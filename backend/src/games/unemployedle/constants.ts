const parsePositiveNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const MAX_GUESSES = 7;
export const CACHE_TTL_MS = 10 * 60 * 1000;
export const CACHE_MAX_ENTRIES = 30;
export const MAX_RESUME_CHARS = 4000;
export const OPENAI_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
export const OPENAI_API_URL =
  process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
export const OPENAI_MAX_TOKENS = parsePositiveNumber(
  process.env.OPENAI_MAX_TOKENS,
  1800,
);
export const OPENAI_RANKING_MAX_TOKENS = parsePositiveNumber(
  process.env.OPENAI_RANKING_MAX_TOKENS,
  900,
);
export const SERPAPI_API_URL =
  process.env.SERPAPI_API_URL ?? 'https://serpapi.com/search.json';
export const SERPAPI_API_KEY = process.env.SERPAPI_API_KEY ?? '';
export const JOB_BOARD_SEARCH_TIMEOUT_MS = parsePositiveNumber(
  process.env.JOB_BOARD_SEARCH_TIMEOUT_MS,
  15000,
);
export const JOB_BOARD_MAX_RESULTS_PER_QUERY = parsePositiveNumber(
  process.env.JOB_BOARD_MAX_RESULTS_PER_QUERY,
  10,
);
export const JOB_BOARD_MAX_GOOGLE_JOBS_QUERIES = parsePositiveNumber(
  process.env.JOB_BOARD_MAX_GOOGLE_JOBS_QUERIES,
  6,
);
export const JOB_BOARD_MAX_BOARD_QUERIES = parsePositiveNumber(
  process.env.JOB_BOARD_MAX_BOARD_QUERIES,
  3,
);
export const JOB_BOARD_MAX_FORTUNE_QUERIES = parsePositiveNumber(
  process.env.JOB_BOARD_MAX_FORTUNE_QUERIES,
  2,
);
export const JOB_BOARD_MAX_TOTAL_RESULTS = parsePositiveNumber(
  process.env.JOB_BOARD_MAX_TOTAL_RESULTS,
  80,
);
export const COMPANY_SIZE_LIMITS = {
  large: 4,
  mid: 4,
  startup: 4,
} as const;
export const DEFAULT_RATING = 4.0;
export const UNEMPLOYEDLE_RATE_LIMIT_WINDOW_MS = parsePositiveNumber(
  process.env.UNEMPLOYEDLE_RATE_LIMIT_WINDOW_MS,
  10 * 60 * 1000,
);
export const UNEMPLOYEDLE_RATE_LIMIT_MAX_REQUESTS = parsePositiveNumber(
  process.env.UNEMPLOYEDLE_RATE_LIMIT_MAX_REQUESTS,
  6,
);
