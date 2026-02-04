import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  MAX_RESUME_CHARS,
  OPENAI_API_URL,
  OPENAI_MODEL,
  OPENAI_RANKING_MAX_TOKENS,
  OPENAI_TIMEOUT_MS,
} from './constants';
import {
  buildResumeProfile,
  extractFocusTags,
  normalizeCompanySize,
  safeParseJson,
  toNonEmptyString,
  truncateText,
} from './job-utils';
import type { JobOpening, JobRanker, JobRanking } from './types';

const MAX_RANKING_JOBS = 30;

const extractRankings = (value: unknown): JobRanking[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  const record = value as Record<string, unknown>;
  const candidates = [
    record.rankings,
    record.results,
    record.jobs,
    record.data,
    record.data && (record.data as Record<string, unknown>).rankings,
    record.result && (record.result as Record<string, unknown>).rankings,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate as JobRanking[];
    }
  }

  return [];
};

const normalizeRanking = (value: unknown): JobRanking | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;
  const id = toNonEmptyString(record.id);
  if (!id) {
    return null;
  }

  const matchScoreValue =
    typeof record.matchScore === 'number'
      ? record.matchScore
      : typeof record.matchScore === 'string'
        ? Number(record.matchScore)
        : undefined;

  const companySizeValue = toNonEmptyString(record.companySize);
  const companySize = companySizeValue
    ? normalizeCompanySize(companySizeValue)
    : undefined;
  const companyHint = toNonEmptyString(record.companyHint) ?? undefined;
  const rationale = toNonEmptyString(record.rationale) ?? undefined;

  return {
    id,
    matchScore: Number.isFinite(matchScoreValue) ? matchScoreValue : undefined,
    companySize,
    companyHint,
    rationale,
  };
};

@Injectable()
export class ChatGptJobRanker implements JobRanker {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly model = OPENAI_MODEL;
  private readonly apiUrl = OPENAI_API_URL;
  private readonly logger = new Logger(ChatGptJobRanker.name);
  private readonly fetcher: typeof fetch = fetch;

  async rankJobs(resumeText: string, jobs: JobOpening[]): Promise<JobRanking[]> {
    if (!this.apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is not configured for job ranking.',
      );
    }

    if (jobs.length === 0) {
      return [];
    }

    const trimmedResume = truncateText(resumeText, MAX_RESUME_CHARS);
    const resumeProfile = buildResumeProfile(resumeText);
    const experienceHighlights = resumeProfile.experienceHighlights
      .map((line) => truncateText(line, 160))
      .filter(Boolean);
    const experienceFallback = resumeProfile.experienceText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 6)
      .map((line) => truncateText(line, 160));
    const experienceLines =
      experienceHighlights.length > 0 ? experienceHighlights : experienceFallback;
    const focusTags = resumeProfile.focusTags;
    const focusKeywords = resumeProfile.experienceKeywords.slice(0, 10);
    const resumeSummaryParts = [
      focusTags.length > 0 ? `Focus areas: ${focusTags.join(', ')}` : null,
      focusKeywords.length > 0
        ? `Experience keywords: ${focusKeywords.join(', ')}`
        : null,
      experienceLines.length > 0
        ? `Experience highlights:\n- ${experienceLines.join('\n- ')}`
        : null,
    ].filter(Boolean);
    const resumeSummary =
      resumeSummaryParts.length > 0
        ? resumeSummaryParts.join('\n')
        : 'Experience summary: Not available.';
    const jobPayload = jobs.slice(0, MAX_RANKING_JOBS).map((job) => ({
      id: job.id,
      company: job.company,
      title: job.title,
      location: job.location,
      source: job.source,
      companySize: job.companySize ?? null,
      keywords: job.keywords.slice(0, 8),
      focusTags: extractFocusTags(
        `${job.title} ${job.keywords.join(' ')}`.trim(),
        2,
      ),
    }));

    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content:
            'You are a job ranking assistant. Rank ONLY the provided jobs ' +
            'based on the resume fit. Prioritize prior job responsibilities ' +
            'and focus areas over raw keyword overlap. Return JSON only.',
        },
        {
          role: 'user',
          content:
            'Return JSON with a rankings array. Each ranking must include: ' +
            'id (from the list), matchScore (0-100), companySize ' +
            '(large|mid|startup), and companyHint (<=15 words, no company name). ' +
            'Make companyHint specific using ONLY the provided fields (size, ' +
            'industry signals, location, focus keywords, or focus tags). Do ' +
            'not invent external facts or news. Do not add or remove jobs. ' +
            'Do not fabricate URLs. If unsure about companySize or ' +
            'companyHint, set them to null.\n\n' +
            'Scoring guidance:\n' +
            '- Use resume experience highlights and job keywords/focusTags ' +
            'more than the skills list.\n' +
            '- Infer focus areas (e.g., backend vs frontend) from the resume ' +
            'job descriptions and weight those matches higher.\n' +
            '- If the resume is backend-heavy, backend roles should score ' +
            'higher than frontend roles.\n' +
            '- Use job focusTags when provided.\n\n' +
            `Resume experience summary:\n${resumeSummary}\n\n` +
            `Resume (full):\n${trimmedResume}\n\n` +
            `Jobs:\n${JSON.stringify(jobPayload)}`,
        },
      ],
      temperature: 0.2,
      max_tokens: OPENAI_RANKING_MAX_TOKENS,
      response_format: { type: 'json_object' },
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

    try {
      const response = await this.fetcher(this.apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.warn(
          `OpenAI API error ${response.status}: ${errorText.slice(0, 200)}`,
        );
        throw new ServiceUnavailableException('ChatGPT job ranking failed.');
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content;
      if (!content) {
        throw new ServiceUnavailableException(
          'ChatGPT did not return job rankings.',
        );
      }

      const parsed = safeParseJson(content);
      const rawRankings = extractRankings(parsed);
      const normalized = rawRankings
        .map((entry) => normalizeRanking(entry))
        .filter((entry): entry is JobRanking => Boolean(entry));

      return normalized;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('ChatGPT job ranking timed out.');
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
