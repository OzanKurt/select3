import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3, type Item } from '../src';
import { buildTree, leavesOf } from '../src/tree/tree';

const item = (value: string, label: string, parent?: string): Item => ({
    value,
    label,
    selected: false,
    disabled: false,
    placeholder: false,
    group: null,
    data: parent ? { parent } : {},
});

function opt(label: string, value: string, parent?: string): HTMLOptionElement {
    const o = new Option(label, value);
    if (parent) o.setAttribute('data-parent', parent);
    return o;
}

/** Electronics ▸ Phones ▸ {iPhone, Pixel}; Clothing ▸ Shirt. */
function mountTree(config = {}, multiple = true) {
    const select = document.createElement('select');
    if (multiple) select.multiple = true;
    [
        opt('Electronics', 'electronics'),
        opt('Phones', 'phones', 'electronics'),
        opt('iPhone', 'iphone', 'phones'),
        opt('Pixel', 'pixel', 'phones'),
        opt('Clothing', 'clothing'),
        opt('Shirt', 'shirt', 'clothing'),
    ].forEach((o) => select.add(o));
    document.body.appendChild(select);
    return { select, instance: createSelect3(select, { tree: true, ...config }) };
}

const labels = (i: { wrap: HTMLElement }) =>
    [...i.wrap.querySelectorAll('.s3__option .s3__label')].map((l) => l.textContent?.trim());
const rowFor = (i: { wrap: HTMLElement }, label: string) =>
    [...i.wrap.querySelectorAll<HTMLElement>('.s3__option')].find(
        (r) => r.querySelector('.s3__label')?.textContent?.trim() === label,
    );
const expand = (i: { wrap: HTMLElement }, label: string) =>
    rowFor(i, label)?.querySelector('.s3__caret')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const clickRow = (i: { wrap: HTMLElement }, label: string) =>
    rowFor(i, label)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

describe('buildTree', () => {
    it('builds a forest from data-parent links with levels', () => {
        const roots = buildTree([item('a', 'A'), item('b', 'B', 'a'), item('c', 'C', 'b')]);
        expect(roots).toHaveLength(1);
        expect(roots[0]?.children[0]?.value).toBe('b');
        expect(roots[0]?.children[0]?.level).toBe(1);
        expect(roots[0]?.children[0]?.children[0]?.level).toBe(2);
        expect(leavesOf(roots[0] as never).map((n) => n.value)).toEqual(['c']);
    });
});

describe('tree rendering', () => {
    beforeEach(() => document.body.replaceChildren());

    it('shows only roots until a branch is expanded', () => {
        const { instance } = mountTree();
        instance.open();
        expect(labels(instance)).toEqual(['Electronics', 'Clothing']);
    });

    it('expands a branch to reveal its children', () => {
        const { instance } = mountTree();
        instance.open();
        expand(instance, 'Electronics');
        expect(labels(instance)).toContain('Phones');
    });

    it('reveals a deep leaf with its ancestors when searching', () => {
        const { instance } = mountTree();
        instance.open();
        instance.search.value = 'pixel';
        instance.search.dispatchEvent(new Event('input'));
        const shown = labels(instance);
        expect(shown).toEqual(expect.arrayContaining(['Electronics', 'Phones', 'Pixel']));
        expect(shown).not.toContain('Clothing');
        expect(shown).not.toContain('iPhone');
    });
});

describe('tree selection (multi)', () => {
    beforeEach(() => document.body.replaceChildren());

    it('checking a branch selects all its descendant leaves', () => {
        const { select, instance } = mountTree();
        instance.open();
        expand(instance, 'Electronics');
        clickRow(instance, 'Phones');
        expect([...select.selectedOptions].map((o) => o.value).sort()).toEqual(['iphone', 'pixel']);
    });

    it('shows an indeterminate branch when only some leaves are selected', () => {
        const { select, instance } = mountTree();
        (select.querySelector('option[value="iphone"]') as HTMLOptionElement).selected = true;
        instance.refresh();
        instance.open();
        expand(instance, 'Electronics');
        expect(rowFor(instance, 'Phones')?.querySelector('.s3__checkbox')?.classList.contains('is-indeterminate')).toBe(true);
    });

    it('unchecks all leaves when a fully-checked branch is toggled', () => {
        const { select, instance } = mountTree();
        instance.open();
        expand(instance, 'Electronics');
        clickRow(instance, 'Phones'); // select both
        clickRow(instance, 'Phones'); // toggle off
        expect([...select.selectedOptions]).toHaveLength(0);
    });
});

describe('tree selection (single)', () => {
    beforeEach(() => document.body.replaceChildren());

    it('selects a leaf value on click', () => {
        const { select, instance } = mountTree({}, false);
        instance.open();
        expand(instance, 'Electronics');
        expand(instance, 'Phones');
        clickRow(instance, 'iPhone');
        expect(select.value).toBe('iphone');
    });
});
