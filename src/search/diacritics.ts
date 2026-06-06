/** Lower-case + strip diacritics so search is accent-insensitive. */
export const fold = (s: string): string =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');
