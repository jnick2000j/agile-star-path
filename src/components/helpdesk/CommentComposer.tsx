import { useEffect, useRef, useState, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Paperclip, X, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MentionUser {
  user_id: string;
  full_name?: string | null;
  email?: string | null;
}

export interface PendingFile {
  id: string;
  file: File;
  previewUrl?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  users: MentionUser[];
  pendingFiles: PendingFile[];
  onPendingFilesChange: (files: PendingFile[]) => void;
  onMentionsChange: (userIds: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

const MAX_BYTES = 25 * 1024 * 1024;

function userHandle(u: MentionUser): string {
  // Build a deterministic, parser-friendly handle: prefer email local part, else snake-cased name
  if (u.email) return u.email.split("@")[0].toLowerCase();
  if (u.full_name) return u.full_name.replace(/\s+/g, "_").toLowerCase();
  return u.user_id.slice(0, 8);
}

function userLabel(u: MentionUser): string {
  return u.full_name || u.email || "Unknown";
}

export function CommentComposer({
  value,
  onChange,
  users,
  pendingFiles,
  onPendingFilesChange,
  onMentionsChange,
  placeholder = "Type your reply…  Use @ to mention, paste or drop files to attach.",
  disabled,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionAnchor, setMentionAnchor] = useState<number>(0);
  const [activeIdx, setActiveIdx] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  // Recompute mentions whenever value changes
  useEffect(() => {
    const handles = new Map<string, MentionUser>();
    users.forEach((u) => handles.set(userHandle(u), u));
    const found = new Set<string>();
    const re = /@([a-zA-Z0-9._-]+)/g;
    let m;
    while ((m = re.exec(value)) !== null) {
      const u = handles.get(m[1].toLowerCase());
      if (u) found.add(u.user_id);
    }
    onMentionsChange(Array.from(found));
  }, [value, users, onMentionsChange]);

  const filteredUsers = mentionQuery !== null
    ? users
        .filter((u) => {
          const q = mentionQuery.toLowerCase();
          if (!q) return true;
          return (
            (u.full_name ?? "").toLowerCase().includes(q) ||
            (u.email ?? "").toLowerCase().includes(q) ||
            userHandle(u).includes(q)
          );
        })
        .slice(0, 6)
    : [];

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted: PendingFile[] = [];
      for (const file of files) {
        if (file.size > MAX_BYTES) continue;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const previewUrl = file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined;
        accepted.push({ id, file, previewUrl });
      }
      if (accepted.length) onPendingFilesChange([...pendingFiles, ...accepted]);
    },
    [pendingFiles, onPendingFilesChange],
  );

  const removeFile = (id: string) => {
    const next = pendingFiles.filter((f) => {
      if (f.id === id && f.previewUrl) URL.revokeObjectURL(f.previewUrl);
      return f.id !== id;
    });
    onPendingFilesChange(next);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of Array.from(items)) {
      if (it.kind === "file") {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length) {
      e.preventDefault();
      addFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) addFiles(files);
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    onChange(v);
    const cursor = e.target.selectionStart ?? v.length;
    // Look back for an @ that begins a mention token
    const upto = v.slice(0, cursor);
    const match = upto.match(/(^|\s)@([a-zA-Z0-9._-]*)$/);
    if (match) {
      setMentionQuery(match[2]);
      setMentionAnchor(cursor - match[2].length - 1); // position of '@'
      setActiveIdx(0);
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (u: MentionUser) => {
    if (mentionQuery === null) return;
    const handle = userHandle(u);
    const before = value.slice(0, mentionAnchor);
    const after = value.slice(mentionAnchor + 1 + mentionQuery.length);
    const insertion = `@${handle} `;
    const next = before + insertion + after;
    onChange(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = (before + insertion).length;
      taRef.current?.focus();
      taRef.current?.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && filteredUsers.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => (i + 1) % filteredUsers.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => (i - 1 + filteredUsers.length) % filteredUsers.length);
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredUsers[activeIdx]);
      } else if (e.key === "Escape") {
        setMentionQuery(null);
      }
    }
  };

  return (
    <div
      className={cn(
        "relative space-y-2",
        dragOver && "ring-2 ring-primary rounded-md",
      )}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <Textarea
        ref={taRef}
        rows={4}
        value={value}
        onChange={handleTextChange}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
      />

      {mentionQuery !== null && filteredUsers.length > 0 && (
        <div className="absolute z-20 bottom-full mb-1 left-0 w-72 rounded-md border bg-popover shadow-md overflow-hidden">
          <div className="py-1 max-h-60 overflow-y-auto">
            {filteredUsers.map((u, i) => (
              <button
                key={u.user_id}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-sm text-left hover:bg-accent",
                  i === activeIdx && "bg-accent",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(u);
                }}
                onMouseEnter={() => setActiveIdx(i)}
              >
                <span className="truncate">{userLabel(u)}</span>
                <span className="text-xs text-muted-foreground ml-2">@{userHandle(u)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {pendingFiles.map((pf) => (
            <div
              key={pf.id}
              className="flex items-center gap-2 px-2 py-1 rounded-md border bg-muted/40 text-xs"
            >
              {pf.previewUrl ? (
                <img src={pf.previewUrl} alt="" className="h-8 w-8 rounded object-cover" />
              ) : (
                <FileText className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="max-w-[160px] truncate">{pf.file.name}</span>
              <button
                type="button"
                onClick={() => removeFile(pf.id)}
                className="rounded-full hover:bg-background/60 p-0.5"
                aria-label="Remove file"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Paperclip className="h-4 w-4 mr-1" /> Attach
        </Button>
        <span className="text-xs text-muted-foreground">
          Tip: type <kbd className="px-1 rounded bg-muted">@</kbd> to mention. Paste or drop files to attach.
        </span>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function renderBodyWithMentions(body: string, users: MentionUser[]): React.ReactNode {
  const handles = new Map<string, MentionUser>();
  users.forEach((u) => handles.set(userHandle(u), u));
  const parts: React.ReactNode[] = [];
  const re = /@([a-zA-Z0-9._-]+)/g;
  let lastIndex = 0;
  let m;
  let key = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > lastIndex) parts.push(body.slice(lastIndex, m.index));
    const handle = m[1].toLowerCase();
    const user = handles.get(handle);
    if (user) {
      parts.push(
        <span
          key={`m-${key++}`}
          className="inline-flex items-center px-1 rounded bg-primary/10 text-primary font-medium"
        >
          @{userLabel(user)}
        </span>,
      );
    } else {
      parts.push(m[0]);
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < body.length) parts.push(body.slice(lastIndex));
  return parts;
}

export const composerHelpers = { userHandle, userLabel };
