import { requireAdmin } from '@/lib/adminReports/adminAuth';
import { logReportExport } from '@/lib/adminReports/auditExport';
import { buildCsv, csvResponse } from '@/lib/adminReports/csv';
import { buildExcelBuffer, buildSingleSheetExcel, xlsxResponse } from '@/lib/adminReports/excel';
import { parseReportParams, stampFilename } from '@/lib/adminReports/parseParams';
import { getReportMeta, VALID_REPORT_TYPES } from '@/lib/adminReports/reportCatalog';
import { buildReportDataset } from '@/lib/adminReports/reportData';

/**
 * GET /api/admin/reports/[type]?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|xlsx&includePhones=true
 */
export async function GET(request, { params }) {
  try {
    const auth = await requireAdmin(request);
    if (auth.response) return auth.response;

    const { type } = await params;
    if (!VALID_REPORT_TYPES.has(type)) {
      return Response.json({ error: 'Unknown report type' }, { status: 404 });
    }

    const meta = getReportMeta(type);
    const { searchParams } = new URL(request.url);
    const parsed = parseReportParams(searchParams);

    if (type === 'financial-pack') {
      parsed.format = 'xlsx';
    } else if (!meta?.formats.includes(parsed.format)) {
      parsed.format = meta?.formats[0] || 'csv';
    }

    const dataset = await buildReportDataset(auth.supabase, type, {
      ...parsed,
      dateField: searchParams.get('dateField') || meta?.dateField || 'created_at',
    });

    const fromLabel = searchParams.get('from') || '';
    const toLabel = searchParams.get('to') || '';
    const filename = stampFilename(type, parsed.format, fromLabel, toLabel);

    await logReportExport(auth.supabase, {
      adminId: auth.user.id,
      reportType: type,
      rowCount: dataset.rowCount ?? dataset.rows?.length ?? 0,
      fromIso: parsed.fromIso,
      toIso: parsed.toIso,
      format: parsed.format,
    });

    if (parsed.format === 'xlsx') {
      const buffer = dataset.sheets
        ? await buildExcelBuffer(dataset.sheets)
        : await buildSingleSheetExcel(
            dataset.headers,
            dataset.rows,
            meta?.title?.slice(0, 31) || 'Report'
          );
      return xlsxResponse(buffer, filename);
    }

    const csv = buildCsv(dataset.headers, dataset.rows);
    return csvResponse(`\uFEFF${csv}`, filename);
  } catch (e) {
    console.error('[adminReports] export failed:', e);
    return Response.json(
      { error: e?.message || 'Failed to generate report' },
      { status: 500 }
    );
  }
}
