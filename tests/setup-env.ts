// Set required env vars BEFORE the env module is imported by any test.
process.env.GOOGLE_CLIENT_ID = "test-client-id";
process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/auth/google/callback";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
