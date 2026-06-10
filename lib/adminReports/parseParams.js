const MAX_EXPORT_ROWS = 25000;

/**
 * @param {URLSearchParams} searchParams
 */
export function parseReportParams(searchParams) {
  const type = String(searchParams.get('type') || '').trim();
  const format = (searchParams.get('format') || 'csv').toLowerCase();
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';
  const includePhones = searchParams.get('includePhones') !== 'false';
  const dateField = searchParams.get('dateField') || 'created_at';

  const allowedFormats = new Set(['csv', 'xlsx']);
  const resolvedFormat = allowedFormats.has(format) ? format : 'csv';

  let fromIso = null;
  let toIso = null;

  if (from) {
    const d = new Date(`${from}T00:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) fromIso = d.toISOString();
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999Z`);
    if (!Number.isNaN(d.getTime())) toIso = d.toISOString();
  }

  return {
    format: resolvedFormat,
    fromIso,
    toIso,
    includePhones,
    dateField,
    maxRows: MAX_EXPORT_ROWS,
  };
}

/**
 * @param {import('@supabase/supabase-js').PostgrestFilterBuilder} query
 * @param {string} column
 * @param {string|null} fromIso
 * @param {string|null} toIso
 */
export function applyDateRange(query, column, fromIso, toIso) {
  let q = query;
  if (fromIso) q = q.gte(column, fromIso);
  if (toIso) q = q.lte(column, toIso);
  return q;
}

export function stampFilename(type, format, from, to) {
  const day = new Date().toISOString().slice(0, 10);
  const range =
    from && to ? `_${from}_to_${to}` : from ? `_from_${from}` : to ? `_to_${to}` : '';
  const ext = format === 'xlsx' ? 'xlsx' : 'csv';
  return `safe-hands-${type}${range || `_${day}`}.${ext}`;
}
