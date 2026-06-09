import { normalizePhone, validatePhone } from '@/lib/validation';

/**
 * Validate and normalize a Kenyan M-Pesa phone for STK / B2C.
 * @param {string} raw
 * @returns {{ ok: true; phone: string } | { ok: false; error: string }}
 */
export function resolveMpesaPhone(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {
    return { ok: false, error: 'M-Pesa phone number is required' };
  }
  if (!validatePhone(trimmed)) {
    return {
      ok: false,
      error: 'Enter a valid Kenyan number (e.g. 07XXXXXXXX or 2547XXXXXXXX)',
    };
  }
  return { ok: true, phone: normalizePhone(trimmed) };
}

/** @param {string} phone 254XXXXXXXXX */
export function formatMpesaPhoneDisplay(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.startsWith('254') && p.length >= 12) {
    return `+${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}`;
  }
  return phone || '';
}
