import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import {
  CACHE_MAX_ENTRIES,
  CACHE_TTL_MS,
  MAX_GUESSES,
} from './unemployedle/constants';
import { ChatGptJobSearchClient } from './unemployedle/job-search.client';
import {
  buildSelectionSummary,
  clampNumber,
  computeMatchScore,
  extractResumeKeywords,
  maskCompanyName,
  normalizeJobResults,
  sanitizeLetter,
} from './unemployedle/job-utils';
import {
  type CachedJobSearch,
  type GameState,
  type GuessResponse,
  type StartResponse,
  type TopJobsResponse,
  type JobSearchClient,
} from './unemployedle/types';

@Injectable()
export class UnemployedleService {
  private readonly games = new Map<string, GameState>();
  private readonly searchCache = new Map<string, CachedJobSearch>();
  private readonly logger = new Logger(UnemployedleService.name);

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
