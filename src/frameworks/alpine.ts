/**
 * Select3 Alpine.js adapter: an `x-select3` directive.
 *
 * Registered as an Alpine plugin, this turns any native `<select>` carrying
 * `x-select3` into an enhanced Select3 instance. The attribute value, when
 * present, is evaluated in the element's Alpine scope as the options bag
 * (e.g. `x-select3="{ placeholder: 'Pick one', tags: true }"`).
 *
 * When the same element also has `x-model`, the two stay in sync both ways:
 * Select3's `change` event writes the new value back into the bound Alpine
 * property, and reactive changes to that property are mirrored into the
 * instance via `setValue`. Alpine is a *peer* dependency, imported for types
 * only, never bundled.
 *
 * @example
 * ```js
 * import Alpine from 'alpinejs';
 * import select3Plugin from '@ozankurt/select3/alpine';
 * import '@ozankurt/select3/css';
 *
 * Alpine.plugin(select3Plugin);
 * Alpine.start();
 * ```
 *
 * @example Markup
 * ```html
 * <div x-data="{ country: 'au' }">
 *   <select x-model="country" x-select3="{ placeholder: 'Pick a country' }">
 *     <option value="au">Australia</option>
 *     <option value="nz">New Zealand</option>
 *   </select>
 * </div>
 * ```
 */

import createSelect3 from '../core/Select3';
import type { Select3 } from '../core/Select3';
import type { Select3Options } from '../types';

/**
 * The minimal slice of Alpine's API this adapter uses, declared locally so the
 * package builds without Alpine's (unbundled) type declarations. Alpine stays a
 * runtime peer dependency.
 */
interface AlpineDirectiveUtils {
    evaluate: (expression: string) => unknown;
    effect: (fn: () => void) => void;
    cleanup: (fn: () => void) => void;
}
interface AlpineLike {
    directive(
        name: string,
        callback: (el: Element, directive: { expression: string }, utils: AlpineDirectiveUtils) => void,
    ): void;
}

/**
 * Alpine surfaces an element's `x-model` binding at runtime as `_x_model`,
 * exposing a get/set pair over the bound property. It is not part of Alpine's
 * published types, so we describe just the slice we use here.
 */
interface XModelBinding {
    get(): unknown;
    set(value: unknown): void;
}

/** A `<select>` enhanced by Alpine, optionally carrying an `x-model` binding. */
type ModeledSelect = HTMLSelectElement & { _x_model?: XModelBinding };

/** Are two Select3 values equal? Order-insensitive for the multi-select array. */
const sameValue = (a: string | string[], b: string | string[]): boolean => {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        const set = new Set(a);
        return b.every((v) => set.has(v));
    }
    if (Array.isArray(a) || Array.isArray(b)) return false;
    return a === b;
};

/**
 * Coerce a value read from the `x-model` property into the shape Select3's
 * {@link Select3.setValue} expects (a string, or an array of strings).
 */
const toSelectValue = (raw: unknown): string | string[] => {
    if (Array.isArray(raw)) return raw.map((v) => String(v));
    if (raw == null) return '';
    return String(raw);
};

/**
 * Alpine plugin that registers the `x-select3` directive. Pass it to
 * `Alpine.plugin(...)` before `Alpine.start()`.
 */
export const select3Plugin = (Alpine: AlpineLike): void => {
    Alpine.directive(
        'select3',
        (el, { expression }, { evaluate, effect, cleanup }) => {
            // The directive is only meaningful on a native <select>; ignore any
            // other element rather than throwing inside Alpine's init walk.
            if (!(el instanceof HTMLSelectElement)) return;

            // The attribute value, when present, is the options bag evaluated in
            // the element's Alpine scope. An empty `x-select3` uses the defaults.
            const options: Select3Options =
                expression.trim() === ''
                    ? {}
                    : ((evaluate(expression) as Select3Options | undefined) ?? {});

            const instance = createSelect3(el, options);
            const model = (el as ModeledSelect)._x_model;

            if (model) {
                // Tracks the value last seen on either side so we never echo a
                // change straight back across the boundary (which would loop).
                let lastValue: string | string[] = instance.getValue();

                // Alpine -> Select3: mirror the bound property into the instance
                // whenever it changes. `effect` re-runs on every dependency read.
                effect(() => {
                    const next = toSelectValue(model.get());
                    if (sameValue(next, lastValue)) return;
                    lastValue = next;
                    instance.setValue(next);
                });

                // Select3 -> Alpine: push committed edits back into the property.
                const off = instance.on('change', (detail) => {
                    const next = (detail as { value: string | string[] }).value;
                    if (sameValue(next, lastValue)) return;
                    lastValue = next;
                    model.set(next);
                });
                cleanup(off);
            }

            cleanup(() => instance.destroy());
        },
    );
};

export default select3Plugin;
