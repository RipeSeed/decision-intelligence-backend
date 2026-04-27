import { promises as fs } from "node:fs";
import path from "node:path";
import { google } from "googleapis";
import type { Auth } from "googleapis";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { NotAuthenticatedError } from "./errors.js";

export const GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const tokensPath = path.resolve(process.cwd(), env.TOKENS_FILE);

export function createOAuthClient(): Auth.OAuth2Client {
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  client.on("tokens", (tokens) => {
    void mergeAndSaveTokens(tokens).catch((err) => {
      logger.error({ err }, "failed to persist refreshed Google tokens");
    });
  });

  return client;
}

export async function loadTokens(): Promise<Auth.Credentials> {
  try {
    const raw = await fs.readFile(tokensPath, "utf8");
    return JSON.parse(raw) as Auth.Credentials;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new NotAuthenticatedError();
    }
    throw err;
  }
}

export async function saveTokens(tokens: Auth.Credentials): Promise<void> {
  await fs.mkdir(path.dirname(tokensPath), { recursive: true });
  await fs.writeFile(tokensPath, JSON.stringify(tokens, null, 2), { mode: 0o600 });
}

async function mergeAndSaveTokens(partial: Auth.Credentials): Promise<void> {
  let existing: Auth.Credentials = {};
  try {
    existing = JSON.parse(await fs.readFile(tokensPath, "utf8")) as Auth.Credentials;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  await saveTokens({ ...existing, ...partial });
}

export async function getAuthenticatedClient(): Promise<Auth.OAuth2Client> {
  const client = createOAuthClient();
  const tokens = await loadTokens();
  client.setCredentials(tokens);
  return client;
}
