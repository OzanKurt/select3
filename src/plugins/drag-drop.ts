/**
 * drag-drop — reorder selected tags in a multi-select by dragging.
 *
 * In a multi-select, Select3 renders each selected value as a `.s3__tag` inside
 * `instance.display`. This plugin lets the user drag those tags to a new order;
 * on drop it physically reorders the matching selected `<option>` nodes inside
 * `instance.select` (via insertBefore, leaving non-selected options where they
 * are), then calls `instance.sync()` and dispatches a native `change` so the
 * form value and any listeners reflect the new order.
 *
 * Two input paths share one reorder core:
 *   - HTML5 drag-and-drop (dragstart/dragover/drop), and
 *   - pointer dragging (pointerdown/pointermove/pointerup) as a fallback for
 *     environments that don't synthesize a full HTML5 DnD sequence.
 *
 * Everything is wired with event delegation on `instance.display` (which the
 * core rebuilds via replaceChildren() on every sync), so the bindings survive
 * tag re-renders with no MutationObserver. Tags are made draggable lazily on
 * the first pointerdown/mousedown so the `draggable` attribute is present in
 * time for the browser's native dragstart, again without observing mutations.
 *
 * Single-select instances have no tags to reorder, so the plugin is a no-op
 * there and registers no listeners.
 */

import type { Select3 } from '../core/Select3';
import type { PluginFactory } from '../types';
import { registerPlugin } from './registry';

const TAG_SELECTOR = '.s3__tag';
const DRAGGING_CLASS = 's3__tag--dragging';

/** The value a tag represents, read off its `.s3__tag-remove[data-value]` child. */
const tagValue = (tag: Element): string | null => {
    const remove = tag.querySelector<HTMLElement>('.s3__tag-remove');
    return remove?.dataset.value ?? null;
};

/** The `.s3__tag` ancestor of an event target, scoped to the display container. */
const tagFrom = (display: HTMLElement, target: EventTarget | null): HTMLElement | null => {
    const node = target instanceof Element ? target : null;
    const tag = node?.closest<HTMLElement>(TAG_SELECTOR);
    return tag && display.contains(tag) ? tag : null;
};

export const dragDrop: PluginFactory = (instance: Select3) => {
    // Reordering only makes sense when multiple values can be selected.
    if (!instance.multiple) return;

    const display = instance.display;
    let draggingValue: string | null = null;

    /** Mark the tag for `value` (if currently rendered) with the dragging class. */
    const markDragging = (value: string | null): void => {
        for (const tag of display.querySelectorAll<HTMLElement>(TAG_SELECTOR)) {
            tag.classList.toggle(DRAGGING_CLASS, value != null && tagValue(tag) === value);
        }
    };

    const clearDragging = (): void => {
        for (const tag of display.querySelectorAll<HTMLElement>(TAG_SELECTOR)) {
            tag.classList.remove(DRAGGING_CLASS);
        }
    };

    /**
     * Reorder the selected <option> nodes so the dragged value lands at the
     * position of the target value, then sync + emit a native change.
     *
     * Only selected options move; the dragged option is re-inserted immediately
     * before (dragging up/onto) the target's option, preserving the relative
     * order of every other node. A no-op move (same value, or already adjacent
     * in the resulting order) leaves the DOM untouched and emits nothing.
     */
    const reorder = (fromValue: string, toValue: string): void => {
        if (fromValue === toValue) return;

        const options = [...instance.select.options];
        const from = options.find((o) => o.value === fromValue);
        const to = options.find((o) => o.value === toValue);
        if (!from || !to || !from.selected || !to.selected) return;

        // Snapshot the current selected order to detect a real change afterwards.
        const before = options.filter((o) => o.selected).map((o) => o.value);

        const fromIdx = options.indexOf(from);
        const toIdx = options.indexOf(to);

        // Dragging a tag onto one to its right should drop it *after* that
        // target; onto one to its left, *before* it. insertBefore handles both:
        // for a rightward move we anchor before the target's next sibling.
        const parent = from.parentElement ?? instance.select;
        if (fromIdx < toIdx) {
            parent.insertBefore(from, to.nextSibling);
        } else {
            parent.insertBefore(from, to);
        }

        const after = [...instance.select.options].filter((o) => o.selected).map((o) => o.value);
        const changed = before.length !== after.length || before.some((v, i) => v !== after[i]);
        if (!changed) return;

        instance.sync();
        instance.select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // ----- HTML5 drag-and-drop (delegated on the display container) ----------

    // Make a tag draggable just-in-time. Setting the attribute on pointer/mouse
    // down happens before the browser starts its native dragstart, so native DnD
    // works without per-tag setup or a MutationObserver watching re-renders.
    const onPointerDownArm = (e: Event): void => {
        const tag = tagFrom(display, e.target);
        if (tag) tag.setAttribute('draggable', 'true');
    };

    const onDragStart = (e: DragEvent): void => {
        const tag = tagFrom(display, e.target);
        const value = tag && tagValue(tag);
        if (!value) return;
        draggingValue = value;
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            // Some browsers require data to be set for a drag to proceed.
            try {
                e.dataTransfer.setData('text/plain', value);
            } catch {
                /* setData can throw in restricted contexts; the drag still works. */
            }
        }
        markDragging(value);
    };

    const onDragOver = (e: DragEvent): void => {
        if (draggingValue == null) return;
        const overTag = tagFrom(display, e.target);
        if (!overTag) return;
        // Allow dropping here.
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };

    const onDrop = (e: DragEvent): void => {
        if (draggingValue == null) return;
        const overTag = tagFrom(display, e.target);
        const toValue = overTag && tagValue(overTag);
        e.preventDefault();
        if (toValue) reorder(draggingValue, toValue);
        draggingValue = null;
        clearDragging();
    };

    const onDragEnd = (): void => {
        draggingValue = null;
        clearDragging();
    };

    // ----- Pointer fallback (delegated on the display container) -------------

    let pointerActive = false;

    const onPointerMove = (e: PointerEvent): void => {
        if (!pointerActive || draggingValue == null) return;
        const overEl = document.elementFromPoint(e.clientX, e.clientY);
        const overTag = tagFrom(display, overEl);
        const toValue = overTag && tagValue(overTag);
        if (toValue && toValue !== draggingValue) {
            reorder(draggingValue, toValue);
            // After the reorder + re-render, keep tracking the same value.
            markDragging(draggingValue);
        }
    };

    const endPointer = (): void => {
        if (!pointerActive) return;
        pointerActive = false;
        draggingValue = null;
        clearDragging();
        document.removeEventListener('pointermove', onPointerMove);
        document.removeEventListener('pointerup', endPointer);
        document.removeEventListener('pointercancel', endPointer);
    };

    const onPointerDown = (e: PointerEvent): void => {
        // Don't hijack the remove button or non-primary buttons.
        if (e.button !== 0) return;
        const target = e.target instanceof Element ? e.target : null;
        if (target?.closest('.s3__tag-remove')) return;
        const tag = tagFrom(display, e.target);
        const value = tag && tagValue(tag);
        if (!value) return;
        pointerActive = true;
        draggingValue = value;
        markDragging(value);
        document.addEventListener('pointermove', onPointerMove);
        document.addEventListener('pointerup', endPointer);
        document.addEventListener('pointercancel', endPointer);
    };

    display.addEventListener('mousedown', onPointerDownArm);
    display.addEventListener('pointerdown', onPointerDownArm);
    display.addEventListener('dragstart', onDragStart);
    display.addEventListener('dragover', onDragOver);
    display.addEventListener('drop', onDrop);
    display.addEventListener('dragend', onDragEnd);
    display.addEventListener('pointerdown', onPointerDown);

    return {
        destroy() {
            display.removeEventListener('mousedown', onPointerDownArm);
            display.removeEventListener('pointerdown', onPointerDownArm);
            display.removeEventListener('dragstart', onDragStart);
            display.removeEventListener('dragover', onDragOver);
            display.removeEventListener('drop', onDrop);
            display.removeEventListener('dragend', onDragEnd);
            display.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', endPointer);
            document.removeEventListener('pointercancel', endPointer);
            clearDragging();
            // Drop the lazily-added draggable attribute we may have set.
            for (const tag of display.querySelectorAll<HTMLElement>(TAG_SELECTOR)) {
                tag.removeAttribute('draggable');
            }
        },
    };
};

registerPlugin('drag-drop', dragDrop);

export default dragDrop;
