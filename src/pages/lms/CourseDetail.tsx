import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { CheckCircle2, Circle, FileText, Video, HelpCircle, ArrowLeft, Play, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import {
  completeLesson,
  getSignedContentUrl,
  selfEnroll,
  updateLessonProgress,
  type LmsCourse,
  type LmsLesson,
  type LmsModule,
} from "@/lib/lms";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import { QuizPlayer } from "@/components/lms/QuizPlayer";
import { downloadCertificate } from "@/lib/certificate";

export default function CourseDetail() {
  const { id: courseId } = useParams<{ id: string }>();
  const { user, userProfile } = useAuth();
  const { currentOrganization } = useOrganization();
  const [course, setCourse] = useState<LmsCourse | null>(null);
  const [modules, setModules] = useState<LmsModule[]>([]);
  const [lessons, setLessons] = useState<LmsLesson[]>([]);
  const [progress, setProgress] = useState<Record<string, { completed: boolean; position_seconds: number; watch_seconds: number }>>({});
  const [enrollment, setEnrollment] = useState<any | null>(null);
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!courseId || !user) return;
    const [c, mods, less, enr, prog] = await Promise.all([
      supabase.from("lms_courses").select("*").eq("id", courseId).maybeSingle(),
      supabase.from("lms_modules").select("*").eq("course_id", courseId).order("position"),
      supabase.from("lms_lessons").select("*").eq("course_id", courseId).order("position"),
      supabase.from("lms_enrollments").select("*").eq("course_id", courseId).eq("user_id", user.id).maybeSingle(),
      supabase.from("lms_lesson_progress").select("lesson_id,completed,position_seconds,watch_seconds").eq("course_id", courseId).eq("user_id", user.id),
    ]);
    setCourse(c.data as LmsCourse | null);
    setModules((mods.data ?? []) as LmsModule[]);
    setLessons((less.data ?? []) as LmsLesson[]);
    setEnrollment(enr.data);
    const pmap: Record<string, { completed: boolean; position_seconds: number; watch_seconds: number }> = {};
    (prog.data ?? []).forEach((p: any) => {
      pmap[p.lesson_id] = {
        completed: p.completed,
        position_seconds: p.position_seconds ?? 0,
        watch_seconds: p.watch_seconds ?? 0,
      };
    });
    setProgress(pmap);
  }, [courseId, user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await reload();
      setLoading(false);
    })();
  }, [reload]);

  // Pick the first incomplete lesson by default
  useEffect(() => {
    if (!activeLessonId && lessons.length > 0) {
      const next = lessons.find((l) => !progress[l.id]?.completed) ?? lessons[0];
      setActiveLessonId(next.id);
    }
  }, [lessons, progress, activeLessonId]);

  const activeLesson = useMemo(() => lessons.find((l) => l.id === activeLessonId) ?? null, [lessons, activeLessonId]);

  const totalLessons = lessons.filter((l) => l.required).length;
  const completedLessons = lessons.filter((l) => l.required && progress[l.id]?.completed).length;
  const computedPct = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);

  const handleEnroll = async () => {
    if (!currentOrganization?.id || !courseId) return;
    await selfEnroll(currentOrganization.id, courseId);
    toast.success("Enrolled");
    await reload();
  };

  const handleLessonCompleted = async () => {
    if (!currentOrganization?.id || !courseId || !activeLesson) return;

    // Enforce module-level minimum across the active lesson's module
    const moduleLessons = lessons.filter((l) => l.module_id === activeLesson.module_id);
    const moduleObj = modules.find((m) => m.id === activeLesson.module_id);
    if (moduleObj?.min_required_seconds) {
      const moduleWatch = moduleLessons.reduce((sum, l) => {
        const w = progress[l.id]?.watch_seconds ?? 0;
        // include the just-finished lesson's required minimum so completing the
        // last lesson of a module doesn't fall short by a few seconds
        return sum + (l.id === activeLesson.id ? Math.max(w, activeLesson.min_required_seconds ?? 0) : w);
      }, 0);
      if (moduleWatch < moduleObj.min_required_seconds) {
        const remaining = Math.ceil((moduleObj.min_required_seconds - moduleWatch) / 60);
        toast.error(`Spend at least ${remaining} more minute(s) on this module before completing this lesson.`);
        return;
      }
    }

    // Enforce course-wide minimum if completing this lesson would finish all required lessons
    if (course?.min_required_seconds) {
      const wouldFinishCourse = lessons
        .filter((l) => l.required && l.id !== activeLesson.id)
        .every((l) => progress[l.id]?.completed);
      if (wouldFinishCourse && activeLesson.required) {
        const totalWatch = lessons.reduce((sum, l) => {
          const w = progress[l.id]?.watch_seconds ?? 0;
          return sum + (l.id === activeLesson.id ? Math.max(w, activeLesson.min_required_seconds ?? 0) : w);
        }, 0);
        if (totalWatch < course.min_required_seconds) {
          const remaining = Math.ceil((course.min_required_seconds - totalWatch) / 60);
          toast.error(`Spend at least ${remaining} more minute(s) on this course before finishing.`);
          return;
        }
      }
    }

    const result = await completeLesson(
      currentOrganization.id,
      courseId,
      activeLesson.id,
      activeLesson.min_required_seconds,
    );
    if (!result.ok) {
      if (result.reason === "min_time_not_met") {
        const remaining = Math.ceil(((result.required ?? 0) - (result.watched ?? 0)) / 60);
        toast.error(`Spend at least ${remaining} more minute(s) on this lesson before completing.`);
      } else {
        toast.error(result.reason ?? "Could not complete lesson");
      }
      return;
    }
    toast.success("Lesson complete");
    // Auto-advance
    const idx = lessons.findIndex((l) => l.id === activeLesson.id);
    const next = lessons[idx + 1];
    await reload();
    if (next) setActiveLessonId(next.id);
  };

  if (loading) {
    return (
      <AppLayout title="Course" subtitle="Loading…">
        <Skeleton className="h-64" />
      </AppLayout>
    );
  }
  if (!course) {
    return (
      <AppLayout title="Course not found">
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">This course is unavailable.</p>
            <Button asChild>
              <Link to="/learning">Back to catalog</Link>
            </Button>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const isCompleted = enrollment?.status === "completed";

  return (
    <AppLayout title={course.title} subtitle={course.description ?? undefined}>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link to="/learning">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to catalog
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {/* Player */}
            <Card>
              <CardContent className="p-4">
                {!enrollment ? (
                  <div className="text-center py-12 space-y-3">
                    <p className="text-muted-foreground">Enroll to start this course</p>
                    <Button onClick={handleEnroll}>Enroll</Button>
                  </div>
                ) : !activeLesson ? (
                  <div className="text-center py-12 text-muted-foreground">No lessons available yet.</div>
                ) : (
                  <LessonPlayer
                    lesson={activeLesson}
                    course={course}
                    completed={!!progress[activeLesson.id]?.completed}
                    initialPosition={progress[activeLesson.id]?.position_seconds ?? 0}
                    watchedSeconds={progress[activeLesson.id]?.watch_seconds ?? 0}
                    onCompleted={handleLessonCompleted}
                    onProgress={(secs, deltaWatch) => {
                      if (currentOrganization?.id) {
                        updateLessonProgress(currentOrganization.id, course.id, activeLesson.id, secs, deltaWatch);
                        if (deltaWatch && deltaWatch > 0) {
                          setProgress((p) => ({
                            ...p,
                            [activeLesson.id]: {
                              completed: p[activeLesson.id]?.completed ?? false,
                              position_seconds: secs,
                              watch_seconds: (p[activeLesson.id]?.watch_seconds ?? 0) + deltaWatch,
                            },
                          }));
                        }
                      }
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar: progress + curriculum */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>{completedLessons} / {totalLessons} lessons</span>
                  <span>{computedPct}%</span>
                </div>
                <Progress value={computedPct} className="h-2" />
                {isCompleted && <Badge className="mt-2">Completed</Badge>}
                {course.passing_score_percent && (
                  <p className="text-xs text-muted-foreground">
                    Passing score: {course.passing_score_percent}%
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Curriculum</CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3">
                <Accordion type="multiple" defaultValue={modules.map((m) => m.id)}>
                  {modules.map((m) => {
                    const modLessons = lessons.filter((l) => l.module_id === m.id);
                    return (
                      <AccordionItem key={m.id} value={m.id} className="border-b last:border-b-0">
                        <AccordionTrigger className="text-sm px-2">{m.title}</AccordionTrigger>
                        <AccordionContent className="pb-1">
                          <ul className="space-y-0.5">
                            {modLessons.map((l) => (
                              <li key={l.id}>
                                <button
                                  onClick={() => enrollment && setActiveLessonId(l.id)}
                                  disabled={!enrollment}
                                  className={`w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent flex items-center gap-2 ${
                                    activeLessonId === l.id ? "bg-accent font-medium" : ""
                                  } ${!enrollment ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                  {progress[l.id]?.completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                                  )}
                                  <LessonIcon type={l.lesson_type} />
                                  <span className="truncate flex-1">{l.title}</span>
                                </button>
                              </li>
                            ))}
                            {modLessons.length === 0 && (
                              <li className="text-xs text-muted-foreground px-2 py-1">No lessons yet.</li>
                            )}
                          </ul>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                  {modules.length === 0 && (
                    <p className="text-sm text-muted-foreground px-2 py-3">No content yet.</p>
                  )}
                </Accordion>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function LessonIcon({ type }: { type: LmsLesson["lesson_type"] }) {
  if (type === "quiz") return <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />;
  if (type === "document") return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Video className="h-3.5 w-3.5 text-muted-foreground" />;
}

function LessonPlayer({
  lesson,
  course,
  completed,
  initialPosition,
  watchedSeconds,
  onCompleted,
  onProgress,
}: {
  lesson: LmsLesson;
  course: LmsCourse;
  completed: boolean;
  initialPosition: number;
  watchedSeconds: number;
  onCompleted: () => void;
  onProgress: (seconds: number, deltaWatchSeconds: number) => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  // For non-video lessons, accumulate dwell time client-side and report a delta
  // every ~10s so the watch_seconds counter reflects time spent on the page.
  const [localWatch, setLocalWatch] = useState(0);

  useEffect(() => {
    setSignedUrl(null);
    setLocalWatch(0);
    if (lesson.lesson_type === "video_upload" && lesson.storage_path) {
      getSignedContentUrl(lesson.storage_path).then(setSignedUrl);
    } else if (lesson.lesson_type === "document" && lesson.storage_path) {
      getSignedContentUrl(lesson.storage_path).then(setSignedUrl);
    }
  }, [lesson.id, lesson.storage_path, lesson.lesson_type]);

  // Dwell-time ticker for non-uploaded-video lessons (embed / document / quiz).
  useEffect(() => {
    if (completed) return;
    if (lesson.lesson_type === "video_upload") return; // tracked via timeupdate
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setLocalWatch((w) => {
        const next = w + 10;
        onProgress(0, 10);
        return next;
      });
    }, 10000);
    return () => window.clearInterval(id);
  }, [lesson.id, lesson.lesson_type, completed, onProgress]);

  const minSecs = lesson.min_required_seconds ?? 0;
  const effectiveWatched = watchedSeconds + localWatch;
  const minMet = !minSecs || effectiveWatched >= minSecs;
  const minRemainingMin = minSecs ? Math.max(0, Math.ceil((minSecs - effectiveWatched) / 60)) : 0;

  // Track per-tick deltas for uploaded-video timeupdate events
  const handleVideoTick = (currentTime: number, prevTime: number) => {
    const delta = Math.max(0, Math.floor(currentTime - prevTime));
    if (delta > 0 && delta < 60) onProgress(currentTime, delta);
    else onProgress(currentTime, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{lesson.title}</h2>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground capitalize">
            <Badge variant="outline">{lesson.lesson_type.replace("_", " ")}</Badge>
            {lesson.duration_seconds && <span>{Math.round(lesson.duration_seconds / 60)} min</span>}
            {minSecs > 0 && (
              <span className="normal-case">
                Min time: {Math.round(minSecs / 60)} min
                {!completed && !minMet && ` · ${minRemainingMin} min remaining`}
              </span>
            )}
          </div>
        </div>
        {completed && <Badge>Completed</Badge>}
      </div>

      {lesson.lesson_type === "video_upload" && (
        <div className="aspect-video bg-muted rounded-md overflow-hidden">
          {signedUrl ? (
            <VideoTracker
              key={lesson.id}
              src={signedUrl}
              initialPosition={initialPosition}
              onTick={handleVideoTick}
              onEnded={() => { if (minMet) onCompleted(); }}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
              <Play className="h-5 w-5 mr-2" /> Loading video…
            </div>
          )}
        </div>
      )}

      {lesson.lesson_type === "video_embed" && lesson.embed_url && (
        <div className="aspect-video bg-muted rounded-md overflow-hidden">
          <iframe
            key={lesson.id}
            src={toEmbedUrl(lesson.embed_url)}
            title={lesson.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {lesson.lesson_type === "document" && (
        <div className="space-y-3">
          {lesson.content_md && (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{lesson.content_md}</ReactMarkdown>
            </div>
          )}
          {signedUrl && (
            <Button asChild variant="outline">
              <a href={signedUrl} target="_blank" rel="noreferrer">
                <FileText className="h-4 w-4 mr-2" /> Open document
              </a>
            </Button>
          )}
        </div>
      )}

      {lesson.lesson_type === "quiz" && (
        <QuizPlayer
          lessonId={lesson.id}
          passingScore={lesson.passing_score_percent ?? course.passing_score_percent}
          onPassed={onCompleted}
        />
      )}

      {lesson.lesson_type !== "quiz" && !completed && (
        <div className="flex justify-end items-center gap-3">
          {minSecs > 0 && !minMet && (
            <span className="text-xs text-muted-foreground">
              {minRemainingMin} min of required time remaining
            </span>
          )}
          <Button onClick={onCompleted} disabled={!minMet}>Mark complete & continue</Button>
        </div>
      )}
    </div>
  );
}

function VideoTracker({
  src, initialPosition, onTick, onEnded,
}: {
  src: string;
  initialPosition: number;
  onTick: (currentTime: number, prevTime: number) => void;
  onEnded: () => void;
}) {
  const [prev, setPrev] = useState(initialPosition);
  return (
    <video
      src={src}
      controls
      className="w-full h-full"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        if (initialPosition && initialPosition < v.duration - 5) v.currentTime = initialPosition;
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (Math.floor(v.currentTime) % 5 === 0 && Math.floor(v.currentTime) !== Math.floor(prev)) {
          onTick(v.currentTime, prev);
          setPrev(v.currentTime);
        }
      }}
      onEnded={onEnded}
    />
  );
}

function toEmbedUrl(url: string): string {
  // YouTube watch → embed
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  // Vimeo
  const vm = url.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  // Loom share → embed
  const lm = url.match(/loom\.com\/share\/([\w]+)/);
  if (lm) return `https://www.loom.com/embed/${lm[1]}`;
  return url;
}
