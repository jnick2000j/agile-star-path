import { useEffect, useState } from "react";
import { resolveLogoUrl } from "@/lib/logoUrl";

/**
 * Resolves a stored logo reference (legacy public URL or storage path) to a
 * signed URL that works while the 'logos' bucket is private. Returns null
 * until resolution completes, then the signed URL (or original if external).
 */
export function useSignedLogo(stored: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!stored) {
      setUrl(null);
      return;
    }
    resolveLogoUrl(stored).then((resolved) => {
      if (!cancelled) setUrl(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);

  return url;
}
