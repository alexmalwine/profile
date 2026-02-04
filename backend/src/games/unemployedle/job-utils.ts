import { createHash } from 'crypto';
import { DEFAULT_RATING } from './constants';
import { KNOWN_KEYWORDS } from './keywords';
import {
  EXPERIENCE_HEADERS,
  ROLE_QUERY_RULES,
  SECTION_HEADERS,
} from './job-search.constants';
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

const normalizeKeywordText = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const keywordMatches = (lower: string, normalized: string, keyword: string) => {
  const lowerKeyword = keyword.toLowerCase();
  if (lower.includes(lowerKeyword)) {
    return true;
  }
  const normalizedKeyword = normalizeKeywordText(lowerKeyword);
  if (normalizedKeyword.length < 3) {
    return false;
  }
  return normalized.includes(normalizedKeyword);
};

export const extractResumeKeywords = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const normalized = normalizeKeywordText(resumeText);
  const matches = new Set<string>();

  KNOWN_KEYWORDS.forEach((keyword) => {
    if (keywordMatches(lower, normalized, keyword)) {
      matches.add(keyword);
    }
  });

  return matches;
};

export const extractKeywordsFromText = (text: string) => {
  const lower = text.toLowerCase();
  const normalized = normalizeKeywordText(text);
  return KNOWN_KEYWORDS.filter((keyword) =>
    keywordMatches(lower, normalized, keyword),
  );
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

type FocusScore = {
  id: string;
  score: number;
  matchedKeywords: string[];
};

export type ResumeProfile = {
  keywords: Set<string>;
  experienceText: string;
  experienceHighlights: string[];
  experienceKeywords: string[];
  focusScores: FocusScore[];
  focusTags: string[];
};

const MAX_EXPERIENCE_LINES = 80;
const MAX_EXPERIENCE_HIGHLIGHTS = 8;
const MAX_EXPERIENCE_CHARS = 1600;
const STRONG_FOCUS_THRESHOLD = 0.35;
const GENERIC_FOCUS_TAGS = new Set(['software engineer']);
const BULLET_REGEX = /^[-*\u2022]\s+/;

const FOCUS_RULES = ROLE_QUERY_RULES.map((rule) => ({
  id: rule.query,
  keywords: rule.keywords,
  requiredKeywords: rule.requiredKeywords,
  minScore: rule.minScore ?? 1,
}));

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
    (header) => normalized === header || normalized.startsWith(`${header} `),
  );
};

const extractExperienceLines = (resumeText: string) => {
  const lines = normalizeResumeLines(resumeText);
  if (lines.length === 0) {
    return [];
  }

  const experienceIndex = lines.findIndex((line) =>
    matchesHeader(line, EXPERIENCE_HEADERS),
  );

  let sectionLines = lines;
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
    sectionLines = lines.slice(experienceIndex + 1, endIndex);
  }

  const trimmed = sectionLines.filter(Boolean);
  const fallback = trimmed.length >= 3 ? trimmed : lines;
  return fallback.slice(0, MAX_EXPERIENCE_LINES);
};

const extractExperienceHighlights = (lines: string[]) => {
  const bullets = lines
    .filter((line) => BULLET_REGEX.test(line))
    .map((line) => line.replace(BULLET_REGEX, '').trim())
    .filter(Boolean);
  const source = bullets.length > 0 ? bullets : lines;
  return source.slice(0, MAX_EXPERIENCE_HIGHLIGHTS);
};

const orderKeywordsByAppearance = (text: string, keywords: string[]) => {
  const lower = text.toLowerCase();
  return keywords
    .map((keyword) => ({
      keyword,
      index: lower.indexOf(keyword.toLowerCase()),
    }))
    .filter((entry) => entry.index >= 0)
    .sort((a, b) => a.index - b.index)
    .map((entry) => entry.keyword);
};

const scoreFocusRules = (text: string): FocusScore[] => {
  const lower = text.toLowerCase();
  const normalized = normalizeKeywordText(text);
  return FOCUS_RULES.map((rule) => {
    const matchedKeywords = rule.keywords.filter((keyword) =>
      keywordMatches(lower, normalized, keyword),
    );
    const matchCount = matchedKeywords.length;
    const requiredMatch = rule.requiredKeywords
      ? rule.requiredKeywords.some((keyword) =>
          keywordMatches(lower, normalized, keyword),
        )
      : true;
    if (!requiredMatch || matchCount < rule.minScore) {
      return null;
    }
    return {
      id: rule.id,
      score: matchCount / rule.keywords.length,
      matchedKeywords,
    };
  }).filter((entry): entry is FocusScore => Boolean(entry));
};

const selectTopFocusTags = (scores: FocusScore[], maxTags: number) => {
  if (scores.length === 0) {
    return [];
  }
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const nonGeneric = sorted.filter((entry) => !GENERIC_FOCUS_TAGS.has(entry.id));
  const source = nonGeneric.length > 0 ? nonGeneric : sorted;
  return source.slice(0, maxTags).map((entry) => entry.id);
};

export const extractFocusTags = (text: string, maxTags = 3) =>
  selectTopFocusTags(scoreFocusRules(text), maxTags);

export const buildResumeProfile = (resumeText: string): ResumeProfile => {
  const keywords = extractResumeKeywords(resumeText);
  const experienceLines = extractExperienceLines(resumeText);
  const experienceHighlights = extractExperienceHighlights(experienceLines);
  const experienceText = truncateText(
    experienceLines.join('\n'),
    MAX_EXPERIENCE_CHARS,
  );
  const experienceKeywords = orderKeywordsByAppearance(
    experienceText,
    extractKeywordsFromText(experienceText),
  );
  const focusSource = experienceText.length >= 80 ? experienceText : resumeText;
  const focusScores = scoreFocusRules(focusSource);
  const focusTags = selectTopFocusTags(focusScores, 3);

  return {
    keywords,
    experienceText,
    experienceHighlights,
    experienceKeywords,
    focusScores,
    focusTags,
  };
};

const computeFocusAlignment = (
  resumeScores: FocusScore[],
  jobScores: FocusScore[],
) => {
  if (resumeScores.length === 0 || jobScores.length === 0) {
    return 0;
  }
  const resumeMap = new Map(
    resumeScores.map((score) => [score.id, score.score]),
  );
  const jobMap = new Map(jobScores.map((score) => [score.id, score.score]));
  const keys = new Set([...resumeMap.keys(), ...jobMap.keys()]);
  let dot = 0;
  let resumeNorm = 0;
  let jobNorm = 0;

  keys.forEach((key) => {
    const weight = GENERIC_FOCUS_TAGS.has(key) ? 0.6 : 1;
    const resumeScore = (resumeMap.get(key) ?? 0) * weight;
    const jobScore = (jobMap.get(key) ?? 0) * weight;
    dot += resumeScore * jobScore;
    resumeNorm += resumeScore * resumeScore;
    jobNorm += jobScore * jobScore;
  });

  if (resumeNorm === 0 || jobNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(resumeNorm) * Math.sqrt(jobNorm));
};

const pickPrimaryFocus = (scores: FocusScore[]) => {
  if (scores.length === 0) {
    return null;
  }
  return scores.reduce((best, current) =>
    current.score > best.score ? current : best,
  );
};

export const computeMatchScore = (
  job: JobOpening,
  resumeProfile: ResumeProfile,
) => {
  const jobKeywords =
    job.keywords.length > 0 ? job.keywords : extractKeywordsFromText(job.title);
  if (jobKeywords.length === 0) {
    const focusAlignment = computeFocusAlignment(
      resumeProfile.focusScores,
      scoreFocusRules(job.title),
    );
    return clampNumber(0.35 + focusAlignment * 0.45, 0, 1);
  }

  const resumeKeywordSet = resumeProfile.keywords;
  const experienceKeywordSet = new Set(resumeProfile.experienceKeywords);
  const keywordOverlap =
    jobKeywords.filter((keyword) => resumeKeywordSet.has(keyword)).length /
    jobKeywords.length;
  const experienceOverlapBase =
    jobKeywords.filter((keyword) => experienceKeywordSet.has(keyword)).length /
    jobKeywords.length;
  const experienceOverlap =
    experienceKeywordSet.size > 0 ? experienceOverlapBase : keywordOverlap * 0.7;

  const jobText = `${job.title} ${jobKeywords.join(' ')}`.trim();
  const jobFocusScores = scoreFocusRules(jobText);
  const focusAlignment = computeFocusAlignment(
    resumeProfile.focusScores,
    jobFocusScores,
  );
  const titleKeywords = extractKeywordsFromText(job.title);
  const titleOverlap =
    titleKeywords.length > 0
      ? titleKeywords.filter((keyword) => experienceKeywordSet.has(keyword))
          .length / titleKeywords.length
      : null;

  const components: Array<{ score: number; weight: number }> = [
    { score: experienceOverlap, weight: 0.45 },
    { score: keywordOverlap, weight: 0.25 },
    { score: focusAlignment, weight: 0.2 },
  ];
  if (titleOverlap !== null) {
    components.push({ score: titleOverlap, weight: 0.1 });
  }

  const totalWeight = components.reduce(
    (sum, component) => sum + component.weight,
    0,
  );
  const weightedScore =
    components.reduce(
      (sum, component) => sum + component.score * component.weight,
      0,
    ) / totalWeight;
  let score = 0.15 + weightedScore * 0.85;

  const resumePrimary = pickPrimaryFocus(resumeProfile.focusScores);
  const jobPrimary = pickPrimaryFocus(jobFocusScores);
  if (
    resumePrimary &&
    jobPrimary &&
    resumePrimary.id !== jobPrimary.id &&
    resumePrimary.score >= STRONG_FOCUS_THRESHOLD &&
    jobPrimary.score >= STRONG_FOCUS_THRESHOLD
  ) {
    score = clampNumber(score - 0.1, 0, 1);
  }

  return clampNumber(score, 0, 1);
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

const GENERIC_HINT_KEYWORDS = new Set([
  'software',
  'engineering',
  'developer',
  'development',
  'web',
  'frontend',
  'backend',
  'fullstack',
  'full stack',
  'mobile',
  'data',
  'data analysis',
  'data analytics',
  'analytics',
  'analysis',
  'management',
  'manager',
  'project management',
  'product management',
  'program management',
  'sales',
  'marketing',
  'design',
  'operations',
  'cloud',
  'security',
  'testing',
  'performance',
  'reporting',
  'database',
]);

const INDUSTRY_HINT_RULES = [
  {
    label: 'healthcare',
    keywords: [
      'healthcare',
      'clinical',
      'patient care',
      'nursing',
      'medical',
      'hospital',
      'pharmacy',
      'biotech',
      'pharmaceutical',
      'public health',
      'ehr',
      'emr',
      'hipaa',
    ],
  },
  {
    label: 'finance',
    keywords: [
      'finance',
      'financial analysis',
      'financial modeling',
      'accounting',
      'audit',
      'tax',
      'treasury',
      'investments',
      'portfolio management',
      'risk management',
      'insurance',
      'underwriting',
      'claims',
      'actuarial',
    ],
  },
  {
    label: 'education',
    keywords: [
      'education',
      'teaching',
      'teacher',
      'curriculum',
      'instruction',
      'lesson planning',
      'student',
      'higher education',
      'k-12',
      'instructional design',
      'lms',
      'edtech',
    ],
  },
  {
    label: 'marketing',
    keywords: [
      'marketing',
      'digital marketing',
      'content marketing',
      'growth marketing',
      'performance marketing',
      'brand',
      'seo',
      'sem',
      'ppc',
      'paid search',
      'paid social',
      'email marketing',
      'marketing automation',
      'demand generation',
      'lead generation',
      'campaign management',
      'google analytics',
      'google ads',
    ],
  },
  {
    label: 'sales & revenue',
    keywords: [
      'sales',
      'business development',
      'account executive',
      'account management',
      'customer success',
      'crm',
      'salesforce',
      'pipeline management',
      'sales operations',
      'revenue operations',
      'renewals',
      'upsell',
      'cross-sell',
    ],
  },
  {
    label: 'operations & logistics',
    keywords: [
      'operations',
      'supply chain',
      'logistics',
      'procurement',
      'inventory',
      'warehouse',
      'fulfillment',
      'shipping',
      'transportation',
      'demand planning',
      'capacity planning',
      'quality management',
      'lean',
      'six sigma',
    ],
  },
  {
    label: 'energy & sustainability',
    keywords: [
      'energy',
      'renewable energy',
      'utilities',
      'oil and gas',
      'sustainability',
      'environmental',
    ],
  },
  {
    label: 'public sector',
    keywords: ['government', 'public sector', 'policy', 'regulatory'],
  },
  {
    label: 'nonprofit',
    keywords: [
      'nonprofit',
      'grant writing',
      'fundraising',
      'community outreach',
      'program evaluation',
    ],
  },
  {
    label: 'design & creative',
    keywords: [
      'design',
      'graphic design',
      'visual design',
      'product design',
      'user experience',
      'user interface',
      'ux research',
      'user research',
      'interaction design',
      'figma',
      'adobe',
      'photoshop',
      'illustrator',
      'indesign',
      'motion design',
      'video editing',
    ],
  },
  {
    label: 'data & analytics',
    keywords: [
      'data engineering',
      'data analysis',
      'data analytics',
      'data science',
      'data scientist',
      'business intelligence',
      'analytics',
      'etl',
      'data warehouse',
      'bigquery',
      'snowflake',
      'statistics',
      'machine learning',
    ],
  },
  {
    label: 'cloud infrastructure',
    keywords: [
      'cloud',
      'aws',
      'gcp',
      'azure',
      'devops',
      'sre',
      'site reliability',
      'docker',
      'kubernetes',
      'terraform',
      'ansible',
    ],
  },
  {
    label: 'security & compliance',
    keywords: [
      'security',
      'cybersecurity',
      'privacy',
      'gdpr',
      'compliance',
      'risk management',
    ],
  },
];

const capitalizeSentence = (value: string) =>
  value.length === 0 ? value : `${value[0].toUpperCase()}${value.slice(1)}`;

const getCompanyScaleHint = (
  source: JobSource,
  companySize?: CompanySize,
) => {
  if (source === 'Fortune 500') {
    return 'Fortune 500 employer';
  }
  if (companySize === 'large') {
    return 'Large enterprise';
  }
  if (companySize === 'startup') {
    return 'Early-stage startup';
  }
  if (companySize === 'mid') {
    return 'Mid-sized company';
  }
  return null;
};

const findIndustryHint = (keywords: string[]) => {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const scored = INDUSTRY_HINT_RULES.map((rule, index) => ({
    rule,
    index,
    score: rule.keywords.reduce(
      (total, keyword) => total + (normalized.includes(keyword) ? 1 : 0),
      0,
    ),
  }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return scored[0]?.rule.label ?? null;
};

const selectFocusKeywords = (keywords: string[]) => {
  const normalized = keywords.map((keyword) => keyword.toLowerCase().trim());
  const unique = Array.from(new Set(normalized)).filter(Boolean);
  const prioritized = unique.filter(
    (keyword) => keyword.includes(' ') && !GENERIC_HINT_KEYWORDS.has(keyword),
  );
  const fallback = unique.filter(
    (keyword) => !GENERIC_HINT_KEYWORDS.has(keyword),
  );
  return Array.from(new Set([...prioritized, ...fallback])).slice(0, 2);
};

const getLocationHint = (location: string) => {
  const normalized = location.toLowerCase();
  if (normalized.includes('remote')) {
    return { type: 'remote' as const };
  }
  if (location.length <= 40) {
    return { type: 'onsite' as const, label: location };
  }
  return null;
};

const buildFallbackHint = (
  title: string,
  keywords: string[],
  source: JobSource,
  location: string,
  companySize?: CompanySize,
) => {
  const trimmedTitle = title.trim();
  const focusKeywords = selectFocusKeywords(keywords);
  const scaleHint = getCompanyScaleHint(source, companySize);
  const industryHint = findIndustryHint(keywords);
  const locationHint = getLocationHint(location);

  const leadParts = [scaleHint, industryHint ? `in ${industryHint}` : null].filter(
    Boolean,
  );
  const lead = leadParts.length > 0 ? leadParts.join(' ') : 'This team';
  let hint = `${capitalizeSentence(lead)} is hiring a ${trimmedTitle} role`;

  if (locationHint?.type === 'remote') {
    hint += ' with remote-friendly work';
  } else if (locationHint?.type === 'onsite') {
    hint += ` based in ${locationHint.label}`;
  }

  if (focusKeywords.length > 0) {
    hint += ` focused on ${focusKeywords.join(', ')}`;
  }

  hint += '.';

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
    const companySizeValue = toNonEmptyString(job.companySize);
    const companySize = companySizeValue
      ? normalizeCompanySize(companySizeValue)
      : undefined;
    const hintKeywords = filterKeywordsForHint(keywords, company);
    const companyHint =
      normalizeCompanyHint(job.companyHint, company) ??
      buildFallbackHint(title, hintKeywords, source, location, companySize);
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
