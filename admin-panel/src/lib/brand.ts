export const BRAND_NAME = 'Supbort.io';
export const BRAND_WORD = 'Supbort';
export const BRAND_TLD = '.io';

export const pageTitle = (...parts: Array<string | null | undefined | false>): string =>
  [...parts.filter((part): part is string => Boolean(part)), BRAND_NAME].join(' — ');
