const REDACTED = '[redacted]';
const HOME = '[home]';
const bs = String.fromCharCode(92);

const ALWAYS_SENSITIVE_KEYS = new Set([
  'shortcutName',
  'gaiaName',
  'userName',
  'extensionInstanceId',
  'workingPipe',
  'samplePipes',
  'pipe',
  'path',
]);

const EMAIL_RE = new RegExp('[A-Z0-9._%+-]+@[A-Z0-9.-]+[.][A-Z]{2,}', 'giu');
const UUID_RE = new RegExp('[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}', 'giu');

function redactHomePath(value) {
  const windowsUserMarker = ':' + bs + 'Users' + bs;
  if (value.includes(windowsUserMarker)) return HOME;
  if (value.includes('/Users/') || value.includes('/home/')) return HOME;
  return value;
}

function redactString(value) {
  return redactHomePath(value)
    .replace(EMAIL_RE, REDACTED)
    .replace(UUID_RE, REDACTED);
}

function looksLikeProfileObject(value) {
  return Boolean(value && typeof value === 'object' && ('profileDir' in value || 'userName' in value || 'gaiaName' in value || 'shortcutName' in value));
}

function redactObject(value) {
  const profileObject = looksLikeProfileObject(value);
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (ALWAYS_SENSITIVE_KEYS.has(key) || (profileObject && key === 'name')) {
      out[key] = REDACTED;
    } else {
      out[key] = redactForLogs(item);
    }
  }
  return out;
}

export function redactForLogs(value) {
  if (typeof value === 'string') return redactString(value);
  if (Array.isArray(value)) return value.map((item) => redactForLogs(item));
  if (!value || typeof value !== 'object') return value;
  return redactObject(value);
}
