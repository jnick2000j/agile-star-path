// SCIM 2.0 stub endpoint — bearer-token auth scoped to one org.
// Implements the read-only Users + Groups subset (List, Get) plus a 200 stub
// for ServiceProviderConfig. Write operations return 501 Not Implemented for
// now but are wired so we can expand later without changing the URL contract.
//
// URL shape: /scim-v2/<resource>[...]
//   /Users                       → list
//   /Users/<userId>              → get
//   /Groups                      → list
//   /Groups/<groupId>            → get
//   /ServiceProviderConfig       → capabilities
//   /Schemas                     → schema list
//   /ResourceTypes               → resource type list

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const SCIM_CT = "application/scim+json";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  // Strip the function name from the path so we get e.g. "/Users/<id>"
  const segments = url.pathname.split("/").filter(Boolean);
  const fnIdx = segments.indexOf("scim-v2");
  const subPath = fnIdx >= 0 ? segments.slice(fnIdx + 1) : segments;

  // Bearer token auth → look up org by token hash
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) {
    return scimError(401, "Missing bearer token");
  }
  const token = auth.slice("Bearer ".length).trim();
  const tokenHash = await sha256Hex(token);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: tokenRow } = await admin
    .from("scim_tokens")
    .select("id, organization_id, revoked_at, expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at || (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date())) {
    return scimError(401, "Invalid or expired SCIM token");
  }
  const orgId = tokenRow.organization_id as string;

  // Touch last-used timestamp (best-effort)
  admin.from("scim_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenRow.id).then();

  // Public discovery endpoints
  if (subPath[0] === "ServiceProviderConfig") {
    return scimJson(serviceProviderConfig(url));
  }
  if (subPath[0] === "Schemas") {
    return scimJson(listResponse([userSchema(), groupSchema()]));
  }
  if (subPath[0] === "ResourceTypes") {
    return scimJson(listResponse(resourceTypes(url)));
  }

  // Users
  if (subPath[0] === "Users") {
    if (subPath.length === 1 && req.method === "GET") {
      return await listUsers(admin, orgId, url);
    }
    if (subPath.length === 2 && req.method === "GET") {
      return await getUser(admin, orgId, subPath[1]);
    }
    if (subPath.length === 1 && req.method === "POST") {
      return await createUser(admin, orgId, await req.json().catch(() => ({})));
    }
    if (subPath.length === 2 && (req.method === "PUT" || req.method === "PATCH")) {
      return await updateUser(admin, orgId, subPath[1], await req.json().catch(() => ({})), req.method);
    }
    if (subPath.length === 2 && req.method === "DELETE") {
      return await deactivateUser(admin, orgId, subPath[1]);
    }
  }

  // Groups (read-only — group membership is driven via mappings)
  if (subPath[0] === "Groups") {
    if (subPath.length === 1 && req.method === "GET") {
      return await listGroups(admin, orgId, url);
    }
    if (subPath.length === 2 && req.method === "GET") {
      return await getGroup(admin, orgId, subPath[1]);
    }
    if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
      return scimError(501, "Group writes not supported — manage memberships via Users.groups.");
    }
  }

  return scimError(404, "Resource not found");
});

// --- Handlers ---------------------------------------------------------------

async function listUsers(admin: any, orgId: string, url: URL) {
  const startIndex = parseInt(url.searchParams.get("startIndex") ?? "1", 10);
  const count = Math.min(parseInt(url.searchParams.get("count") ?? "50", 10), 200);
  const filter = url.searchParams.get("filter") ?? "";

  let query = admin
    .from("user_organization_access")
    .select("user_id, access_level, profiles:user_id(user_id, email, full_name, status)", { count: "exact" })
    .eq("organization_id", orgId);

  // Trivial filter support: userName eq "..."
  const m = filter.match(/userName\s+eq\s+"([^"]+)"/i);
  if (m) {
    // Filter via inner join — we need to fetch then filter since PostgREST
    // can't filter on the embedded resource directly here.
  }

  const { data, count: total, error } = await query.range(startIndex - 1, startIndex - 1 + count - 1);
  if (error) return scimError(500, error.message);

  let resources = (data ?? [])
    .filter((row: any) => row.profiles)
    .map((row: any) => userToScim(row.profiles, row.access_level));

  if (m) {
    const wanted = m[1].toLowerCase();
    resources = resources.filter((r: any) => r.userName?.toLowerCase() === wanted);
  }

  return scimJson({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: total ?? resources.length,
    startIndex,
    itemsPerPage: resources.length,
    Resources: resources,
  });
}

async function getUser(admin: any, orgId: string, userId: string) {
  const { data, error } = await admin
    .from("user_organization_access")
    .select("access_level, profiles:user_id(user_id, email, full_name, status)")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return scimError(500, error.message);
  if (!data || !data.profiles) return scimError(404, "User not found");
  return scimJson(userToScim(data.profiles, data.access_level));
}

async function listGroups(admin: any, orgId: string, url: URL) {
  const startIndex = parseInt(url.searchParams.get("startIndex") ?? "1", 10);
  const count = Math.min(parseInt(url.searchParams.get("count") ?? "50", 10), 200);

  // We expose access levels as groups for now. A future iteration can map
  // custom_roles and entity_assignments here.
  const groups = ["admin", "manager", "editor", "viewer"];
  const resources = await Promise.all(
    groups.map(async (level) => {
      const { data: members } = await admin
        .from("user_organization_access")
        .select("user_id")
        .eq("organization_id", orgId)
        .eq("access_level", level);
      return groupToScim(orgId, level, members ?? []);
    })
  );
  const slice = resources.slice(startIndex - 1, startIndex - 1 + count);
  return scimJson({
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: resources.length,
    startIndex,
    itemsPerPage: slice.length,
    Resources: slice,
  });
}

async function getGroup(admin: any, orgId: string, groupId: string) {
  const valid = ["admin", "manager", "editor", "viewer"];
  if (!valid.includes(groupId)) return scimError(404, "Group not found");
  const { data: members } = await admin
    .from("user_organization_access")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("access_level", groupId);
  return scimJson(groupToScim(orgId, groupId, members ?? []));
}

// --- SCIM helpers -----------------------------------------------------------

async function createUser(admin: any, orgId: string, body: any) {
  const email = body.userName ?? body.emails?.[0]?.value;
  if (!email) return scimError(400, "userName/email required");
  const externalId = body.externalId ?? null;
  const groups: string[] = (body.groups ?? []).map((g: any) => g.display ?? g.value).filter(Boolean);
  const fullName = body.displayName ?? `${body.name?.givenName ?? ""} ${body.name?.familyName ?? ""}`.trim();

  // Resolve access level via group→role mapping; default to viewer
  let accessLevel = "viewer";
  if (groups.length > 0) {
    const { data: lvl } = await admin.rpc("resolve_scim_groups_to_access_level", {
      _org_id: orgId,
      _groups: groups,
    });
    if (lvl) accessLevel = lvl;
  }

  // Find or create auth user
  const { data: existing } = await admin
    .from("profiles")
    .select("user_id")
    .ilike("email", email)
    .maybeSingle();

  let userId = existing?.user_id;
  if (!userId) {
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: fullName, scim_provisioned: true },
    });
    if (cErr) return scimError(500, cErr.message);
    userId = created.user.id;
  }

  await admin.from("user_organization_access").upsert(
    { user_id: userId, organization_id: orgId, access_level: accessLevel },
    { onConflict: "user_id,organization_id" }
  );

  await admin.from("scim_user_sync_state").upsert(
    {
      organization_id: orgId,
      user_id: userId,
      external_id: externalId ?? userId,
      scim_username: email,
      scim_groups: groups,
      active: body.active !== false,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" }
  );

  await admin.rpc("log_audit_event", {
    _event_type: "scim_user_created",
    _event_category: "sso",
    _organization_id: orgId,
    _target_user_id: userId,
    _metadata: { email, groups, access_level: accessLevel },
  });

  const { data: profile } = await admin.from("profiles").select("*").eq("user_id", userId).maybeSingle();
  return scimJson(userToScim(profile, accessLevel), 201);
}

async function updateUser(admin: any, orgId: string, userId: string, body: any, method: string) {
  // Handle PATCH ops minimally; accept full PUT representation otherwise
  const patchOps: any[] = method === "PATCH" ? body.Operations ?? [] : [];
  let active: boolean | undefined;
  let groups: string[] | undefined;

  if (method === "PUT") {
    active = body.active;
    groups = (body.groups ?? []).map((g: any) => g.display ?? g.value).filter(Boolean);
  } else {
    for (const op of patchOps) {
      const path = (op.path ?? "").toLowerCase();
      if (path === "active") active = op.value;
      if (path === "groups") groups = (op.value ?? []).map((g: any) => g.display ?? g.value).filter(Boolean);
    }
  }

  if (active === false) {
    await admin.from("user_organization_access").delete().eq("user_id", userId).eq("organization_id", orgId);
  } else if (groups) {
    const { data: lvl } = await admin.rpc("resolve_scim_groups_to_access_level", {
      _org_id: orgId,
      _groups: groups,
    });
    if (lvl) {
      await admin.from("user_organization_access").upsert(
        { user_id: userId, organization_id: orgId, access_level: lvl },
        { onConflict: "user_id,organization_id" }
      );
    }
  }

  await admin
    .from("scim_user_sync_state")
    .update({
      active: active ?? true,
      scim_groups: groups ?? [],
      last_synced_at: new Date().toISOString(),
    })
    .eq("organization_id", orgId)
    .eq("user_id", userId);

  await admin.rpc("log_audit_event", {
    _event_type: "scim_user_updated",
    _event_category: "sso",
    _organization_id: orgId,
    _target_user_id: userId,
    _metadata: { active, groups },
  });

  return await getUser(admin, orgId, userId);
}

async function deactivateUser(admin: any, orgId: string, userId: string) {
  await admin.from("user_organization_access").delete().eq("user_id", userId).eq("organization_id", orgId);
  await admin
    .from("scim_user_sync_state")
    .update({ active: false, last_synced_at: new Date().toISOString() })
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  await admin.rpc("log_audit_event", {
    _event_type: "scim_user_deactivated",
    _event_category: "sso",
    _organization_id: orgId,
    _target_user_id: userId,
  });
  return new Response(null, { status: 204, headers: corsHeaders });
}

function userToScim(p: any, accessLevel: string) {
  const [given, ...rest] = (p.full_name ?? "").split(" ");
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
    id: p.user_id,
    userName: p.email,
    name: { givenName: given || "", familyName: rest.join(" ") || "" },
    displayName: p.full_name ?? p.email,
    active: p.status !== "archived" && p.status !== "disabled",
    emails: [{ value: p.email, primary: true }],
    "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User": {
      department: accessLevel,
    },
    meta: {
      resourceType: "User",
      location: `/scim/v2/Users/${p.user_id}`,
    },
  };
}

function groupToScim(orgId: string, level: string, members: { user_id: string }[]) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
    id: level,
    displayName: `${level.charAt(0).toUpperCase()}${level.slice(1)}s`,
    members: members.map((m) => ({
      value: m.user_id,
      $ref: `/scim/v2/Users/${m.user_id}`,
    })),
    meta: {
      resourceType: "Group",
      location: `/scim/v2/Groups/${level}`,
    },
  };
}

function listResponse(items: any[]) {
  return {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: items.length,
    startIndex: 1,
    itemsPerPage: items.length,
    Resources: items,
  };
}

function userSchema() {
  return {
    id: "urn:ietf:params:scim:schemas:core:2.0:User",
    name: "User",
    description: "SCIM core User schema",
  };
}
function groupSchema() {
  return {
    id: "urn:ietf:params:scim:schemas:core:2.0:Group",
    name: "Group",
    description: "SCIM core Group schema",
  };
}
function resourceTypes(url: URL) {
  const base = `${url.origin}/scim/v2`;
  return [
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id: "User",
      name: "User",
      endpoint: "/Users",
      schema: "urn:ietf:params:scim:schemas:core:2.0:User",
      meta: { location: `${base}/ResourceTypes/User`, resourceType: "ResourceType" },
    },
    {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id: "Group",
      name: "Group",
      endpoint: "/Groups",
      schema: "urn:ietf:params:scim:schemas:core:2.0:Group",
      meta: { location: `${base}/ResourceTypes/Group`, resourceType: "ResourceType" },
    },
  ];
}
function serviceProviderConfig(url: URL) {
  return {
    schemas: ["urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig"],
    documentationUri: "https://docs.lovable.dev/",
    patch: { supported: false },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      { type: "oauthbearertoken", name: "OAuth Bearer Token", description: "Per-org SCIM token" },
    ],
    meta: { location: `${url.origin}/scim/v2/ServiceProviderConfig`, resourceType: "ServiceProviderConfig" },
  };
}

function scimJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": SCIM_CT },
  });
}
function scimError(status: number, detail: string) {
  return scimJson(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      status: String(status),
      detail,
    },
    status
  );
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
