import { SKILL_KEYWORDS } from './constants';

export const normalizeResumeLines = (resumeText: string) =>
  resumeText
    .replace(/\t/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

export const extractSkills = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const matches = SKILL_KEYWORDS.filter((skill) =>
    lower.includes(skill.toLowerCase()),
  );

  return Array.from(new Set(matches));
};

export const sanitizeFileName = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return base || 'candidate';
};

const SUMMARY_HEADERS = ['summary', 'professional summary', 'profile', 'objective'];
const EXPERIENCE_HEADERS = [
  'experience',
  'work experience',
  'professional experience',
  'employment',
  'employment history',
  'work history',
  'career history',
];
const SKILLS_HEADERS = ['skills', 'technical skills', 'core skills', 'toolbox'];
const PROJECT_HEADERS = ['projects', 'selected projects'];
const EDUCATION_HEADERS = ['education'];

const SECTION_CONFIG = [
  { key: 'summary', headers: SUMMARY_HEADERS },
  { key: 'experience', headers: EXPERIENCE_HEADERS },
  { key: 'skills', headers: SKILLS_HEADERS },
  { key: 'projects', headers: PROJECT_HEADERS },
  { key: 'education', headers: EDUCATION_HEADERS },
];

const normalizeHeader = (line: string) =>
  line
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchSectionHeader = (line: string) => {
  const normalized = normalizeHeader(line);
  const match = SECTION_CONFIG.find(({ headers }) =>
    headers.some(
      (header) => normalized === header || normalized.startsWith(`${header} `),
    ),
  );
  return match?.key ?? null;
};

const isContactLine = (line: string) => {
  const lower = line.toLowerCase();
  return (
    /[^\s@]+@[^\s@]+\.[^\s@]+/.test(line) ||
    /(\+?\d[\d\s().-]{7,}\d)/.test(line) ||
    lower.includes('linkedin.com') ||
    lower.includes('github.com') ||
    lower.includes('portfolio') ||
    lower.includes('www.') ||
    lower.startsWith('http')
  );
};

const isBulletLine = (line: string) => /^[-*•]\s+/.test(line);

const stripBullet = (line: string) =>
  line.replace(/^[-*•]\s+/, '').trim();

const extractName = (lines: string[]) => {
  const candidates = lines.slice(0, 6).filter((line) => {
    if (!line || isContactLine(line)) {
      return false;
    }
    if (matchSectionHeader(line)) {
      return false;
    }
    if (!/[a-zA-Z]/.test(line)) {
      return false;
    }
    return line.length <= 60;
  });

  const withTwoWords = candidates.find(
    (line) => line.trim().split(/\s+/).length >= 2,
  );
  return withTwoWords ?? candidates[0] ?? lines[0] ?? '';
};

const splitSections = (lines: string[]) => {
  const sections: Record<string, string[]> = {
    intro: [],
    summary: [],
    experience: [],
    skills: [],
    projects: [],
    education: [],
  };
  let current = 'intro';

  lines.forEach((line) => {
    const sectionKey = matchSectionHeader(line);
    if (sectionKey) {
      current = sectionKey;
      return;
    }
    sections[current].push(line);
  });

  return sections;
};

const extractSummary = (sections: Record<string, string[]>, name: string) => {
  const summarySource =
    sections.summary.length > 0
      ? sections.summary
      : sections.intro.filter(
          (line) => line !== name && !isContactLine(line),
        );
  return summarySource.slice(0, 2).join(' ').trim();
};

const extractHighlights = (sections: Record<string, string[]>) => {
  const detailLines = [...sections.experience, ...sections.projects];
  const bullets = detailLines
    .filter((line) => isBulletLine(line))
    .map((line) => stripBullet(line))
    .filter(Boolean);

  if (bullets.length > 0) {
    return bullets.slice(0, 6);
  }

  const fallback = detailLines
    .filter((line) => !isContactLine(line))
    .map((line) => line.trim())
    .filter(Boolean);
  return fallback.slice(0, 4);
};

const extractSkillsFromSection = (sections: Record<string, string[]>) => {
  if (sections.skills.length === 0) {
    return [];
  }
  const combined = sections.skills.join(' ');
  const tokens = combined
    .split(/[,|•]/g)
    .map((token) => token.trim())
    .filter(Boolean);
  return Array.from(new Set(tokens));
};

export const parseResumeContent = (resumeText: string) => {
  const lines = normalizeResumeLines(resumeText);
  const name = extractName(lines);
  const sections = splitSections(lines);
  const summary = extractSummary(sections, name);
  const bullets = extractHighlights(sections);
  const skillsFromSections = extractSkillsFromSection(sections);
  const skills =
    skillsFromSections.length > 0 ? skillsFromSections : extractSkills(resumeText);

  return {
    name,
    summary,
    bullets,
    skills,
  };
};
