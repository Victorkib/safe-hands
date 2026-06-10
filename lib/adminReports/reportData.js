import { applyDateRange } from '@/lib/adminReports/parseParams';
import { getReportMeta } from '@/lib/adminReports/reportCatalog';

function fmt(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function fmtDate(value) {
  if (!value) return '';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toISOString();
}

function maskPhone(phone, includePhones) {
  if (!phone) return '';
  if (includePhones) return String(phone);
  const s = String(phone);
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {object} opts
 */
async function fetchTable(supabase, table, opts) {
  const { dateField, fromIso, toIso, maxRows, select = '*' } = opts;
  let query = supabase.from(table).select(select).order(dateField, { ascending: false }).limit(maxRows);
  query = applyDateRange(query, dateField, fromIso, toIso);
  const { data, error } = await query;
  if (error) {
    if (/does not exist|schema cache/i.test(error.message || '')) {
      return { rows: [], missing: true, error: error.message };
    }
    throw new Error(error.message);
  }
  return { rows: data || [], missing: false };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} params
 * @returns {Promise<{ headers: string[]; rows: Record<string, unknown>[]; rowCount: number; sheets?: object[] }>}
 */
export async function buildReportDataset(supabase, type, params) {
  const meta = getReportMeta(type);
  if (!meta) throw new Error('Unknown report type');

  const dateField = params.dateField || meta.dateField || 'created_at';
  const fetchOpts = {
    dateField,
    fromIso: params.fromIso,
    toIso: params.toIso,
    maxRows: params.maxRows,
  };

  if (type === 'financial-pack') {
    return buildFinancialPack(supabase, fetchOpts, params);
  }

  const built = await buildSingleReport(supabase, type, fetchOpts, params);
  return built;
}

async function buildSingleReport(supabase, type, fetchOpts, params) {
  const includePhones = params.includePhones !== false;

  switch (type) {
    case 'users':
      return buildUsers(supabase, fetchOpts, includePhones);
    case 'transactions':
      return buildTransactions(supabase, fetchOpts, includePhones);
    case 'disputes':
      return buildDisputes(supabase, fetchOpts, includePhones);
    case 'appeals':
      return buildAppeals(supabase, fetchOpts, includePhones);
    case 'wallet-ledger':
      return buildWalletLedger(supabase, fetchOpts);
    case 'withdrawals':
      return buildWithdrawals(supabase, fetchOpts, includePhones);
    case 'refunds':
      return buildRefunds(supabase, fetchOpts, includePhones);
    case 'settlements':
      return buildSettlements(supabase, fetchOpts);
    case 'listings':
      return buildListings(supabase, fetchOpts);
    case 'seller-invitations':
      return buildSellerInvitations(supabase, fetchOpts, includePhones);
    case 'delivery-evidence':
      return buildDeliveryEvidence(supabase, fetchOpts);
    case 'ratings':
      return buildRatings(supabase, fetchOpts);
    case 'transaction-history':
      return buildTransactionHistory(supabase, fetchOpts);
    case 'audit-logs':
      return buildAuditLogs(supabase, fetchOpts);
    default:
      throw new Error('Unsupported report type');
  }
}

async function buildUsers(supabase, fetchOpts, includePhones) {
  const { rows } = await fetchTable(supabase, 'users', fetchOpts);
  const headers = [
    'user_id',
    'email',
    'full_name',
    'phone_number',
    'role',
    'kyc_status',
    'is_active',
    'account_balance_kes',
    'transactions_completed',
    'avg_rating',
    'email_verified_at',
    'created_at',
    'last_login',
  ];
  const mapped = rows.map((u) => ({
    user_id: u.id,
    email: u.email,
    full_name: u.full_name,
    phone_number: maskPhone(u.phone_number, includePhones),
    role: u.role,
    kyc_status: u.kyc_status,
    is_active: fmt(u.is_active),
    account_balance_kes: u.account_balance,
    transactions_completed: u.total_transactions_completed,
    avg_rating: u.avg_rating,
    email_verified_at: fmtDate(u.email_verified_at),
    created_at: fmtDate(u.created_at),
    last_login: fmtDate(u.last_login),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildTransactions(supabase, fetchOpts, includePhones) {
  let query = supabase
    .from('transactions')
    .select(
      `
      *,
      buyer:users!transactions_buyer_id_fkey(id, full_name, email, phone_number),
      seller:users!transactions_seller_id_fkey(id, full_name, email, phone_number)
    `
    )
    .order(fetchOpts.dateField, { ascending: false })
    .limit(fetchOpts.maxRows);
  query = applyDateRange(query, fetchOpts.dateField, fetchOpts.fromIso, fetchOpts.toIso);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'transaction_id',
    'status',
    'amount_kes',
    'currency',
    'description',
    'buyer_name',
    'buyer_email',
    'buyer_phone',
    'seller_name',
    'seller_email',
    'seller_phone',
    'mpesa_receipt',
    'mpesa_checkout_ref',
    'mpesa_phone',
    'payment_confirmed_at',
    'shipped_at',
    'delivery_confirmed_at',
    'is_disputed',
    'auto_release_date',
    'created_at',
    'completed_at',
  ];
  const mapped = (data || []).map((t) => ({
    transaction_id: t.id,
    status: t.status,
    amount_kes: t.amount,
    currency: t.currency,
    description: t.description,
    buyer_name: t.buyer?.full_name,
    buyer_email: t.buyer?.email,
    buyer_phone: maskPhone(t.buyer?.phone_number, includePhones),
    seller_name: t.seller?.full_name,
    seller_email: t.seller?.email,
    seller_phone: maskPhone(t.seller?.phone_number, includePhones),
    mpesa_receipt: t.mpesa_receipt_number,
    mpesa_checkout_ref: t.mpesa_ref,
    mpesa_phone: maskPhone(t.mpesa_phone, includePhones),
    payment_confirmed_at: fmtDate(t.payment_confirmed_at),
    shipped_at: fmtDate(t.shipped_at),
    delivery_confirmed_at: fmtDate(t.delivery_confirmed_at),
    is_disputed: fmt(t.is_disputed),
    auto_release_date: fmtDate(t.auto_release_date),
    created_at: fmtDate(t.created_at),
    completed_at: fmtDate(t.completed_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildDisputes(supabase, fetchOpts, includePhones) {
  let query = supabase
    .from('disputes')
    .select(
      `
      *,
      transaction:transactions(id, amount, status, description),
      raised_by_user:users!disputes_raised_by_fkey(full_name, email),
      raised_against_user:users!disputes_raised_against_fkey(full_name, email),
      resolver:users!disputes_resolved_by_fkey(full_name, email)
    `
    )
    .order('created_at', { ascending: false })
    .limit(fetchOpts.maxRows);
  query = applyDateRange(query, fetchOpts.dateField, fetchOpts.fromIso, fetchOpts.toIso);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'dispute_id',
    'transaction_id',
    'amount_kes',
    'status',
    'reason',
    'resolution',
    'dispute_queue',
    'submission_screening',
    'raised_by_name',
    'raised_by_email',
    'raised_against_name',
    'raised_against_email',
    'resolved_by',
    'admin_notes',
    'accused_responded_at',
    'response_due_at',
    'filed_at',
    'resolved_at',
  ];
  const mapped = (data || []).map((d) => ({
    dispute_id: d.id,
    transaction_id: d.transaction_id,
    amount_kes: d.transaction?.amount,
    status: d.status,
    reason: d.reason,
    resolution: d.resolution,
    dispute_queue: d.dispute_queue,
    submission_screening: d.submission_screening,
    raised_by_name: d.raised_by_user?.full_name,
    raised_by_email: d.raised_by_user?.email,
    raised_against_name: d.raised_against_user?.full_name,
    raised_against_email: d.raised_against_user?.email,
    resolved_by: d.resolver?.full_name || d.resolver?.email,
    admin_notes: d.admin_notes,
    accused_responded_at: fmtDate(d.accused_responded_at),
    response_due_at: fmtDate(d.response_due_at),
    filed_at: fmtDate(d.created_at),
    resolved_at: fmtDate(d.resolved_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildAppeals(supabase, fetchOpts, includePhones) {
  let query = supabase
    .from('dispute_appeals')
    .select(
      `
      *,
      dispute:disputes(id, reason, resolution),
      transaction:transactions(id, amount, status)
    `
    )
    .order('created_at', { ascending: false })
    .limit(fetchOpts.maxRows);
  query = applyDateRange(query, fetchOpts.dateField, fetchOpts.fromIso, fetchOpts.toIso);
  const { data, error } = await query;
  if (error) {
    if (/dispute_appeals/i.test(error.message || '')) {
      return emptyReport('appeals_not_migrated');
    }
    throw new Error(error.message);
  }

  const headers = [
    'appeal_id',
    'dispute_id',
    'transaction_id',
    'amount_kes',
    'appellant_role',
    'filer_name',
    'filer_email',
    'filer_phone',
    'grounds',
    'status',
    'original_resolution',
    'overturn_resolution',
    'reversal_mode',
    'admin_notes',
    'appeal_deadline_at',
    'decided_at',
    'filed_at',
  ];
  const filerIds = [...new Set((data || []).map((a) => a.filed_by).filter(Boolean))];
  let filerMap = {};
  if (filerIds.length > 0) {
    const { data: filers } = await supabase
      .from('users')
      .select('id, full_name, email, phone_number')
      .in('id', filerIds);
    filerMap = Object.fromEntries((filers || []).map((u) => [u.id, u]));
  }

  const mapped = (data || []).map((a) => {
    const filer = filerMap[a.filed_by];
    return {
    appeal_id: a.id,
    dispute_id: a.dispute_id,
    transaction_id: a.transaction_id,
    amount_kes: a.transaction?.amount,
    appellant_role: a.appellant_role,
    filer_name: filer?.full_name,
    filer_email: filer?.email,
    filer_phone: maskPhone(filer?.phone_number, includePhones),
    grounds: a.grounds,
    status: a.status,
    original_resolution: a.original_resolution,
    overturn_resolution: a.overturn_resolution,
    reversal_mode: a.reversal_mode,
    admin_notes: a.admin_notes,
    appeal_deadline_at: fmtDate(a.appeal_deadline_at),
    decided_at: fmtDate(a.decided_at),
    filed_at: fmtDate(a.created_at),
  };
  });
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildWalletLedger(supabase, fetchOpts) {
  const { rows, missing } = await fetchTable(supabase, 'wallet_ledger_entries', fetchOpts);
  if (missing) return emptyReport('wallet_ledger_not_migrated');

  const headers = [
    'entry_id',
    'user_id',
    'transaction_id',
    'entry_type',
    'amount_kes',
    'currency',
    'description',
    'withdrawal_request_id',
    'created_at',
  ];
  const mapped = rows.map((e) => ({
    entry_id: e.id,
    user_id: e.user_id,
    transaction_id: e.transaction_id,
    entry_type: e.entry_type,
    amount_kes: e.amount,
    currency: e.currency,
    description: e.description,
    withdrawal_request_id: e.withdrawal_request_id,
    created_at: fmtDate(e.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildWithdrawals(supabase, fetchOpts, includePhones) {
  const { rows, missing } = await fetchTable(supabase, 'withdrawal_requests', {
    ...fetchOpts,
    select: '*, seller:users!withdrawal_requests_seller_id_fkey(full_name, email)',
  });
  if (missing) return emptyReport('withdrawals_not_migrated');

  const headers = [
    'withdrawal_id',
    'seller_id',
    'seller_name',
    'seller_email',
    'amount_kes',
    'phone',
    'status',
    'simulated',
    'mpesa_transaction_id',
    'result_code',
    'result_desc',
    'created_at',
    'updated_at',
  ];
  const mapped = rows.map((w) => ({
    withdrawal_id: w.id,
    seller_id: w.seller_id,
    seller_name: w.seller?.full_name,
    seller_email: w.seller?.email,
    amount_kes: w.amount,
    phone: maskPhone(w.phone, includePhones),
    status: w.status,
    simulated: fmt(w.simulated),
    mpesa_transaction_id: w.mpesa_transaction_id,
    result_code: w.result_code,
    result_desc: w.result_desc,
    created_at: fmtDate(w.created_at),
    updated_at: fmtDate(w.updated_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildRefunds(supabase, fetchOpts, includePhones) {
  const { rows, missing } = await fetchTable(supabase, 'refund_requests', {
    ...fetchOpts,
    select: '*, buyer:users!refund_requests_buyer_id_fkey(full_name, email)',
  });
  if (missing) return emptyReport('refunds_not_migrated');

  const headers = [
    'refund_id',
    'dispute_id',
    'transaction_id',
    'buyer_id',
    'buyer_name',
    'buyer_email',
    'amount_kes',
    'phone',
    'status',
    'simulated',
    'mpesa_transaction_id',
    'result_desc',
    'created_at',
    'completed_at',
  ];
  const mapped = rows.map((r) => ({
    refund_id: r.id,
    dispute_id: r.dispute_id,
    transaction_id: r.transaction_id,
    buyer_id: r.buyer_id,
    buyer_name: r.buyer?.full_name,
    buyer_email: r.buyer?.email,
    amount_kes: r.amount,
    phone: maskPhone(r.phone, includePhones),
    status: r.status,
    simulated: fmt(r.simulated),
    mpesa_transaction_id: r.mpesa_transaction_id,
    result_desc: r.result_desc,
    created_at: fmtDate(r.created_at),
    completed_at: fmtDate(r.completed_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildSettlements(supabase, fetchOpts) {
  const { rows, missing } = await fetchTable(
    supabase,
    'transaction_release_settlements',
    { ...fetchOpts, dateField: 'settled_at' }
  );
  if (missing) return emptyReport('settlements_not_migrated');

  const headers = [
    'transaction_id',
    'seller_id',
    'buyer_id',
    'amount_kes',
    'settled_at',
  ];
  const mapped = rows.map((s) => ({
    transaction_id: s.transaction_id,
    seller_id: s.seller_id,
    buyer_id: s.buyer_id,
    amount_kes: s.amount,
    settled_at: fmtDate(s.settled_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildListings(supabase, fetchOpts) {
  let query = supabase
    .from('listings')
    .select('*, seller:users!listings_seller_id_fkey(full_name, email), category:categories(name)')
    .order('created_at', { ascending: false })
    .limit(fetchOpts.maxRows);
  query = applyDateRange(query, fetchOpts.dateField, fetchOpts.fromIso, fetchOpts.toIso);
  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const headers = [
    'listing_id',
    'title',
    'status',
    'price_kes',
    'currency',
    'category',
    'seller_name',
    'seller_email',
    'location',
    'condition',
    'view_count',
    'created_at',
    'sold_at',
  ];
  const mapped = (data || []).map((l) => ({
    listing_id: l.id,
    title: l.title,
    status: l.status,
    price_kes: l.price,
    currency: l.currency,
    category: l.category?.name,
    seller_name: l.seller?.full_name,
    seller_email: l.seller?.email,
    location: l.location,
    condition: l.condition,
    view_count: l.view_count,
    created_at: fmtDate(l.created_at),
    sold_at: fmtDate(l.sold_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildSellerInvitations(supabase, fetchOpts, includePhones) {
  const { rows, missing } = await fetchTable(supabase, 'seller_invitations', {
    ...fetchOpts,
    select: '*, inviter:users!seller_invitations_invited_by_user_id_fkey(full_name, email)',
  });
  if (missing) return emptyReport('invitations_not_migrated');

  const headers = [
    'invitation_id',
    'email',
    'status',
    'invited_by',
    'requested_amount_kes',
    'requested_currency',
    'expires_at',
    'accepted_at',
    'created_at',
  ];
  const mapped = rows.map((i) => ({
    invitation_id: i.id,
    email: i.email,
    status: i.status,
    invited_by: i.inviter?.full_name || i.inviter?.email,
    requested_amount_kes: i.requested_amount,
    requested_currency: i.requested_currency,
    expires_at: fmtDate(i.expires_at),
    accepted_at: fmtDate(i.accepted_at),
    created_at: fmtDate(i.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildDeliveryEvidence(supabase, fetchOpts) {
  const { rows, missing } = await fetchTable(supabase, 'delivery_evidence', fetchOpts);
  if (missing) return emptyReport('delivery_evidence_not_migrated');

  const headers = [
    'evidence_id',
    'transaction_id',
    'submitted_by',
    'submission_type',
    'tracking_number',
    'courier',
    'condition_rating',
    'item_matches_description',
    'photo_urls',
    'notes',
    'submitted_at',
  ];
  const mapped = rows.map((e) => ({
    evidence_id: e.id,
    transaction_id: e.transaction_id,
    submitted_by: e.submitted_by,
    submission_type: e.submission_type,
    tracking_number: e.tracking_number,
    courier: e.courier,
    condition_rating: e.condition_rating,
    item_matches_description: fmt(e.item_matches_description),
    photo_urls: Array.isArray(e.photos) ? e.photos.join(' | ') : '',
    notes: e.notes,
    submitted_at: fmtDate(e.submitted_at || e.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildRatings(supabase, fetchOpts) {
  const { rows } = await fetchTable(supabase, 'ratings', fetchOpts);
  const headers = [
    'rating_id',
    'transaction_id',
    'rater_id',
    'rated_user_id',
    'rating',
    'comment',
    'created_at',
  ];
  const mapped = rows.map((r) => ({
    rating_id: r.id,
    transaction_id: r.transaction_id,
    rater_id: r.rater_id,
    rated_user_id: r.rated_user_id,
    rating: r.rating,
    comment: r.comment,
    created_at: fmtDate(r.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildTransactionHistory(supabase, fetchOpts) {
  const { rows } = await fetchTable(supabase, 'transaction_history', fetchOpts);
  const headers = [
    'history_id',
    'transaction_id',
    'old_status',
    'new_status',
    'changed_by',
    'reason',
    'created_at',
  ];
  const mapped = rows.map((h) => ({
    history_id: h.id,
    transaction_id: h.transaction_id,
    old_status: h.old_status,
    new_status: h.new_status,
    changed_by: h.changed_by,
    reason: h.reason,
    created_at: fmtDate(h.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

async function buildAuditLogs(supabase, fetchOpts) {
  const { rows } = await fetchTable(supabase, 'audit_logs', fetchOpts);
  const headers = [
    'log_id',
    'user_id',
    'action',
    'resource_type',
    'resource_id',
    'details',
    'created_at',
  ];
  const mapped = rows.map((l) => ({
    log_id: l.id,
    user_id: l.user_id,
    action: l.action,
    resource_type: l.resource_type,
    resource_id: l.resource_id,
    details: fmt(l.details),
    created_at: fmtDate(l.created_at),
  }));
  return { headers, rows: mapped, rowCount: mapped.length };
}

function emptyReport(note) {
  return {
    headers: ['notice'],
    rows: [{ notice: `No data — ${note}. Run missing SQL migrations if applicable.` }],
    rowCount: 0,
  };
}

async function buildFinancialPack(supabase, fetchOpts, params) {
  const includePhones = params.includePhones !== false;
  const [
    transactions,
    wallet,
    withdrawals,
    refunds,
    settlements,
    disputes,
  ] = await Promise.all([
    buildTransactions(supabase, fetchOpts, includePhones),
    buildWalletLedger(supabase, fetchOpts),
    buildWithdrawals(supabase, fetchOpts, includePhones),
    buildRefunds(supabase, fetchOpts, includePhones),
    buildSettlements(supabase, fetchOpts),
    buildDisputes(supabase, fetchOpts, includePhones),
  ]);

  const txRows = transactions.rows;
  const sum = (arr, pred) =>
    arr.filter(pred).reduce((s, r) => s + (Number(r.amount_kes) || 0), 0);

  const gmvReleased = sum(txRows, (r) => r.status === 'released');
  const escrowFloat = sum(txRows, (r) => r.status === 'escrow');
  const paidIn = txRows.filter((r) => r.payment_confirmed_at).length;
  const disputedCount = disputes.rowCount;
  const withdrawnTotal = withdrawals.rows.reduce(
    (s, r) => s + (r.status === 'completed' ? Number(r.amount_kes) || 0 : 0),
    0
  );
  const refundedTotal = refunds.rows.reduce(
    (s, r) => s + (r.status === 'completed' ? Number(r.amount_kes) || 0 : 0),
    0
  );

  const summaryHeaders = ['metric', 'value'];
  const summaryRows = [
    { metric: 'Report generated (UTC)', value: new Date().toISOString() },
    { metric: 'Date range from', value: params.fromIso || 'all time' },
    { metric: 'Date range to', value: params.toIso || 'all time' },
    { metric: 'Transactions in export', value: String(transactions.rowCount) },
    { metric: 'Payments confirmed (count)', value: String(paidIn) },
    { metric: 'GMV released to sellers (KES)', value: String(gmvReleased) },
    { metric: 'Escrow float in period rows (KES)', value: String(escrowFloat) },
    { metric: 'Withdrawals completed (KES)', value: String(withdrawnTotal) },
    { metric: 'Refunds completed (KES)', value: String(refundedTotal) },
    { metric: 'Disputes in period', value: String(disputedCount) },
    { metric: 'Settlements recorded', value: String(settlements.rowCount) },
    { metric: 'Wallet ledger lines', value: String(wallet.rowCount) },
  ];

  const glossaryHeaders = ['term', 'definition'];
  const glossaryRows = [
    { term: 'escrow', definition: 'Buyer paid; funds held until delivery confirm or auto-release.' },
    { term: 'released', definition: 'Seller wallet credited; sale complete.' },
    { term: 'simulated', definition: 'Demo M-Pesa row — not a live Safaricom transfer.' },
  ];

  const sheets = [
    { name: 'Summary', headers: summaryHeaders, rows: summaryRows },
    { name: 'Glossary', headers: glossaryHeaders, rows: glossaryRows },
    { name: 'Transactions', headers: transactions.headers, rows: transactions.rows },
    { name: 'Wallet ledger', headers: wallet.headers, rows: wallet.rows },
    { name: 'Withdrawals', headers: withdrawals.headers, rows: withdrawals.rows },
    { name: 'Refunds', headers: refunds.headers, rows: refunds.rows },
    { name: 'Settlements', headers: settlements.headers, rows: settlements.rows },
    { name: 'Disputes', headers: disputes.headers, rows: disputes.rows },
  ];

  const rowCount = sheets.reduce((n, s) => n + s.rows.length, 0);
  return { sheets, rowCount, headers: summaryHeaders, rows: summaryRows };
}
