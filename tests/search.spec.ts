import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';
import type { Select3Options } from '../src/index';

type Spec = string | { label: string; value?: string; data?: Record<string, string> };

function mount(cities: Spec[], opts: Select3Options = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    cities.forEach((c) => {
        if (typeof c === 'string') {
            select.add(new Option(c, c.toLowerCase()));
        } else {
            const o = new Option(c.label, c.value ?? c.label.toLowerCase());
            if (c.data) Object.entries(c.data).forEach(([k, v]) => (o.dataset[k] = v));
            select.add(o);
        }
    });
    document.body.appendChild(select);
    return createSelect3(select, opts);
}

function search(s: ReturnType<typeof createSelect3>, q: string) {
    s.open();
    s.search.value = q;
    s.search.dispatchEvent(new Event('input'));
    return [...s.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent!.trim());
}

describe('Scoring search', () => {
    beforeEach(() => document.body.replaceChildren());

    it('ranks a prefix match above a substring match', () => {
        const s = mount(['Amsterdam', 'Rotterdam', 'Damascus']);
        expect(search(s, 'dam')[0]).toBe('Damascus');
    });

    it('ranks an exact match first', () => {
        const s = mount([{ label: 'Ams', value: 'ams' }, 'Amsterdam']);
        expect(search(s, 'ams')[0]).toBe('Ams');
    });

    it('highlights the matched substring', () => {
        const s = mount(['Amsterdam']);
        search(s, 'ams');
        expect(s.wrap.querySelector('.s3__mark')?.textContent).toBe('Ams');
    });

    it('searches across extra fields via searchField', () => {
        const s = mount(
            [{ label: 'NYC', value: 'nyc', data: { keywords: 'new york city' } }, 'Boston'],
            { searchField: ['label', 'keywords'] },
        );
        expect(search(s, 'york')).toEqual(['NYC']);
    });

    it('is diacritic-insensitive', () => {
        const s = mount(['Zürich', 'Boston']);
        expect(search(s, 'zur')).toEqual(['Zürich']);
    });
});

describe('Search-box controls', () => {
    beforeEach(() => document.body.replaceChildren());

    it('hides the search box below minResultsForSearch', () => {
        const s = mount(['A', 'B', 'C'], { minResultsForSearch: 5 });
        s.open();
        const wrap = s.dropdown.querySelector<HTMLElement>('.s3__search-wrap');
        expect(wrap?.style.display).toBe('none');
    });

    it('shows the search box above minResultsForSearch', () => {
        const s = mount(['A', 'B', 'C'], { minResultsForSearch: 2 });
        s.open();
        const wrap = s.dropdown.querySelector<HTMLElement>('.s3__search-wrap');
        expect(wrap?.style.display).toBe('');
    });

    it('caps typed length with maxInputLength', () => {
        const s = mount(['A'], { maxInputLength: 5 });
        expect(s.search.maxLength).toBe(5);
    });
});
