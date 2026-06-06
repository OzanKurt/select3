import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';
import { AjaxAdapter, defaultProcessResults } from '../src/data/ajax-adapter';
import type { Transport } from '../src/index';

const settle = async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
};

function makeAdapter(transport: Transport, debounce = 0) {
    const state = { results: [] as any[], errors: 0, loading: 0 };
    const a = new AjaxAdapter({
        url: '/search',
        debounce,
        transport,
        processResults: defaultProcessResults,
        queryParam: 'q',
        pageParam: 'page',
        onLoading: () => (state.loading += 1),
        onResults: (rows, meta) => state.results.push({ rows, meta }),
        onError: () => (state.errors += 1),
    });
    return { a, state };
}

describe('defaultProcessResults', () => {
    it('maps value/label and reads hasMore', () => {
        const p = defaultProcessResults({ results: [{ id: 5, text: 'Five' }], hasMore: true }, 1);
        expect(p.results[0]).toMatchObject({ value: '5', label: 'Five' });
        expect(p.hasMore).toBe(true);
    });

    it('treats a bare array as a single page', () => {
        const p = defaultProcessResults([{ value: 'x', label: 'X' }], 1);
        expect(p.hasMore).toBe(false);
        expect(p.results[0]).toMatchObject({ value: 'x', label: 'X' });
    });
});

describe('AjaxAdapter', () => {
    it('delivers processed rows from a search', async () => {
        const { a, state } = makeAdapter(async () => [
            { id: 1, text: 'One' },
            { id: 2, text: 'Two' },
        ]);
        a.search('o');
        await settle();
        expect(state.results[0].rows.map((r: any) => r.value)).toEqual(['1', '2']);
        expect(state.results[0].rows[0].label).toBe('One');
        expect(state.results[0].meta.append).toBe(false);
    });

    it('caches by query + page', async () => {
        let calls = 0;
        const { a } = makeAdapter(async () => {
            calls += 1;
            return [{ id: 1, text: 'A' }];
        });
        a.search('x');
        await settle();
        a.search('x');
        await settle();
        expect(calls).toBe(1);
    });

    it('paginates with more() and appends', async () => {
        const pages: Record<number, unknown> = {
            1: { results: [{ id: 1, text: 'A' }], hasMore: true },
            2: { results: [{ id: 2, text: 'B' }], hasMore: false },
        };
        const transport: Transport = async (url) => {
            const m = url.match(/page=(\d+)/);
            return pages[m ? Number(m[1]) : 1];
        };
        const { a, state } = makeAdapter(transport);
        a.search('q');
        await settle();
        expect(a.hasMore).toBe(true);
        a.more();
        await settle();
        expect(state.results[1].meta.append).toBe(true);
        expect(state.results[1].rows[0].value).toBe('2');
        expect(a.hasMore).toBe(false);
    });

    it('serves a stale cache entry then revalidates (SWR)', async () => {
        let calls = 0;
        const a = new AjaxAdapter({
            url: '/s',
            debounce: 0,
            cacheTTL: 1,
            transport: async () => {
                calls += 1;
                return [{ id: 1, text: 'A' }];
            },
            processResults: defaultProcessResults,
            queryParam: 'q',
            pageParam: 'page',
            onLoading: () => {},
            onResults: () => {},
            onError: () => {},
        });
        a.search('x');
        await settle();
        expect(calls).toBe(1);
        await new Promise((r) => setTimeout(r, 5)); // exceed the 1ms TTL
        a.search('x');
        await settle();
        expect(calls).toBe(2); // cached served immediately, then revalidated
    });

    it('drops a stale response when superseded', async () => {
        let resolveFirst!: (v: unknown) => void;
        const first = new Promise((r) => (resolveFirst = r));
        let call = 0;
        const transport: Transport = () => {
            call += 1;
            return call === 1 ? first : Promise.resolve([{ id: 2, text: 'B' }]);
        };
        const { a, state } = makeAdapter(transport);
        a.search('a');
        a.search('b');
        await settle();
        resolveFirst([{ id: 1, text: 'A' }]);
        await settle();
        const values = state.results.flatMap((r) => r.rows.map((x: any) => x.value));
        expect(values).toEqual(['2']);
    });
});

describe('Select3 AJAX integration', () => {
    beforeEach(() => document.body.replaceChildren());

    it('injects and renders remote options', async () => {
        const select = document.createElement('select');
        select.add(new Option('', ''));
        document.body.appendChild(select);
        const transport: Transport = async () => [
            { id: 'ams', text: 'Amsterdam' },
            { id: 'ber', text: 'Berlin' },
        ];
        const s = createSelect3(select, { ajax: '/cities', minChars: 1, debounce: 0, transport });
        s.open();
        s.search.value = 'a';
        s.search.dispatchEvent(new Event('input'));
        await settle();
        const labels = [...s.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent!.trim());
        expect(labels).toContain('Amsterdam');
        expect(labels).toContain('Berlin');
    });

    it('carries rich per-row data and groups remote options', async () => {
        const select = document.createElement('select');
        select.add(new Option('', ''));
        document.body.appendChild(select);
        const transport: Transport = async () => [
            { id: 'a', text: 'Ann', icon: 'fa fa-user', group: 'Admins' },
            { id: 'b', text: 'Bob', group: 'Users' },
        ];
        const s = createSelect3(select, { ajax: '/u', minChars: 1, debounce: 0, transport });
        s.open();
        s.search.value = 'x';
        s.search.dispatchEvent(new Event('input'));
        await settle();

        // Native <optgroup>s created for the remote groups, rich data on the option.
        const groups = [...select.querySelectorAll('optgroup')].map((g) => g.label);
        expect(groups).toEqual(expect.arrayContaining(['Admins', 'Users']));
        expect([...select.options].find((o) => o.value === 'a')?.dataset.icon).toBe('fa fa-user');

        // Rendered dropdown shows the group headers and the icon.
        const headers = [...s.wrap.querySelectorAll('.s3__group')].map((h) => h.textContent?.trim());
        expect(headers).toEqual(expect.arrayContaining(['Admins', 'Users']));
        expect(s.wrap.querySelector('.s3__option .s3__icon')).not.toBeNull();
    });

    it('preload:true loads the first page on init', async () => {
        const select = document.createElement('select');
        select.add(new Option('', ''));
        document.body.appendChild(select);
        const transport: Transport = async () => [{ id: 'x', text: 'Xanadu' }];
        const s = createSelect3(select, { ajax: '/c', debounce: 0, preload: true, transport });
        await settle();
        expect([...select.options].some((o) => o.value === 'x')).toBe(true);
        s.open();
        expect([...s.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent!.trim())).toContain('Xanadu');
    });
});
