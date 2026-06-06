/**
 * Dropdown positioning + modal compatibility.
 *
 * Two strategies:
 *  - in-flow (parent === null): the dropdown stays inside the wrap and is laid
 *    out by CSS; we only toggle a flip-up class when there's no room below.
 *  - portaled (parent !== null): the dropdown is moved into `parent` and placed
 *    with inline coords. Portaling into a modal/dialog ancestor is what makes
 *    Select3 work inside Bootstrap 4/5/6 and Alpine (`x-trap`) modals: the
 *    modal's focus trap treats the search input as "inside" the modal, and the
 *    dropdown escapes any `overflow:hidden` clipping.
 */

import type { AppendTo } from '../types';

const MODAL_SELECTOR = '.modal, [role="dialog"], [x-trap], .fixed[x-data]';

/** Resolve where the dropdown should live. null => keep it in-flow in the wrap. */
export function resolveDropdownParent(control: HTMLElement, appendTo: AppendTo): HTMLElement | null {
    if (appendTo instanceof HTMLElement) return appendTo;
    if (appendTo === 'self') return null;
    if (appendTo === 'body') return document.body;
    // 'auto': portal into a modal/dialog ancestor if present, else stay in-flow.
    return control.closest<HTMLElement>(MODAL_SELECTOR);
}

/** Open upward when there isn't room below but there is above. */
export function computeFlip(
    rect: { top: number; bottom: number },
    dropdownHeight: number,
    viewportHeight: number,
): boolean {
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    return spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
}

/** Place a portaled dropdown with inline coordinates relative to `parent`. */
export function placeDropdown(
    control: HTMLElement,
    dropdown: HTMLElement,
    parent: HTMLElement,
    gap: number,
    z: number,
): void {
    const cr = control.getBoundingClientRect();
    const flipUp = computeFlip(cr, dropdown.offsetHeight || 0, window.innerHeight);
    const s = dropdown.style;
    s.zIndex = String(z);
    s.right = 'auto';
    s.width = `${cr.width}px`;

    if (parent === document.body) {
        s.position = 'fixed';
        s.left = `${cr.left}px`;
        if (flipUp) {
            s.top = 'auto';
            s.bottom = `${window.innerHeight - cr.top + gap}px`;
        } else {
            s.bottom = 'auto';
            s.top = `${cr.bottom + gap}px`;
        }
    } else {
        const pr = parent.getBoundingClientRect();
        s.position = 'absolute';
        s.left = `${cr.left - pr.left + parent.scrollLeft}px`;
        if (flipUp) {
            s.top = 'auto';
            s.bottom = `${pr.height - (cr.top - pr.top) + gap}px`;
        } else {
            s.bottom = 'auto';
            s.top = `${cr.bottom - pr.top + parent.scrollTop + gap}px`;
        }
    }
}

/** Clear inline coords applied by placeDropdown so CSS takes over again. */
export function resetDropdown(dropdown: HTMLElement): void {
    const s = dropdown.style;
    s.position = '';
    s.top = '';
    s.bottom = '';
    s.left = '';
    s.right = '';
    s.width = '';
    s.zIndex = '';
    s.display = '';
}
