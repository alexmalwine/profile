import type { ResumeFormat } from './types';

export const FORMATS: ResumeFormat[] = [
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

export const SKILL_KEYWORDS = [
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
