'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/context/AuthContext';
import {
  REPORT_CATALOG,
  REPORT_CATEGORIES,
} from '@/lib/adminReports/reportCatalog';

const ACCENT_STYLES = {
  amber: 'from-amber-500/20 to-orange-500/10 border-amber-200/80 ring-amber-500/20',
  emerald: 'from-emerald-500/20 to-teal-500/10 border-emerald-200/80 ring-emerald-500/20',
  teal: 'from-teal-500/20 to-cyan-500/10 border-teal-200/80 ring-teal-500/20',
  cyan: 'from-cyan-500/20 to-sky-500/10 border-cyan-200/80 ring-cyan-500/20',
  orange: 'from-orange-500/20 to-amber-500/10 border-orange-200/80 ring-orange-500/20',
  green: 'from-green-500/20 to-emerald-500/10 border-green-200/80 ring-green-500/20',
  blue: 'from-blue-500/20 to-indigo-500/10 border-blue-200/80 ring-blue-500/20',
  rose: 'from-rose-500/20 to-red-500/10 border-rose-200/80 ring-rose-500/20',
  violet: 'from-violet-500/20 to-purple-500/10 border-violet-200/80 ring-violet-500/20',
  purple: 'from-purple-500/20 to-fuchsia-500/10 border-purple-200/80 ring-purple-500/20',
  indigo: 'from-indigo-500/20 to-blue-500/10 border-indigo-200/80 ring-indigo-500/20',
  sky: 'from-sky-500/20 to-blue-500/10 border-sky-200/80 ring-sky-500/20',
  yellow: 'from-yellow-500/20 to-amber-500/10 border-yellow-200/80 ring-yellow-500/20',
  slate: 'from-slate-500/20 to-gray-500/10 border-slate-200/80 ring-slate-500/20',
  gray: 'from-gray-500/20 to-slate-500/10 border-gray-200/80 ring-gray-500/20',
};

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d = new Date()) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

export default function AdminReportsPage() {
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [activeCategory, setActiveCategory] = useState('financial');
  const [preset, setPreset] = useState('month');
  const [fromDate, setFromDate] = useState(isoDate(startOfMonth()));
  const [toDate, setToDate] = useState(isoDate(new Date()));
  const [includePhones, setIncludePhones] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!profile || profile.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [profile, authLoading, router]);

  useEffect(() => {
    const now = new Date();
    if (preset === 'month') {
      setFromDate(isoDate(startOfMonth(now)));
      setToDate(isoDate(now));
    } else if (preset === '30d') {
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() - 30);
      setFromDate(isoDate(start));
      setToDate(isoDate(now));
    } else if (preset === 'all') {
      setFromDate('');
      setToDate('');
    }
  }, [preset]);

  const filteredReports = useMemo(
    () => REPORT_CATALOG.filter((r) => r.category === activeCategory),
    [activeCategory]
  );

  const featured = useMemo(
    () => REPORT_CATALOG.find((r) => r.id === 'financial-pack'),
    []
  );

  const downloadReport = useCallback(
    async (reportId, format) => {
      const key = `${reportId}:${format}`;
      setDownloading(key);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          toast.error('Session expired — please log in again');
          return;
        }

        const params = new URLSearchParams();
        params.set('format', format);
        params.set('includePhones', includePhones ? 'true' : 'false');
        if (fromDate) params.set('from', fromDate);
        if (toDate) params.set('to', toDate);

        const res = await fetch(`/api/admin/reports/${reportId}?${params}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          toast.error(body.error || 'Export failed');
          return;
        }

        const blob = await res.blob();
        const disposition = res.headers.get('Content-Disposition') || '';
        const match = disposition.match(/filename="([^"]+)"/);
        const filename = match?.[1] || `safe-hands-${reportId}.${format}`;

        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        URL.revokeObjectURL(url);

        toast.success(`Downloaded ${filename}`);
      } catch (e) {
        console.error(e);
        toast.error('Export failed');
      } finally {
        setDownloading(null);
      }
    },
    [fromDate, toDate, includePhones]
  );

  if (authLoading || !profile || profile.role !== 'admin') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-indigo-950 to-violet-900 p-8 sm:p-10 text-white shadow-xl">
        <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="relative">
          <Link
            href="/dashboard/admin"
            className="text-sm font-medium text-indigo-200 hover:text-white transition"
          >
            ← Admin dashboard
          </Link>
          <p className="mt-3 text-xs font-bold uppercase tracking-widest text-amber-300/90">
            Compliance & finance
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight">
            Reports & exports
          </h1>
          <p className="mt-3 max-w-2xl text-indigo-100/90 text-sm sm:text-base leading-relaxed">
            Download escrow ledgers, user registers, dispute outcomes, and audit trails.
            Exports are generated server-side and logged for accountability.
          </p>
        </div>
      </section>

      {featured && (
        <section
          className={`rounded-2xl border bg-gradient-to-br p-6 sm:p-8 shadow-sm ring-1 ${ACCENT_STYLES.amber}`}
        >
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex gap-4">
              <span className="text-4xl" aria-hidden>
                {featured.icon}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                  Featured · Excel workbook
                </p>
                <h2 className="text-xl font-bold text-slate-900 mt-1">{featured.title}</h2>
                <p className="text-sm text-slate-700 mt-2 max-w-xl">{featured.description}</p>
              </div>
            </div>
            <button
              type="button"
              disabled={downloading === 'financial-pack:xlsx'}
              onClick={() => downloadReport('financial-pack', 'xlsx')}
              className="shrink-0 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-sm font-bold text-white shadow-lg hover:from-amber-600 hover:to-orange-600 disabled:opacity-60 transition"
            >
              {downloading === 'financial-pack:xlsx'
                ? 'Building workbook…'
                : 'Download financial pack (.xlsx)'}
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Date range & privacy</h2>
          <p className="text-sm text-slate-600 mt-1">
            Filter rows by creation date (settlements use settled date). Leave empty for all-time.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'month', label: 'This month' },
            { id: '30d', label: 'Last 30 days' },
            { id: 'all', label: 'All time' },
            { id: 'custom', label: 'Custom' },
          ].map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPreset(p.id)}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                preset === p.id
                  ? 'bg-indigo-600 text-white shadow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              From
            </span>
            <input
              type="date"
              value={fromDate}
              disabled={preset !== 'custom'}
              onChange={(e) => {
                setPreset('custom');
                setFromDate(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">To</span>
            <input
              type="date"
              value={toDate}
              disabled={preset !== 'custom'}
              onChange={(e) => {
                setPreset('custom');
                setToDate(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm disabled:bg-slate-50"
            />
          </label>
          <label className="flex items-end gap-3 pb-1">
            <input
              id="include-phones"
              type="checkbox"
              checked={includePhones}
              onChange={(e) => setIncludePhones(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600"
            />
            <span className="text-sm text-slate-700">
              Include full phone numbers in exports
            </span>
          </label>
        </div>
      </section>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-1">
        {REPORT_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={`rounded-t-xl px-5 py-3 text-sm font-semibold transition border-b-2 -mb-px ${
              activeCategory === cat.id
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/80'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      <p className="text-sm text-slate-600 -mt-4">
        {REPORT_CATEGORIES.find((c) => c.id === activeCategory)?.description}
      </p>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filteredReports
          .filter((r) => !r.featured)
          .map((report) => {
            const accent = ACCENT_STYLES[report.accent] || ACCENT_STYLES.slate;
            return (
              <article
                key={report.id}
                className={`rounded-2xl border bg-gradient-to-br p-5 shadow-sm ring-1 flex flex-col ${accent}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-2xl" aria-hidden>
                    {report.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-slate-900">{report.title}</h3>
                    <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                      {report.description}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {report.formats.includes('csv') && (
                    <button
                      type="button"
                      disabled={downloading === `${report.id}:csv`}
                      onClick={() => downloadReport(report.id, 'csv')}
                      className="flex-1 min-w-[7rem] rounded-lg border border-slate-300/80 bg-white/90 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-white disabled:opacity-50 transition"
                    >
                      {downloading === `${report.id}:csv` ? '…' : 'CSV'}
                    </button>
                  )}
                  {report.formats.includes('xlsx') && (
                    <button
                      type="button"
                      disabled={downloading === `${report.id}:xlsx`}
                      onClick={() => downloadReport(report.id, 'xlsx')}
                      className="flex-1 min-w-[7rem] rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
                    >
                      {downloading === `${report.id}:xlsx` ? '…' : 'Excel'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-xs text-slate-600 space-y-1">
        <p className="font-semibold text-slate-800">Export notes</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Each download is recorded in platform audit logs.</li>
          <li>Rows are capped at 25,000 per sheet for performance — narrow the date range if needed.</li>
          <li>
            If a financial sheet is empty, run wallet migrations (
            <code className="bg-white px-1 rounded">019</code>,{' '}
            <code className="bg-white px-1 rounded">020</code>,{' '}
            <code className="bg-white px-1 rounded">025</code>) in Supabase.
          </li>
        </ul>
      </section>
    </div>
  );
}
