import { convert as htmlToText } from "html-to-text";
import type { gmail_v1 } from "googleapis";
import type { Email } from "../types/email.js";

type Schema$Message = gmail_v1.Schema$Message;
type Schema$MessagePart = gmail_v1.Schema$MessagePart;

function decodeBase64Url(data: string): string {
  return Buffer.from(data, "base64url").toString("utf8");
}

function header(parts: gmail_v1.Schema$MessagePartHeader[] | undefined, name: string): string {
  if (!parts) return "";
  const found = parts.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return found?.value ?? "";
}

function findFirstPartByMime(
  part: Schema$MessagePart | undefined,
  mime: string,
): Schema$MessagePart | undefined {
  if (!part) return undefined;
  if (part.mimeType === mime && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findFirstPartByMime(child, mime);
    if (hit) return hit;
  }
  return undefined;
}

function partText(part: Schema$MessagePart | undefined): string {
  const data = part?.body?.data;
  return data ? decodeBase64Url(data) : "";
}

function stripQuotedReplies(text: string): string {
  const replyMarker = text.search(/^On .{1,200}wrote:\s*$/im);
  let working = replyMarker >= 0 ? text.slice(0, replyMarker) : text;

  working = working
    .split("\n")
    .filter((line) => !/^\s*>/.test(line))
    .join("\n");

  return working;
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractBody(message: Schema$Message): string {
  const payload = message.payload;
  if (!payload) return "";

  if (payload.body?.data && !payload.parts?.length) {
    if (payload.mimeType === "text/html") {
      return htmlToText(decodeBase64Url(payload.body.data), {
        wordwrap: false,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "a", options: { ignoreHref: true } },
        ],
      });
    }
    return decodeBase64Url(payload.body.data);
  }

  const plain = findFirstPartByMime(payload, "text/plain");
  if (plain) return partText(plain);

  const html = findFirstPartByMime(payload, "text/html");
  if (html) {
    return htmlToText(partText(html), {
      wordwrap: false,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { ignoreHref: true } },
      ],
    });
  }

  return "";
}

export interface ParseOptions {
  maxBodyChars: number;
}

export function parseGmailMessage(message: Schema$Message, opts: ParseOptions): Email {
  const headers = message.payload?.headers ?? [];
  const subject = header(headers, "Subject") || "(no subject)";
  const from = header(headers, "From") || "(unknown sender)";
  const dateHeader = header(headers, "Date");

  const date = (() => {
    if (!dateHeader) return new Date(Number(message.internalDate ?? 0)).toISOString();
    const parsed = new Date(dateHeader);
    return Number.isNaN(parsed.getTime()) ? dateHeader : parsed.toISOString();
  })();

  const rawBody = extractBody(message);
  const cleaned = normalizeWhitespace(stripQuotedReplies(rawBody));
  const body =
    cleaned.length > opts.maxBodyChars
      ? `${cleaned.slice(0, opts.maxBodyChars)}\n\n[...truncated to ${opts.maxBodyChars} chars]`
      : cleaned;

  return {
    id: message.id ?? "",
    threadId: message.threadId ?? "",
    from,
    subject,
    date,
    snippet: message.snippet ?? "",
    body,
  };
}
