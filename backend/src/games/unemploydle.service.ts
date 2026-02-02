import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';

type JobSource =
  | 'LinkedIn'
  | 'Glassdoor'
  | 'Fortune 500'
  | 'Company Careers'
  | 'Indeed'
  | 'Other';

interface JobOpening {
  id: string;
  company: string;
  title: string;
  location: string;
  source: JobSource;
  rating: number;
  keywords: string[];
  url: string;
  matchScoreHint?: number;
}

interface RankedJob extends JobOpening {
  matchScore: number;
  overallScore: number;
}

interface GameState {
  id: string;
  company: string;
  maskedCompany: string;
  guessesLeft: number;
  maxGuesses: number;
  guessedLetters: Set<string>;
  incorrectGuesses: Set<string>;
  job: RankedJob;
  createdAt: number;
  selectionSummary: string;
}

export interface StartResponse {
  gameId: string;
  maskedCompany: string;
  guessesLeft: number;
  maxGuesses: number;
  status: 'in_progress' | 'won' | 'lost';
  selectionSummary: string;
  job: {
    title: string;
    location: string;
    source: JobSource;
    rating: number;
    matchScore: number;
    companyMasked: string;
  };
  guessedLetters: string[];
  incorrectGuesses: string[];
}

export interface GuessResponse extends StartResponse {
  status: 'in_progress' | 'won' | 'lost';
  alreadyGuessed: boolean;
  revealedCompany?: string;
  jobUrl?: string;
}

export interface TopJobsResponse {
  selectionSummary: string;
  jobs: Array<{
    id: string;
    company: string;
    title: string;
    location: string;
    source: JobSource;
    rating: number;
    matchScore: number;
    url: string;
  }>;
}

interface JobSearchJob {
  company?: string;
  title?: string;
  location?: string;
  source?: string;
  rating?: number;
  keywords?: string[] | string;
  url?: string;
  matchScore?: number;
  rationale?: string;
}

interface JobSearchResult {
  summary?: string;
  searchQueries?: string[];
  jobs: JobSearchJob[];
}

interface JobSearchClient {
  searchJobs(resumeText: string): Promise<JobSearchResult>;
}

interface CachedJobSearch {
  result: JobSearchResult;
  createdAt: number;
}

const MAX_GUESSES = 7;
const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 30;
const MAX_RESUME_CHARS = 4000;
const OPENAI_TIMEOUT_MS = 20000;
const OPENAI_API_URL =
  process.env.OPENAI_API_URL ?? 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
const DEFAULT_RATING = 4.0;

const KNOWN_KEYWORDS = [
  'react',
  'typescript',
  'javascript',
  'node',
  'nest',
  'graphql',
  'rest',
  'aws',
  'gcp',
  'python',
  'docker',
  'kubernetes',
  'postgres',
  'redis',
  'testing',
  'observability',
  'frontend',
  'backend',
  'fullstack',
  'ui',
  'performance',
  'accessibility',
];

const sanitizeLetter = (letter: string) => letter.trim().toUpperCase();

const maskCompanyName = (company: string, guessed: Set<string>) =>
  company
    .split('')
    .map((char) => {
      if (/[a-z]/i.test(char)) {
        const upper = char.toUpperCase();
        return guessed.has(upper) ? char : '_';
      }
      return char;
    })
    .join('');

const extractResumeKeywords = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const matches = new Set<string>();

  KNOWN_KEYWORDS.forEach((keyword) => {
    if (lower.includes(keyword)) {
      matches.add(keyword);
    }
  });

  return matches;
};

const extractKeywordsFromText = (text: string) => {
  const lower = text.toLowerCase();
  return KNOWN_KEYWORDS.filter((keyword) => lower.includes(keyword));
};

const computeMatchScore = (job: JobOpening, resumeKeywords: Set<string>) => {
  if (job.keywords.length === 0) {
    return 0.4;
  }

  const matches = job.keywords.filter((keyword) =>
    resumeKeywords.has(keyword),
  ).length;
  return matches / job.keywords.length;
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toNonEmptyString = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

const normalizeJobSource = (value: unknown): JobSource => {
  const source = String(value ?? '').toLowerCase();
  if (source.includes('linkedin')) {
    return 'LinkedIn';
  }
  if (source.includes('glassdoor')) {
    return 'Glassdoor';
  }
  if (source.includes('fortune')) {
    return 'Fortune 500';
  }
  if (source.includes('indeed')) {
    return 'Indeed';
  }
  if (source.includes('career') || source.includes('company')) {
    return 'Company Careers';
  }
  return 'Other';
};

const normalizeKeywords = (value: unknown) => {
  const keywords = Array.isArray(value)
    ? value
        .map((keyword) => String(keyword).toLowerCase().trim())
        .filter(Boolean)
    : typeof value === 'string'
      ? value
          .split(/[,/|]/)
          .map((keyword) => keyword.toLowerCase().trim())
          .filter(Boolean)
      : [];

  return Array.from(new Set(keywords));
};

const normalizeMatchScore = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (value > 1) {
    return clampNumber(value / 100, 0, 1);
  }

  return clampNumber(value, 0, 1);
};

const buildJobId = (
  company: string,
  title: string,
  location: string,
  url: string,
) =>
  createHash('sha256')
    .update(`${company}|${title}|${location}|${url}`)
    .digest('hex')
    .slice(0, 12);

const buildFallbackUrl = (
  source: JobSource,
  company: string,
  title: string,
  location: string,
) => {
  const query = encodeURIComponent(`${title} ${company} ${location}`.trim());
  switch (source) {
    case 'LinkedIn':
      return `https://www.linkedin.com/jobs/search/?keywords=${query}`;
    case 'Glassdoor':
      return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${query}`;
    case 'Indeed':
      return `https://www.indeed.com/jobs?q=${query}`;
    case 'Company Careers':
      return `https://www.google.com/search?q=${encodeURIComponent(
        `${company} careers ${title}`,
      )}`;
    case 'Fortune 500':
    case 'Other':
    default:
      return `https://www.google.com/search?q=${query}`;
  }
};

const normalizeUrl = (
  value: unknown,
  source: JobSource,
  company: string,
  title: string,
  location: string,
) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  return buildFallbackUrl(source, company, title, location);
};

const safeParseJson = (text: string) => {
  const cleaned = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
};

const truncateText = (text: string, maxChars: number) =>
  text.length > maxChars ? text.slice(0, maxChars) : text;

const buildSelectionSummary = (
  result: JobSearchResult,
  suffix: string,
) => {
  const summary =
    toNonEmptyString(result.summary) ??
    'ChatGPT searched job sites for the best resume matches.';
  const queries = Array.isArray(result.searchQueries)
    ? result.searchQueries.map((query) => String(query).trim()).filter(Boolean)
    : [];
  const querySnippet = queries.length
    ? `Search queries: ${queries.slice(0, 3).join(' | ')}.`
    : '';

  return [summary, querySnippet, suffix].filter(Boolean).join(' ');
};

const normalizeJobResults = (jobs: JobSearchJob[]) => {
  const normalized: JobOpening[] = [];
  const seen = new Set<string>();

  jobs.forEach((job) => {
    const company = toNonEmptyString(job.company);
    const title = toNonEmptyString(job.title);
    if (!company || !title) {
      return;
    }

    const location = toNonEmptyString(job.location) ?? 'Remote';
    const source = normalizeJobSource(job.source);
    const rating = clampNumber(
      typeof job.rating === 'number' ? job.rating : DEFAULT_RATING,
      1,
      5,
    );
    const providedKeywords = normalizeKeywords(job.keywords);
    const keywords =
      providedKeywords.length > 0
        ? providedKeywords
        : extractKeywordsFromText(`${title} ${company} ${location}`);
    const url = normalizeUrl(job.url, source, company, title, location);
    const matchScoreHint = normalizeMatchScore(job.matchScore) ?? undefined;
    const id = buildJobId(company, title, location, url);
    const key = `${company.toLowerCase()}|${title.toLowerCase()}|${location.toLowerCase()}`;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    normalized.push({
      id,
      company,
      title,
      location,
      source,
      rating,
      keywords,
      url,
      matchScoreHint,
    });
  });

  return normalized;
};

class ChatGptJobSearchClient implements JobSearchClient {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = OPENAI_MODEL;
  private readonly apiUrl = OPENAI_API_URL;
  private readonly logger = new Logger(ChatGptJobSearchClient.name);

  constructor(private readonly fetcher: typeof fetch = fetch) {}

  async searchJobs(resumeText: string): Promise<JobSearchResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for job search.',
      );
    }

    const trimmedResume = truncateText(resumeText, MAX_RESUME_CHARS);
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a job search engine. Use the resume to find relevant job ' +
            'openings on LinkedIn, Glassdoor, Indeed, and company career pages. ' +
            'Respond with JSON only.',
        },
        {
          role: 'user',
          content:
            'Return JSON with fields summary, searchQueries, and jobs. ' +
            'summary: 1-2 sentences about how the search was performed. ' +
            'searchQueries: 5-8 queries you would run. ' +
            'jobs: 12-15 openings with company, title, location, source, rating ' +
            '(1-5), keywords (skills), url, matchScore (0-100), and rationale. ' +
            'Use real job boards in the source field. Only return JSON.\n\n' +
            `Resume:\n${trimmedResume}`,
        },
      ],
      temperature: 0.2,
      max_tokens: 1200,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      OPENAI_TIMEOUT_MS,
    );

    let response: Response;
    try {
      response = await this.fetcher(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException(
          'ChatGPT job search timed out.',
        );
      }
      throw new ServiceUnavailableException('ChatGPT job search failed.');
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      this.logger.warn(
        `OpenAI API error ${response.status}: ${errorText.slice(0, 200)}`,
      );
      throw new ServiceUnavailableException('ChatGPT job search failed.');
    }

    let payload: any;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceUnavailableException('ChatGPT returned invalid JSON.');
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (!content) {
      throw new ServiceUnavailableException(
        'ChatGPT did not return job results.',
      );
    }

    // Defensive parse in case the model wraps JSON.
    const parsed = safeParseJson(content);
    if (!parsed || !Array.isArray(parsed.jobs)) {
      throw new ServiceUnavailableException(
        'ChatGPT response was missing job results.',
      );
    }

    return {
      summary: toNonEmptyString(parsed.summary) ?? '',
      searchQueries: Array.isArray(parsed.searchQueries)
        ? parsed.searchQueries.map((query: unknown) => String(query).trim())
        : [],
      jobs: parsed.jobs as JobSearchJob[],
    };
  }
}

@Injectable()
export class UnemploydleService {
  private readonly games = new Map<string, GameState>();
  private readonly searchCache = new Map<string, CachedJobSearch>();
  private readonly logger = new Logger(UnemploydleService.name);

  constructor(
    private readonly jobSearchClient: JobSearchClient = new ChatGptJobSearchClient(),
  ) {}

  async startGame(resumeText: string): Promise<StartResponse> {
    const { rankedJobs, searchResult } = await this.rankJobs(resumeText);
    const selectedJob =
      rankedJobs[Math.floor(Math.random() * rankedJobs.length)];

    const guessedLetters = new Set<string>();
    const maskedCompany = maskCompanyName(selectedJob.company, guessedLetters);
    const selectionSummary = buildSelectionSummary(
      searchResult,
      'Selected a random company from the top 10 matches.',
    );

    const game: GameState = {
      id: randomUUID(),
      company: selectedJob.company,
      maskedCompany,
      guessesLeft: MAX_GUESSES,
      maxGuesses: MAX_GUESSES,
      guessedLetters,
      incorrectGuesses: new Set<string>(),
      job: selectedJob,
      createdAt: Date.now(),
      selectionSummary,
    };

    this.games.set(game.id, game);
    this.cleanupOldGames();

    return this.buildStartResponse(game);
  }

  async getTopJobs(resumeText: string): Promise<TopJobsResponse> {
    const { rankedJobs, searchResult } = await this.rankJobs(resumeText);
    return {
      selectionSummary: buildSelectionSummary(
        searchResult,
        'Showing the top 10 matches.',
      ),
      jobs: rankedJobs.map((job) => ({
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        source: job.source,
        rating: job.rating,
        matchScore: Math.round(job.matchScore * 100),
        url: job.url,
      })),
    };
  }

  guess(gameId: string, letter: string): GuessResponse {
    const game = this.games.get(gameId);
    if (!game) {
      throw new NotFoundException('Game not found');
    }

    const currentStatus = this.resolveStatus(game);
    if (currentStatus !== 'in_progress') {
      return {
        ...this.buildStartResponse(game),
        status: currentStatus,
        alreadyGuessed: false,
        revealedCompany: game.company,
        jobUrl: game.job.url,
      };
    }

    const sanitized = sanitizeLetter(letter);
    if (!/^[A-Z]$/.test(sanitized)) {
      throw new BadRequestException('Guess must be a single letter.');
    }

    let alreadyGuessed = false;

    if (game.guessedLetters.has(sanitized)) {
      alreadyGuessed = true;
    } else {
      game.guessedLetters.add(sanitized);

      if (!game.company.toUpperCase().includes(sanitized)) {
        game.guessesLeft = Math.max(0, game.guessesLeft - 1);
        game.incorrectGuesses.add(sanitized);
      }

      game.maskedCompany = maskCompanyName(game.company, game.guessedLetters);
    }

    const status = this.resolveStatus(game);

    return {
      ...this.buildStartResponse(game),
      status,
      alreadyGuessed,
      ...(status !== 'in_progress'
        ? {
            revealedCompany: game.company,
            jobUrl: game.job.url,
          }
        : {}),
    };
  }

  private resolveStatus(game: GameState) {
    if (!game.maskedCompany.includes('_')) {
      return 'won' as const;
    }

    if (game.guessesLeft <= 0) {
      return 'lost' as const;
    }

    return 'in_progress' as const;
  }

  private async rankJobs(resumeText: string) {
    const resumeKeywords = extractResumeKeywords(resumeText);
    const searchResult = await this.getSearchResult(resumeText);
    const normalizedJobs = normalizeJobResults(searchResult.jobs ?? []);

    if (normalizedJobs.length === 0) {
      this.logger.warn('ChatGPT returned no usable job results.');
      throw new ServiceUnavailableException('No job matches were returned.');
    }

    const rankedJobs = normalizedJobs
      .map((job) => {
        const matchScore =
          typeof job.matchScoreHint === 'number'
            ? clampNumber(job.matchScoreHint, 0, 1)
            : computeMatchScore(job, resumeKeywords);
        const ratingScore = job.rating / 5;
        const overallScore = matchScore * 0.75 + ratingScore * 0.25;

        return {
          ...job,
          matchScore,
          overallScore,
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, 10);

    return { rankedJobs, searchResult };
  }

  private buildStartResponse(game: GameState): StartResponse {
    return {
      gameId: game.id,
      maskedCompany: game.maskedCompany,
      guessesLeft: game.guessesLeft,
      maxGuesses: game.maxGuesses,
      status: 'in_progress',
      selectionSummary: game.selectionSummary,
      job: {
        title: game.job.title,
        location: game.job.location,
        source: game.job.source,
        rating: game.job.rating,
        matchScore: Math.round(game.job.matchScore * 100),
        companyMasked: game.maskedCompany,
      },
      guessedLetters: Array.from(game.guessedLetters).sort(),
      incorrectGuesses: Array.from(game.incorrectGuesses).sort(),
    };
  }

  private cleanupOldGames() {
    if (this.games.size <= 50) {
      return;
    }

    const oldestGame = Array.from(this.games.values()).sort(
      (a, b) => a.createdAt - b.createdAt,
    )[0];

    if (oldestGame) {
      this.games.delete(oldestGame.id);
    }
  }

  private async getSearchResult(resumeText: string) {
    const cacheKey = createHash('sha256').update(resumeText).digest('hex');
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.result;
    }

    if (cached) {
      this.searchCache.delete(cacheKey);
    }

    const result = await this.jobSearchClient.searchJobs(resumeText);
    this.searchCache.set(cacheKey, { result, createdAt: Date.now() });
    this.cleanupSearchCache();
    return result;
  }

  private cleanupSearchCache() {
    if (this.searchCache.size <= CACHE_MAX_ENTRIES) {
      return;
    }

    const entries = Array.from(this.searchCache.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );

    while (this.searchCache.size > CACHE_MAX_ENTRIES && entries.length > 0) {
      const oldest = entries.shift();
      if (oldest) {
        this.searchCache.delete(oldest[0]);
      }
    }
  }
}
