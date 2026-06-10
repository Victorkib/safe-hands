/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ adminId: string; reportType: string; rowCount: number; fromIso?: string|null; toIso?: string|null; format: string }} meta
 */
export async function logReportExport(supabase, meta) {
  try {
    await supabase.from('audit_logs').insert({
      user_id: meta.adminId,
      action: 'admin_report_export',
      resource_type: 'report',
      resource_id: null,
      details: {
        report_type: meta.reportType,
        row_count: meta.rowCount,
        format: meta.format,
        from: meta.fromIso || null,
        to: meta.toIso || null,
        exported_at: new Date().toISOString(),
      },
    });
  } catch (e) {
    console.warn('[adminReports] audit log insert failed:', e?.message || e);
  }
}
