import { Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  MAX_RESUME_CHARS,
  OPENAI_API_URL,
  OPENAI_MODEL,
  OPENAI_TIMEOUT_MS,
} from './constants';
import {
  safeParseJson,
  toNonEmptyString,
  truncateText,
} from './job-utils';
import type { JobSearchClient, JobSearchJob, JobSearchResult } from './types';

export class ChatGptJobSearchClient implements JobSearchClient {
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
            'You are a job search engine. Use the resume to infer target ' +
            'industries, job families, and seniority. Return openings aligned ' +
            'to those industries (not just software engineering) on LinkedIn, ' +
            'Glassdoor, Indeed, and company career pages. Respond with JSON only.',
        },
        {
          role: 'user',
          content:
            'Return JSON with fields summary, searchQueries, and jobs. ' +
            'summary: 1-2 sentences about how the search was performed and ' +
            'which industries or functions were targeted. ' +
            'searchQueries: 5-8 queries that reflect the resume focus (for ' +
            'example marketing, finance, healthcare, operations, or design). ' +
            'jobs: 12-15 openings aligned to the resume focus with company, ' +
            'title, location, source, rating (1-5), keywords (skills), url, ' +
            'matchScore (0-100), and rationale. ' +
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
