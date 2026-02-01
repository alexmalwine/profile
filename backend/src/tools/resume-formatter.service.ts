import { BadRequestException, Injectable } from '@nestjs/common';

type ResumeFormatId = 'modern' | 'classic' | 'compact';

interface ResumeFormat {
  id: ResumeFormatId;
  label: string;
  description: string;
  fileExtension: string;
  mimeType: string;
}

interface FormatResult {
  formatId: ResumeFormatId;
  formatLabel: string;
  content: string;
  fileName: string;
  mimeType: string;
}

const FORMATS: ResumeFormat[] = [
  {
    id: 'modern',
    label: 'Modern',
    description: 'Clean sections with emphasis on impact and metrics.',
    fileExtension: 'md',
    mimeType: 'text/markdown',
  },
  {
    id: 'classic',
    label: 'Classic',
    description: 'Traditional format with clear headings and bullet points.',
    fileExtension: 'md',
    mimeType: 'text/markdown',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Condensed format designed for quick scanning.',
    fileExtension: 'txt',
    mimeType: 'text/plain',
  },
];

const SKILL_KEYWORDS = [
  'React',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'NestJS',
  'GraphQL',
  'REST',
  'AWS',
  'GCP',
  'Docker',
  'Kubernetes',
  'PostgreSQL',
  'Redis',
  'Testing',
  'Observability',
  'Frontend',
  'Backend',
  'Fullstack',
];

const normalizeResumeLines = (resumeText: string) =>
  resumeText
    .replace(/\t/g, ' ')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const extractSkills = (resumeText: string) => {
  const lower = resumeText.toLowerCase();
  const matches = SKILL_KEYWORDS.filter((skill) =>
    lower.includes(skill.toLowerCase()),
  );

  return Array.from(new Set(matches));
};

const sanitizeFileName = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return base || 'candidate';
};

const formatModern = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const summaryText = summary || 'Add a concise summary of your impact.';
  const highlightLines =
    bullets.length > 0
      ? bullets.map((line) => `- ${line}`)
      : ['- Add measurable outcomes and achievements.'];
  const skillsLine = skills.length > 0 ? skills.join(', ') : 'Add core skills.';

  return [
    `# ${name}`,
    '',
    '## Summary',
    summaryText,
    '',
    '## Highlights',
    ...highlightLines,
    '',
    '## Skills',
    skillsLine,
  ].join('\n');
};

const formatClassic = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const summaryText = summary || 'Add a concise summary of your impact.';
  const highlightLines =
    bullets.length > 0
      ? bullets.map((line) => `- ${line}`)
      : ['- Add measurable outcomes and achievements.'];
  const skillsLine = skills.length > 0 ? skills.join(', ') : 'Add core skills.';

  return [
    name.toUpperCase(),
    '='.repeat(Math.min(40, Math.max(12, name.length))),
    '',
    'SUMMARY',
    summaryText,
    '',
    'EXPERIENCE',
    ...highlightLines,
    '',
    'SKILLS',
    skillsLine,
  ].join('\n');
};

const formatCompact = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const headline = `${name} | Resume`;
  const summaryText = summary || 'Add a concise summary of your impact.';
  const allHighlights = bullets.length > 0 ? bullets : [summaryText];
  const skillsLine = skills.length > 0 ? skills.join(', ') : 'Add core skills.';

  return [headline, '', summaryText, '', allHighlights.join(' • '), '', skillsLine]
    .filter(Boolean)
    .join('\n');
};

@Injectable()
export class ResumeFormatterService {
  getFormats() {
    return FORMATS.map(({ id, label, description }) => ({
      id,
      label,
      description,
    }));
  }

  formatResume(resumeText: string, formatId: string): FormatResult {
    const format = FORMATS.find((entry) => entry.id === formatId);
    if (!format) {
      throw new BadRequestException('Unknown resume format.');
    }

    const lines = normalizeResumeLines(resumeText);
    const name = lines[0] ?? 'Candidate Name';
    const summaryLines = lines.slice(1, 4);
    const detailLines = lines.slice(4);
    const summary = summaryLines.join(' ');
    const bullets = detailLines.length > 0 ? detailLines : summaryLines;
    const skills = extractSkills(resumeText);

    // TODO: Replace with a structured resume parser and LLM-enhanced formatting.
    let content = '';
    switch (format.id) {
      case 'modern':
        content = formatModern(name, summary, bullets, skills);
        break;
      case 'classic':
        content = formatClassic(name, summary, bullets, skills);
        break;
      case 'compact':
        content = formatCompact(name, summary, bullets, skills);
        break;
      default:
        content = formatModern(name, summary, bullets, skills);
    }

    const safeName = sanitizeFileName(name);

    return {
      formatId: format.id,
      formatLabel: format.label,
      content,
      fileName: `${safeName}-resume-${format.id}.${format.fileExtension}`,
      mimeType: format.mimeType,
    };
  }
}
