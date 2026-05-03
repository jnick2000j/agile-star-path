import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";
import type { LessonType, CourseStatus } from "@/lib/lms";

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface ImportLesson {
  title: string;
  lesson_type: LessonType;
  position?: number;
  embed_url?: string | null;
  content_md?: string | null;
  /** Path inside the ZIP to a media/document file (uploaded to lms-content). */
  file_path?: string | null;
  required?: boolean;
  min_required_seconds?: number | null;
  duration_seconds?: number | null;
  passing_score_percent?: number | null;
}

export interface ImportModule {
  title: string;
  description?: string | null;
  position?: number;
  min_required_seconds?: number | null;
  lessons: ImportLesson[];
}

export interface ImportCourse {
  title: string;
  description?: string | null;
  category?: string | null;
  status?: CourseStatus;
  est_duration_minutes?: number | null;
  passing_score_percent?: number | null;
  min_required_seconds?: number | null;
  modules: ImportModule[];
}

export interface ImportManifest {
  courses: ImportCourse[];
}

export interface ImportSource {
  manifest: ImportManifest;
  /** Asset blobs keyed by file_path (only present for ZIP uploads). */
  assets: Map<string, Blob>;
}

export interface ImportResult {
  createdCourses: number;
  createdModules: number;
  createdLessons: number;
  uploadedAssets: number;
  errors: string[];
}

const VALID_LESSON_TYPES: LessonType[] = ["video_upload", "video_embed", "document", "quiz"];

/* -------------------------------------------------------------------------- */
/*  Parsing                                                                   */
/* -------------------------------------------------------------------------- */

/** Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas, doubled quotes). */
export function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n" || c === "\r") {
        if (c === "\r" && text[i + 1] === "\n") i++;
        row.push(field); field = "";
        if (row.some((v) => v.length > 0)) rows.push(row);
        row = [];
      } else {
        field += c;
      }
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((v) => v.length > 0)) rows.push(row);
  }
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
}

const toIntOrNull = (v: string | undefined | null): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
};
const toBool = (v: string | undefined | null, defaultVal = true): boolean => {
  if (v == null || v === "") return defaultVal;
  return ["true", "yes", "y", "1"].includes(String(v).toLowerCase());
};

/** Convert flat CSV rows (one row per lesson) into the nested manifest shape. */
export function csvRowsToManifest(rows: Record<string, string>[]): ImportManifest {
  const courses = new Map<string, ImportCourse>();
  rows.forEach((r) => {
    const courseTitle = (r.course_title || r.course || "").trim();
    if (!courseTitle) return;
    let course = courses.get(courseTitle);
    if (!course) {
      course = {
        title: courseTitle,
        description: r.course_description || null,
        category: r.course_category || null,
        status: (r.course_status as CourseStatus) || "draft",
        est_duration_minutes: toIntOrNull(r.course_est_duration_minutes),
        passing_score_percent: toIntOrNull(r.course_passing_score_percent),
        min_required_seconds: toIntOrNull(r.course_min_required_seconds),
        modules: [],
      };
      courses.set(courseTitle, course);
    }

    const moduleTitle = (r.module_title || r.module || "Module 1").trim();
    let mod = course.modules.find((m) => m.title === moduleTitle);
    if (!mod) {
      mod = {
        title: moduleTitle,
        description: r.module_description || null,
        min_required_seconds: toIntOrNull(r.module_min_required_seconds),
        lessons: [],
      };
      course.modules.push(mod);
    }

    const lessonTitle = (r.lesson_title || r.lesson || "").trim();
    if (!lessonTitle) return;
    const ltype = (r.lesson_type || "document").trim() as LessonType;
    if (!VALID_LESSON_TYPES.includes(ltype)) {
      throw new Error(`Invalid lesson_type "${ltype}" for lesson "${lessonTitle}"`);
    }
    mod.lessons.push({
      title: lessonTitle,
      lesson_type: ltype,
      embed_url: r.embed_url || null,
      content_md: r.content_md || null,
      file_path: r.file_path || null,
      required: toBool(r.required, true),
      min_required_seconds: toIntOrNull(r.min_required_seconds),
      duration_seconds: toIntOrNull(r.duration_seconds),
      passing_score_percent: toIntOrNull(r.passing_score_percent),
    });
  });
  return { courses: Array.from(courses.values()) };
}

/** Validate / normalise a JSON manifest, accepting either { courses: [...] } or [...]. */
export function normalizeJsonManifest(raw: any): ImportManifest {
  const courses = Array.isArray(raw) ? raw : raw?.courses;
  if (!Array.isArray(courses)) throw new Error("Manifest JSON must contain a 'courses' array");
  const out: ImportCourse[] = courses.map((c: any, ci: number) => {
    if (!c?.title) throw new Error(`Course at index ${ci} is missing a title`);
    const modules = Array.isArray(c.modules) ? c.modules : [];
    return {
      title: String(c.title),
      description: c.description ?? null,
      category: c.category ?? null,
      status: (c.status as CourseStatus) ?? "draft",
      est_duration_minutes: c.est_duration_minutes ?? null,
      passing_score_percent: c.passing_score_percent ?? null,
      min_required_seconds: c.min_required_seconds ?? null,
      modules: modules.map((m: any, mi: number) => {
        if (!m?.title) throw new Error(`Module ${mi} of "${c.title}" is missing a title`);
        const lessons = Array.isArray(m.lessons) ? m.lessons : [];
        return {
          title: String(m.title),
          description: m.description ?? null,
          min_required_seconds: m.min_required_seconds ?? null,
          lessons: lessons.map((l: any, li: number) => {
            if (!l?.title) throw new Error(`Lesson ${li} of module "${m.title}" is missing a title`);
            const ltype = (l.lesson_type ?? "document") as LessonType;
            if (!VALID_LESSON_TYPES.includes(ltype)) {
              throw new Error(`Invalid lesson_type "${ltype}" in lesson "${l.title}"`);
            }
            return {
              title: String(l.title),
              lesson_type: ltype,
              embed_url: l.embed_url ?? null,
              content_md: l.content_md ?? null,
              file_path: l.file_path ?? null,
              required: l.required ?? true,
              min_required_seconds: l.min_required_seconds ?? null,
              duration_seconds: l.duration_seconds ?? null,
              passing_score_percent: l.passing_score_percent ?? null,
            };
          }),
        };
      }),
    };
  });
  return { courses: out };
}

/** Parse any supported upload (single .csv, .json, or .zip) into an ImportSource. */
export async function parseUpload(file: File): Promise<ImportSource> {
  const name = file.name.toLowerCase();
  const assets = new Map<string, Blob>();

  if (name.endsWith(".csv")) {
    const text = await file.text();
    return { manifest: csvRowsToManifest(parseCSV(text)), assets };
  }
  if (name.endsWith(".json")) {
    const text = await file.text();
    return { manifest: normalizeJsonManifest(JSON.parse(text)), assets };
  }
  if (name.endsWith(".zip")) {
    const zip = await JSZip.loadAsync(file);
    let manifestFile: JSZip.JSZipObject | null = null;
    let manifestKind: "csv" | "json" | null = null;
    zip.forEach((path, entry) => {
      if (entry.dir) return;
      const lower = path.toLowerCase();
      if (lower.endsWith("manifest.csv") && !manifestFile) { manifestFile = entry; manifestKind = "csv"; }
      else if (lower.endsWith("manifest.json") && !manifestFile) { manifestFile = entry; manifestKind = "json"; }
    });
    if (!manifestFile) throw new Error("ZIP must contain a manifest.csv or manifest.json at the root or inside a single folder");

    const manifestText = await (manifestFile as JSZip.JSZipObject).async("string");
    const manifest = manifestKind === "csv"
      ? csvRowsToManifest(parseCSV(manifestText))
      : normalizeJsonManifest(JSON.parse(manifestText));

    // Collect referenced file_paths so we only buffer what we'll actually upload
    const referenced = new Set<string>();
    manifest.courses.forEach((c) => c.modules.forEach((m) => m.lessons.forEach((l) => {
      if (l.file_path) referenced.add(l.file_path);
    })));

    for (const ref of referenced) {
      // Allow paths to be relative to the manifest's folder OR the zip root
      const tryPaths = [ref, ref.replace(/^\.?\//, "")];
      let entry: JSZip.JSZipObject | null = null;
      for (const candidate of tryPaths) {
        entry = zip.file(candidate) ?? null;
        if (entry) break;
        // Also try matching by suffix inside any folder
        const matches = zip.file(new RegExp(candidate.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
        if (matches.length > 0) { entry = matches[0]; break; }
      }
      if (!entry) throw new Error(`File referenced by manifest not found in ZIP: ${ref}`);
      const blob = await entry.async("blob");
      assets.set(ref, blob);
    }

    return { manifest, assets };
  }

  throw new Error("Unsupported file type. Upload a .csv, .json, or .zip file.");
}

/* -------------------------------------------------------------------------- */
/*  Import execution                                                          */
/* -------------------------------------------------------------------------- */

export interface ImportContext {
  organizationId: string;
  userId: string;
  onProgress?: (current: number, total: number, message: string) => void;
}

export async function runImport(source: ImportSource, ctx: ImportContext): Promise<ImportResult> {
  const result: ImportResult = {
    createdCourses: 0,
    createdModules: 0,
    createdLessons: 0,
    uploadedAssets: 0,
    errors: [],
  };

  const totalUnits = source.manifest.courses.reduce((sum, c) =>
    sum + 1 + c.modules.length + c.modules.reduce((s, m) => s + m.lessons.length, 0), 0);
  let done = 0;
  const tick = (msg: string) => {
    done++;
    ctx.onProgress?.(done, totalUnits, msg);
  };

  for (const course of source.manifest.courses) {
    try {
      const { data: cRow, error: cErr } = await supabase
        .from("lms_courses")
        .insert({
          organization_id: ctx.organizationId,
          created_by: ctx.userId,
          title: course.title,
          description: course.description ?? null,
          category: course.category ?? null,
          status: course.status ?? "draft",
          est_duration_minutes: course.est_duration_minutes ?? null,
          passing_score_percent: course.passing_score_percent ?? 80,
          min_required_seconds: course.min_required_seconds ?? null,
        } as any)
        .select("id")
        .single();
      if (cErr || !cRow) throw cErr ?? new Error("Failed to create course");
      result.createdCourses++;
      tick(`Created course: ${course.title}`);
      const courseId = cRow.id;

      let modulePos = 0;
      for (const mod of course.modules) {
        const { data: mRow, error: mErr } = await supabase
          .from("lms_modules")
          .insert({
            course_id: courseId,
            title: mod.title,
            description: mod.description ?? null,
            position: modulePos++,
            min_required_seconds: mod.min_required_seconds ?? null,
          } as any)
          .select("id")
          .single();
        if (mErr || !mRow) throw mErr ?? new Error(`Failed to create module ${mod.title}`);
        result.createdModules++;
        tick(`Created module: ${mod.title}`);
        const moduleId = mRow.id;

        let lessonPos = 0;
        for (const lesson of mod.lessons) {
          let storage_path: string | null = null;
          if (lesson.file_path) {
            const blob = source.assets.get(lesson.file_path);
            if (!blob) {
              result.errors.push(`Asset missing for lesson "${lesson.title}": ${lesson.file_path}`);
            } else {
              const safeName = lesson.file_path.split("/").pop()!.replace(/[^a-zA-Z0-9._-]/g, "_");
              const path = `${ctx.organizationId}/${courseId}/${Date.now()}_${safeName}`;
              const { error: upErr } = await supabase.storage
                .from("lms-content")
                .upload(path, blob, { cacheControl: "3600", upsert: false });
              if (upErr) {
                result.errors.push(`Upload failed for "${lesson.title}": ${upErr.message}`);
              } else {
                storage_path = path;
                result.uploadedAssets++;
              }
            }
          }

          const { error: lErr } = await supabase.from("lms_lessons").insert({
            course_id: courseId,
            module_id: moduleId,
            title: lesson.title,
            lesson_type: lesson.lesson_type,
            position: lessonPos++,
            required: lesson.required ?? true,
            embed_url: lesson.lesson_type === "video_embed" ? (lesson.embed_url ?? null) : null,
            content_md: lesson.lesson_type === "document" ? (lesson.content_md ?? null) : null,
            storage_path,
            duration_seconds: lesson.duration_seconds ?? null,
            passing_score_percent: lesson.passing_score_percent ?? null,
            min_required_seconds: lesson.min_required_seconds ?? null,
          } as any);
          if (lErr) {
            result.errors.push(`Lesson "${lesson.title}" failed: ${lErr.message}`);
          } else {
            result.createdLessons++;
          }
          tick(`Added lesson: ${lesson.title}`);
        }
      }
    } catch (e: any) {
      result.errors.push(`Course "${course.title}" failed: ${e?.message ?? String(e)}`);
    }
  }

  return result;
}

/* -------------------------------------------------------------------------- */
/*  Sample / template downloads                                               */
/* -------------------------------------------------------------------------- */

export const SAMPLE_CSV = `course_title,course_description,course_category,course_status,course_min_required_seconds,module_title,module_min_required_seconds,lesson_title,lesson_type,embed_url,content_md,file_path,required,min_required_seconds
Intro to PRINCE2,Foundational PRINCE2 overview,Methodology,draft,1800,Module 1 - Principles,600,What is PRINCE2,video_embed,https://www.youtube.com/watch?v=dQw4w9WgXcQ,,,true,300
Intro to PRINCE2,,,,,Module 1 - Principles,,Reading - 7 Principles,document,,"# The 7 Principles\\n\\nContinued business justification, learn from experience...",,true,180
Intro to PRINCE2,,,,,Module 2 - Themes,,Themes overview,document,,"# Themes\\n\\nBusiness Case, Organization, Quality...",,true,180
`;

export const SAMPLE_JSON = JSON.stringify({
  courses: [
    {
      title: "Intro to PRINCE2",
      description: "Foundational PRINCE2 overview",
      category: "Methodology",
      status: "draft",
      min_required_seconds: 1800,
      modules: [
        {
          title: "Module 1 - Principles",
          min_required_seconds: 600,
          lessons: [
            {
              title: "What is PRINCE2",
              lesson_type: "video_embed",
              embed_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
              required: true,
              min_required_seconds: 300,
            },
            {
              title: "Reading - 7 Principles",
              lesson_type: "document",
              content_md: "# The 7 Principles\n\nContinued business justification, learn from experience...",
              required: true,
              min_required_seconds: 180,
            },
          ],
        },
        {
          title: "Module 2 - Themes",
          lessons: [
            {
              title: "Themes overview slides",
              lesson_type: "document",
              file_path: "assets/themes-overview.pdf",
              required: true,
            },
          ],
        },
      ],
    },
  ],
}, null, 2);

export function downloadText(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
