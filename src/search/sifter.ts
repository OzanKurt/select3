/**
 * Relevance scoring for client-side search. Higher scores rank first:
 *   exact (100) > prefix (≈80) > token-prefix (60) > substring (≈40) > none (0).
 * Multi-field search takes the best score across the configured fields.
 */

import { fold } from './diacritics';
import type { Item } from '../types';

/** Score a single haystack against an already-folded query. */
export function scoreText(haystack: string, foldedQuery: string): number {
    if (!foldedQuery) return 1;
    const h = fold(haystack);
    if (!h) return 0;
    if (h === foldedQuery) return 100;
    if (h.startsWith(foldedQuery)) return 80 - (h.length - foldedQuery.length) * 0.01;
    if (h.split(/\s+/).some((token) => token.startsWith(foldedQuery))) return 60;
    const idx = h.indexOf(foldedQuery);
    if (idx === -1) return 0;
    return 40 - idx * 0.1;
}

function haystackFor(item: Item, field: string): string {
    if (field === 'label') return item.label;
    return item.data?.[field] ?? '';
}

/** Best score for an item across the search fields. Empty query => 1 (all match). */
export function scoreItem(item: Item, query: string, fields: string[]): number {
    const q = fold(query.trim());
    if (!q) return 1;
    let best = 0;
    for (const field of fields) {
        const s = scoreText(haystackFor(item, field), q);
        if (s > best) best = s;
    }
    return best;
}
