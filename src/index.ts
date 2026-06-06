/**
 * @ozankurt/select3 — dependency-free <select> enhancer.
 * See docs/specs/2026-06-06-select3-full-feature-set-design.md for the roadmap.
 */
import createSelect3, { Select3 } from './core/Select3';
import type { Select3Options, Select3Config, Item } from './types';

export const VERSION = '0.2.0';
export { Select3, createSelect3 };
export type { Select3Options, Select3Config, Item };
export default createSelect3;
