# C-Bot

A self-hosted RAG engine for building company AI chatbots. Own your data,
choose your LLM provider, and either use the built-in widget or plug the
headless API into a fully custom UI.

## Why this exists

Most "build your own AI chatbot" tools give you a fixed, pre-styled widget.
This framework treats the widget as *optional*: the core API is headless
by design, so your dev team can build any interface — sidebar panel,
full-page assistant, whatever matches your product — while non-technical
teams can just drop in the default widget and be done in five minutes.

## Architecture

```
c-bot/
├── core_engine/     # RAG pipeline: ingestion, chunking, embeddings, retrieval
├── api_server/      # FastAPI server exposing /v1/chat, /v1/ingest, /v1/sync
├── admin_ui/        # React + Vite + Tailwind control panel (dashboard, knowledge base, logs, settings)
└── examples/        # Default widget + headless API client + React example
```

Everything (admin panel, default widget, and any custom UI) talks to the
same `/v1/chat` endpoint. There's no special privileged frontend.

## Quick start

### 1. Configure

```bash
cp .env.example .env
# edit .env: set LLM_API_KEY and API_SECRET_KEY
```

### 2. Run with Docker

If plain `docker` (without `sudo`) gives a permission error, either
prefix every command below with `sudo`, or run
`sudo usermod -aG docker $USER` once and log out/in to avoid needing
`sudo` for Docker going forward.

Also note: newer Docker installs use the `docker compose` command
(with a space) instead of the older standalone `docker-compose` binary.
This README uses `docker compose` — swap in `docker-compose` if that's
what your install has.

```bash
# First-time setup only: pre-create the data folder with the right
# ownership. Without this, Docker auto-creates it as root on first run,
# and the container's non-root user won't be able to write to it.
mkdir -p data/vectorstore
sudo chown -R 1000:1000 data

sudo docker compose up --build
```

- API server: `http://localhost:8000` (docs at `/docs`)
- Admin panel: `http://localhost:3000`

### 3. Or run locally without Docker

```bash
pip install -r requirements.txt
uvicorn api_server.main:app --reload
# in another terminal, run the admin panel in dev mode:
cd admin_ui && npm install && npm run dev
```
The admin panel opens on `http://localhost:5173` in dev mode (Vite's
default), or `http://localhost:3000` when built and served via Docker.

On first load, the admin panel asks you to connect: enter your API URL
(`http://localhost:8000`) and the `API_SECRET_KEY` from your `.env`.

### Note for existing setups: container now runs as non-root

If you set this up before this change, stop the containers, then fix
`./data` ownership the same way as the first-time setup above:

```bash
sudo docker compose down
sudo chown -R 1000:1000 ./data
sudo docker compose up --build
```

### Making code changes after the first setup

**Backend** (`core_engine/`, `api_server/`) is mounted as volumes and the
server runs with `--reload`, so **most changes need no rebuild at all** —
just save the file and the API server auto-restarts itself (watch it
happen in `sudo docker compose logs -f api_server`).

**Admin panel** (`admin_ui/`) is a React app — it's compiled at build
time, so changes there need a rebuild:
```bash
sudo docker compose up --build admin_ui
```
For faster iteration while actively developing the panel, run it outside
Docker with hot-reload instead: `cd admin_ui && npm run dev`.

You only need to rebuild the **API server** when:
- `requirements.txt` changes (new/updated Python packages)
- `Dockerfile` itself changes

Otherwise, if containers are already running, backend changes apply
automatically. If containers are stopped, `sudo docker compose up -d`
(no `--build`) is enough.

## Adding company data

Use the admin panel, or call the API directly:

```bash
# Upload a PDF
curl -X POST http://localhost:8000/v1/ingest/file \
  -H "X-API-Key: your-secret" \
  -F "file=@company_faq.pdf"

# Add a website page
curl -X POST http://localhost:8000/v1/ingest/url \
  -H "X-API-Key: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://yourcompany.com/faq"}'
```

When your website content changes, re-sync just that page instead of
re-ingesting everything:

```bash
curl -X POST "http://localhost:8000/v1/sync/https%3A%2F%2Fyourcompany.com%2Ffaq" \
  -H "X-API-Key: your-secret"
```

Old chunks for that source are replaced automatically — no duplicates.

## Two API keys — admin vs. public chat

This project uses **two separate keys**, not one:

- **`API_SECRET_KEY`** (set in `.env`) — full access: knowledge base,
  settings, logs, ingestion. **Never put this in a public-facing
  frontend** — it's for the admin panel only.
- **Public chat key** — auto-generated on first use, only unlocks
  `/v1/chat` and `/v1/chat/stream`. This is the key meant to be embedded
  in the default widget or a custom chat UI. It's expected to be visible
  in your website's page source (anyone can "View Source" a widget embed),
  so it's scoped to do nothing but chat, and rate-limited
  (`RATE_LIMIT_PER_MINUTE` in `.env`, default 20/minute per IP) to limit
  abuse if it gets scraped.

Find and rotate the public chat key from the admin panel's **Integration**
page, or via the API:
```bash
curl http://localhost:8000/v1/admin/chat-key -H "X-API-Key: your-admin-secret"
curl -X POST http://localhost:8000/v1/admin/chat-key/regenerate -H "X-API-Key: your-admin-secret"
```
Rotating it immediately invalidates any previously embedded widgets —
update them with the new key.

### Domain restriction

For extra protection against a copied/leaked public chat key being reused
on a different website, restrict it to specific domains from the admin
panel's Integration page (or `PUT /v1/admin/allowed-domains`). Requests
are checked against the browser's `Origin`/`Referer` header — leave the
list empty to allow any domain (relying on scope + rate limiting alone).
Note this only affects browser-based requests; non-browser clients using
the public key aren't checked this way.

## Two ways to build the chat interface

### Option A — Default widget (fastest)

A floating launcher button that opens a slide-in side panel — no build
step, no dependencies, works by dropping in a `<script>` tag:

```html
<script src="widget.js"
  data-api-url="http://localhost:8000"
  data-api-key="your-PUBLIC-chat-key"
  data-bot-name="Company Assistant"
  data-accent-color="#3454D1"
  data-greeting="Hi! Ask me anything about us."
  data-position="right">
</script>
```

`data-position` can be `"right"` (default) or `"left"`. See
`examples/vanilla_js_widget/demo.html` for a working page.

### Option B — Fully custom UI (headless)

Call `/v1/chat` directly from any frontend you build:

```js
const res = await fetch("http://localhost:8000/v1/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-API-Key": "your-PUBLIC-chat-key" },
  body: JSON.stringify({ question: "What are your business hours?" }),
});
const { answer, sources } = await res.json();
```

See `examples/react_custom_ui_example/CustomChatUI.jsx` for a full example,
or `examples/vanilla_js_widget/api_client.js` for a minimal reusable client.

### Streaming responses

For a word-by-word "typing" effect instead of waiting for the full answer,
use `/v1/chat/stream` (Server-Sent Events) instead of `/v1/chat`. Both the
default widget and the React example already use streaming. See
`CompanyBotClient.askStream()` in `examples/vanilla_js_widget/api_client.js`
for a minimal reference implementation — it uses `fetch` + manual SSE
parsing rather than the native `EventSource` API, because `EventSource`
can't send the `X-API-Key` header.

### Error responses

Failures (bad/missing LLM API key, rate limits, provider outages, bad
file uploads, dead URLs) return clean JSON instead of a raw stack trace:

```json
{ "detail": "The LLM provider rejected the API key. Check LLM_API_KEY in your .env." }
```

with an appropriate HTTP status code (401 for auth issues, 429 for rate
limits, 502 for provider/network failures, 400 for bad input).

## Switching LLM providers

**Recommended: use the admin panel** — Bot Settings → AI Provider lets
you change provider, model, base URL, and API key at runtime, no restart
needed. Keys entered there are write-only (see the Security section
below).

**Or edit `.env`** (used as the default until an admin-panel override is
saved):

```bash
LLM_PROVIDER=gemini
LLM_API_KEY=your-gemini-key
LLM_MODEL=gemini-1.5-flash
```

Local/self-hosted models (Ollama, vLLM, LM Studio) work too via
`LLM_PROVIDER=local` + `LLM_BASE_URL`. OpenRouter also works this way:

```bash
LLM_PROVIDER=local
LLM_API_KEY=your-openrouter-key
LLM_MODEL=openai/gpt-4o-mini
LLM_BASE_URL=https://openrouter.ai/api/v1
```

## Embeddings without any paid API key

Set `EMBEDDING_PROVIDER=local` (the default) to use `sentence-transformers`
— runs entirely on your own machine, downloads a small (~80MB) model once,
then works fully offline with zero cost:

```bash
EMBEDDING_PROVIDER=local
EMBEDDING_MODEL=all-MiniLM-L6-v2
```

Note: OpenRouter and most LLM-only proxies don't serve embeddings, so even
if your `LLM_PROVIDER` is OpenRouter, you still need `EMBEDDING_PROVIDER=local`
(free) or a real OpenAI/Gemini key for embeddings specifically. This is
also configurable from the admin panel.

Changing the embedding provider/model doesn't retroactively re-embed
existing documents — re-upload files or re-sync URLs afterward if you
want them on the new model.

## Provider keys: admin-panel vs. `.env` — security notes

The admin panel can set/replace LLM and embedding API keys, but it's
**write-only by design**: no API response, including to the admin panel
itself, ever returns an existing key's value — only whether one is set.
This keeps the risk equivalent to editing `.env` by hand (a key sitting
on disk, readable only with server/filesystem access), while adding the
convenience of changing it without a restart.

What this does **not** protect against: if your SQLite `data/app.db` file
or your `.env` file leaks (backup exposure, server compromise), whichever
key is active would leak too — that risk exists either way. Keep both
out of version control (already in `.gitignore`) and restrict who has
server/admin access.

## Admin panel features

A full **React + Vite + Tailwind** control panel — dashboard overview,
sidebar navigation, toast notifications, loading states, empty states —
built as a standalone SPA that talks to the same `/v1/*` API endpoints
documented at `/docs`.

- **Dashboard** — at-a-glance stats (sources, chunks, questions asked,
  unanswered %, auto-sync status) plus a questions-over-time chart
- **Knowledge Base** — upload documents (**PDF, DOCX, CSV, TXT, MD**) or
  add website URLs, re-sync or delete sources, drag-and-drop style upload
- **System prompt editor** — change bot behavior/tone at runtime, no restart needed
- **AI provider settings** — switch LLM/embedding provider, model, base URL, and
  API keys at runtime (write-only keys — see security notes above)
- **Prompt & chat logs** — every question shows the *exact final prompt* sent to
  the LLM (retrieved context + system prompt + question), the answer, and
  whether it was flagged as "unanswered" (knowledge gap), in a searchable
  table with a detail modal. Filter to unanswered-only to see what your
  knowledge base is missing.
  ⚠️ **Security note**: logged prompts include retrieved company data, which
  may be sensitive. Keep `API_SECRET_KEY` private and treat `/v1/admin/*`
  routes as internal-only. Consider adding a log retention/auto-clear policy
  before using this in production with sensitive data.
- **Log auto-clear** — set a retention period (days); older chat logs are
  deleted automatically in the background (checked once a day). Set to 0
  to disable and keep logs until manually cleared.
- **Scheduled auto-sync** — enable and set an interval (hours) to
  automatically re-fetch every URL source in the background, so website
  content changes get picked up without manually clicking "Re-sync". A
  "Sync all URLs now" button is also available for on-demand syncing.
- **Integration page** — copy-paste-ready embed code for the default
  widget and the headless API, with your current API URL/key already
  filled in

## Roadmap ideas

- [ ] FAISS as an alternative vector backend
- [ ] Unit test suite (pytest)

## License

MIT — use freely, contributions welcome.
