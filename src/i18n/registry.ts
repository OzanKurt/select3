import { en } from './en';
import type { Locale } from './types';
import type { Select3Options } from '../types';

let globalLocale: Locale = { ...en };

/** Set the global default locale (merged over the current default). */
export function setLocale(locale: Partial<Locale>): void {
    globalLocale = { ...globalLocale, ...locale };
}

export function getLocale(): Locale {
    return globalLocale;
}

/** Resolve the effective locale for an instance: global, then per-instance. */
export function resolveLocale(options: Select3Options): Locale {
    return { ...globalLocale, ...(options.i18n ?? options.locale ?? {}) };
}
