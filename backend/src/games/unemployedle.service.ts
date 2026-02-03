import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  COMPANY_SIZE_LIMITS,
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  MAX_GUESSES,
} from './unemployedle/constants';
import { ChatGptJobSearchClient } from './unemployedle/job-search.client';
import {
  buildJobId,
  buildSelectionSummary,
  clampNumber,
  computeMatchScore,
  extractResumeKeywords,
  maskCompanyName,
  normalizeCompanyKey,
  normalizeJobResults,
  sanitizeLetter,
} from './unemployedle/job-utils';
import {
  type CompanySize,
  type CachedJobSearch,
  type GameState,
  type GuessResponse,
  type JobOpening,
  type StartResponse,
  type TopJobsResponse,
  type JobSearchClient,
} from './unemployedle/types';

@Injectable()
export class UnemployedleService {
  private readonly games = new Map<string, GameState>();
  private readonly searchCache = new Map<string, CachedJobSearch>();
  private readonly logger = new Logger(UnemployedleService.name);
  private readonly jobUrlTimeoutMs = 4000;
  private readonly jobUrlUserAgent =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  private readonly jobNotFoundPatterns = [
    /job not found/i,
    /no longer available/i,
    /position (has been|is) (filled|closed)/i,
    /job (has )?expired/i,
    /this job (has )?expired/i,
    /role (has )?been closed/i,
  ];

  constructor(private readonly jobSearchClient: ChatGptJobSearchClient) {}

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

    return this.buildStartResponse(game, 'in_progress');
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
      const response = this.buildStartResponse(game, currentStatus);
      return {
        ...response,
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
    const response = this.buildStartResponse(game, status);

    return {
      ...response,
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

    const verifiedJobs = await this.validateJobLinks(normalizedJobs);

    if (verifiedJobs.length === 0) {
      this.logger.warn('ChatGPT returned no verifiable job links.');
      throw new ServiceUnavailableException('No verified job matches found.');
    }

    const rankedJobs = verifiedJobs
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
      .sort((a, b) => b.overallScore - a.overallScore);

    const diversifiedJobs = this.applyCompanyDiversity(rankedJobs).slice(0, 10);

    return { rankedJobs: diversifiedJobs, searchResult };
  }

  private buildStartResponse(
    game: GameState,
    status: StartResponse['status'],
  ): StartResponse {
    return {
      gameId: game.id,
      maskedCompany: game.maskedCompany,
      guessesLeft: game.guessesLeft,
      maxGuesses: game.maxGuesses,
      status,
      selectionSummary: game.selectionSummary,
      hint: this.buildHint(game, status),
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

  private buildHint(game: GameState, status: StartResponse['status']) {
    if (status !== 'in_progress') {
      return undefined;
    }
    if (game.guessesLeft > 2) {
      return undefined;
    }
    return game.job.companyHint;
  }

  private async validateJobLinks(jobs: JobOpening[]) {
    const verified = await Promise.all(
      jobs.map((job) => this.resolveVerifiedJob(job)),
    );
    return verified.filter((job): job is JobOpening => Boolean(job));
  }

  private async resolveVerifiedJob(
    job: JobOpening,
  ): Promise<JobOpening | null> {
    const companyUrl = job.companyUrl ?? null;
    const sourceUrl = job.sourceUrl ?? null;

    if (companyUrl) {
      const status = await this.checkUrl(companyUrl);
      if (status === 'valid' || status === 'unknown') {
        return {
          ...job,
          url: companyUrl,
          id: buildJobId(job.company, job.title, job.location, companyUrl),
        };
      }
    }

    if (sourceUrl) {
      const status = await this.checkUrl(sourceUrl);
      if (status === 'valid' || status === 'unknown') {
        return {
          ...job,
          url: sourceUrl,
          id: buildJobId(job.company, job.title, job.location, sourceUrl),
        };
      }
    }

    return null;
  }

  private async checkUrl(
    url: string,
  ): Promise<'valid' | 'invalid' | 'unknown'> {
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.jobUrlTimeoutMs,
    );

    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': this.jobUrlUserAgent,
          Accept: 'text/html,application/xhtml+xml',
        },
      });

      if (response.status === 404 || response.status === 410) {
        return 'invalid';
      }
      if (response.status >= 500) {
        return 'invalid';
      }
      if (
        response.status === 401 ||
        response.status === 403 ||
        response.status === 429
      ) {
        return 'unknown';
      }
      if (response.status >= 300 && response.status < 400) {
        return 'valid';
      }
      if (response.status < 200 || response.status >= 400) {
        return 'invalid';
      }

      const contentType = response.headers.get('content-type')?.toLowerCase();
      if (contentType && contentType.includes('text/html')) {
        const text = await response.text();
        if (this.containsNotFoundMessage(text)) {
          return 'invalid';
        }
      }

      return 'valid';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'unknown';
      }
      return 'unknown';
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private containsNotFoundMessage(text: string) {
    return this.jobNotFoundPatterns.some((pattern) => pattern.test(text));
  }

  private applyCompanyDiversity(jobs: GameState['job'][]) {
    const seenCompanies = new Set<string>();
    const sizeCounts: Record<CompanySize, number> = {
      large: 0,
      mid: 0,
      startup: 0,
    };
    const diversified: GameState['job'][] = [];
    const maxResults = 10;

    const tryAdd = (job: GameState['job'], enforceSizeCaps: boolean) => {
      if (diversified.length >= maxResults) {
        return;
      }
      const companyKey = normalizeCompanyKey(job.company);
      if (seenCompanies.has(companyKey)) {
        return;
      }

      const size = job.companySize ?? 'mid';
      if (enforceSizeCaps && sizeCounts[size] >= COMPANY_SIZE_LIMITS[size]) {
        return;
      }

      seenCompanies.add(companyKey);
      sizeCounts[size] += 1;
      diversified.push(job);
    };

    jobs.forEach((job) => tryAdd(job, true));

    if (diversified.length < maxResults) {
      jobs.forEach((job) => tryAdd(job, false));
    }

    return diversified;
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
