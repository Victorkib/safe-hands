import { requireAdmin } from '@/lib/adminReports/adminAuth';
import { REPORT_CATALOG, REPORT_CATEGORIES } from '@/lib/adminReports/reportCatalog';

/**
 * GET /api/admin/reports — catalog metadata for the reports hub UI
 */
export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  return Response.json({
    success: true,
    categories: REPORT_CATEGORIES,
    reports: REPORT_CATALOG,
  });
}
