import { formatLocaleNumber } from './locale-number-format.mjs';

export const SUGGESTED_SIZING_INCREMENT_BB = 0.5;

function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function compactDecimal(value, maximumFractionDigits = 3, language) {
  return formatLocaleNumber(value, {
    maximumFractionDigits,
    minimumFractionDigits: 0,
    useGrouping: false,
  }, language);
}

export function roundSuggestedSizingBb(value, incrementBb = SUGGESTED_SIZING_INCREMENT_BB) {
  const numeric = finiteNumber(value);
  const increment = finiteNumber(incrementBb);
  if (numeric === null || increment === null || increment <= 0) return null;
  return Number((Math.round(numeric / increment) * increment).toFixed(6));
}

export function formatSuggestedSizingBb(value, { spaced = true, language } = {}) {
  const rounded = roundSuggestedSizingBb(value);
  if (rounded === null) return null;
  return `${compactDecimal(rounded, 1, language)}${spaced ? ' ' : ''}bb`;
}

export function formatExactPokerAmountBb(value, { spaced = false, language } = {}) {
  const numeric = finiteNumber(value);
  if (numeric === null) return null;
  // Exact/canonical values are display-only here: never quantize them through
  // the human suggested-sizing increment or a decimal precision cap.
  const fractionDigits = String(Math.abs(numeric)).split('.')[1]?.length ?? 0;
  return `${compactDecimal(numeric, Math.max(fractionDigits, 6), language)}${spaced ? ' ' : ''}bb`;
}
