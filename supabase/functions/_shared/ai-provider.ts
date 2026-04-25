// Shared AI provider abstraction.
//
// Routes LLM calls to whatever provider the org/global config selects:
//   - lovable        → Lovable AI Gateway (OpenAI-compatible)            [DEFAULT]
//   - openai         → OpenAI Chat Completions
//   - anthropic      → Anthropic Messages API (translated to/from OpenAI shape)
//   - azure_openai   → Azure OpenAI deployments (OpenAI-compatible)
//   - ollama         → Self-hosted Ollama / vLLM (OpenAI-compatible)
//
// Usage in an edge function:
//   const aiResp = await callAI({
//     supabase: authClient,
//     organizationId,
//     model: "google/gemini-2.5-flash",
//     messages: [...],
//     tools: [...],
//   });
//   if (!aiResp.ok) return aiResp.errorResponse;       // 402/429/500 already shaped
//   const content = aiResp.data.choices[0].message.content;
//
// Streaming:
//   const aiResp = await callAI({ ..., stream: true });
//   if (!aiResp.ok) return aiResp.errorResponse;
//   return new Response(aiResp.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type AIProvider = "lovable" | "openai" | "anthropic" | "azure_openai" | "ollama";

export interface AIProviderResolution {
  source: "organization" | "global" | "fallback";
  provider: AIProvider;
  default_model: string | null;
  base_url: string | null;
  api_key_secret_name: string | null;
  enabled_modules: Record<string, unknown>;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  // OpenAI-style tool call extensions:
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
}

export interface CallAIOptions {
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient | any;
  organizationId?: string | null;
  model?: string;            // fallback if provider has no default
  messages: ChatMessage[];
  tools?: unknown[];
  tool_choice?: unknown;
  response_format?: unknown;
  temperature?: number;
  stream?: boolean;
  // Optional escape hatch: skip provider resolution & force Lovable.
  forceLovable?: boolean;
}

export type CallAIResult =
  | { ok: true; provider: AIProvider; model: string; data?: any; body?: ReadableStream<Uint8Array> | null }
  | { ok: false; errorResponse: Response };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK: AIProviderResolution = {
  source: "fallback",
  provider: "lovable",
  default_model: "google/gemini-2.5-flash",
  base_url: null,
  api_key_secret_name: null,
  enabled_modules: {},
};

export async function resolveProvider(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId?: string | null,
): Promise<AIProviderResolution> {
  try {
    const { data, error } = await supabase.rpc("get_effective_ai_provider", {
      _org_id: organizationId ?? null,
    });
    if (error || !data) {
      console.warn("resolveProvider RPC failed, using fallback", error);
      return FALLBACK;
    }
    return data as AIProviderResolution;
  } catch (e) {
    console.warn("resolveProvider threw, using fallback", e);
    return FALLBACK;
  }
}

function jsonError(status: number, message: string, code?: string): Response {
  return new Response(
    JSON.stringify({ error: message, ...(code ? { code } : {}) }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

function getApiKey(provider: AIProvider, secretName: string | null): string | null {
  // Explicit per-config secret name wins (cloud BYO key scenario).
  if (secretName) {
    const v = Deno.env.get(secretName);
    if (v) return v;
  }
  // Conventional defaults so on-prem deployers can just set well-known env vars.
  switch (provider) {
    case "lovable":      return Deno.env.get("LOVABLE_API_KEY") ?? null;
    case "openai":       return Deno.env.get("OPENAI_API_KEY") ?? null;
    case "anthropic":    return Deno.env.get("ANTHROPIC_API_KEY") ?? null;
    case "azure_openai": return Deno.env.get("AZURE_OPENAI_API_KEY") ?? null;
    case "ollama":       return Deno.env.get("OLLAMA_API_KEY") ?? "ollama"; // usually unauthenticated
    default:             return null;
  }
}

function endpointFor(provider: AIProvider, baseUrl: string | null): string {
  switch (provider) {
    case "lovable":
      return "https://ai.gateway.lovable.dev/v1/chat/completions";
    case "openai":
      return (baseUrl?.replace(/\/+$/, "") ?? "https://api.openai.com") + "/v1/chat/completions";
    case "anthropic":
      return (baseUrl?.replace(/\/+$/, "") ?? "https://api.anthropic.com") + "/v1/messages";
    case "azure_openai":
      // For Azure, baseUrl should already include the deployment path or be a base resource URL.
      // Caller can put "https://<resource>.openai.azure.com/openai/deployments/<deployment>" as base_url.
      return (baseUrl?.replace(/\/+$/, "") ?? "") + "/chat/completions?api-version=2024-08-01-preview";
    case "ollama":
      return (baseUrl?.replace(/\/+$/, "") ?? "http://localhost:11434") + "/v1/chat/completions";
  }
}

// Translate an OpenAI-shaped messages array to Anthropic's shape.
function toAnthropicPayload(model: string, messages: ChatMessage[], opts: CallAIOptions) {
  let system: string | undefined;
  const msgs: { role: "user" | "assistant"; content: string }[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      system = (system ? system + "\n\n" : "") + m.content;
    } else if (m.role === "user" || m.role === "assistant") {
      msgs.push({ role: m.role, content: m.content });
    } else if (m.role === "tool") {
      // Surface tool output as a user message — Anthropic tool-use isn't fully wired here.
      msgs.push({ role: "user", content: `[tool result]\n${m.content}` });
    }
  }
  return {
    model,
    max_tokens: 4096,
    system,
    messages: msgs,
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
  };
}

// Translate an Anthropic Messages API response to an OpenAI Chat Completion shape.
function fromAnthropicResponse(json: any): any {
  const text = Array.isArray(json?.content)
    ? json.content.map((c: any) => c?.text ?? "").join("")
    : "";
  return {
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: text },
        finish_reason: json?.stop_reason ?? "stop",
      },
    ],
    model: json?.model,
    usage: json?.usage,
  };
}

export async function callAI(opts: CallAIOptions): Promise<CallAIResult> {
  const resolved = opts.forceLovable
    ? FALLBACK
    : await resolveProvider(opts.supabase, opts.organizationId);

  const provider = resolved.provider;
  const model = opts.model ?? resolved.default_model ?? FALLBACK.default_model!;
  const apiKey = getApiKey(provider, resolved.api_key_secret_name);
  if (!apiKey && provider !== "ollama") {
    return {
      ok: false,
      errorResponse: jsonError(500, `No API key configured for AI provider "${provider}".`, "ai_provider_misconfigured"),
    };
  }
  const url = endpointFor(provider, resolved.base_url);

  // ---- ANTHROPIC ----
  if (provider === "anthropic") {
    if (opts.stream) {
      return {
        ok: false,
        errorResponse: jsonError(501, "Streaming is not yet supported for the Anthropic provider in this build.", "stream_unsupported"),
      };
    }
    const payload = toAnthropicPayload(model, opts.messages, opts);
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": apiKey!,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (r.status === 429) return { ok: false, errorResponse: jsonError(429, "Rate limit exceeded. Please try again shortly.", "rate_limited") };
    if (r.status === 402 || r.status === 401) {
      return { ok: false, errorResponse: jsonError(402, "Anthropic provider rejected the request (auth or credits).", "ai_provider_unauthorized") };
    }
    if (!r.ok) {
      const t = await r.text();
      console.error("anthropic error", r.status, t);
      return { ok: false, errorResponse: jsonError(500, "AI provider error", "ai_provider_error") };
    }
    const json = await r.json();
    return { ok: true, provider, model, data: fromAnthropicResponse(json) };
  }

  // ---- OPENAI-COMPATIBLE (lovable / openai / azure / ollama) ----
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (provider === "azure_openai") {
    headers["api-key"] = apiKey!;
  } else if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.tool_choice ? { tool_choice: opts.tool_choice } : {}),
    ...(opts.response_format ? { response_format: opts.response_format } : {}),
    ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
    ...(opts.stream ? { stream: true } : {}),
  };

  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (r.status === 429) return { ok: false, errorResponse: jsonError(429, "Rate limit exceeded. Please try again shortly.", "rate_limited") };
  if (r.status === 402) return { ok: false, errorResponse: jsonError(402, "AI credits exhausted. Add funds in Settings → Workspace → Usage, or buy a credit pack.", "ai_credits_exhausted") };
  if (r.status === 401) return { ok: false, errorResponse: jsonError(500, `AI provider "${provider}" rejected the API key.`, "ai_provider_unauthorized") };
  if (!r.ok) {
    const t = await r.text();
    console.error(`${provider} error`, r.status, t);
    return { ok: false, errorResponse: jsonError(500, "AI provider error", "ai_provider_error") };
  }

  if (opts.stream) {
    return { ok: true, provider, model, body: r.body };
  }
  const data = await r.json();
  return { ok: true, provider, model, data };
}
