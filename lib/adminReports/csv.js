function escapeCsvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * @param {string[]} headers
 * @param {Array<Record<string, unknown>|unknown[]>} rows
 * @param {'objects'|'arrays'} [rowMode]
 */
export function buildCsv(headers, rows, rowMode = 'objects') {
  const lines = [headers.map(escapeCsvCell).join(',')];

  for (const row of rows) {
    const cells =
      rowMode === 'arrays'
        ? /** @type {unknown[]} */ (row)
        : headers.map((h) => /** @type {Record<string, unknown>} */ (row)[h]);
    lines.push(cells.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}

export function csvResponse(csv, filename) {
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
