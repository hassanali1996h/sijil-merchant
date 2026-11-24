import { toAsciiDigits } from './phone';

export function formatIqd(amount: number | bigint | string, locale: 'ar-IQ' | 'ckb-IQ' = 'ar-IQ') {
  let integer: number | bigint;
  if (typeof amount === 'bigint') {
    integer = amount;
  } else if (typeof amount === 'string' && /^-?\d+$/.test(amount)) {
    integer = BigInt(amount);
  } else if (typeof amount === 'number' && Number.isSafeInteger(amount)) {
    integer = amount;
  } else {
    throw new Error('IQD amount must be a whole number');
  }
  const grouped = integer.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const localized = locale === 'ar-IQ' || locale === 'ckb-IQ' ? grouped.replace(/\d/g, d => String.fromCharCode(0x660 + Number(d))).replace(/,/g, '\u066c') : grouped;
  return localized + ' د.ع';
}

export function parsePositiveIqd(raw: string): number {
  const value = parseNonNegativeIqd(raw);
  if (value <= 0) throw new Error('Amount must be a positive whole number');
  return value;
}

export function parseNonNegativeIqd(raw: string): number {
  const normalized = toAsciiDigits(raw).replace(/[٬,\s]/g, '');
  if (!/^\d+$/.test(normalized)) throw new Error('Enter a whole IQD amount');
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('Amount must be a non-negative whole number');
  return value;
}
