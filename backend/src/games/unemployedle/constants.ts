export const MAX_GUESSES = 7;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 30;
export const MAX_RESUME_CHARS = 4000;
export const OPENAI_TIMEOUT_MS = 20000;
export const OPENAI_API_URL =
  process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const DEFAULT_RATING = 4.0;
