import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function opt(label: string, value: string, data: Record<string, string> = {}): HTMLOptionElement {
    const o = new Option(label, value);
    Object.entries(data).forEach(([k, v]) => o.setAttribute(`data-${k}`, v));
    return o;
}

function mount(options: HTMLOptionElement[], config = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    options.forEach((o) => select.add(o));
    document.body.appendChild(select);
    return createSelect3(select, config);
}

describe('rich option data', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders an icon from data-icon', () => {
        const s3 = mount([opt('Apple', 'apple', { icon: 'fa-solid fa-apple' })]);
        s3.open();
        expect(s3.wrap.querySelector('.s3__option .s3__icon')).not.toBeNull();
    });

    it('prefers an image (data-image) over an icon', () => {
        const s3 = mount([opt('Sara', 'sara', { image: '/sara.png', icon: 'fa-user' })]);
        s3.open();
        const img = s3.wrap.querySelector<HTMLImageElement>('.s3__option img.s3__image');
        expect(img?.getAttribute('src')).toBe('/sara.png');
        expect(s3.wrap.querySelector('.s3__option .s3__icon')).toBeNull();
    });

    it('renders description and badge', () => {
        const s3 = mount([opt('Pro', 'pro', { description: 'Most popular', badge: 'New' })]);
        s3.open();
        expect(s3.wrap.querySelector('.s3__desc')?.textContent).toBe('Most popular');
        expect(s3.wrap.querySelector('.s3__badge')?.textContent).toBe('New');
    });
});

describe('templates', () => {
    beforeEach(() => document.body.replaceChildren());

    it('uses a custom option template returning a Node', () => {
        const s3 = mount([opt('Apple', 'apple')], {
            templates: {
                option: (item: { label: string }) => {
                    const span = document.createElement('span');
                    span.className = 'custom-opt';
                    span.textContent = item.label.toUpperCase();
                    return span;
                },
            },
        });
        s3.open();
        expect(s3.wrap.querySelector('.s3__option .custom-opt')?.textContent).toBe('APPLE');
    });

    it('inserts a string option template as safe text (never markup)', () => {
        const s3 = mount([opt('Apple', 'apple')], { templates: { option: () => '<b>x</b>' } });
        s3.open();
        const optionEl = s3.wrap.querySelector('.s3__option');
        expect(optionEl?.querySelector('b')).toBeNull();
        expect(optionEl?.textContent).toContain('<b>x</b>');
    });

    it('uses the noResults template', () => {
        const s3 = mount([opt('Apple', 'apple')], {
            templates: { noResults: (q: string) => `Nothing for ${q}` },
        });
        s3.open();
        s3.search.value = 'zzz';
        s3.search.dispatchEvent(new Event('input'));
        expect(s3.wrap.querySelector('.s3__empty')?.textContent).toBe('Nothing for zzz');
    });

    it('uses the caption template for a multi-select past the threshold', () => {
        const select = document.createElement('select');
        select.multiple = true;
        ['a', 'b', 'c'].forEach((v) => {
            const o = new Option(v.toUpperCase(), v);
            o.selected = true;
            select.add(o);
        });
        document.body.appendChild(select);
        const s3 = createSelect3(select, {
            csvDispCount: 1,
            templates: { caption: (n: number, total: number) => `${n}/${total} chosen` },
        });
        expect(s3.wrap.querySelector('.s3__caption')?.textContent).toBe('3/3 chosen');
    });

    it('uses the item template for a single selection', () => {
        const select = document.createElement('select');
        const o = new Option('Apple', 'apple');
        o.selected = true;
        select.add(o);
        document.body.appendChild(select);
        const s3 = createSelect3(select, { templates: { item: (item: { label: string }) => `★ ${item.label}` } });
        expect(s3.wrap.querySelector('.s3__single')?.textContent).toBe('★ Apple');
    });
});
