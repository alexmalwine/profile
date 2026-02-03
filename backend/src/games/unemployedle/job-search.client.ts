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
            'jobs: 15 openings aligned to the resume focus with company, ' +
            'title, location, source, rating (1-5), keywords (3-6 items), ' +
            'companyUrl, sourceUrl, companyHint, companySize, matchScore (0-100), ' +
            'and rationale ' +
            '(<=20 words). ' +
            'Each job must be a unique company (no repeats). ' +
            'companySize must be one of: large, mid, startup. Include a balanced ' +
            'mix with 4-6 from each size if possible. ' +
            'companyUrl must be a direct job posting on the hiring company ' +
            'careers/ATS site (Workday, Greenhouse, Lever, SmartRecruiters, etc). ' +
            'If unavailable, set companyUrl to null. ' +
            'sourceUrl must be a direct job posting on the third-party site ' +
            'named in source (LinkedIn /jobs/view, Indeed /viewjob, Glassdoor ' +
            '/job-listing). Include the job ID in the URL (LinkedIn job id in ' +
            '/jobs/view/<id>, Indeed jk=..., Glassdoor jl=... or jobListingId=...). ' +
            'If you cannot provide a job ID, set sourceUrl to null. ' +
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
