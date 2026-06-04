/**
 * @ozankurt/select3 — entry point (skeleton).
 *
 * The full, dependency-free select component (virtual scroll, AJAX, tagging,
 * WAI-ARIA combobox, Select-All/OK-Cancel UX, plugins) is built in its own
 * workstream per ../../select3-plan.md. The host app consumes select3 behind
 * the Blade <x-form.select> component, so this API stays stable while internals
 * grow.
 *
 * This skeleton exists so the package link + build integration can be wired and
 * verified before real features land.
 */

export const VERSION = '0.0.0';

/**
 * Enhance a native <select> element.
 *
 * Skeleton behaviour: marks the element as claimed so the integration seam is
 * observable in tests/DOM. Replaced by the real implementation in the select3
 * track.
 *
 * @param {HTMLSelectElement} el - the native select to enhance
 * @param {object} [options] - reserved for the full API (see select3-plan.md)
 * @returns {{ destroy(): void }}
 */
export function createSelect3(el, options = {}) {
    if (!(el instanceof HTMLSelectElement)) {
        throw new TypeError('createSelect3 expects a <select> element');
    }
    el.dataset.select3 = 'pending';
    return {
        destroy() {
            delete el.dataset.select3;
        },
    };
}

export default createSelect3;
