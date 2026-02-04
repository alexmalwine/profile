import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  JOB_BOARD_MAX_BOARD_QUERIES,
  JOB_BOARD_MAX_FORTUNE_QUERIES,
  JOB_BOARD_MAX_GOOGLE_JOBS_QUERIES,
  JOB_BOARD_MAX_RESULTS_PER_QUERY,
  JOB_BOARD_MAX_TOTAL_RESULTS,
  JOB_BOARD_SEARCH_TIMEOUT_MS,
  SERPAPI_API_KEY,
  SERPAPI_API_URL,
} from './constants';
import { FORTUNE_500_CAREER_SITES } from './fortune-500';
import {
  buildResumeProfile,
  extractKeywordsFromText,
  normalizeCompanyKey,
  normalizeJobSource,
  toNonEmptyString,
} from './job-utils';
import {
  EXPERIENCE_HEADERS,
  JOB_BOARD_HOSTS,
  RESUME_TITLE_TOKENS,
  ROLE_QUERY_RULES,
  SECTION_HEADERS,
  SKILL_HINTS,
  STATE_FALLBACK_CITIES,
  STATE_NAME_TO_CODE,
  TITLE_SEPARATORS,
  TITLE_TOKENS,
} from './job-search.constants';
import type {
  JobSearchClient,
  JobSearchJob,
  JobSearchOptions,
  JobSearchResult,
} from './types';

const normalizeHostname = (host: string) =>
  host.toLowerCase().replace(/^www\./, '');

const hostMatches = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

const isJobBoardHost = (host: string) => {
  const normalized = normalizeHostname(host);
  return JOB_BOARD_HOSTS.some((domain) => hostMatches(normalized, domain));
};

const normalizeUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
};

const normalizeKeywordText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const extractStateCode = (location: string) => {
  const trimmed = location.trim();
  const match = trimmed.match(/,\s*([A-Z]{2})\b/);
  if (match) {
    return match[1];
  }
  const lower = trimmed.toLowerCase();
  const matchedEntry = Object.entries(STATE_NAME_TO_CODE).find(([name]) =>
    lower.includes(name),
  );
  return matchedEntry?.[1] ?? null;
};

const normalizeCityTokens = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\bst\b/g, 'saint')
    .replace(/\bft\b/g, 'fort')
    .replace(/\s+/g, ' ')
    .trim();
  return new Set(normalized.split(' ').filter(Boolean));
};

const scoreCityMatch = (inputTokens: Set<string>, candidateCity: string) => {
  const candidateTokens = normalizeCityTokens(candidateCity);
  let score = 0;
  inputTokens.forEach((token) => {
    if (candidateTokens.has(token)) {
      score += 1;
    }
  });
  return { score, tokenCount: candidateTokens.size };
};

const findFallbackLocation = (location: string) => {
  const stateCode = extractStateCode(location);
  if (!stateCode) {
    return null;
  }
  const candidates = STATE_FALLBACK_CITIES[stateCode];
  if (!candidates || candidates.length === 0) {
    return null;
  }
  const cityPart = location.split(',')[0]?.trim();
  if (!cityPart) {
    return candidates[0];
  }
  const inputTokens = normalizeCityTokens(cityPart);
  if (inputTokens.size === 0) {
    return candidates[0];
  }
  let bestCandidate = candidates[0];
  let bestMatch = scoreCityMatch(inputTokens, candidates[0]);
  candidates.slice(1).forEach((candidate) => {
    const match = scoreCityMatch(inputTokens, candidate);
    if (match.score > bestMatch.score) {
      bestMatch = match;
      bestCandidate = candidate;
    }
  });
  const minimumScore = Math.min(2, bestMatch.tokenCount);
  if (bestMatch.score < minimumScore) {
    return candidates[0];
  }
  return bestCandidate;
};

const isUnsupportedLocationError = (errorText: string) => {
  const normalized = errorText.toLowerCase();
  return (
    normalized.includes('unsupported') &&
    normalized.includes('location') &&
    normalized.includes('parameter')
  );
};

const normalizeResumeLines = (resumeText: string) =>
  resumeText
    .replace(/\t/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const normalizeHeaderLine = (line: string) =>
  line
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesHeader = (line: string, headers: string[]) => {
  const normalized = normalizeHeaderLine(line);
  return headers.some(
    (header) =>
      normalized === header || normalized.startsWith(`${header} `),
  );
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const tokenMatches = (text: string, token: string) => {
  if (!token) {
    return false;
  }
  if (token.includes(' ')) {
    return text.includes(token);
  }
  return new RegExp(`\\b${escapeRegExp(token)}\\b`).test(text);
};

const scoreTokens = (text: string, tokens: string[]) =>
  tokens.reduce((total, token) => total + (tokenMatches(text, token) ? 1 : 0), 0);

const pickBestTitle = (candidates: string[]): string | null => {
  let bestTitle: string | null = null;
  let bestScore = 0;
  let bestLength = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    const trimmed = candidate.trim();
    if (!trimmed) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    const score = scoreTokens(lower, RESUME_TITLE_TOKENS);
    if (score <= 0) {
      continue;
    }
    const length = trimmed.length;
    if (
      !bestTitle ||
      score > bestScore ||
      (score === bestScore && length < bestLength)
    ) {
      bestTitle = trimmed;
      bestScore = score;
      bestLength = length;
    }
  }

  return bestTitle;
};

const cleanJobTitle = (value: string) =>
  value
    .replace(/\s*\((?:19|20)\d{2}.*?\)\s*$/i, '')
    .replace(/\b(19|20)\d{2}\b.*$/g, '')
    .replace(/\s+(present|current)\b.*$/i, '')
    .trim();

const extractTitleFromLine = (line: string) => {
  const sanitized = line.replace(/^[-*•]+/, '').trim();
  if (!sanitized || sanitized.length > 120) {
    return null;
  }

  const lower = sanitized.toLowerCase();
  if (scoreTokens(lower, RESUME_TITLE_TOKENS) === 0) {
    return null;
  }

  const candidates = [sanitized];
  TITLE_SEPARATORS.forEach((separator) => {
    if (sanitized.includes(separator)) {
      const parts = sanitized
        .split(separator)
        .map((part) => part.trim())
        .filter(Boolean);
      if (parts.length > 1) {
        candidates.push(...parts);
      }
    }
  });

  const picked = pickBestTitle(candidates);
  if (!picked) {
    return null;
  }

  const cleaned = cleanJobTitle(picked);
  return cleaned || null;
};

const extractLastJobTitle = (resumeText: string) => {
  const lines = normalizeResumeLines(resumeText);
  if (lines.length === 0) {
    return null;
  }

  const experienceIndex = lines.findIndex((line) =>
    matchesHeader(line, EXPERIENCE_HEADERS),
  );

  let searchLines = lines;
  if (experienceIndex >= 0) {
    let endIndex = lines.length;
    for (let i = experienceIndex + 1; i < lines.length; i += 1) {
      if (
        matchesHeader(lines[i], SECTION_HEADERS) &&
        !matchesHeader(lines[i], EXPERIENCE_HEADERS)
      ) {
        endIndex = i;
        break;
      }
    }
    searchLines = lines.slice(experienceIndex + 1, endIndex);
  }

  const candidates = searchLines
    .map((line) => extractTitleFromLine(line))
    .filter((candidate): candidate is string => Boolean(candidate));

  if (candidates.length > 0) {
    return candidates[0];
  }

  const fallbackCandidates = lines
    .map((line) => extractTitleFromLine(line))
    .filter((candidate): candidate is string => Boolean(candidate));

  return fallbackCandidates[0] ?? null;
};

@Injectable()
export class JobBoardSearchClient implements JobSearchClient {
  private readonly apiKey = SERPAPI_API_KEY;
  private readonly apiUrl = SERPAPI_API_URL;
  private readonly logger = new Logger(JobBoardSearchClient.name);
  private readonly fetcher: typeof fetch = fetch;
  private readonly fortuneCompanyKeys = new Set(
    FORTUNE_500_CAREER_SITES.map((entry) =>
      normalizeCompanyKey(entry.company),
    ),
  );

  async searchJobs(
    resumeText: string,
    options: JobSearchOptions = {},
  ): Promise<JobSearchResult> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'SERPAPI_API_KEY is not configured for job search.',
      );
    }

    const resumeProfile = buildResumeProfile(resumeText);
    const baseQueries = this.buildSearchQueries(
      resumeText,
      resumeProfile,
      options?.desiredJobTitle,
    );
    const locationVariants = this.buildLocationVariants(options);
    const queries = this.expandQueries(
      baseQueries,
      locationVariants,
      JOB_BOARD_MAX_GOOGLE_JOBS_QUERIES,
    );
    const boardQueries = this.expandQueries(
      baseQueries,
      locationVariants,
      JOB_BOARD_MAX_BOARD_QUERIES,
    );
    const fortuneQueries = this.expandQueries(
      baseQueries,
      locationVariants,
      JOB_BOARD_MAX_FORTUNE_QUERIES,
    );

    const jobResults: JobSearchJob[] = [];

    const googleJobs = await Promise.allSettled(
      queries.map((query) =>
        this.fetchGoogleJobs(query.query, query.location),
      ),
    );
    googleJobs.forEach((result) => {
      if (result.status === 'fulfilled') {
        jobResults.push(...result.value);
      } else {
        this.logger.warn(
          `Google Jobs search failed: ${String(result.reason ?? '')}`,
        );
      }
    });

    const boardSearches = boardQueries.flatMap((query) => [
      this.fetchBoardJobs(
        'LinkedIn',
        'linkedin.com/jobs/view',
        query.query,
      ),
      this.fetchBoardJobs('Indeed', 'indeed.com/viewjob', query.query),
      this.fetchBoardJobs(
        'Glassdoor',
        'glassdoor.com/job-listing',
        query.query,
      ),
    ]);

    const boardResults = await Promise.allSettled(boardSearches);
    boardResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        jobResults.push(...result.value);
      } else {
        this.logger.warn(
          `Job board search failed: ${String(result.reason ?? '')}`,
        );
      }
    });

    try {
      const fortuneJobs = await this.fetchFortune500Jobs(fortuneQueries);
      jobResults.push(...fortuneJobs);
    } catch (error) {
      this.logger.warn(
        `Fortune 500 search failed: ${String(error ?? '')}`,
      );
    }

    const deduped = this.dedupeJobs(jobResults);

    return {
      summary: this.buildSummary(
        queries.map((query) => query.query),
        deduped.length,
        locationVariants.map((variant) => variant.label),
      ),
      searchQueries: queries.map((query) => query.query),
      jobs: deduped.slice(0, JOB_BOARD_MAX_TOTAL_RESULTS),
    };
  }

  private async fetchGoogleJobs(
    query: string,
    location?: string,
  ): Promise<JobSearchJob[]> {
    const payload = await this.requestSerpApi({
      engine: 'google_jobs',
      q: query,
      ...(location ? { location } : {}),
      num: String(JOB_BOARD_MAX_RESULTS_PER_QUERY),
    });

    const results = Array.isArray(payload?.jobs_results)
      ? payload.jobs_results
      : [];

    return results
      .map((job: any) => this.mapGoogleJob(job))
      .filter((job: JobSearchJob | null): job is JobSearchJob => Boolean(job));
  }

  private mapGoogleJob(job: any): JobSearchJob | null {
    const title =
      toNonEmptyString(job?.title) ?? toNonEmptyString(job?.job_title);
    const company =
      toNonEmptyString(job?.company_name) ?? toNonEmptyString(job?.company);

    if (!title || !company) {
      return null;
    }

    const location =
      toNonEmptyString(job?.location) ??
      toNonEmptyString(job?.detected_extensions?.location) ??
      null;
    const source = normalizeJobSource(job?.via ?? job?.source ?? '');
    const description =
      toNonEmptyString(job?.description) ?? toNonEmptyString(job?.snippet) ?? '';
    const keywords = extractKeywordsFromText(
      `${title} ${company} ${description}`,
    );

    const { companyUrl, sourceUrl } = this.resolveApplyUrls(job);

    return {
      company,
      title,
      location: location ?? 'Remote',
      source,
      keywords,
      companyUrl,
      sourceUrl,
      companySize: this.resolveCompanySize(company),
    };
  }

  private async fetchBoardJobs(
    board: 'LinkedIn' | 'Indeed' | 'Glassdoor',
    domain: string,
    query: string,
  ): Promise<JobSearchJob[]> {
    const payload = await this.requestSerpApi({
      engine: 'google',
      q: `site:${domain} ${query}`,
      num: String(JOB_BOARD_MAX_RESULTS_PER_QUERY),
    });

    const results = Array.isArray(payload?.organic_results)
      ? payload.organic_results
      : [];

    return results
      .map((result: any) => this.mapBoardResult(board, result))
      .filter((job: JobSearchJob | null): job is JobSearchJob => Boolean(job));
  }

  private mapBoardResult(
    board: 'LinkedIn' | 'Indeed' | 'Glassdoor',
    result: any,
  ): JobSearchJob | null {
    const link = normalizeUrl(result?.link);
    const rawTitle = toNonEmptyString(result?.title);

    if (!link || !rawTitle) {
      return null;
    }

    const cleanedTitle = rawTitle
      .replace(/\s*\|\s*(LinkedIn|Indeed|Glassdoor).*$/i, '')
      .trim();

    const parsed = this.parseTitleCompany(cleanedTitle);
    if (!parsed?.title || !parsed.company) {
      return null;
    }

    const snippet = toNonEmptyString(result?.snippet) ?? '';
    const location = this.extractLocation(snippet);
    const keywords = extractKeywordsFromText(
      `${parsed.title} ${parsed.company} ${snippet}`,
    );

    return {
      company: parsed.company,
      title: parsed.title,
      location: location ?? 'Remote',
      source: board,
      keywords,
      sourceUrl: link,
      companySize: this.resolveCompanySize(parsed.company),
    };
  }

  private async fetchFortune500Jobs(
    queries: Array<{ query: string; label: string }>,
  ): Promise<JobSearchJob[]> {
    if (queries.length === 0) {
      return [];
    }

    const companies = FORTUNE_500_CAREER_SITES.slice(0, queries.length * 3);
    const tasks = companies.map((company, index) =>
      this.fetchFortuneCompanyJobs(
        company,
        queries[index % queries.length].query,
      ),
    );

    const results = await Promise.allSettled(tasks);
    const jobs: JobSearchJob[] = [];

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        jobs.push(...result.value);
      }
    });

    return jobs;
  }

  private async fetchFortuneCompanyJobs(
    company: { company: string; domain: string },
    query: string,
  ): Promise<JobSearchJob[]> {
    const payload = await this.requestSerpApi({
      engine: 'google',
      q: `site:${company.domain} ${query} job`,
      num: String(JOB_BOARD_MAX_RESULTS_PER_QUERY),
    });

    const results = Array.isArray(payload?.organic_results)
      ? payload.organic_results
      : [];

    return results
      .map((result: any) => this.mapFortuneResult(company, result))
      .filter((job: JobSearchJob | null): job is JobSearchJob => Boolean(job));
  }

  private mapFortuneResult(
    company: { company: string; domain: string },
    result: any,
  ): JobSearchJob | null {
    const link = normalizeUrl(result?.link);
    const rawTitle = toNonEmptyString(result?.title);

    if (!link || !rawTitle) {
      return null;
    }

    const cleanedTitle = rawTitle
      .replace(/\s*\|\s*(Careers|Jobs|Job).*$/i, '')
      .trim();
    const parsed = this.parseTitleCompany(cleanedTitle);
    const title = parsed?.title ?? cleanedTitle;
    if (!title) {
      return null;
    }

    const snippet = toNonEmptyString(result?.snippet) ?? '';
    const location = this.extractLocation(snippet);
    const keywords = extractKeywordsFromText(`${title} ${snippet}`);

    return {
      company: company.company,
      title,
      location: location ?? 'Remote',
      source: 'Company Careers',
      keywords,
      companyUrl: link,
      companySize: 'large',
    };
  }

  private async requestSerpApi(
    params: Record<string, string>,
    usedFallback = false,
  ) {
    const searchParams = new URLSearchParams({
      ...params,
      api_key: this.apiKey,
    });
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      JOB_BOARD_SEARCH_TIMEOUT_MS,
    );

    try {
      const response = await this.fetcher(
        `${this.apiUrl}?${searchParams.toString()}`,
        { signal: controller.signal },
      );

      if (!response.ok) {
        const errorText = await response.text();
        if (
          response.status === 400 &&
          !usedFallback &&
          params.location &&
          isUnsupportedLocationError(errorText)
        ) {
          const fallbackLocation = findFallbackLocation(params.location);
          if (fallbackLocation && fallbackLocation !== params.location) {
            this.logger.warn(
              `SerpAPI unsupported location "${params.location}". Retrying with "${fallbackLocation}".`,
            );
            return await this.requestSerpApi(
              { ...params, location: fallbackLocation },
              true,
            );
          }
        }
        this.logger.warn(
          `SerpAPI error ${response.status}: ${errorText.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException('Job board search failed.');
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('Job board search timed out.');
      }
      throw new ServiceUnavailableException('Job board search failed.');
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveApplyUrls(job: any) {
    const candidates: string[] = [];
    const applyOptions = Array.isArray(job?.apply_options)
      ? job.apply_options
      : [];

    applyOptions.forEach((option: any) => {
      const link = normalizeUrl(option?.link);
      if (link) {
        candidates.push(link);
      }
    });

    const shareLink = normalizeUrl(job?.share_link);
    if (shareLink) {
      candidates.push(shareLink);
    }

    const related = Array.isArray(job?.related_links) ? job.related_links : [];
    related.forEach((link: any) => {
      const url = normalizeUrl(link?.link ?? link?.url);
      if (url) {
        candidates.push(url);
      }
    });

    let companyUrl: string | null = null;
    let sourceUrl: string | null = null;

    candidates.forEach((candidate) => {
      try {
        const host = new URL(candidate).hostname;
        if (isJobBoardHost(host)) {
          if (!sourceUrl) {
            sourceUrl = candidate;
          }
        } else if (!companyUrl) {
          companyUrl = candidate;
        }
      } catch {
        // ignore invalid urls
      }
    });

    return { companyUrl, sourceUrl };
  }

  private dedupeJobs(jobs: JobSearchJob[]) {
    const deduped = new Map<string, JobSearchJob>();

    jobs.forEach((job) => {
      const company = toNonEmptyString(job.company);
      const title = toNonEmptyString(job.title);
      if (!company || !title) {
        return;
      }
      const location = toNonEmptyString(job.location) ?? 'Remote';
      const key = `${normalizeCompanyKey(company)}|${title.toLowerCase()}|${location.toLowerCase()}`;
      if (!deduped.has(key)) {
        deduped.set(key, { ...job, company, title, location });
      }
    });

    return Array.from(deduped.values());
  }

  private buildSearchQueries(
    resumeText: string,
    resumeProfile: ReturnType<typeof buildResumeProfile>,
    desiredJobTitle?: string | null,
  ) {
    const lower = resumeText.toLowerCase();
    const normalizedResume = normalizeKeywordText(resumeText);
    const keywordSource =
      resumeProfile.experienceText.length > 0
        ? resumeProfile.experienceText
        : resumeText;
    const lowerSource = keywordSource.toLowerCase();
    const normalizedSource = normalizeKeywordText(keywordSource);
    const queries = new Set<string>();
    const normalizedKeywords = Array.from(
      new Set(
        Array.from(resumeProfile.keywords)
          .map((keyword) => keyword.toLowerCase().trim())
          .filter(Boolean),
      ),
    );
    const experienceKeywords = resumeProfile.experienceKeywords;
    const experienceKeywordSet = new Set(experienceKeywords);
    const focusTagSet = new Set(resumeProfile.focusTags);
    const isSenior =
      /\b(senior|staff|principal)\b/i.test(lower) ||
      /\blead\s+(engineer|developer|designer|manager|analyst|scientist|architect|consultant|specialist|coordinator|administrator|strategist|director)\b/i.test(
        lower,
      );
    const prefix = isSenior ? 'senior ' : '';
    let primaryQuery: string | null = null;

    const keywordMatches = normalizedKeywords
      .map((keyword) => {
        const directIndex = lowerSource.indexOf(keyword);
        if (directIndex >= 0) {
          return { keyword, index: directIndex };
        }
        const normalizedKeyword = normalizeKeywordText(keyword);
        if (normalizedKeyword.length < 3) {
          return { keyword, index: -1 };
        }
        const normalizedIndex = normalizedSource.indexOf(normalizedKeyword);
        if (normalizedIndex >= 0) {
          return { keyword, index: normalizedIndex };
        }
        const resumeIndex = lower.indexOf(keyword);
        if (resumeIndex >= 0) {
          return { keyword, index: resumeIndex + 10000 };
        }
        const resumeNormalizedIndex =
          normalizedResume.indexOf(normalizedKeyword);
        return {
          keyword,
          index:
            resumeNormalizedIndex >= 0 ? resumeNormalizedIndex + 10000 : -1,
        };
      })
      .filter((entry) => entry.index >= 0)
      .sort((a, b) => a.index - b.index);
    const orderedKeywords = keywordMatches.map((entry) => entry.keyword);

    const keywordHasTerm = (keyword: string, term: string) => {
      if (keyword === term) {
        return true;
      }
      if (term.includes(' ')) {
        return keyword.includes(term);
      }
      return keyword.split(/\s+/).includes(term);
    };

    const hasKeyword = (term: string) =>
      normalizedKeywords.some((keyword) => keywordHasTerm(keyword, term));
    const hasExperienceKeyword = (term: string) =>
      experienceKeywordSet.size > 0 &&
      experienceKeywords.some((keyword) => keywordHasTerm(keyword, term));

    const shouldApplySeniority = (query: string) => {
      if (!prefix) {
        return false;
      }
      const normalizedQuery = query.toLowerCase();
      const normalizedPrefix = prefix.trim().toLowerCase();
      if (normalizedQuery.startsWith(normalizedPrefix)) {
        return false;
      }
      return TITLE_TOKENS.some((token) => normalizedQuery.includes(token));
    };

    const add = (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        return;
      }
      const formatted = shouldApplySeniority(trimmed)
        ? `${prefix}${trimmed}`
        : trimmed;
      if (!queries.has(formatted)) {
        queries.add(formatted);
        if (!primaryQuery) {
          primaryQuery = formatted;
        }
      }
    };

    const desiredTitleValue = toNonEmptyString(desiredJobTitle);
    const normalizedDesiredTitle = desiredTitleValue
      ? desiredTitleValue
          .replace(/\([^)]*\)/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      : null;
    if (normalizedDesiredTitle) {
      add(normalizedDesiredTitle);
    }

    const scoredRules = ROLE_QUERY_RULES.map((rule, index) => {
      const experienceScore = rule.keywords.reduce(
        (total, term) => total + (hasExperienceKeyword(term) ? 1 : 0),
        0,
      );
      const resumeScore = rule.keywords.reduce(
        (total, term) => total + (hasKeyword(term) ? 1 : 0),
        0,
      );
      const requiredMatch = rule.requiredKeywords
        ? experienceKeywordSet.size > 0
          ? rule.requiredKeywords.some((term) => hasExperienceKeyword(term))
          : rule.requiredKeywords.some((term) => hasKeyword(term))
        : true;
      const minScore = rule.minScore ?? 1;
      const thresholdScore =
        experienceKeywordSet.size > 0 ? experienceScore : resumeScore;
      const focusBoost = focusTagSet.has(rule.query) ? 2 : 0;
      const score = experienceScore * 2.5 + resumeScore + focusBoost;
      return {
        rule,
        index,
        score,
        requiredMatch,
        meetsThreshold: thresholdScore >= minScore,
      };
    })
      .filter((entry) => entry.requiredMatch && entry.meetsThreshold)
      .sort((a, b) => b.score - a.score || a.index - b.index);

    const phraseKeywords = orderedKeywords.filter((keyword) =>
      keyword.includes(' '),
    );
    const titlePhrases = phraseKeywords.filter((keyword) =>
      TITLE_TOKENS.some((token) => keyword.includes(token)),
    );
    const titlePhraseSet = new Set(titlePhrases);
    const domainPhrases = phraseKeywords.filter(
      (keyword) => !titlePhraseSet.has(keyword),
    );

    resumeProfile.focusTags.forEach((tag) => add(tag));

    titlePhrases.slice(0, 2).forEach((keyword) => add(keyword));

    scoredRules.forEach((entry) => add(entry.rule.query));

    domainPhrases.slice(0, 2).forEach((keyword) => add(keyword));

    const skillHints = orderedKeywords.filter((keyword) =>
      SKILL_HINTS.some((term) => keywordHasTerm(keyword, term)),
    );
    const uniqueSkillHints = Array.from(new Set(skillHints)).slice(0, 2);
    if (primaryQuery && uniqueSkillHints.length > 0) {
      add(`${primaryQuery} ${uniqueSkillHints.join(' ')}`);
    }

    if (queries.size === 0) {
      const lastJobTitle = extractLastJobTitle(resumeText);
      if (lastJobTitle) {
        add(lastJobTitle);
      }
    }

    if (queries.size === 0) {
      add('software engineer');
      add('fullstack engineer');
    }

    return Array.from(queries);
  }

  private buildSummary(
    queries: string[],
    jobCount: number,
    locationLabels: string[],
  ) {
    const queryText = queries.slice(0, 3).join(', ');
    const locationText = locationLabels.length
      ? ` Location filters: ${locationLabels.join(', ')}.`
      : '';
    return `Queried LinkedIn, Indeed, Glassdoor, Google Jobs, and Fortune 500 career sites using ${queries.length} resume-driven queries (${queryText}). Found ${jobCount} candidate openings.${locationText}`;
  }

  private buildLocationVariants(options: JobSearchOptions) {
    const variants: Array<{ label: string; suffix?: string; location?: string }> =
      [];

    const includeRemote = Boolean(options.includeRemote);
    const includeLocal = Boolean(options.includeLocal);
    const specificLocation = toNonEmptyString(options.specificLocation);
    const localLocation = toNonEmptyString(options.localLocation);

    if (includeRemote) {
      variants.push({
        label: 'remote',
        suffix: 'remote',
        location: 'United States',
      });
    }

    if (includeLocal && localLocation) {
      variants.push({
        label: `local (${localLocation})`,
        location: localLocation,
      });
    }

    if (specificLocation) {
      variants.push({
        label: `specific (${specificLocation})`,
        location: specificLocation,
      });
    }

    if (variants.length === 0) {
      variants.push({ label: 'anywhere' });
    }

    return variants;
  }

  private expandQueries(
    baseQueries: string[],
    variants: Array<{ label: string; suffix?: string; location?: string }>,
    maxQueries: number,
  ) {
    const expanded: Array<{ query: string; location?: string; label: string }> =
      [];

    for (const baseQuery of baseQueries) {
      for (const variant of variants) {
        if (expanded.length >= maxQueries) {
          break;
        }
        const suffix = variant.suffix ? ` ${variant.suffix}` : '';
        const location = variant.location;
        const query = `${baseQuery}${suffix}${
          location && !suffix ? ` ${location}` : ''
        }`.trim();
        expanded.push({ query, location, label: variant.label });
      }
      if (expanded.length >= maxQueries) {
        break;
      }
    }

    return expanded;
  }

  private parseTitleCompany(text: string) {
    if (!text) {
      return null;
    }
    const separators = [' - ', ' – ', ' | ', ' at '];
    for (const separator of separators) {
      if (text.includes(separator)) {
        const parts = text.split(separator).map((part) => part.trim());
        if (parts.length >= 2) {
          return {
            title: parts[0],
            company: parts[1],
          };
        }
      }
    }
    return { title: text.trim(), company: null };
  }

  private extractLocation(text: string) {
    if (!text) {
      return null;
    }
    if (/remote/i.test(text)) {
      return 'Remote';
    }
    const match = text.match(
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s([A-Z]{2})\b/,
    );
    if (match) {
      return `${match[1]}, ${match[2]}`;
    }
    return null;
  }

  private resolveCompanySize(company: string) {
    return this.fortuneCompanyKeys.has(normalizeCompanyKey(company))
      ? 'large'
      : undefined;
  }
}
