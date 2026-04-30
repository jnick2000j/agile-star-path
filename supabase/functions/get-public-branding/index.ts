// Public, anon-callable: returns the global branding row plus fresh signed URLs
// for the logo and login background image (since the 'logos' bucket is private).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const SIGN_TTL_SECONDS = 60 * 60; // 1 hour

function extractLogoPath(stored: string | null): string | null {
  if (!stored) return null;
  // If a full Supabase storage URL was previously persisted, pull out the
  // object path that lives inside the 'logos' bucket.
  const marker = "/storage/v1/object/";
  const idx = stored.indexOf(marker);
  if (idx === -1) {
    // Treat as already-a-path
    return stored.replace(/^logos\//, "");
  }
  // After marker: either "public/logos/..." or "sign/logos/..." or "authenticated/logos/..."
  let rest = stored.slice(idx + marker.length);
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  if (!rest.startsWith("logos/")) return null;
  return rest.slice("logos/".length).split("?")[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data, error } = await supabase
      .from("branding_settings")
      .select("*")
      .is("organization_id", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return new Response(JSON.stringify({ branding: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result: any = { ...data };

    const logoPath = extractLogoPath(data.logo_url);
    if (logoPath) {
      const { data: signed } = await supabase.storage
        .from("logos")
        .createSignedUrl(logoPath, SIGN_TTL_SECONDS);
      result.logo_url = signed?.signedUrl ?? null;
    }

    const bgPath = extractLogoPath((data as any).login_bg_image_url);
    if (bgPath) {
      const { data: signed } = await supabase.storage
        .from("logos")
        .createSignedUrl(bgPath, SIGN_TTL_SECONDS);
      result.login_bg_image_url = signed?.signedUrl ?? null;
    }

    return new Response(JSON.stringify({ branding: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-public-branding error", e);
    return new Response(JSON.stringify({ error: "Failed to load branding" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
