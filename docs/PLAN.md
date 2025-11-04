# Project Plan: locail

## Goals
- Build a desktop translation tool (Wails: Go + React TS) that imports translation files (i18n JSON, CSV, Valve/HL VDF), translates via LLMs, and exports back to original formats or templates.
- Provider-agnostic LLM layer using Genkit (Ollama and OpenRouter first), structured JSON output, per-key non-conversational calls.
- Clean architecture, SQLite storage (mattn/go-sqlite3) with Squirrel query builder, and a polished React UI using shadcn/ui.

## Architecture & Project Structure
- Wails app with Clean Architecture layers:
  - `internal/domain/`: entities/value objects (`project.go`, `file.go`, `unit.go`, `translation.go`, `provider.go`, `job.go`, `errors.go`).
  - `internal/ports/`: pure interfaces (`Repository`, `Provider`, `Parser`, `Exporter`, `PromptRenderer`, `Logger`).
  - `internal/usecase/`: application services (`importer/`, `translator/`, `exporter/`, `providers/`, `projects/`, `jobs/`).
  - `internal/adapters/db/sqlite/`: DB repo impl; `migrations/*.sql` (embedded), `conn.go`, Squirrel queries.
  - `internal/adapters/llm/`: Genkit client + providers: `genkit/`, `ollama/`, `openrouter/` (OpenAI later).
  - `internal/adapters/parser/`: `paraglidejson/`, `valvevdf/`, `csv/` → Units.
  - `internal/adapters/exporter/`: `paraglidejson/`, `valvevdf/`, `csv/`.
  - `internal/adapters/cache/`: translation cache.
  - `internal/api/wails/`: DTOs + bound services (Projects, Files, Units, Jobs, Providers, Templates, Prompts).
  - `cmd/locail/`: entrypoint (migrate `main.go`/`app.go` later).
- Frontend (React + TS + shadcn/ui): `frontend/src/`
  - `app/` routes: `projects`, `files`, `units`, `jobs`, `settings`, `export`.
  - `components/ui/` (shadcn), `components/features/`, `lib/` (wails bridge, utils), `store/` (zustand).

## Data Model (SQLite)
- `projects(id, name, source_lang)`; `project_locales(id, project_id, locale)`
- `files(id, project_id, path, format, locale, hash)`
- `units(id, file_id, key, source_text, context, metadata_json)`
- `translations(id, unit_id, locale, text, status, provider_id, confidence, created_at)`
- `providers(id, type, name, base_url, model, api_key, options_json)`
- `provider_models(id, provider_id, name, updated_at)` (cache)
- `jobs(id, type, status, project_id, provider_id, params_json, progress, created_at)`; `job_logs(id, job_id, ts, level, message)`
- `cache(id, source_text, src_lang, tgt_lang, provider, model, translation, created_at)`
- `templates(id, scope, ref_id, type, role, body, updated_at, is_default)` (prompts)

## LLM Providers (Genkit)
- Interface: `TranslateBatch(ctx, []Segment, Params) ([]Result, error)`, `ListModels(ctx)`, `Test(ctx)`.
- Ollama: list models via `/api/tags`; configurable `base_url`, `model`.
- OpenRouter: list via `/api/v1/models`; requires `api_key`; configurable `model`.
- Structured output: enforce JSON only: `{"translation":"..."}`. Use provider JSON mode where available; otherwise validate/extract.
- One unit per request (no shared context); retries with backoff.

## Parsers & Exporters
- Paraglide i18n JSON: flat keys, ICU-like placeholders `{name}`. Preserve order and keys.
- Valve/HL VDF: `lang { language ... tokens { "key" "value" } }`; preserve tags `<sfx>`, `<clr:...>`, and `[english]` variants.
- CSV: map columns `key, source, context, comment` (configurable).
- Export to original format; additionally support Go `text/template` exporters using project/files/units/translations as input.

## Translation Pipeline
- Mask placeholders and tags before LLM; unmask after. Validate placeholder preservation.
- Deduplicate identical source strings across files/jobs; consult/write cache.
- Per-key calls; concurrency limited per provider (2–5 workers).
- Jobs: `detect_language`, `translate_units`, `translate_file`, `export`. Items per (unit, locale); progress tracked; detailed logs.

## Prompts (Editable)
- Scope: global → project → provider override; plus per-job override.
- Types: `translate_single`, `translate_file`, `detect_language`; roles: `system`, `user`.
- Default system (translate_single): “Translate from {{.SrcLang}} to {{.TgtLang}}. Preserve placeholders/tags. Return only JSON: {"translation":"..."}.”
- Default user (translate_single): includes `Project`, `FilePath`, `Key`, `Context`, `Text`.
- UI: editor with variables helper + preview.

## User Flows
1) Landing → Project list (create/select, set source + target locales).
2) Inside project → Upload files → Parse into units → Store.
3) Optionally “Detect Language” (sample units, majority vote) or set manually.
4) Select target locales → Units table shows keys/source and existing translations.
5) Start job: per-key “Translate Selected” or “Translate File (all)” for chosen locales.
6) Monitor Jobs; review diffs; approve; export (original format or template).
7) Settings → Providers: configure Ollama/OpenRouter (API key/base URL/model), list/select models, test connection.
8) Settings → Prompts: edit system/user templates; reset to defaults; preview.

## Milestones
1. DB foundation: migrations, repo layer (Squirrel), settings seed.
2. Genkit integration + providers (Ollama/OpenRouter) with model discovery.
3. Parsers (JSON, VDF, CSV) + initial import/export.
4. Translation pipeline (masking, caching, retries) + job runner + logs.
5. Wails services (Projects, Files, Units, Jobs, Providers, Templates).
6. Frontend setup: Tailwind + shadcn/ui, core screens & flows.
7. Prompt editor + template exporting; polish; docs and packaging.

## Notes
- DB path: `data/locail.db` (configurable). Driver: `github.com/mattn/go-sqlite3`.
- Frontend builds via Vite; Wails embeds `frontend/dist` using `go:embed`.
- Keep one translation per request to avoid shared context; cache to reduce cost/latency.
