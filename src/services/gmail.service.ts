import { google } from "googleapis";
import type { Auth } from "googleapis";
import { env } from "../config/env.js";
import { logger } from "../lib/logger.js";
import { GmailFetchError } from "../lib/errors.js";
import { getAuthenticatedClient } from "../lib/google-oauth.js";
import { parseGmailMessage } from "./gmail-parser.js";
import type { Email } from "../types/email.js";

export interface FetchOptions {
  hours: number;
  max: number;
}

export async function fetchRecentEmails(opts: FetchOptions): Promise<Email[]> {
  const auth = await getAuthenticatedClient();
  return fetchRecentEmailsWith(auth, opts);
}

export async function fetchRecentEmailsWith(
  auth: Auth.OAuth2Client,
  opts: FetchOptions,
): Promise<Email[]> {
  const gmail = google.gmail({ version: "v1", auth });

  const query = `newer_than:${opts.hours}h -in:chats`;

  let listResponse;
  try {
    listResponse = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: opts.max,
    });
  } catch (err) {
    throw new GmailFetchError("Failed to list Gmail messages", err);
  }

  const messageRefs = listResponse.data.messages ?? [];
  logger.info({ count: messageRefs.length, query }, "gmail list");

  if (messageRefs.length === 0) return [];

  const messages = await Promise.all(
    messageRefs.map(async (ref) => {
      try {
        const res = await gmail.users.messages.get({
          userId: "me",
          id: ref.id!,
          format: "full",
        });
        return parseGmailMessage(res.data, { maxBodyChars: env.EMAIL_MAX_BODY_CHARS });
      } catch (err) {
        logger.warn({ err, id: ref.id }, "failed to fetch a message; skipping");
        return null;
      }
    }),
  );

  return messages.filter((m): m is Email => m !== null);
}
