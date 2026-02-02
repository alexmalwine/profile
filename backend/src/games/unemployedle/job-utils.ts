import { createHash } from 'crypto';
import { DEFAULT_RATING } from './constants';
import { KNOWN_KEYWORDS } from './keywords';
import type {
  JobOpening,
  JobSearchJob,
  JobSearchResult,
  JobSource,
} from './types';

export const sanitizeLetter = (letter: string) => letter.trim().toUpperCase();

export const maskCompanyName = (company: string, guessed: Set<string>) =>
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

export const extractResumeKeywords = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const matches = new Set<string>();

  KNOWN_KEYWORDS.forEach((keyword) => {
    if (lower.includes(keyword)) {
      matches.add(keyword);
    }
  });

  return matches;
};

export const extractKeywordsFromText = (text: string) => {
  const lower = text.toLowerCase();
  return KNOWN_KEYWORDS.filter((keyword) => lower.includes(keyword));
};

export const computeMatchScore = (
  job: JobOpening,
  resumeKeywords: Set<string>,
) => {
  if (job.keywords.length === 0) {
    return 0.4;
  }

  const matches = job.keywords.filter((keyword) =>
    resumeKeywords.has(keyword),
  ).length;
  return matches / job.keywords.length;
};

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export const toNonEmptyString = (value: unknown) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return null;
};

export const normalizeJobSource = (value: unknown): JobSource => {
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

export const normalizeKeywords = (value: unknown) => {
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

export const normalizeMatchScore = (value: unknown) => {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  if (value > 1) {
    return clampNumber(value / 100, 0, 1);
  }

  return clampNumber(value, 0, 1);
};

export const buildJobId = (
  company: string,
  title: string,
  location: string,
  url: string,
) =>
  createHash('sha256')
    .update(`${company}|${title}|${location}|${url}`)
    .digest('hex')
    .slice(0, 12);

export const buildFallbackUrl = (
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

export const normalizeUrl = (
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

export const safeParseJson = (text: string) => {
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

export const truncateText = (text: string, maxChars: number) =>
  text.length > maxChars ? text.slice(0, maxChars) : text;

export const buildSelectionSummary = (
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

export const normalizeJobResults = (jobs: JobSearchJob[]) => {
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
