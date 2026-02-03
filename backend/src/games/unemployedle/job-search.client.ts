import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MAX_RESUME_CHARS,
  OPENAI_API_URL,
  OPENAI_MAX_TOKENS,
  OPENAI_MODEL,
  OPENAI_TIMEOUT_MS,
} from './constants';
import { safeParseJson, toNonEmptyString, truncateText } from './job-utils';
import type { JobSearchClient, JobSearchJob, JobSearchResult } from './types';

const looksLikeJob = (value: unknown): value is JobSearchJob =>
  Boolean(
    value &&
      typeof value === 'object' &&
      ('company' in value ||
        'title' in value ||
        'location' in value ||
        'source' in value),
  );

const findJobsArray = (value: unknown): JobSearchJob[] | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.some(looksLikeJob) ? (value as JobSearchJob[]) : null;
  }

  const withJobs = value as { jobs?: unknown };
  if (Array.isArray(withJobs.jobs)) {
    return withJobs.jobs as JobSearchJob[];
  }
  if (typeof withJobs.jobs === 'string') {
    try {
      const parsed = JSON.parse(withJobs.jobs);
      if (Array.isArray(parsed) && parsed.some(looksLikeJob)) {
        return parsed as JobSearchJob[];
      }
    } catch {
      // ignore invalid json strings
    }
  }
  if (withJobs.jobs && typeof withJobs.jobs === 'object') {
    const values = Object.values(withJobs.jobs);
    if (values.some(looksLikeJob)) {
      return values as JobSearchJob[];
    }
  }

  for (const candidate of Object.values(value)) {
    if (Array.isArray(candidate) && candidate.some(looksLikeJob)) {
      return candidate as JobSearchJob[];
    }
  }

  return null;
};

const extractSearchResult = (parsed: unknown): JobSearchResult | null => {
  if (!parsed || typeof parsed !== 'object') {
    return null;
  }

  const parsedObj = parsed as Record<string, unknown>;
  const data = parsedObj.data as Record<string, unknown> | undefined;
  const result = parsedObj.result as Record<string, unknown> | undefined;
  const results = parsedObj.results as Record<string, unknown> | undefined;
  const jobResults = parsedObj.jobResults as Record<string, unknown> | undefined;
  const openings = parsedObj.openings as Record<string, unknown> | undefined;

  const nestedCandidates = [
    parsedObj,
    data,
    result,
    results,
    jobResults,
    openings,
  ].filter(Boolean) as Record<string, unknown>[];

  let jobs: JobSearchJob[] | null = null;
  for (const candidate of nestedCandidates) {
    jobs = findJobsArray(candidate);
    if (jobs?.length) {
      break;
    }
  }

  if (!jobs || jobs.length === 0) {
    return null;
  }

  const summary =
    toNonEmptyString(parsedObj.summary) ??
    toNonEmptyString(data?.summary) ??
    toNonEmptyString(result?.summary) ??
    toNonEmptyString(results?.summary) ??
    '';

  const searchQueries =
    Array.isArray(parsedObj.searchQueries) && parsedObj.searchQueries.length > 0
      ? parsedObj.searchQueries
      : Array.isArray(data?.searchQueries)
        ? data?.searchQueries
        : Array.isArray(result?.searchQueries)
          ? result?.searchQueries
          : Array.isArray(results?.searchQueries)
            ? results?.searchQueries
            : [];

  return {
    summary,
    searchQueries: searchQueries.map((query) => String(query).trim()),
    jobs,
  };
};

@Injectable()
export class ChatGptJobSearchClient implements JobSearchClient {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = OPENAI_MODEL;
  private readonly apiUrl = OPENAI_API_URL;
  private readonly logger = new Logger(ChatGptJobSearchClient.name);
  private readonly fetcher: typeof fetch = fetch;

  constructor() {}

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
            'You are a job search engine. Use the resume to infer target ' +
            'industries, job families, and seniority. Return openings aligned ' +
            'to those industries (not just software engineering) on LinkedIn, ' +
            'Glassdoor, Indeed, and company career pages. Respond with JSON only.',
        },
        {
          role: 'user',
          content:
            'Return JSON with fields summary, searchQueries, and jobs. ' +
            'summary: 1-2 sentences (<=35 words) about how the search was ' +
            'performed and which industries or functions were targeted. ' +
            'searchQueries: 5-8 short queries (<=6 words each) that reflect ' +
            'the resume focus (for example marketing, finance, healthcare, ' +
            'operations, or design). ' +
            'jobs: 8-12 openings aligned to the resume focus with company, ' +
            'title, location, source, rating (1-5), keywords (3-6 items), ' +
            'companyUrl, sourceUrl, companyHint, companySize, matchScore (0-100), ' +
            'and rationale ' +
            '(<=20 words). ' +
            'Each job must be a unique company (no repeats). ' +
            'companySize must be one of: large, mid, startup. Return 4 per size ' +
            'if possible; if not, fill remaining slots with other sizes but keep ' +
            'companies unique. ' +
            'companyUrl must be a direct job posting on the hiring company ' +
            'careers/ATS site (Workday, Greenhouse, Lever, SmartRecruiters, etc). ' +
            'Only include openings you are confident are live right now; if ' +
            'unsure, omit the job. If unavailable, set companyUrl to null. ' +
            'sourceUrl must be a direct job posting on the third-party site ' +
            'named in source (LinkedIn /jobs/view, Indeed /viewjob, Glassdoor ' +
            '/job-listing). Include the job ID in the URL (LinkedIn job id in ' +
            '/jobs/view/<id>, Indeed jk=..., Glassdoor jl=... or jobListingId=...). ' +
            'If you cannot provide a job ID, set sourceUrl to null. ' +
            'Do not fabricate URLs; if fewer than 12 real jobs are found, ' +
            'return fewer jobs instead of guessing. ' +
            'companyHint must describe what the company does in <=15 words ' +
            'and must not include the company name. If unsure, set null. ' +
            'Do not use search-result or Google URLs. ' +
            'Use real job boards in the source field. Keep values concise, ' +
            'avoid extra whitespace or Markdown, and return JSON only.\n\n' +
            `Resume:\n${trimmedResume}`,
        },
      ],
      temperature: 0.2,
      max_tokens: OPENAI_MAX_TOKENS,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    let response: Response;
    console.log('Sending ChatGPT job search request:', requestBody);
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
        throw new ServiceUnavailableException('ChatGPT job search timed out.');
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
      // console.log('ChatGPT job search response payload:', payload);
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
    const extracted = extractSearchResult(parsed);
    if (!extracted) {
      throw new ServiceUnavailableException(
        'ChatGPT response was missing job results.',
      );
    }

    return {
      summary: toNonEmptyString(extracted.summary) ?? '',
      searchQueries: Array.isArray(extracted.searchQueries)
        ? extracted.searchQueries.map((query: unknown) => String(query).trim())
        : [],
      jobs: extracted.jobs,
    };
  }
}
