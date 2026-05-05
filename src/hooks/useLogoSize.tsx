import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

/**
 * Per-placement custom logo sizing.
 *
 * Resolution order:
 *   1. Current org's branding_settings row (if width/height set)
 *   2. Platform default row (organization_id IS NULL)
 *   3. Hard-coded fallback per placement
 *
 * Width and height are independent — the consumer applies both as inline
 * styles. `null` from the DB means "inherit", so an org row can override
 * width but inherit height from the platform default, and vice versa.
 */

export type LogoPlacement = "header" | "login" | "email";

interface LogoSize {
  width: number;
  height: number;
}

const FALLBACKS: Record<LogoPlacement, LogoSize> = {
  // Matches existing layouts so behaviour is unchanged when no override exists.
  header: { width: 0, height: 56 }, // h-14
  login: { width: 0, height: 96 }, // max-h-24
  email: { width: 0, height: 48 },
};

const COL: Record<LogoPlacement, { w: string; h: string }> = {
  header: { w: "logo_header_width", h: "logo_header_height" },
  login: { w: "logo_login_width", h: "logo_login_height" },
  email: { w: "logo_email_width", h: "logo_email_height" },
};

export function useLogoSize(placement: LogoPlacement): LogoSize {
  const { currentOrganization } = useOrganization();
  const [size, setSize] = useState<LogoSize>(FALLBACKS[placement]);

  useEffect(() => {
    let cancelled = false;
    const cols = COL[placement];

    async function load() {
      // 1. Org row
      let orgWidth: number | null = null;
      let orgHeight: number | null = null;
      if (currentOrganization?.id) {
        const { data } = await supabase
          .from("branding_settings")
          .select(`${cols.w}, ${cols.h}`)
          .eq("organization_id", currentOrganization.id)
          .maybeSingle();
        if (data) {
          orgWidth = (data as any)[cols.w] ?? null;
          orgHeight = (data as any)[cols.h] ?? null;
        }
      }

      // 2. Platform default row (only fetch fields we still need)
      let defaultWidth: number | null = null;
      let defaultHeight: number | null = null;
      if (orgWidth == null || orgHeight == null) {
        const { data } = await supabase
          .from("branding_settings")
          .select(`${cols.w}, ${cols.h}`)
          .is("organization_id", null)
          .maybeSingle();
        if (data) {
          defaultWidth = (data as any)[cols.w] ?? null;
          defaultHeight = (data as any)[cols.h] ?? null;
        }
      }

      const fb = FALLBACKS[placement];
      const next: LogoSize = {
        width: orgWidth ?? defaultWidth ?? fb.width,
        height: orgHeight ?? defaultHeight ?? fb.height,
      };
      if (!cancelled) setSize(next);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id, placement]);

  return size;
}

/**
 * Convert a `LogoSize` to inline styles. Width=0 means "auto" (preserve
 * aspect ratio), which is the default fallback for placements where only
 * height matters historically.
 */
export function logoSizeStyle(size: LogoSize): React.CSSProperties {
  return {
    width: size.width > 0 ? `${size.width}px` : "auto",
    height: size.height > 0 ? `${size.height}px` : "auto",
    objectFit: "contain",
  };
}
