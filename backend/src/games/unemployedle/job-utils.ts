import { createHash } from 'crypto';
import { DEFAULT_RATING } from './constants';
import { KNOWN_KEYWORDS } from './keywords';
import type {
  CompanySize,
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

export const extractResumeLocation = (resumeText: string) => {
  const lines = resumeText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 12);

  for (const line of lines) {
    const match = line.match(
      /([A-Z][a-zA-Z.\- ]+),\s*([A-Z]{2})\b/,
    );
    if (match) {
      return `${match[1].trim()}, ${match[2].trim()}`;
    }
  }

  return null;
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

const MAX_HINT_CHARS = 160;
const COMPANY_SUFFIXES = new Set([
  'inc',
  'incorporated',
  'llc',
  'ltd',
  'limited',
  'corp',
  'corporation',
  'co',
  'company',
  'plc',
  'gmbh',
  'sarl',
  'sa',
  'ag',
  'bv',
  'oy',
  'pte',
  'pvt',
  'lp',
  'llp',
]);

const truncateHint = (value: string) =>
  value.length > MAX_HINT_CHARS ? value.slice(0, MAX_HINT_CHARS).trim() : value;

export const normalizeCompanyHint = (value: unknown, company: string) => {
  const hint = toNonEmptyString(value);
  if (!hint) {
    return null;
  }

  const sanitized = hint.replace(/\s+/g, ' ').trim();
  if (!sanitized) {
    return null;
  }

  const normalizedHint = sanitized
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const normalizedCompany = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalizedCompany && normalizedHint.includes(normalizedCompany)) {
    return null;
  }

  return truncateHint(sanitized);
};

const buildFallbackHint = (title: string, keywords: string[]) => {
  const trimmedTitle = title.trim();
  const hint =
    keywords.length > 0
      ? `This company hires for ${trimmedTitle} roles focused on ${keywords
          .slice(0, 3)
          .join(', ')}.`
      : `This company is hiring for a ${trimmedTitle} role.`;

  return truncateHint(hint);
};

export const normalizeCompanyKey = (company: string) => {
  const normalized = company
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  const tokens = normalized
    .split(' ')
    .filter(Boolean)
    .filter((token) => !COMPANY_SUFFIXES.has(token));
  return tokens.length > 0 ? tokens.join(' ') : normalized;
};

export const normalizeCompanySize = (value: unknown): CompanySize => {
  const normalized = String(value ?? '').toLowerCase();

  if (
    normalized.includes('startup') ||
    normalized.includes('start-up') ||
    normalized.includes('early') ||
    normalized.includes('seed') ||
    normalized.includes('series') ||
    normalized.includes('venture') ||
    normalized.includes('vc') ||
    normalized.includes('bootstrapped') ||
    normalized.includes('small')
  ) {
    return 'startup';
  }

  if (
    normalized.includes('mid') ||
    normalized.includes('medium') ||
    normalized.includes('midsize') ||
    normalized.includes('mid-size') ||
    normalized.includes('scale')
  ) {
    return 'mid';
  }

  if (
    normalized.includes('large') ||
    normalized.includes('enterprise') ||
    normalized.includes('public') ||
    normalized.includes('fortune') ||
    normalized.includes('faang') ||
    normalized.includes('big')
  ) {
    return 'large';
  }

  return 'mid';
};

const filterKeywordsForHint = (keywords: string[], company: string) => {
  const normalizedCompany = company
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalizedCompany) {
    return keywords;
  }
  const tokens = normalizedCompany.split(' ').filter((token) => token.length);
  if (tokens.length === 0) {
    return keywords;
  }

  return keywords.filter((keyword) => {
    const normalizedKeyword = keyword.toLowerCase();
    return !tokens.some((token) => normalizedKeyword.includes(token));
  });
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

const JOB_BOARD_HOSTS = ['linkedin.com', 'glassdoor.com', 'indeed.com'];
const MIN_JOB_ID_LENGTH = 6;

const normalizeHostname = (host: string) =>
  host.toLowerCase().replace(/^www\./, '');

const hostMatches = (host: string, domain: string) =>
  host === domain || host.endsWith(`.${domain}`);

const isJobBoardHost = (host: string) => {
  const normalized = normalizeHostname(host);
  return JOB_BOARD_HOSTS.some((domain) => hostMatches(normalized, domain));
};

const normalizeHttpUrl = (value: unknown) => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    return null;
  }
  try {
    const url = new URL(trimmed);
    return url.toString();
  } catch {
    return null;
  }
};

const isJobBoardSearchUrl = (url: URL) => {
  const host = normalizeHostname(url.hostname);
  const path = url.pathname.toLowerCase();

  if (hostMatches(host, 'linkedin.com')) {
    return path.startsWith('/jobs/search') && url.searchParams.has('keywords');
  }
  if (hostMatches(host, 'glassdoor.com')) {
    return (
      path.includes('/job') &&
      path.endsWith('jobs.htm') &&
      url.searchParams.has('sc.keyword')
    );
  }
  if (hostMatches(host, 'indeed.com')) {
    return path.startsWith('/jobs') && url.searchParams.has('q');
  }
  if (hostMatches(host, 'google.com')) {
    return path.startsWith('/search') && url.searchParams.has('q');
  }

  return false;
};

const isJobBoardDetailUrl = (url: URL) => {
  const host = normalizeHostname(url.hostname);
  const path = url.pathname.toLowerCase();

  if (hostMatches(host, 'linkedin.com')) {
    const match = path.match(/^\/jobs\/view\/(\d+)/);
    return Boolean(match && match[1].length >= MIN_JOB_ID_LENGTH);
  }
  if (hostMatches(host, 'indeed.com')) {
    const jobKey = url.searchParams.get('jk')?.trim();
    return (
      Boolean(jobKey && jobKey.length >= MIN_JOB_ID_LENGTH) &&
      (path.startsWith('/viewjob') ||
        path.startsWith('/rc/clk') ||
        path.startsWith('/pagead/clk'))
    );
  }
  if (hostMatches(host, 'glassdoor.com')) {
    const jobListingId =
      url.searchParams.get('jl') ?? url.searchParams.get('jobListingId');
    return (
      path.includes('/job-listing/') &&
      Boolean(jobListingId && jobListingId.trim().length >= MIN_JOB_ID_LENGTH)
    );
  }

  return false;
};

const normalizeCompanyUrl = (value: unknown) => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (isJobBoardHost(url.hostname)) {
      return null;
    }
    const host = normalizeHostname(url.hostname);
    if (hostMatches(host, 'google.com')) {
      if (url.pathname.toLowerCase().startsWith('/search')) {
        return null;
      }
    }
  } catch {
    return null;
  }

  return normalized;
};

const normalizeSourceUrl = (value: unknown) => {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized);
    if (!isJobBoardHost(url.hostname)) {
      return null;
    }
    if (isJobBoardSearchUrl(url)) {
      return null;
    }
    return isJobBoardDetailUrl(url) ? normalized : null;
  } catch {
    return null;
  }
};

export const resolveJobUrls = (
  job: JobSearchJob,
  source: JobSource,
  company: string,
  title: string,
  location: string,
) => {
  let companyUrl = normalizeCompanyUrl(job.companyUrl);
  let sourceUrl = normalizeSourceUrl(job.sourceUrl);

  const legacyUrl = normalizeHttpUrl(job.url);
  if (legacyUrl) {
    try {
      const host = new URL(legacyUrl).hostname;
      if (!companyUrl && !isJobBoardHost(host)) {
        companyUrl = normalizeCompanyUrl(legacyUrl);
      }
      if (!sourceUrl && isJobBoardHost(host)) {
        sourceUrl = normalizeSourceUrl(legacyUrl);
      }
    } catch {
      // ignore invalid legacy urls
    }
  }

  const fallbackUrl = buildFallbackUrl(source, company, title, location);
  const url = companyUrl ?? sourceUrl ?? fallbackUrl;

  return { companyUrl, sourceUrl, fallbackUrl, url };
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
    const hintKeywords = filterKeywordsForHint(keywords, company);
    const companyHint =
      normalizeCompanyHint(job.companyHint, company) ??
      buildFallbackHint(title, hintKeywords);
    const { companyUrl, sourceUrl, url } = resolveJobUrls(
      job,
      source,
      company,
      title,
      location,
    );
    const matchScoreHint = normalizeMatchScore(job.matchScore) ?? undefined;
    const id = buildJobId(company, title, location, url);
    const companyKey = normalizeCompanyKey(company);
    const key = `${companyKey}|${title.toLowerCase()}|${location.toLowerCase()}`;
    const companySize = normalizeCompanySize(job.companySize);

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
      companyHint,
      companySize,
      companyUrl,
      sourceUrl,
    });
  });

  return normalized;
};
