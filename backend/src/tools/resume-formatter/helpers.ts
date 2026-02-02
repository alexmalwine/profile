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
