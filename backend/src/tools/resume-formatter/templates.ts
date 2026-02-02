export const formatModern = (
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

export const formatClassic = (
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

export const formatCompact = (
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
