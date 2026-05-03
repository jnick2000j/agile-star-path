import { supabase } from "@/integrations/supabase/client";

export type LessonType = "video_upload" | "video_embed" | "document" | "quiz";
export type CourseStatus = "draft" | "published" | "archived";
export type EnrollmentStatus = "not_started" | "in_progress" | "completed" | "failed" | "expired";

export interface LmsCourse {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  category: string | null;
  cover_image_url: string | null;
  est_duration_minutes: number | null;
  passing_score_percent: number;
  issues_certificate: boolean;
  status: CourseStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  min_required_seconds?: number | null;
}

export interface LmsModule {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  position: number;
  min_required_seconds?: number | null;
}

export interface LmsLesson {
  id: string;
  module_id: string;
  course_id: string;
  title: string;
  lesson_type: LessonType;
  position: number;
  storage_path: string | null;
  embed_url: string | null;
  content_md: string | null;
  duration_seconds: number | null;
  passing_score_percent: number | null;
  max_attempts: number | null;
  required: boolean;
  min_required_seconds?: number | null;
}

export interface LmsEnrollment {
  id: string;
  organization_id: string;
  user_id: string;
  course_id: string;
  status: EnrollmentStatus;
  source: "self" | "assigned";
  mandatory: boolean;
  due_at: string | null;
  enrolled_at: string;
  completed_at: string | null;
  progress_percent: number;
  final_score: number | null;
}

export interface LmsCertificate {
  id: string;
  user_id: string;
  course_id: string;
  serial: string;
  issued_at: string;
  final_score: number | null;
}

/** Compute a signed playback / download URL for an lms-content storage path. */
export async function getSignedContentUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("lms-content").createSignedUrl(path, expiresIn);
  if (error) {
    console.error("getSignedContentUrl error", error);
    return null;
  }
  return data?.signedUrl ?? null;
}

/** Upload a learning content file (video/doc) under {org_id}/{course_id}/{filename}. */
export async function uploadLmsContent(orgId: string, courseId: string, file: File): Promise<string | null> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${orgId}/${courseId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage.from("lms-content").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) {
    console.error("uploadLmsContent error", error);
    return null;
  }
  return path;
}

/** Mark a lesson complete and recompute course progress. */
export async function completeLesson(orgId: string, courseId: string, lessonId: string) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return;

  await supabase
    .from("lms_lesson_progress")
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        completed: true,
        completed_at: new Date().toISOString(),
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );

  // Recompute enrollment + maybe issue certificate
  await supabase.rpc("lms_recompute_enrollment", { _course_id: courseId });
}

/** Update watch position without marking complete. */
export async function updateLessonProgress(
  orgId: string,
  courseId: string,
  lessonId: string,
  positionSeconds: number,
) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return;
  await supabase
    .from("lms_lesson_progress")
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        course_id: courseId,
        lesson_id: lessonId,
        position_seconds: Math.floor(positionSeconds),
        last_accessed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,lesson_id" },
    );
}

export async function selfEnroll(orgId: string, courseId: string) {
  const { data: u } = await supabase.auth.getUser();
  const userId = u?.user?.id;
  if (!userId) return null;
  const { data, error } = await supabase
    .from("lms_enrollments")
    .upsert(
      {
        organization_id: orgId,
        user_id: userId,
        course_id: courseId,
        source: "self",
        status: "not_started",
      },
      { onConflict: "user_id,course_id", ignoreDuplicates: true },
    )
    .select()
    .maybeSingle();
  if (error) {
    console.error("selfEnroll error", error);
  }
  return data;
}
