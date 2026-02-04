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
import { JobBoardSearchClient } from './unemployedle/job-search.client';
import { ChatGptJobRanker } from './unemployedle/job-ranker.client';
import {
  buildJobId,
  buildSelectionSummary,
  buildResumeProfile,
  clampNumber,
  computeMatchScore,
  extractResumeLocation,
  maskCompanyName,
  normalizeCompanyKey,
  normalizeCompanyHint,
  normalizeCompanySize,
  normalizeJobResults,
  normalizeMatchScore,
  sanitizeLetter,
  toNonEmptyString,
} from './unemployedle/job-utils';
import {
  type CompanySize,
  type CachedJobSearch,
  type GameState,
  type GuessResponse,
  type JobOpening,
  type JobRanker,
  type JobRanking,
  type JobSearchOptions,
  type JobSearchResult,
  type StartResponse,
  type TopJobsResponse,
} from './unemployedle/types';

const DEFAULT_TOP_JOBS_COUNT = 10;
const MAX_TOP_JOBS_RESULTS = 30;
const MIN_TOP_JOBS_MATCH_SCORE = 0.3;
const DEFAULT_MATCH_THRESHOLDS = [0.75, 0.7, 0.65, 0.6];
const EXPANDED_MATCH_THRESHOLDS = [MIN_TOP_JOBS_MATCH_SCORE];

type CachedTopJobs = {
  rankedJobs: GameState['job'][];
  searchResult: JobSearchResult;
  createdAt: number;
};

@Injectable()
export class UnemployedleService {
  private readonly games = new Map<string, GameState>();
  private readonly searchCache = new Map<string, CachedJobSearch>();
  private readonly topJobsCache = new Map<string, CachedTopJobs>();
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
    /page not found/i,
    /we (couldn't|cant|can't) find (that|this) job/i,
    /we (couldn't|cant|can't) find the page/i,
    /this job is no longer available/i,
    /job is no longer available/i,
    /job has been removed/i,
    /job is no longer accepting applications/i,
    /job opening is no longer available/i,
    /job posting is no longer available/i,
  ];

  constructor(
    private readonly jobSearchClient: JobBoardSearchClient,
    private readonly jobRanker: ChatGptJobRanker,
  ) {}

  async startGame(
    resumeText: string,
    options?: JobSearchOptions,
  ): Promise<StartResponse> {
    const { rankedJobs, searchResult } = await this.rankJobs(
      resumeText,
      options,
    );
    const selectedJob =
      rankedJobs[Math.floor(Math.random() * rankedJobs.length)];
    const matchCount = rankedJobs.length;

    const guessedLetters = new Set<string>();
    const maskedCompany = maskCompanyName(selectedJob.company, guessedLetters);
    const selectionSummary = buildSelectionSummary(
      searchResult,
      `Selected a random company from the top ${matchCount} match${
        matchCount === 1 ? '' : 'es'
      }.`,
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

  async getTopJobs(
    resumeText: string,
    options?: JobSearchOptions,
  ): Promise<TopJobsResponse> {
    const resolvedOptions = this.resolveSearchOptions(resumeText, options);
    const cacheKey = this.buildTopJobsCacheKey(resumeText, resolvedOptions);
    const cached = this.getCachedTopJobs(cacheKey);
    const { rankedJobs, searchResult } =
      cached ??
      (await this.rankJobs(resumeText, resolvedOptions, {
        thresholds: EXPANDED_MATCH_THRESHOLDS,
        desiredCount: MAX_TOP_JOBS_RESULTS,
      }));
    if (!cached) {
      this.topJobsCache.set(cacheKey, {
        rankedJobs,
        searchResult,
        createdAt: Date.now(),
      });
      this.cleanupTopJobsCache();
    }
    const matchCount = rankedJobs.length;
    const resultSuffix =
      matchCount > 0
        ? `Showing ${matchCount} match${matchCount === 1 ? '' : 'es'}.`
        : 'No matches found.';
    return {
      selectionSummary: buildSelectionSummary(
        searchResult,
        resultSuffix,
      ),
      jobs: rankedJobs.map((job) => ({
        id: job.id,
        company: job.company,
        title: job.title,
        location: job.location,
        source: job.source,
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

  private async rankJobs(
    resumeText: string,
    options?: JobSearchOptions,
    config: { thresholds?: number[]; desiredCount?: number } = {},
  ) {
    const resumeProfile = buildResumeProfile(resumeText);
    const resolvedOptions = this.resolveSearchOptions(resumeText, options);
    const desiredJobTitle = toNonEmptyString(resolvedOptions.desiredJobTitle);
    const desiredCount = config.desiredCount ?? DEFAULT_TOP_JOBS_COUNT;
    const thresholds = config.thresholds ?? DEFAULT_MATCH_THRESHOLDS;
    const { verifiedJobs, searchResult } = await this.gatherVerifiedJobs(
      resumeText,
      resolvedOptions,
      desiredCount,
    );

    if (verifiedJobs.length === 0) {
      this.logger.warn('ChatGPT returned no verifiable job links.');
      throw new ServiceUnavailableException('No verified job matches found.');
    }

    let rankedCandidates = verifiedJobs;
    try {
      const rankings = await this.jobRanker.rankJobs(
        resumeText,
        verifiedJobs,
        desiredJobTitle ?? undefined,
      );
      rankedCandidates = this.applyRankings(verifiedJobs, rankings);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`ChatGPT job ranking failed. ${message}`);
    }

    const rankedJobs = rankedCandidates
      .map((job) => {
        const matchScore =
          typeof job.matchScoreHint === 'number'
            ? clampNumber(job.matchScoreHint, 0, 1)
            : computeMatchScore(job, resumeProfile, desiredJobTitle);
        const overallScore = matchScore;

        return {
          ...job,
          matchScore,
          overallScore,
        };
      })
      .sort((a, b) => b.overallScore - a.overallScore);

    const thresholdedJobs = this.applyMatchThreshold(
      rankedJobs,
      thresholds,
      desiredCount,
    );
    const diversifiedJobs = this.applyCompanyDiversity(
      thresholdedJobs,
      desiredCount,
    );

    if (diversifiedJobs.length === 0) {
      this.logger.warn('No job matches met the minimum match threshold.');
      throw new ServiceUnavailableException('No strong job matches found.');
    }

    return { rankedJobs: diversifiedJobs, searchResult };
  }

  private applyMatchThreshold(
    jobs: GameState['job'][],
    thresholds: number[],
    desiredCount = DEFAULT_TOP_JOBS_COUNT,
  ) {
    let filtered: GameState['job'][] = [];

    thresholds.forEach((threshold) => {
      if (filtered.length >= desiredCount) {
        return;
      }
      const matches = jobs.filter((job) => job.matchScore >= threshold);
      if (matches.length > 0) {
        filtered = matches;
      }
    });

    return filtered;
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

  private applyRankings(jobs: JobOpening[], rankings: JobRanking[]) {
    if (!rankings || rankings.length === 0) {
      return jobs;
    }

    const rankingMap = new Map<string, JobRanking>();
    rankings.forEach((ranking) => {
      if (ranking?.id) {
        rankingMap.set(ranking.id, ranking);
      }
    });

    return jobs.map((job) => {
      const ranking = rankingMap.get(job.id);
      if (!ranking) {
        return job;
      }

      const matchScoreHint = normalizeMatchScore(ranking.matchScore);
      const companyHint =
        normalizeCompanyHint(ranking.companyHint, job.company) ??
        job.companyHint;
      const companySize = ranking.companySize
        ? normalizeCompanySize(ranking.companySize)
        : job.companySize;

      return {
        ...job,
        matchScoreHint: matchScoreHint ?? job.matchScoreHint,
        companyHint,
        companySize,
      };
    });
  }

  private async gatherVerifiedJobs(
    resumeText: string,
    options: JobSearchOptions,
    desiredCount: number,
  ) {
    const maxAttempts = 3;
    const maxJobs = Math.max(20, Math.min(MAX_TOP_JOBS_RESULTS, desiredCount));
    const collected: JobOpening[] = [];
    const seen = new Set<string>();
    let summaryResult: CachedJobSearch['result'] | null = null;
    const resolvedOptions = this.resolveSearchOptions(resumeText, options);

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const searchResult =
        attempt === 0
          ? await this.getSearchResult(resumeText, resolvedOptions)
          : await this.jobSearchClient.searchJobs(resumeText, resolvedOptions);

      if (!summaryResult) {
        summaryResult = searchResult;
      }

      const normalizedJobs = normalizeJobResults(searchResult.jobs ?? []);
      if (normalizedJobs.length === 0) {
        continue;
      }

      const uniqueCandidates = normalizedJobs.filter((job) => {
        const key = `${normalizeCompanyKey(job.company)}|${job.title.toLowerCase()}|${job.location.toLowerCase()}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });

      if (uniqueCandidates.length === 0) {
        continue;
      }

      const verified = await this.validateJobLinks(
        uniqueCandidates.slice(0, maxJobs),
      );
      collected.push(...verified);

      if (collected.length >= desiredCount) {
        break;
      }
    }

    return {
      verifiedJobs: collected,
      searchResult: summaryResult ?? { jobs: [] },
    };
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
      const status = await this.checkUrl(companyUrl, job);
      if (status === 'valid') {
        return {
          ...job,
          url: companyUrl,
          id: buildJobId(job.company, job.title, job.location, companyUrl),
        };
      }
    }

    if (sourceUrl) {
      const status = await this.checkUrl(sourceUrl, job);
      if (status === 'valid') {
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
    job: JobOpening,
  ): Promise<'valid' | 'invalid'> {
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
      if (response.status === 401 || response.status === 403 || response.status === 429) {
        return 'invalid';
      }
      if (response.status < 200 || response.status >= 400) {
        return 'invalid';
      }

      const contentType = response.headers.get('content-type')?.toLowerCase();
      if (
        !contentType ||
        contentType.includes('text') ||
        contentType.includes('html')
      ) {
        const text = await response.text();
        const truncated = text.slice(0, 200_000);

        if (this.containsNotFoundMessage(truncated)) {
          return 'invalid';
        }

        const jobPostingMetadata = this.extractJobPostingMetadata(truncated);
        if (jobPostingMetadata.length > 0) {
          const matchesSchemaTitle = jobPostingMetadata.some((entry) => {
            if (!this.matchesJobTitleText(entry.title, job.title)) {
              return false;
            }
            if (
              entry.orgName &&
              !this.matchesCompanyName(entry.orgName, job.company)
            ) {
              return false;
            }
            if (
              entry.url &&
              !this.urlsLikelyMatchJob(url, entry.url, entry.identifiers)
            ) {
              return false;
            }
            return true;
          });
          return matchesSchemaTitle ? 'valid' : 'invalid';
        }

        const hasSchema = this.containsJobPostingSchema(truncated);
        const matchesTitle = this.matchesJobTitleText(truncated, job.title);
        const matchesCompany = this.matchesCompanyName(truncated, job.company);
        const hasIndicators = this.containsJobPageIndicators(truncated, url);

        if (hasSchema && matchesTitle && matchesCompany) {
          return 'valid';
        }

        if (matchesTitle && matchesCompany && hasIndicators) {
          return 'valid';
        }

        return 'invalid';
      }

      return 'invalid';
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return 'invalid';
      }
      return 'invalid';
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private containsNotFoundMessage(text: string) {
    return this.jobNotFoundPatterns.some((pattern) => pattern.test(text));
  }

  private matchesJobTitleText(text: string, title: string) {
    const normalized = text.toLowerCase();
    const tokens = title
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((token) => token.length > 2) ?? [];

    if (tokens.length === 0) {
      return false;
    }

    let matches = 0;
    tokens.forEach((token) => {
      if (normalized.includes(token)) {
        matches += 1;
      }
    });

    const requiredMatches = Math.min(2, tokens.length);
    return matches >= requiredMatches;
  }

  private containsJobPostingSchema(html: string) {
    return /schema\.org\/JobPosting/i.test(html);
  }

  private containsJobPageIndicators(html: string, url: string) {
    const lower = html.toLowerCase();
    const urlLower = url.toLowerCase();
    const indicators = [
      'job description',
      'responsibilities',
      'requirements',
      'qualifications',
      'apply now',
      'job summary',
      'job details',
      'role overview',
      'employment type',
      'location',
      'experience',
    ];
    const atsHosts = [
      'greenhouse.io',
      'boards.greenhouse.io',
      'jobs.lever.co',
      'lever.co',
      'myworkdayjobs.com',
      'workday',
      'smartrecruiters.com',
      'icims.com',
      'jobvite.com',
      'ashbyhq.com',
      'recruitee.com',
      'bamboohr.com',
      'paylocity.com',
      'taleo.net',
      'successfactors.com',
      'oraclecloud.com',
    ];

    if (atsHosts.some((host) => urlLower.includes(host))) {
      return true;
    }

    return indicators.some((indicator) => lower.includes(indicator));
  }

  private matchesCompanyName(text: string, company: string) {
    const companyKey = normalizeCompanyKey(company);
    if (!companyKey) {
      return false;
    }
    const tokens = companyKey.split(' ').filter((token) => token.length > 2);
    if (tokens.length === 0) {
      return false;
    }

    const normalized = text.toLowerCase();
    return tokens.some((token) => normalized.includes(token));
  }

  private urlsLikelyMatchJob(
    currentUrl: string,
    candidateUrl: string,
    identifiers: string[],
  ) {
    try {
      const current = new URL(currentUrl);
      const candidate = new URL(candidateUrl);
      if (current.hostname === candidate.hostname) {
        if (
          current.pathname.includes(candidate.pathname) ||
          candidate.pathname.includes(current.pathname)
        ) {
          return true;
        }
      }

      const currentId = currentUrl.match(/[0-9]{4,}/g)?.pop();
      const candidateId = candidateUrl.match(/[0-9]{4,}/g)?.pop();
      if (currentId && candidateId && currentId === candidateId) {
        return true;
      }

      if (currentId && identifiers.some((id) => id.includes(currentId))) {
        return true;
      }
    } catch {
      return false;
    }

    return false;
  }

  private extractJobPostingMetadata(html: string) {
    const results: Array<{
      title: string;
      url?: string;
      orgName?: string;
      identifiers: string[];
    }> = [];
    const scriptRegex =
      /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      const raw = match[1]?.trim();
      if (!raw) {
        continue;
      }
      try {
        const parsed = JSON.parse(raw);
        this.collectJobPostingMetadata(parsed, results);
      } catch {
        // ignore invalid json-ld blocks
      }
    }

    return results.filter((entry) => Boolean(entry.title));
  }

  private collectJobPostingMetadata(
    value: unknown,
    results: Array<{
      title: string;
      url?: string;
      orgName?: string;
      identifiers: string[];
    }>,
  ) {
    if (!value) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((entry) => this.collectJobPostingMetadata(entry, results));
      return;
    }
    if (typeof value !== 'object') {
      return;
    }

    const record = value as Record<string, unknown>;
    const type = record['@type'];
    const graph = record['@graph'];

    if (graph) {
      this.collectJobPostingMetadata(graph, results);
    }

    const types = Array.isArray(type) ? type : [type];
    const hasJobPosting = types.some(
      (item) =>
        typeof item === 'string' &&
        item.toLowerCase().includes('jobposting'),
    );

    if (hasJobPosting) {
      const title =
        typeof record.title === 'string'
          ? record.title
          : typeof record.name === 'string'
            ? record.name
            : null;
      if (title) {
        const org = record.hiringOrganization as
          | Record<string, unknown>
          | string
          | undefined;
        const orgName =
          typeof org === 'string'
            ? org
            : typeof org?.name === 'string'
              ? org.name
              : undefined;
        const identifiers: string[] = [];
        const rawId = record.identifier;
        if (typeof rawId === 'string') {
          identifiers.push(rawId);
        } else if (rawId && typeof rawId === 'object') {
          const idRecord = rawId as Record<string, unknown>;
          if (typeof idRecord.value === 'string') {
            identifiers.push(idRecord.value);
          }
        }
        const url =
          typeof record.url === 'string'
            ? record.url
            : typeof record['@id'] === 'string'
              ? (record['@id'] as string)
              : undefined;
        if (typeof record.id === 'string') {
          identifiers.push(record.id);
        }

        results.push({
          title,
          url,
          orgName,
          identifiers,
        });
      }
    }

    Object.values(record).forEach((entry) => {
      if (typeof entry === 'object') {
        this.collectJobPostingMetadata(entry, results);
      }
    });
  }

  private applyCompanyDiversity(
    jobs: GameState['job'][],
    maxResults = DEFAULT_TOP_JOBS_COUNT,
  ) {
    const seenCompanies = new Set<string>();
    const sizeCounts: Record<CompanySize, number> = {
      large: 0,
      mid: 0,
      startup: 0,
    };
    const diversified: GameState['job'][] = [];

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

  private async getSearchResult(
    resumeText: string,
    options?: JobSearchOptions,
  ) {
    const cacheKey = createHash('sha256')
      .update(`${resumeText}|${JSON.stringify(options ?? {})}`)
      .digest('hex');
    const cached = this.searchCache.get(cacheKey);

    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached.result;
    }

    if (cached) {
      this.searchCache.delete(cacheKey);
    }

    const result = await this.jobSearchClient.searchJobs(resumeText, options);
    this.searchCache.set(cacheKey, { result, createdAt: Date.now() });
    this.cleanupSearchCache();
    return result;
  }

  private resolveSearchOptions(
    resumeText: string,
    options?: JobSearchOptions,
  ): JobSearchOptions {
    if (!options) {
      return { includeRemote: true, includeLocal: true };
    }

    const includeRemote = Boolean(options.includeRemote);
    const includeLocal = Boolean(options.includeLocal);
    const specificLocation = toNonEmptyString(options.specificLocation);
    const desiredJobTitle = toNonEmptyString(options.desiredJobTitle);
    const localLocation = includeLocal
      ? toNonEmptyString(options.localLocation) ??
        extractResumeLocation(resumeText)
      : null;

    if (!includeRemote && !includeLocal && !specificLocation) {
      return {
        includeRemote: true,
        includeLocal: true,
        localLocation,
        desiredJobTitle,
      };
    }

    return {
      includeRemote,
      includeLocal,
      specificLocation,
      localLocation,
      desiredJobTitle,
    };
  }

  private buildTopJobsCacheKey(
    resumeText: string,
    options: JobSearchOptions,
  ) {
    return createHash('sha256')
      .update(`${resumeText}|${JSON.stringify(options ?? {})}`)
      .digest('hex');
  }

  private getCachedTopJobs(cacheKey: string) {
    const cached = this.topJobsCache.get(cacheKey);
    if (!cached) {
      return null;
    }
    if (Date.now() - cached.createdAt < CACHE_TTL_MS) {
      return cached;
    }
    this.topJobsCache.delete(cacheKey);
    return null;
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

  private cleanupTopJobsCache() {
    if (this.topJobsCache.size <= CACHE_MAX_ENTRIES) {
      return;
    }

    const entries = Array.from(this.topJobsCache.entries()).sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );

    while (this.topJobsCache.size > CACHE_MAX_ENTRIES && entries.length > 0) {
      const oldest = entries.shift();
      if (oldest) {
        this.topJobsCache.delete(oldest[0]);
      }
    }
  }
}
