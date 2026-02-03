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
  extractKeywordsFromText,
  extractResumeKeywords,
  normalizeCompanyKey,
  normalizeJobSource,
  toNonEmptyString,
} from './job-utils';
import type {
  JobSearchClient,
  JobSearchJob,
  JobSearchOptions,
  JobSearchResult,
} from './types';

const JOB_BOARD_HOSTS = ['linkedin.com', 'glassdoor.com', 'indeed.com'];

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

    const resumeKeywords = Array.from(extractResumeKeywords(resumeText));
    const baseQueries = this.buildSearchQueries(resumeText, resumeKeywords);
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
      rating: 4.2,
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
      rating: 4.1,
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
      rating: 4.4,
      keywords,
      companyUrl: link,
      companySize: 'large',
    };
  }

  private async requestSerpApi(params: Record<string, string>) {
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

  private buildSearchQueries(resumeText: string, keywords: string[]) {
    const lower = resumeText.toLowerCase();
    const queries = new Set<string>();
    const isSenior = /(senior|staff|lead|principal)/i.test(lower);
    const prefix = isSenior ? 'senior ' : '';

    const add = (query: string) => {
      const trimmed = query.trim();
      if (trimmed.length > 0) {
        queries.add(trimmed);
      }
    };

    const has = (term: string) => lower.includes(term);
    const hasKeyword = (term: string) =>
      keywords.some((keyword) => keyword.includes(term));

    if (has('software engineer') || (hasKeyword('software') && hasKeyword('engineering'))) {
      add(`${prefix}software engineer`);
    }
    if (has('frontend') || hasKeyword('frontend') || hasKeyword('react')) {
      add(`${prefix}frontend engineer react`);
    }
    if (has('backend') || hasKeyword('backend') || hasKeyword('node')) {
      add(`${prefix}backend engineer node`);
    }
    if (has('fullstack') || hasKeyword('fullstack') || hasKeyword('full stack')) {
      add(`${prefix}fullstack engineer`);
    }
    if (has('platform') || hasKeyword('devops') || hasKeyword('sre')) {
      add(`${prefix}platform engineer`);
    }
    if (has('mobile') || hasKeyword('react native')) {
      add(`${prefix}mobile engineer react native`);
    }

    const skillHints = keywords.filter((keyword) =>
      ['typescript', 'react', 'node', 'aws', 'kubernetes'].some((term) =>
        keyword.includes(term),
      ),
    );
    if (skillHints.length > 0) {
      add(
        `${prefix}software engineer ${skillHints.slice(0, 2).join(' ')}`.trim(),
      );
    }

    if (queries.size === 0) {
      add(`${prefix}software engineer`);
      add(`${prefix}fullstack engineer`);
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
    const expanded: Array<{ query: string; location?: string }> = [];

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
        expanded.push({ query, location });
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
