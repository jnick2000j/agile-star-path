// LMS chat commands — backend handler invoked from the Task Master chat UI when
// the user types one of:
//
//   /complete-lesson <lesson title or id>   — mark a lesson complete (and roll up
//                                              course progress + enrollment status)
//   /recommend-courses [topic]              — return personalised course
//                                              recommendations using the user's
//                                              learning context + KB vector store
//
// Both commands are gated on the org's LMS module toggle and the user's RLS.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CommandKind = "complete_lesson" | "recommend_courses";

interface CommandRequest {
  command: CommandKind;
  organization_id: string;
  // For complete_lesson:
  lesson_query?: string;
  course_query?: string;
  // For recommend_courses:
  topic?: string;
  limit?: number;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeIlike(input: string) {
  return input.replace(/[%_]/g, (c) => `\\${c}`);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await client.auth.getClaims(
      token,
    );
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    let body: CommandRequest;
    try {
      body = (await req.json()) as CommandRequest;
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    if (!body.organization_id || typeof body.organization_id !== "string") {
      return jsonResponse({ error: "organization_id is required" }, 400);
    }
    if (!["complete_lesson", "recommend_courses"].includes(body.command)) {
      return jsonResponse({ error: "Unknown command" }, 400);
    }

    // Gate: LMS module must be enabled for this org
    const { data: toggleRow } = await client
      .from("organization_module_toggles")
      .select("enabled")
      .eq("organization_id", body.organization_id)
      .eq("module_key", "lms")
      .maybeSingle();

    if (toggleRow?.enabled !== true) {
      return jsonResponse({
        ok: false,
        markdown:
          "The **Learning** add-on isn't enabled for this workspace. Ask an org admin to enable it under **Admin Panel → Modules**.",
      });
    }

    if (body.command === "complete_lesson") {
      return await handleCompleteLesson(client, userId, body);
    }
    return await handleRecommendCourses(
      client,
      userId,
      body,
      authHeader,
      supabaseUrl,
    );
  } catch (err) {
    console.error("lms-chat-command error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});

// ---------- /complete-lesson ----------

async function handleCompleteLesson(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: CommandRequest,
) {
  const orgId = body.organization_id;
  const lessonQuery = (body.lesson_query ?? "").trim();
  const courseQuery = (body.course_query ?? "").trim();

  if (!lessonQuery) {
    return jsonResponse({
      ok: false,
      markdown:
        "Tell me which lesson to mark complete. Try `/complete-lesson <lesson title>` — you can add the course name too if the title is generic.",
    });
  }

  // Resolve candidate lessons. Match by id, exact title, then fuzzy.
  // Restrict to lessons belonging to courses the user is enrolled in (so RLS-allowed
  // and meaningful — completing a lesson the user isn't enrolled in is a no-op).
  const { data: enrollments } = await client
    .from("lms_enrollments")
    .select("course_id, course:lms_courses(id, title)")
    .eq("user_id", userId)
    .eq("organization_id", orgId);

  const enrolledCourseIds = (enrollments ?? []).map((e: any) => e.course_id);
  if (enrolledCourseIds.length === 0) {
    return jsonResponse({
      ok: false,
      markdown:
        "You don't have any active enrollments yet. Browse the **Catalog** under **Learning** to enroll in a course first.",
    });
  }

  let lessonsQuery = client
    .from("lms_lessons")
    .select("id, title, course_id, module_id, course:lms_courses(id, title, organization_id)")
    .in("course_id", enrolledCourseIds);

  if (UUID_RE.test(lessonQuery)) {
    lessonsQuery = lessonsQuery.eq("id", lessonQuery);
  } else {
    lessonsQuery = lessonsQuery.ilike("title", `%${escapeIlike(lessonQuery)}%`);
  }

  const { data: lessonMatches, error: lmErr } = await lessonsQuery.limit(10);
  if (lmErr) {
    console.error("lessons query failed:", lmErr);
    return jsonResponse({
      ok: false,
      markdown: `Couldn't search lessons: ${lmErr.message}`,
    });
  }

  let candidates = lessonMatches ?? [];

  // If a course hint was provided, narrow further
  if (courseQuery && candidates.length > 1) {
    const cq = courseQuery.toLowerCase();
    const narrowed = candidates.filter((l: any) =>
      (l.course?.title ?? "").toLowerCase().includes(cq) ||
      (UUID_RE.test(courseQuery) && l.course_id === courseQuery)
    );
    if (narrowed.length > 0) candidates = narrowed;
  }

  if (candidates.length === 0) {
    return jsonResponse({
      ok: false,
      markdown:
        `I couldn't find a lesson matching "${lessonQuery}" in any of your enrolled courses. ` +
        `Open **Learning → My Learning** to see your active courses, or include the course name: ` +
        "`/complete-lesson <lesson> in <course>`.",
    });
  }

  if (candidates.length > 1) {
    const list = candidates
      .slice(0, 6)
      .map(
        (l: any, i: number) =>
          `${i + 1}. **${l.title}** — ${l.course?.title ?? "Unknown course"} \`${l.id}\``,
      )
      .join("\n");
    return jsonResponse({
      ok: false,
      markdown:
        `I found multiple lessons matching "${lessonQuery}":\n\n${list}\n\n` +
        "Re-run with the lesson id, e.g. `/complete-lesson <id>`.",
    });
  }

  const lesson: any = candidates[0];

  // Upsert progress as completed
  const nowIso = new Date().toISOString();
  const { error: upErr } = await client
    .from("lms_lesson_progress")
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        lesson_id: lesson.id,
        course_id: lesson.course_id,
        completed: true,
        completed_at: nowIso,
        last_accessed_at: nowIso,
      },
      { onConflict: "user_id,lesson_id" },
    );

  if (upErr) {
    console.error("progress upsert failed:", upErr);
    return jsonResponse({
      ok: false,
      markdown: `Couldn't mark the lesson complete: ${upErr.message}`,
    });
  }

  // Roll up enrollment progress: % of required lessons completed
  const { data: courseLessons } = await client
    .from("lms_lessons")
    .select("id, required")
    .eq("course_id", lesson.course_id);
  const required = (courseLessons ?? []).filter((l: any) => l.required);
  const requiredIds = required.map((l: any) => l.id);

  let progressPercent = 0;
  let allDone = false;
  if (requiredIds.length > 0) {
    const { data: completedRows } = await client
      .from("lms_lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .eq("course_id", lesson.course_id)
      .eq("completed", true)
      .in("lesson_id", requiredIds);
    const completedCount = completedRows?.length ?? 0;
    progressPercent = Math.round((completedCount / requiredIds.length) * 100);
    allDone = completedCount >= requiredIds.length;
  }

  const enrollmentPatch: Record<string, unknown> = {
    progress_percent: progressPercent,
    started_at: nowIso, // safe: only fills if null due to RLS-ignored constraint? we use update
  };
  if (allDone) {
    enrollmentPatch.status = "completed";
    enrollmentPatch.completed_at = nowIso;
  } else {
    enrollmentPatch.status = "in_progress";
  }
  // Don't overwrite started_at if already set — fetch first
  const { data: enrollRow } = await client
    .from("lms_enrollments")
    .select("id, started_at")
    .eq("user_id", userId)
    .eq("course_id", lesson.course_id)
    .maybeSingle();

  if (enrollRow) {
    if (enrollRow.started_at) delete enrollmentPatch.started_at;
    await client
      .from("lms_enrollments")
      .update(enrollmentPatch)
      .eq("id", enrollRow.id);
  }

  const courseTitle = lesson.course?.title ?? "your course";
  const summaryLines = [
    `✅ Marked **${lesson.title}** complete in *${courseTitle}*.`,
    `Course progress is now **${progressPercent}%**.`,
  ];
  if (allDone) {
    summaryLines.push(
      "🎉 All required lessons are done — your enrollment is marked **completed** and a certificate will be issued if the course is configured for one.",
    );
  } else {
    summaryLines.push(
      `[Open the course](/learning/courses/${lesson.course_id}) to continue.`,
    );
  }

  return jsonResponse({
    ok: true,
    markdown: summaryLines.join("\n\n"),
    data: {
      lesson_id: lesson.id,
      course_id: lesson.course_id,
      progress_percent: progressPercent,
      completed: allDone,
    },
  });
}

// ---------- /recommend-courses ----------

async function handleRecommendCourses(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: CommandRequest,
  authHeader: string,
  supabaseUrl: string,
) {
  const orgId = body.organization_id;
  const limit = Math.max(1, Math.min(body.limit ?? 5, 10));
  const topicHint = (body.topic ?? "").trim();

  // Pull the user's training context to personalise the query
  const [enrollments, assignments, certs] = await Promise.all([
    client
      .from("lms_enrollments")
      .select(
        "status, progress_percent, course:lms_courses(id, title, category, description)",
      )
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .order("enrolled_at", { ascending: false })
      .limit(20),
    client
      .from("lms_assignments")
      .select("course:lms_courses(id, title, category)")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .limit(20),
    client
      .from("lms_certificates")
      .select("course:lms_courses(id, title, category)")
      .eq("user_id", userId)
      .eq("organization_id", orgId)
      .order("issued_at", { ascending: false })
      .limit(10),
  ]);

  const completedTitles = new Set<string>();
  const inProgressTitles = new Set<string>();
  const categories = new Set<string>();
  const knownCourseIds = new Set<string>();

  for (const e of enrollments.data ?? []) {
    const c: any = (e as any).course;
    if (!c) continue;
    knownCourseIds.add(c.id);
    if (c.category) categories.add(c.category);
    if (e.status === "completed") completedTitles.add(c.title);
    else inProgressTitles.add(c.title);
  }
  for (const c of (certs.data ?? []).map((r: any) => r.course).filter(Boolean)) {
    completedTitles.add((c as any).title);
    knownCourseIds.add((c as any).id);
  }
  for (const a of (assignments.data ?? []).map((r: any) => r.course).filter(
    Boolean,
  )) {
    knownCourseIds.add((a as any).id);
    if ((a as any).category) categories.add((a as any).category);
  }

  // Build a search query that biases toward unfinished or related learning
  const queryBits: string[] = [];
  if (topicHint) queryBits.push(topicHint);
  if (categories.size > 0)
    queryBits.push(`Topics: ${Array.from(categories).slice(0, 5).join(", ")}.`);
  if (inProgressTitles.size > 0)
    queryBits.push(
      `Currently learning: ${Array.from(inProgressTitles).slice(0, 4).join(", ")}.`,
    );
  if (completedTitles.size > 0)
    queryBits.push(
      `Already completed: ${Array.from(completedTitles).slice(0, 4).join(", ")}.`,
    );
  if (queryBits.length === 0)
    queryBits.push("Recommended training for this user.");

  const searchQuery = queryBits.join(" ");

  // Use kb-search (which already unions KB + LMS chunks) to find relevant courses
  let searchHits: any[] = [];
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/kb-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        query: searchQuery,
        organization_id: orgId,
        match_count: 25,
      }),
    });
    if (resp.ok) {
      const json = await resp.json();
      searchHits = Array.isArray(json?.articles) ? json.articles : [];
    } else {
      console.warn("kb-search non-200:", resp.status);
    }
  } catch (e) {
    console.warn("kb-search call failed:", e);
  }

  // Filter to LMS hits, dedupe, drop already-known courses, fall back to catalog
  const recommendedCourseIds: string[] = [];
  const seen = new Set<string>();
  for (const hit of searchHits) {
    if (hit?.source !== "lms") continue;
    const id: string | undefined = hit.id;
    if (!id || seen.has(id) || knownCourseIds.has(id)) continue;
    seen.add(id);
    recommendedCourseIds.push(id);
    if (recommendedCourseIds.length >= limit) break;
  }

  // Fall back: top courses in user's interest categories not already taken
  if (recommendedCourseIds.length < limit) {
    let fallbackQ = client
      .from("lms_courses")
      .select("id, title, category, description, status")
      .eq("organization_id", orgId)
      .eq("status", "published");
    if (categories.size > 0)
      fallbackQ = fallbackQ.in("category", Array.from(categories));
    const { data: fallback } = await fallbackQ.limit(20);
    for (const c of fallback ?? []) {
      if (knownCourseIds.has(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);
      recommendedCourseIds.push(c.id);
      if (recommendedCourseIds.length >= limit) break;
    }
  }

  // Final fallback: any published course in the org not already known
  if (recommendedCourseIds.length < limit) {
    const { data: anyCourses } = await client
      .from("lms_courses")
      .select("id, title, category, description, status")
      .eq("organization_id", orgId)
      .eq("status", "published")
      .limit(20);
    for (const c of anyCourses ?? []) {
      if (knownCourseIds.has(c.id) || seen.has(c.id)) continue;
      seen.add(c.id);
      recommendedCourseIds.push(c.id);
      if (recommendedCourseIds.length >= limit) break;
    }
  }

  if (recommendedCourseIds.length === 0) {
    return jsonResponse({
      ok: true,
      markdown:
        "I couldn't find any new courses to recommend right now — you may already be enrolled in everything published, or no courses match your topics yet. Browse **Learning → Catalog** to explore.",
      data: { recommendations: [] },
    });
  }

  // Hydrate course details (in_, preserves order)
  const { data: courses } = await client
    .from("lms_courses")
    .select("id, title, description, category")
    .in("id", recommendedCourseIds);
  const byId = new Map<string, any>();
  for (const c of courses ?? []) byId.set(c.id, c);

  const lines: string[] = [
    "🎯 **Recommended training based on your context**",
    "",
  ];
  if (topicHint) lines.push(`_Topic focus: ${topicHint}_`, "");

  let n = 1;
  const rec: any[] = [];
  for (const id of recommendedCourseIds) {
    const c = byId.get(id);
    if (!c) continue;
    const desc = c.description
      ? ` — ${String(c.description).slice(0, 160)}${
        String(c.description).length > 160 ? "…" : ""
      }`
      : "";
    const cat = c.category ? ` *(${c.category})*` : "";
    lines.push(`${n}. [**${c.title}**](/learning/courses/${c.id})${cat}${desc}`);
    rec.push({ id: c.id, title: c.title, category: c.category });
    n++;
  }
  lines.push(
    "",
    "Open one to enroll, or run `/recommend-courses <topic>` to refocus the suggestions.",
  );

  return jsonResponse({
    ok: true,
    markdown: lines.join("\n"),
    data: { recommendations: rec },
  });
}
