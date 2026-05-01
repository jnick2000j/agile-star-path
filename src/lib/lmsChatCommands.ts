import { supabase } from "@/integrations/supabase/client";

export type LmsChatCommandKind = "complete_lesson" | "recommend_courses";

export interface LmsChatCommandResult {
  /** True if recognised as an LMS command (regardless of execution success). */
  handled: boolean;
  /** Markdown to render as the assistant's reply. */
  markdown?: string;
  /** Structured data echoed back from the backend (optional). */
  data?: unknown;
  /** True when the backend executed the action successfully. */
  ok?: boolean;
}

interface ParsedCommand {
  kind: LmsChatCommandKind;
  // For complete_lesson:
  lesson_query?: string;
  course_query?: string;
  // For recommend_courses:
  topic?: string;
}

/**
 * Parse leading slash-style LMS commands. Examples:
 *   /complete-lesson Risk basics
 *   /complete-lesson Risk basics in PRINCE2 Foundation
 *   /complete-lesson <uuid>
 *   /lesson-complete Risk basics                       (alias)
 *   /recommend-courses
 *   /recommend-courses change management               (with topic)
 *   /retrain                                           (alias)
 */
export function parseLmsCommand(text: string): ParsedCommand | null {
  const raw = text.trim();
  if (!raw.startsWith("/")) return null;

  // Take only the command line (commands are single-line)
  const firstLine = raw.split(/\r?\n/)[0];
  const m = firstLine.match(/^\/([a-zA-Z][a-zA-Z0-9_-]*)\s*(.*)$/);
  if (!m) return null;
  const cmd = m[1].toLowerCase();
  const rest = (m[2] ?? "").trim();

  if (cmd === "complete-lesson" || cmd === "lesson-complete" || cmd === "complete_lesson") {
    if (!rest) return { kind: "complete_lesson" };
    // Split optional " in <course>" suffix
    const inMatch = rest.match(/^(.+?)\s+in\s+(.+)$/i);
    if (inMatch) {
      return {
        kind: "complete_lesson",
        lesson_query: inMatch[1].trim(),
        course_query: inMatch[2].trim(),
      };
    }
    return { kind: "complete_lesson", lesson_query: rest };
  }

  if (
    cmd === "recommend-courses" ||
    cmd === "recommend-training" ||
    cmd === "retrain" ||
    cmd === "recommend_courses"
  ) {
    return { kind: "recommend_courses", topic: rest || undefined };
  }

  return null;
}

/** Run a parsed LMS command via the lms-chat-command edge function. */
export async function runLmsCommand(
  parsed: ParsedCommand,
  organizationId: string | null | undefined,
): Promise<LmsChatCommandResult> {
  if (!organizationId) {
    return {
      handled: true,
      ok: false,
      markdown:
        "I need an active organization to run that command. Pick one from the organization selector and try again.",
    };
  }

  if (parsed.kind === "complete_lesson" && !parsed.lesson_query) {
    return {
      handled: true,
      ok: false,
      markdown:
        "Tell me which lesson to mark complete:\n\n" +
        "`/complete-lesson <lesson title>` — or include the course: " +
        "`/complete-lesson <lesson> in <course>`.",
    };
  }

  const { data, error } = await supabase.functions.invoke("lms-chat-command", {
    body: {
      command: parsed.kind,
      organization_id: organizationId,
      lesson_query: parsed.lesson_query,
      course_query: parsed.course_query,
      topic: parsed.topic,
    },
  });

  if (error) {
    return {
      handled: true,
      ok: false,
      markdown: `That command failed: ${error.message ?? "unknown error"}.`,
    };
  }

  return {
    handled: true,
    ok: !!(data as any)?.ok,
    markdown:
      (data as any)?.markdown ??
      "Command finished, but no summary was returned.",
    data: (data as any)?.data,
  };
}

/**
 * Convenience: detect + execute in one call. Returns null if the text isn't an
 * LMS command (so the caller falls back to the normal AI chat path).
 */
export async function maybeRunLmsCommand(
  text: string,
  organizationId: string | null | undefined,
): Promise<LmsChatCommandResult | null> {
  const parsed = parseLmsCommand(text);
  if (!parsed) return null;
  return runLmsCommand(parsed, organizationId);
}
