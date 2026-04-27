export class NotAuthenticatedError extends Error {
  constructor(message = "Not authenticated with Google. Visit GET /auth/google to begin.") {
    super(message);
    this.name = "NotAuthenticatedError";
  }
}

export class ClaudeFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaudeFormatError";
  }
}

export class GmailFetchError extends Error {
  public override readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "GmailFetchError";
    this.cause = cause;
  }
}
