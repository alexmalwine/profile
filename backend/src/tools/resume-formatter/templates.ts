export const formatModern = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const sections: string[] = [`# ${name}`];
  const summaryText = summary?.trim();
  const highlightLines = bullets
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
  const skillsLine = skills.map((skill) => skill.trim()).filter(Boolean).join(', ');

  if (summaryText) {
    sections.push('', '## Summary', summaryText);
  }
  if (highlightLines.length > 0) {
    sections.push('', '## Highlights', ...highlightLines);
  }
  if (skillsLine) {
    sections.push('', '## Skills', skillsLine);
  }

  return sections.join('\n');
};

export const formatClassic = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const sections: string[] = [
    name.toUpperCase(),
    '='.repeat(Math.min(40, Math.max(12, name.length))),
  ];
  const summaryText = summary?.trim();
  const highlightLines = bullets
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `- ${line}`);
  const skillsLine = skills.map((skill) => skill.trim()).filter(Boolean).join(', ');

  if (summaryText) {
    sections.push('', 'SUMMARY', summaryText);
  }
  if (highlightLines.length > 0) {
    sections.push('', 'EXPERIENCE', ...highlightLines);
  }
  if (skillsLine) {
    sections.push('', 'SKILLS', skillsLine);
  }

  return sections.join('\n');
};

export const formatCompact = (
  name: string,
  summary: string,
  bullets: string[],
  skills: string[],
) => {
  const headline = `${name} | Resume`;
  const summaryText = summary?.trim();
  const highlightText = bullets
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' • ');
  const skillsLine = skills.map((skill) => skill.trim()).filter(Boolean).join(', ');

  return [headline, '', summaryText, '', highlightText, '', skillsLine]
    .filter((line) => Boolean(line && line.trim()))
    .join('\n');
};
