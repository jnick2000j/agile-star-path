// Bulk create users edge function.
// Accepts an array of rows (CSV-style). For each row:
//   - validates email + name
//   - resolves target organization (slug if caller is platform admin, else
//     forced to the caller-supplied organization_id)
//   - if user already exists by email -> grants org access only ("linked")
//   - else creates auth user, grants org access, optional custom role,
//     upserts profile fields, generates signup link, sends invite email
//
// Returns { rows: [...per-row result], summary }.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { sendTransactionalEmail } from "../_shared/send-transactional.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type AccessLevel = "admin" | "editor" | "viewer";

interface BulkRow {
  email?: string;
  first_name?: string;
  last_name?: string;
  job_title?: string;
  department?: string;
  phone_number?: string;
  location?: string;
  organization_slug?: string;
  organization_id?: string;
  access_level?: AccessLevel | string;
  custom_roles?: string; // semicolon-separated role names
  send_invite?: string | boolean;
}

interface RowResult {
  index: number;
  email: string;
  status: "created" | "linked" | "skipped" | "error";
  user_id?: string;
  organization_id?: string;
  accept_url?: string;
  email_sent?: boolean;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function inviteEmailHtml(opts: {
  inviterName: string;
  appName: string;
  acceptUrl: string;
}) {
  const { inviterName, appName, acceptUrl } = opts;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width:560px; margin:0 auto; padding:32px;">
      <h2 style="color:#0f172a;">You've been invited to ${appName}</h2>
      <p style="color:#475569; font-size:15px; line-height:1.6;">
        ${inviterName} has created an account for you on <strong>${appName}</strong>.
        Click the button below to confirm your email and sign in.
      </p>
      <p style="margin: 28px 0;">
        <a href="${acceptUrl}" style="background:#2563eb; color:white; padding:12px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block;">
          Confirm &amp; sign in
        </a>
      </p>
      <p style="color:#94a3b8; font-size:13px;">
        Or copy this link: <br/>
        <a href="${acceptUrl}" style="color:#2563eb; word-break:break-all;">${acceptUrl}</a>
      </p>
    </div>
  `;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Auth: identify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authErr } =
      await admin.auth.getUser(token);
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: platformRoles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");
    const isPlatformAdmin = (platformRoles?.length ?? 0) > 0;

    const body = await req.json().catch(() => ({}));
    const rows: BulkRow[] = Array.isArray(body?.rows) ? body.rows : [];
    const callerOrgId: string | undefined = body?.organization_id;
    const redirectTo: string =
      body?.redirect_to ||
      `${supabaseUrl.replace(".supabase.co", ".lovable.app")}/auth/confirm`;

    if (!rows.length) {
      return new Response(
        JSON.stringify({ error: "rows[] is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Org-admin check (caller must be admin of their requested org)
    if (!isPlatformAdmin) {
      if (!callerOrgId) {
        return new Response(
          JSON.stringify({ error: "organization_id is required for org admins" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: callerAccess } = await admin
        .from("user_organization_access")
        .select("access_level")
        .eq("user_id", caller.id)
        .eq("organization_id", callerOrgId)
        .maybeSingle();
      if (callerAccess?.access_level !== "admin") {
        return new Response(
          JSON.stringify({ error: "Only org admins can perform bulk import" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Pre-cache organizations for slug lookup (platform admin only).
    let orgsBySlug = new Map<string, { id: string; slug: string; name: string }>();
    if (isPlatformAdmin) {
      const { data: orgs } = await admin
        .from("organizations")
        .select("id, slug, name");
      orgsBySlug = new Map(
        (orgs ?? []).map((o: any) => [String(o.slug ?? "").toLowerCase(), o]),
      );
    }

    // Pre-cache custom roles per org as we encounter them.
    const customRoleCache = new Map<string, Map<string, string>>(); // orgId -> roleName(lower) -> roleId

    const inviterName = (caller.user_metadata as any)?.full_name ||
      caller.email || "An administrator";
    const appName = Deno.env.get("APP_NAME") || "TaskMaster";

    const results: RowResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const email = String(row.email ?? "").trim().toLowerCase();
      const out: RowResult = { index: i, email, status: "error" };

      try {
        if (!EMAIL_RE.test(email)) {
          out.status = "error";
          out.message = "Invalid email";
          results.push(out);
          continue;
        }

        // Resolve target org
        let orgId: string | null = null;
        if (isPlatformAdmin && row.organization_slug) {
          const o = orgsBySlug.get(String(row.organization_slug).toLowerCase());
          if (!o) {
            out.status = "error";
            out.message = `Unknown organization slug: ${row.organization_slug}`;
            results.push(out);
            continue;
          }
          orgId = o.id;
        } else {
          orgId = (row.organization_id || callerOrgId) ?? null;
        }
        if (!orgId) {
          out.status = "error";
          out.message = "Organization could not be resolved";
          results.push(out);
          continue;
        }
        out.organization_id = orgId;

        const accessLevel = (["admin", "editor", "viewer"].includes(
          String(row.access_level ?? "viewer").toLowerCase(),
        )
          ? String(row.access_level ?? "viewer").toLowerCase()
          : "viewer") as AccessLevel;

        const sendInviteRaw = row.send_invite;
        const sendInvite = sendInviteRaw === undefined || sendInviteRaw === null ||
          sendInviteRaw === ""
          ? true
          : String(sendInviteRaw).toLowerCase() !== "false" &&
            String(sendInviteRaw).toLowerCase() !== "0" &&
            String(sendInviteRaw).toLowerCase() !== "no";

        // Look up existing user by email via admin API (paginated search).
        let existingUserId: string | null = null;
        const { data: existingProfile } = await admin
          .from("profiles")
          .select("user_id")
          .ilike("email", email)
          .maybeSingle();
        existingUserId = existingProfile?.user_id ?? null;

        if (existingUserId) {
          // Already a user: just grant org access if missing.
          await admin.from("user_organization_access").upsert(
            { user_id: existingUserId, organization_id: orgId, access_level: accessLevel },
            { onConflict: "user_id,organization_id" },
          );
          out.user_id = existingUserId;
          out.status = "linked";
          out.message = "User existed; granted org access";
        } else {
          // Create new user
          const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() ||
            email.split("@")[0];

          const { data: newUser, error: createErr } = await admin.auth.admin
            .createUser({
              email,
              email_confirm: false,
              user_metadata: {
                full_name: fullName,
                first_name: row.first_name ?? null,
                last_name: row.last_name ?? null,
              },
            } as any);
          if (createErr) throw createErr;
          const newId = newUser.user?.id;
          if (!newId) throw new Error("createUser returned no id");
          out.user_id = newId;
          out.status = "created";

          // Org access
          await admin.from("user_organization_access").upsert(
            { user_id: newId, organization_id: orgId, access_level: accessLevel },
            { onConflict: "user_id,organization_id" },
          );

          // Profile fields
          await admin
            .from("profiles")
            .update({
              first_name: row.first_name ?? null,
              last_name: row.last_name ?? null,
              job_title: row.job_title ?? null,
              department: row.department ?? null,
              phone_number: row.phone_number ?? null,
              location: row.location ?? null,
              default_organization_id: orgId,
            })
            .eq("user_id", newId);
        }

        // Custom roles (semicolon-separated names)
        const roleNames = String(row.custom_roles ?? "")
          .split(";")
          .map((r) => r.trim())
          .filter(Boolean);
        if (roleNames.length && out.user_id) {
          let cache = customRoleCache.get(orgId);
          if (!cache) {
            const { data: roles } = await admin
              .from("custom_roles")
              .select("id, name")
              .or(`organization_id.eq.${orgId},organization_id.is.null`);
            cache = new Map(
              (roles ?? []).map((r: any) => [
                String(r.name).toLowerCase(),
                r.id,
              ]),
            );
            customRoleCache.set(orgId, cache);
          }
          for (const rn of roleNames) {
            const rid = cache.get(rn.toLowerCase());
            if (!rid) continue;
            await admin.from("user_organization_custom_roles").upsert(
              { user_id: out.user_id, organization_id: orgId, custom_role_id: rid },
              { onConflict: "user_id,organization_id,custom_role_id" },
            );
          }
        }

        // Invite email (only for newly-created or when explicitly requested for linked)
        if (sendInvite && out.status === "created") {
          const { data: linkData } = await admin.auth.admin.generateLink({
            type: "signup",
            email,
            options: { redirectTo },
          } as any);
          const acceptUrl = (linkData as any)?.properties?.action_link ||
            (linkData as any)?.action_link || redirectTo;
          out.accept_url = acceptUrl;

          const result = await sendTransactionalEmail({
            to: email,
            subject: `${inviterName} invited you to ${appName}`,
            html: inviteEmailHtml({ inviterName, appName, acceptUrl }),
            idempotencyKey: `bulk-invite-${out.user_id}`,
            label: "user-invite",
            triggerKey: "user_invite",
            organizationId: orgId,
            templateKey: "invite",
            templateData: {
              user_name: row.first_name || email.split("@")[0],
              org_name: appName,
              site_name: appName,
              action_url: acceptUrl,
            },
          });
          out.email_sent = result.ok;
          if (!result.ok) out.message = `Email queue error: ${result.error}`;
        }
      } catch (e) {
        out.status = "error";
        out.message = e instanceof Error ? e.message : String(e);
      }
      results.push(out);
    }

    const summary = {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      linked: results.filter((r) => r.status === "linked").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errored: results.filter((r) => r.status === "error").length,
      emails_sent: results.filter((r) => r.email_sent).length,
    };

    return new Response(JSON.stringify({ success: true, rows: results, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
