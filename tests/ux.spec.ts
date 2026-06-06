import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

function mount(opts = {}, cities = ['Apple', 'Banana', 'Cherry']) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    return createSelect3(select, opts);
}

describe('async / custom create', () => {
    beforeEach(() => document.body.replaceChildren());

    it('adds and selects from a sync create hook', () => {
        const select = document.createElement('select');
        document.body.appendChild(select);
        const s = createSelect3(select, { tags: true, create: (label) => ({ value: label.toLowerCase(), label }) });
        s.createTag('Mango');
        expect([...select.options].some((o) => o.value === 'mango')).toBe(true);
        expect(select.value).toBe('mango');
    });

    it('awaits an async create hook, carrying rich data', async () => {
        const select = document.createElement('select');
        document.body.appendChild(select);
        const s = createSelect3(select, {
            tags: true,
            create: (label) => Promise.resolve({ value: '99', label, icon: 'fa fa-star' }),
        });
        s.createTag('Server Tag');
        await settle();
        const opt = [...select.options].find((o) => o.value === '99');
        expect(opt?.dataset.icon).toBe('fa fa-star');
        expect(select.value).toBe('99');
    });

    it('rejects creation when the hook returns null', () => {
        const select = document.createElement('select');
        document.body.appendChild(select);
        const s = createSelect3(select, { tags: true, create: () => null });
        s.createTag('Nope');
        expect(select.options.length).toBe(0);
    });
});

describe('recent options', () => {
    beforeEach(() => {
        document.body.replaceChildren();
        localStorage.clear();
    });
    afterEach(() => localStorage.clear());

    it('floats recently-chosen values to the top in recency order', () => {
        const s = mount({ recent: { key: 'r' } });
        s.choose('cherry');
        s.choose('banana');
        s.open();
        const labels = [...s.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent?.trim());
        expect(labels.slice(0, 2)).toEqual(['Banana', 'Cherry']);
    });

    it('persists recents to localStorage, capped at max', () => {
        const s = mount({ recent: { key: 'cap', max: 2 } });
        s.choose('apple');
        s.choose('banana');
        s.choose('cherry');
        expect(JSON.parse(localStorage.getItem('cap') as string)).toEqual(['cherry', 'banana']);
    });
});

describe('result count', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders a count footer', () => {
        const s = mount({ showCount: true });
        s.open();
        expect(s.wrap.querySelector('.s3__count')?.textContent).toBe('3 results');
    });

    it('singularizes a single result', () => {
        const s = mount({ showCount: true });
        s.open();
        s.search.value = 'apple';
        s.search.dispatchEvent(new Event('input'));
        expect(s.wrap.querySelector('.s3__count')?.textContent).toBe('1 result');
    });
});

describe('loading spinner', () => {
    beforeEach(() => document.body.replaceChildren());

    it('toggles s3--loading around an AJAX request', async () => {
        let resolve!: (v: unknown) => void;
        const pending = new Promise((r) => (resolve = r));
        const select = document.createElement('select');
        document.body.appendChild(select);
        const s = createSelect3(select, {
            ajax: '/c',
            minChars: 1,
            debounce: 0,
            transport: () => pending.then(() => [{ id: 1, text: 'A' }]),
        });
        s.open();
        s.search.value = 'a';
        s.search.dispatchEvent(new Event('input'));
        await settle();
        expect(s.wrap.classList.contains('s3--loading')).toBe(true);
        resolve(null);
        await settle();
        expect(s.wrap.classList.contains('s3--loading')).toBe(false);
    });
});
