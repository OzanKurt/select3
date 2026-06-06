import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSelect3 } from '../src';
import { dragDrop } from '../src/plugins/drag-drop';

/**
 * Mount a multi-select with three preselected options. Returns the native
 * <select>, the instance (with the drag-drop plugin), and a helper for the
 * current option value order.
 */
function mountMulti(preselected = ['a', 'b', 'c']) {
    const select = document.createElement('select');
    select.multiple = true;
    ['a', 'b', 'c'].forEach((v) => {
        const o = new Option(v.toUpperCase(), v, false, preselected.includes(v));
        select.add(o);
    });
    document.body.appendChild(select);
    const instance = createSelect3(select, { plugins: [dragDrop] });
    return { select, instance };
}

/** Option values in DOM order. */
const optionOrder = (select: HTMLSelectElement) => [...select.options].map((o) => o.value);

/** The rendered tag whose value matches `value`, from instance.display. */
function tagFor(display: HTMLElement, value: string): HTMLElement {
    const tags = [...display.querySelectorAll<HTMLElement>('.s3__tag')];
    const tag = tags.find(
        (t) => t.querySelector<HTMLElement>('.s3__tag-remove')?.dataset.value === value,
    );
    if (!tag) throw new Error(`no tag for value ${value}`);
    return tag;
}

/**
 * Dispatch one HTML5 drag-family event on `node` with a minimal dataTransfer
 * stub (jsdom has no DragEvent / DataTransfer). Returns the event so callers
 * can inspect defaultPrevented.
 */
function fireDrag(node: Element, type: string, dataTransfer?: unknown): Event {
    const e = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(e, 'dataTransfer', { value: dataTransfer ?? null, configurable: true });
    node.dispatchEvent(e);
    return e;
}

/** A throwaway DataTransfer-like object good enough for setData/effect flags. */
const makeDataTransfer = () => ({
    effectAllowed: '',
    dropEffect: '',
    setData: () => {},
    getData: () => '',
});

describe('drag-drop plugin', () => {
    beforeEach(() => document.body.replaceChildren());

    it('reorders selected <option> nodes and getValue() on drop (drag a tag right)', () => {
        const { select, instance } = mountMulti();
        expect(optionOrder(select)).toEqual(['a', 'b', 'c']);
        expect(instance.getValue()).toEqual(['a', 'b', 'c']);

        const display = instance.display;
        // Drag tag "a" onto tag "c" -> a moves to after c.
        const dt = makeDataTransfer();
        fireDrag(tagFor(display, 'a'), 'dragstart', dt);
        fireDrag(tagFor(display, 'c'), 'dragover', dt);
        fireDrag(tagFor(display, 'c'), 'drop', dt);

        expect(optionOrder(select)).toEqual(['b', 'c', 'a']);
        expect(instance.getValue()).toEqual(['b', 'c', 'a']);
    });

    it('reorders when dragging a tag left (onto an earlier tag)', () => {
        const { select, instance } = mountMulti();
        const display = instance.display;
        const dt = makeDataTransfer();
        // Drag tag "c" onto tag "a" -> c inserts before a.
        fireDrag(tagFor(display, 'c'), 'dragstart', dt);
        fireDrag(tagFor(display, 'a'), 'dragover', dt);
        fireDrag(tagFor(display, 'a'), 'drop', dt);

        expect(optionOrder(select)).toEqual(['c', 'a', 'b']);
        expect(instance.getValue()).toEqual(['c', 'a', 'b']);
    });

    it('dispatches a native change event once on a real reorder', () => {
        const { select, instance } = mountMulti();
        const onChange = vi.fn();
        select.addEventListener('change', onChange);
        const display = instance.display;
        const dt = makeDataTransfer();

        fireDrag(tagFor(display, 'a'), 'dragstart', dt);
        fireDrag(tagFor(display, 'b'), 'dragover', dt);
        fireDrag(tagFor(display, 'b'), 'drop', dt);

        expect(optionOrder(select)).toEqual(['b', 'a', 'c']);
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('is a no-op when dropping a tag onto itself (no reorder, no change)', () => {
        const { select, instance } = mountMulti();
        const onChange = vi.fn();
        select.addEventListener('change', onChange);
        const display = instance.display;
        const dt = makeDataTransfer();

        fireDrag(tagFor(display, 'b'), 'dragstart', dt);
        fireDrag(tagFor(display, 'b'), 'dragover', dt);
        fireDrag(tagFor(display, 'b'), 'drop', dt);

        expect(optionOrder(select)).toEqual(['a', 'b', 'c']);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('reorders via the pointer path using elementFromPoint', () => {
        const { select, instance } = mountMulti();
        const display = instance.display;

        // Stub elementFromPoint (absent in jsdom) to point at tag "c".
        const targetTag = tagFor(display, 'c');
        const efp = vi
            .spyOn(document, 'elementFromPoint')
            .mockReturnValue(targetTag as unknown as Element);

        // pointerdown on tag "a" (primary button), then a move, then up.
        const down = new Event('pointerdown', { bubbles: true, cancelable: true });
        Object.defineProperty(down, 'button', { value: 0 });
        tagFor(display, 'a').dispatchEvent(down);

        const move = new Event('pointermove', { bubbles: true });
        Object.defineProperty(move, 'clientX', { value: 1 });
        Object.defineProperty(move, 'clientY', { value: 1 });
        document.dispatchEvent(move);

        document.dispatchEvent(new Event('pointerup', { bubbles: true }));

        efp.mockRestore();

        expect(optionOrder(select)).toEqual(['b', 'c', 'a']);
        expect(instance.getValue()).toEqual(['b', 'c', 'a']);
    });

    it('is a no-op on single-select and leaves the value untouched', () => {
        const select = document.createElement('select');
        select.add(new Option('', ''));
        ['a', 'b', 'c'].forEach((v) => select.add(new Option(v.toUpperCase(), v)));
        document.body.appendChild(select);
        const instance = createSelect3(select, { plugins: [dragDrop] });
        instance.setValue('b');

        // No tags exist in single mode; firing drag on the display is harmless.
        fireDrag(instance.display, 'dragstart', makeDataTransfer());
        fireDrag(instance.display, 'drop', makeDataTransfer());

        expect(instance.getValue()).toBe('b');
        expect(optionOrder(select)).toEqual(['', 'a', 'b', 'c']);
    });

    it('removes its listeners on destroy', () => {
        const { select, instance } = mountMulti();
        const display = instance.display;
        const onChange = vi.fn();
        select.addEventListener('change', onChange);

        instance.destroy();

        // display still exists as a detached node; drag events must do nothing.
        const dt = makeDataTransfer();
        fireDrag(display, 'dragstart', dt);
        fireDrag(display, 'drop', dt);
        expect(onChange).not.toHaveBeenCalled();
    });
});
