# AI Provider Configuration

On-prem installs default to a **local Ollama** running in the same Compose
stack. You can switch to OpenAI, Azure OpenAI, Anthropic, Google Gemini, the
**Lovable AI Gateway**, or any OpenAI-compatible endpoint at any time.

The platform uses AI for: ticket-intake conversations, KB embedding & semantic
search, KB suggestions on tickets, weekly status report summarisation, ticket
summarisation, risk insights, AI Advisor, AI Wizards, the "Ask the Task
Master" assistant, and reply drafting. Each consumer can be enabled/disabled
in `ai_provider_settings.enabled_modules`.


## Local Ollama (default)

The `ollama` service in `docker-compose.yml` runs in the `ollama` profile.
It is started automatically by `install.sh` when `AI_PROVIDER=ollama`.

Pull a model after install:

```bash
docker compose exec ollama ollama pull llama3.1:8b
```

For better quality at higher cost:

```bash
docker compose exec ollama ollama pull llama3.1:70b   # needs ~40GB RAM/VRAM
```

Update `AI_DEFAULT_MODEL` in `.env` and restart `edge`:

```bash
docker compose restart edge
```

## OpenAI

```env
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_DEFAULT_MODEL=gpt-4o-mini
AI_API_KEY=sk-...
```

## Azure OpenAI

```env
AI_PROVIDER=openai          # uses OpenAI-compatible client
AI_BASE_URL=https://<resource>.openai.azure.com/openai/deployments/<deployment>
AI_DEFAULT_MODEL=<deployment-name>
AI_API_KEY=<azure-key>
```

## Anthropic

```env
AI_PROVIDER=anthropic
AI_BASE_URL=https://api.anthropic.com/v1
AI_DEFAULT_MODEL=claude-3-5-sonnet-20241022
AI_API_KEY=sk-ant-...
```

## Google Gemini (direct)

```env
AI_PROVIDER=google
AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
AI_DEFAULT_MODEL=gemini-2.5-flash
AI_API_KEY=<google-api-key>
```

Supported model identifiers include `gemini-2.5-pro`, `gemini-2.5-flash`,
`gemini-2.5-flash-lite`, and the preview models
`gemini-3.1-pro-preview`, `gemini-3-flash-preview`,
`gemini-3-pro-image-preview`, `gemini-3.1-flash-image-preview`.

## Lovable AI Gateway

A managed multi-provider gateway that exposes Google, OpenAI and image-gen
models behind a single endpoint with a single key. Recommended when you want
no per-provider account management.

```env
AI_PROVIDER=lovable
AI_BASE_URL=https://ai.gateway.lovable.dev/v1
AI_DEFAULT_MODEL=google/gemini-2.5-flash
AI_API_KEY=<lovable-ai-key>
```

Currently supported model strings:

| Model                                   | Best for |
|-----------------------------------------|----------|
| `google/gemini-2.5-pro`                 | Heavy reasoning, multimodal, long context |
| `google/gemini-2.5-flash`               | Balanced default for most workloads |
| `google/gemini-2.5-flash-lite`          | High-volume classification / summarisation |
| `google/gemini-3.1-pro-preview`         | Latest preview, strongest reasoning |
| `google/gemini-3-flash-preview`         | Fast preview, balanced |
| `google/gemini-3-pro-image-preview`     | Image generation |
| `google/gemini-3.1-flash-image-preview` | Fast image generation/editing |
| `openai/gpt-5`                          | All-rounder, top accuracy |
| `openai/gpt-5-mini`                     | Cheaper GPT-5 with most reasoning |
| `openai/gpt-5-nano`                     | Highest throughput, cheapest GPT-5 |
| `openai/gpt-5.2`                        | Latest OpenAI reasoning model |

Cloud builds default to this gateway. On-prem operators may also point to it,
or self-host with Ollama / direct providers above.

## Per-organization overrides

Each org can override the global provider via **Settings → AI Provider**
(visible to org admins). The override is stored in
`ai_provider_settings` with `scope='organization'` and takes precedence
over the global default.

## Disabling AI entirely

Leave `AI_DEFAULT_MODEL` blank and set every entry in
`ai_provider_settings.enabled_modules` to `false`. The UI hides AI features
when no provider is configured.

## Verifying

```bash
curl -fsS http://<host>/functions/v1/ai-summarize \
  -H "Authorization: Bearer <service-role-key>" \
  -d '{"scope_type":"test","scope_id":"00000000-0000-0000-0000-000000000000"}'
```

A `200` with a JSON body confirms the provider is reachable. Check
`docker compose logs edge` if it fails.
