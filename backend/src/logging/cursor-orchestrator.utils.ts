const MAX_FIELD_LENGTH = 10_000;

const truncate = (value: string | undefined, max = MAX_FIELD_LENGTH) => {
  if (!value) {
    return value;
  }
  if (value.length <= max) {
    return value;
  }
  return `${value.slice(0, max)} ... (truncated)`;
};

const parseBooleanFlag = (value?: string) => {
  if (!value) {
    return false;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
};

const resolveRepoUrl = () => {
  if (process.env.CURSOR_ORCHESTRATOR_REPO_URL) {
    return process.env.CURSOR_ORCHESTRATOR_REPO_URL;
  }
  if (process.env.REPO_URL) {
    return process.env.REPO_URL;
  }
  if (process.env.GITHUB_REPOSITORY) {
    return `https://github.com/${process.env.GITHUB_REPOSITORY}`;
  }
  return '';
};

const resolveRepoRef = () => {
  if (process.env.CURSOR_ORCHESTRATOR_REPO_REF) {
    return process.env.CURSOR_ORCHESTRATOR_REPO_REF;
  }
  if (process.env.REPO_REF) {
    return process.env.REPO_REF;
  }
  return process.env.GITHUB_REF_NAME ?? process.env.GITHUB_SHA ?? '';
};

const resolveServiceName = () =>
  process.env.CURSOR_ORCHESTRATOR_SERVICE ??
  process.env.SERVICE_NAME ??
  'backend';

const resolveEnvironment = () =>
  process.env.CURSOR_ORCHESTRATOR_ENVIRONMENT ??
  process.env.ENVIRONMENT ??
  process.env.NODE_ENV ??
  'unknown';

const safeStringify = (value: unknown) => {
  const seen = new WeakSet<object>();
  try {
    return JSON.stringify(
      value,
      (key, current) => {
        if (typeof current === 'bigint') {
          return current.toString();
        }
        if (typeof current === 'function') {
          return `[Function: ${current.name || 'anonymous'}]`;
        }
        if (typeof current === 'symbol') {
          return current.toString();
        }
        if (current && typeof current === 'object') {
          if (seen.has(current as object)) {
            return '[Circular]';
          }
          seen.add(current as object);
        }
        return current;
      },
      2,
    );
  } catch (error) {
    return `"Unable to serialize value: ${
      error instanceof Error ? error.message : 'unknown error'
    }"`;
  }
};

const looksLikeStack = (value: string) =>
  value.includes('\n') || value.includes(' at ') || value.startsWith('Error:');

const extractDetails = (value: Record<string, unknown>) => {
  const details: Record<string, unknown> = {};
  Object.entries(value).forEach(([key, entry]) => {
    if (key === 'message' || key === 'stack' || key === 'name') {
      return;
    }
    details[key] = entry;
  });
  return Object.keys(details).length > 0 ? details : undefined;
};

export {
  MAX_FIELD_LENGTH,
  extractDetails,
  looksLikeStack,
  parseBooleanFlag,
  resolveEnvironment,
  resolveRepoRef,
  resolveRepoUrl,
  resolveServiceName,
  safeStringify,
  truncate,
};
