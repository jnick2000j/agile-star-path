# AI Provider Configuration

On-prem installs default to a **local Ollama** running in the same Compose
stack. You can switch to OpenAI, Azure OpenAI, Anthropic, or any
OpenAI-compatible endpoint at any time.

> **AI features are available at every tier.** What changes by tier is
> only **where the model runs** — locally inside the Compose stack, on a
> separate GPU host, or via an external provider. No AI feature
> (Ask the Task Master, drafting, summarisation, KB semantic search,
> ticket suggestions, risk insights, etc.) is gated by deployment size.

## Choosing a provider by tier

| Tier        | Bundled Ollama (in compose)       | Recommended setup                                              |
|-------------|-----------------------------------|----------------------------------------------------------------|
| Eval        | Disabled (host too small)         | External provider (OpenAI / Azure / Anthropic) **or** point at an existing internal Ollama |
| Small       | Possible with a 3B model on CPU, but slow | External provider, or shared internal Ollama                   |
| Medium      | Works with 7B–8B on CPU if you have the RAM; **GPU strongly recommended** | Add Ollama on a 2nd GPU host *or* use an external provider |
| Large (A1)  | Works on the same VM if it has a GPU | Dedicated GPU host for Ollama, or external provider           |
| Large (A2)+ | Run Ollama on its own VM(s)       | GPU pool behind LB (see [scaling-ha.md §4.5](./scaling-ha.md#45-ai--ollama)) |

If the install host has no GPU and you don't want to provision one, use an
external provider — every AI feature works identically.

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
