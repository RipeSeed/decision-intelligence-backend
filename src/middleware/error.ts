import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { GaxiosError } from "gaxios";
import { ClaudeFormatError, GmailFetchError, NotAuthenticatedError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";

interface ErrorBody {
  error: string;
  message: string;
  hint?: string;
  details?: unknown;
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const { status, body } = mapError(err);
  if (status >= 500) {
    logger.error({ err }, "unhandled error");
  } else {
    logger.warn({ err }, "request error");
  }
  res.status(status).json(body);
};

function mapError(err: unknown): { status: number; body: ErrorBody } {
  if (err instanceof NotAuthenticatedError) {
    return {
      status: 401,
      body: {
        error: "not_authenticated",
        message: err.message,
        hint: "Open GET /auth/google in a browser to authenticate.",
      },
    };
  }

  if (err instanceof ZodError) {
    return {
      status: 400,
      body: {
        error: "validation_error",
        message: "Request validation failed.",
        details: err.issues,
      },
    };
  }

  if (err instanceof ClaudeFormatError) {
    return {
      status: 502,
      body: {
        error: "claude_format_error",
        message: err.message,
      },
    };
  }

  if (err instanceof Anthropic.APIError) {
    return {
      status: err.status && err.status >= 400 && err.status < 600 ? err.status : 502,
      body: {
        error: "anthropic_error",
        message: err.message,
      },
    };
  }

  if (err instanceof GmailFetchError || err instanceof GaxiosError) {
    const status = (err as GaxiosError).status ?? (err as GaxiosError).response?.status;
    if (status === 401 || status === 403) {
      return {
        status: 401,
        body: {
          error: "google_auth_error",
          message: "Google rejected the credentials. Re-authenticate.",
          hint: "Open GET /auth/google in a browser.",
        },
      };
    }
    return {
      status: 502,
      body: {
        error: "gmail_error",
        message: err instanceof Error ? err.message : "Gmail request failed.",
      },
    };
  }

  return {
    status: 500,
    body: {
      error: "internal_error",
      message: "An unexpected error occurred.",
    },
  };
}
