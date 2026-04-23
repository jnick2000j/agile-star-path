import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  return (
    <div
      className={cn(
        "prose prose-sm max-w-none dark:prose-invert",
        "prose-headings:font-semibold prose-headings:text-foreground",
        "prose-p:text-foreground prose-li:text-foreground",
        "prose-strong:text-foreground",
        "prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:rounded",
        "prose-a:text-primary hover:prose-a:underline",
        className,
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
