import { describe, expect, it } from "vitest";
import type { gmail_v1 } from "googleapis";
import { parseGmailMessage } from "../src/services/gmail-parser.js";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");

function makeMessage(payload: gmail_v1.Schema$MessagePart): gmail_v1.Schema$Message {
  return {
    id: "abc123",
    threadId: "thr1",
    internalDate: String(Date.UTC(2026, 3, 27, 12, 0, 0)),
    snippet: "snippet text",
    payload,
  };
}

const headers = (overrides: Partial<Record<string, string>> = {}) => [
  { name: "From", value: "Alice <alice@example.com>" },
  { name: "Subject", value: "Q2 budget review" },
  { name: "Date", value: "Mon, 27 Apr 2026 09:30:00 -0500" },
  ...Object.entries(overrides).map(([name, value]) => ({ name, value: value ?? "" })),
];

describe("parseGmailMessage", () => {
  it("extracts plain headers and decodes single-part text/plain body", () => {
    const message = makeMessage({
      mimeType: "text/plain",
      headers: headers(),
      body: { data: b64url("Please review the attached numbers before Thursday.") },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });

    expect(email.id).toBe("abc123");
    expect(email.from).toBe("Alice <alice@example.com>");
    expect(email.subject).toBe("Q2 budget review");
    expect(email.date).toBe("2026-04-27T14:30:00.000Z");
    expect(email.body).toBe("Please review the attached numbers before Thursday.");
  });

  it("prefers text/plain inside a multipart/alternative tree", () => {
    const message = makeMessage({
      mimeType: "multipart/alternative",
      headers: headers(),
      parts: [
        {
          mimeType: "text/plain",
          body: { data: b64url("Plain version of the message.") },
        },
        {
          mimeType: "text/html",
          body: { data: b64url("<p>HTML version of the message.</p>") },
        },
      ],
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });
    expect(email.body).toBe("Plain version of the message.");
  });

  it("falls back to text/html and converts to text when no plain part exists", () => {
    const html = "<h1>Title</h1><p>Hello <b>world</b>!</p><img src='x'/><a href='y'>link</a>";
    const message = makeMessage({
      mimeType: "text/html",
      headers: headers(),
      body: { data: b64url(html) },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });
    expect(email.body.toLowerCase()).toContain("title");
    expect(email.body).toContain("Hello world!");
    expect(email.body).not.toContain("<");
  });

  it("strips quoted reply trails", () => {
    const body = [
      "Confirming the call for Friday.",
      "",
      "On Mon, Apr 27, 2026 at 9:00 AM, Bob <bob@example.com> wrote:",
      "> Are we still on for Friday?",
      "> Let me know.",
    ].join("\n");

    const message = makeMessage({
      mimeType: "text/plain",
      headers: headers(),
      body: { data: b64url(body) },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });
    expect(email.body).toBe("Confirming the call for Friday.");
  });

  it("trims body to maxBodyChars and adds a truncation marker", () => {
    const long = "a".repeat(5000);
    const message = makeMessage({
      mimeType: "text/plain",
      headers: headers(),
      body: { data: b64url(long) },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 100 });
    expect(email.body.startsWith("a".repeat(100))).toBe(true);
    expect(email.body).toContain("[...truncated to 100 chars]");
  });

  it("falls back to internalDate when Date header is missing", () => {
    const message = makeMessage({
      mimeType: "text/plain",
      headers: [
        { name: "From", value: "X" },
        { name: "Subject", value: "Y" },
      ],
      body: { data: b64url("hi") },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });
    expect(email.date).toBe(new Date(Date.UTC(2026, 3, 27, 12, 0, 0)).toISOString());
  });

  it("uses default subject and from when headers are missing", () => {
    const message = makeMessage({
      mimeType: "text/plain",
      headers: [],
      body: { data: b64url("body") },
    });

    const email = parseGmailMessage(message, { maxBodyChars: 4000 });
    expect(email.subject).toBe("(no subject)");
    expect(email.from).toBe("(unknown sender)");
  });
});
