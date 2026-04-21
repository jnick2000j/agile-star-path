import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendEmail, isEmailConfigured } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  to: string[];
  subject?: string;
  message?: string;
  pdf_base64: string; // raw base64 (no data: prefix)
  filename?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as Payload;
    const recipients = (body.to || [])
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.includes("@"));

    if (recipients.length === 0 || !body.pdf_base64) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isEmailConfigured()) {
      return new Response(
        JSON.stringify({ error: "Email is not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const senderName =
      userData.user.user_metadata?.full_name || userData.user.email || "Timesheets";
    const filename = body.filename || "timesheet.pdf";

    const result = await sendEmail({
      to: recipients,
      subject: body.subject || "Timesheet",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:560px; margin:0 auto; padding:24px;">
          <h2 style="color:#0f172a;">Timesheet attached</h2>
          <p style="color:#475569; font-size:15px; line-height:1.6;">
            ${
              body.message
                ? body.message.replace(/[<>]/g, "")
                : `${senderName} sent you a signed timesheet.`
            }
          </p>
          <p style="color:#94a3b8; font-size:12px; margin-top:24px;">
            See attached PDF: ${filename}
          </p>
        </div>
      `,
      attachments: [
        {
          filename,
          content: body.pdf_base64,
          contentType: "application/pdf",
        },
      ],
    });
    if (!result.ok) {
      console.error("email-timesheet send failed:", result.error);
      return new Response(
        JSON.stringify({ error: result.error || "Email send failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("email-timesheet error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
