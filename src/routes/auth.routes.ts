import { Router } from "express";
import { z } from "zod";
import {
  GMAIL_SCOPES,
  createOAuthClient,
  saveTokens,
} from "../lib/google-oauth.js";
import { logger } from "../lib/logger.js";

const CallbackQuery = z.object({
  code: z.string().min(1).optional(),
  error: z.string().optional(),
});

export const authRouter = Router();

authRouter.get("/google", (_req, res) => {
  const client = createOAuthClient();
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GMAIL_SCOPES,
  });
  res.redirect(url);
});

authRouter.get("/google/callback", async (req, res) => {
  const parsed = CallbackQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).type("html").send(errorPage("Malformed callback query."));
    return;
  }

  const { code, error } = parsed.data;
  if (error) {
    res.status(400).type("html").send(errorPage(`Google returned an error: ${error}`));
    return;
  }
  if (!code) {
    res.status(400).type("html").send(errorPage("Missing authorization code."));
    return;
  }

  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);

  logger.info(
    {
      hasRefreshToken: Boolean(tokens.refresh_token),
      scopes: tokens.scope,
    },
    "google oauth tokens persisted",
  );

  res.type("html").send(successPage());
});

function successPage(): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Authenticated</title>
  <style>body{font-family:system-ui,sans-serif;margin:3rem auto;max-width:36rem;padding:0 1rem;color:#222}
  code{background:#f4f4f5;padding:.15rem .35rem;border-radius:4px}</style></head>
  <body><h1>✅ Authenticated</h1>
  <p>Tokens saved. You can close this tab and trigger an analysis:</p>
  <pre><code>curl -s -X POST http://localhost:3000/decisions | jq .</code></pre>
  </body></html>`;
}

function errorPage(message: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Auth error</title>
  <style>body{font-family:system-ui,sans-serif;margin:3rem auto;max-width:36rem;padding:0 1rem;color:#222}</style></head>
  <body><h1>❌ Authentication failed</h1><p>${escapeHtml(message)}</p>
  <p><a href="/auth/google">Try again</a></p></body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}
