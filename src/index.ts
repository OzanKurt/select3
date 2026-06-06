/**
 * @ozankurt/select3 — dependency-free <select> enhancer.
 * See docs/specs/2026-06-06-select3-full-feature-set-design.md for the roadmap.
 */
import createSelect3, { Select3 } from './core/Select3';
import { Emitter } from './core/emitter';
import type { Handler } from './core/emitter';
import { setLocale, getLocale } from './i18n/registry';
import { registerPlugin } from './plugins/registry';
import type { Locale } from './i18n/types';
import type {
    Select3Options,
    Select3Config,
    Item,
    AddOptionInput,
    ClassNames,
    Select3Templates,
    RenderContext,
    PluginFactory,
    Select3Plugin,
} from './types';

export const VERSION = '0.2.0';
export { Select3, createSelect3, Emitter, setLocale, getLocale, registerPlugin };
export type {
    Select3Options,
    Select3Config,
    Item,
    AddOptionInput,
    Handler,
    Locale,
    ClassNames,
    Select3Templates,
    RenderContext,
    PluginFactory,
    Select3Plugin,
};
export default createSelect3;
