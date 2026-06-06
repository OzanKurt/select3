import type { Locale } from './types';

/** Default English locale; the base every other pack overrides. */
export const en: Locale = {
    placeholder: 'Select…',
    noResults: 'No results',
    loadingText: 'Searching…',
    loadingMoreText: 'Loading more…',
    createText: (q) => `Create “${q}”`,
    moreText: (n) => `${n} more, refine your search`,
    maxReachedText: (max) => `Limit of ${max} reached`,
    selectAllText: 'Select all',
    clearAllText: 'Clear all',
    okText: 'OK',
    cancelText: 'Cancel',
    captionFormat: (n) => `${n} selected`,
    captionFormatAllSelected: (n) => `All ${n} selected`,
};

export default en;
