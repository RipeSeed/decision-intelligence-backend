# Decision Intelligence Backend

Pulls the user's last 24 hours of Gmail, sends the messages to the Claude API, and returns the **3 most important executive decisions** as structured JSON — including hidden risks and "what you're not seeing" insights.

## Stack

Node 20+ · TypeScript (ESM, strict) · Express 5 · `googleapis` · `@anthropic-ai/sdk` · `zod` · `pino` · `vitest`

## How it works

1. `GET /auth/google` → redirects you to Google consent for `gmail.readonly`.
2. `GET /auth/google/callback` → exchanges the code, persists tokens to `.tokens/tokens.json`.
3. `POST /decisions` →
   1. Lists Gmail messages in the last `EMAIL_FETCH_HOURS` (`newer_than:24h`).
   2. Fetches and parses each message (prefers `text/plain`, falls back to HTML stripped to text, trims to a char budget).
   3. Calls Claude with a **forced tool-use** schema that matches the spec exactly — guarantees clean JSON, no truncation, no fence parsing.
   4. zod-validates the model's tool input as defense-in-depth.
   5. Returns `{ decisions: Decision[3], source: { emailCount, windowHours } }` and pretty-prints the same JSON to the server console.

## Setup

```bash
cp .env.example .env
# fill in GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / ANTHROPIC_API_KEY
npm install
npm run dev
```

### Google Cloud Console (one-time)

1. Create a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable the **Gmail API**.
3. Configure the **OAuth consent screen** (User Type: External, Publishing status: Testing). Add yourself as a Test user.
4. Create OAuth credentials → **Web application**. Authorized redirect URI: `http://localhost:3000/auth/google/callback`.
5. Copy Client ID and Client Secret into `.env`.

### Anthropic

Get an API key at [console.anthropic.com](https://console.anthropic.com/) and put it in `.env`.

## Run

```bash
npm run dev          # tsx watch on :3000
```

Then in the browser:

```
http://localhost:3000/auth/google
```

After authenticating:

```bash
curl -s -X POST http://localhost:3000/decisions | jq .
```

The same JSON is also pretty-printed to the server console.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Hot-reload dev server (`tsx watch`) |
| `npm run build` | Type-check and emit `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run format` | Prettier write |
| `npm test` | Vitest unit tests |

## Project layout

```
src/
  server.ts            entry — listens, graceful shutdown
  app.ts               express() builder
  config/env.ts        zod-validated process.env
  lib/                 logger, anthropic client, google oauth client + token I/O
  services/            framework-agnostic Gmail + Decision logic
  routes/              auth.routes, decisions.routes
  middleware/          error handler, 404
  prompts/             system prompt, tool schema, zod schema
  types/               Email, Decision
tests/                 vitest unit tests
```

## Why forced tool-use for the Claude call?

The spec demands "JSON output is clean, structured, and usable. No errors or truncation." Free-form prompting + `JSON.parse` is the wrong tool for that — the model can wrap output in fences, truncate at `max_tokens`, or drift from the schema across runs.

We instead declare a `submit_decisions` tool whose `input_schema` exactly mirrors the spec's decision shape and call with `tool_choice: { type: "tool", name: "submit_decisions" }`. The model is **required** to emit a `tool_use` block whose `input` is schema-valid. We zod-parse it for defense-in-depth and return.

## Out of scope (prototype)

Multi-user / DB-backed token storage, frontend UI, Gmail push, deployment config. The service boundaries are designed so any of these can be added without changing `services/`.
