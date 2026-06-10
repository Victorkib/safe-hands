/** @typedef {'financial'|'users'|'disputes'|'operations'|'audit'} ReportCategory */

/**
 * @type {Array<{
 *   id: string;
 *   title: string;
 *   description: string;
 *   category: ReportCategory;
 *   formats: ('csv'|'xlsx')[];
 *   icon: string;
 *   accent: string;
 *   dateField?: string;
 *   featured?: boolean;
 * }>}
 */
export const REPORT_CATALOG = [
  {
    id: 'financial-pack',
    title: 'Monthly financial pack',
    description:
      'One Excel workbook: summary KPIs, transactions, wallet ledger, withdrawals, refunds, and settlements.',
    category: 'financial',
    formats: ['xlsx'],
    icon: '📊',
    accent: 'amber',
    featured: true,
  },
  {
    id: 'transactions',
    title: 'Transaction ledger',
    description: 'All escrow deals with buyer/seller, amounts, M-Pesa refs, and status timeline.',
    category: 'financial',
    formats: ['csv', 'xlsx'],
    icon: '💳',
    accent: 'emerald',
    dateField: 'created_at',
  },
  {
    id: 'wallet-ledger',
    title: 'Wallet ledger',
    description: 'Seller wallet credits and debits tied to releases and withdrawals.',
    category: 'financial',
    formats: ['csv', 'xlsx'],
    icon: '👛',
    accent: 'teal',
    dateField: 'created_at',
  },
  {
    id: 'withdrawals',
    title: 'Withdrawals',
    description: 'Seller M-Pesa payout requests with status and receipt IDs.',
    category: 'financial',
    formats: ['csv', 'xlsx'],
    icon: '📤',
    accent: 'cyan',
    dateField: 'created_at',
  },
  {
    id: 'refunds',
    title: 'Refunds',
    description: 'Buyer refund rows after dispute resolution (demo vs live flagged).',
    category: 'financial',
    formats: ['csv', 'xlsx'],
    icon: '↩️',
    accent: 'orange',
    dateField: 'created_at',
  },
  {
    id: 'settlements',
    title: 'Release settlements',
    description: 'Idempotent settlement marker when escrow funds credit seller wallet.',
    category: 'financial',
    formats: ['csv', 'xlsx'],
    icon: '✅',
    accent: 'green',
    dateField: 'settled_at',
  },
  {
    id: 'users',
    title: 'Users register',
    description: 'Accounts, roles, KYC, wallet balance, and activity counters.',
    category: 'users',
    formats: ['csv', 'xlsx'],
    icon: '👥',
    accent: 'blue',
    dateField: 'created_at',
  },
  {
    id: 'disputes',
    title: 'Disputes register',
    description: 'Full dispute cases with parties, routing queue, resolution, and admin notes.',
    category: 'disputes',
    formats: ['csv', 'xlsx'],
    icon: '⚖️',
    accent: 'rose',
    dateField: 'created_at',
  },
  {
    id: 'appeals',
    title: 'Post-verdict appeals',
    description: 'Second-look requests, grounds, outcomes, and overturn resolutions.',
    category: 'disputes',
    formats: ['csv', 'xlsx'],
    icon: '🔁',
    accent: 'violet',
    dateField: 'created_at',
  },
  {
    id: 'listings',
    title: 'Marketplace listings',
    description: 'Active and sold listings with seller contact and pricing.',
    category: 'operations',
    formats: ['csv', 'xlsx'],
    icon: '📦',
    accent: 'purple',
    dateField: 'created_at',
  },
  {
    id: 'seller-invitations',
    title: 'Seller invitations',
    description: 'Off-platform seller invites and acceptance status.',
    category: 'operations',
    formats: ['csv', 'xlsx'],
    icon: '✉️',
    accent: 'indigo',
    dateField: 'created_at',
  },
  {
    id: 'delivery-evidence',
    title: 'Delivery evidence',
    description: 'Shipping and delivery proof uploads linked to transactions.',
    category: 'operations',
    formats: ['csv', 'xlsx'],
    icon: '📷',
    accent: 'sky',
    dateField: 'created_at',
  },
  {
    id: 'ratings',
    title: 'Ratings & reviews',
    description: 'Transaction ratings between buyers and sellers.',
    category: 'operations',
    formats: ['csv', 'xlsx'],
    icon: '⭐',
    accent: 'yellow',
    dateField: 'created_at',
  },
  {
    id: 'transaction-history',
    title: 'Transaction audit trail',
    description: 'Every status change with actor and reason (compliance).',
    category: 'audit',
    formats: ['csv', 'xlsx'],
    icon: '📜',
    accent: 'slate',
    dateField: 'created_at',
  },
  {
    id: 'audit-logs',
    title: 'Platform audit logs',
    description: 'System and admin actions recorded in audit_logs.',
    category: 'audit',
    formats: ['csv', 'xlsx'],
    icon: '🔐',
    accent: 'gray',
    dateField: 'created_at',
  },
];

export const REPORT_CATEGORIES = [
  { id: 'financial', label: 'Financial & escrow', description: 'Money in, held, released, and paid out' },
  { id: 'users', label: 'Users & compliance', description: 'Accounts and KYC posture' },
  { id: 'disputes', label: 'Disputes & appeals', description: 'Cases, verdicts, and reviews' },
  { id: 'operations', label: 'Operations', description: 'Marketplace and logistics evidence' },
  { id: 'audit', label: 'Audit & trust', description: 'Immutable trails for oversight' },
];

export function getReportMeta(type) {
  return REPORT_CATALOG.find((r) => r.id === type) || null;
}

export const VALID_REPORT_TYPES = new Set(REPORT_CATALOG.map((r) => r.id));
