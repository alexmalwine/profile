const normalizeListEntry = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .trim();

export const parseDelimitedList = (
  value?: string | string[] | null,
): string[] => {
  if (!value) {
    return [];
  }

  const parts = Array.isArray(value) ? value : [value];
  const parsed: string[] = [];

  parts.forEach((entry) => {
    if (!entry) {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed) {
      return;
    }
    try {
      const json = JSON.parse(trimmed);
      if (Array.isArray(json)) {
        json
          .map((item) => (typeof item === 'string' ? normalizeListEntry(item) : ''))
          .filter(Boolean)
          .forEach((item) => parsed.push(item));
        return;
      }
    } catch {
      // ignore json parse errors and fall through to delimited parsing
    }

    trimmed
      .split(/[\n,]+/)
      .map(normalizeListEntry)
      .filter(Boolean)
      .forEach((item) => parsed.push(item));
  });

  return parsed;
};

export const normalizeTitleKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

export const sanitizeFileName = (value: string) => {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

  return base || 'card';
};
