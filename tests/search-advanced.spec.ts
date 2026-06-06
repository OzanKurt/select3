import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

/** Labels of the currently rendered dropdown options. */
const rendered = (instance: { wrap: HTMLElement }) =>
    [...instance.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent?.trim());

function mountFlat(cities: string[], opts = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    const instance = createSelect3(select, opts);
    instance.open();
    return instance;
}

function type(instance: { search: HTMLInputElement }, q: string) {
    instance.search.value = q;
    instance.search.dispatchEvent(new Event('input'));
}

describe('fuzzy search', () => {
    beforeEach(() => document.body.replaceChildren());

    it('matches an in-order subsequence when fuzzy is on', () => {
        const s = mountFlat(['Amsterdam', 'Berlin'], { fuzzy: true });
        type(s, 'amtrdm'); // a-m-(s)-t-(e)-r-d-(a)-m
        expect(rendered(s)).toEqual(['Amsterdam']);
    });

    it('does not subsequence-match without fuzzy', () => {
        const s = mountFlat(['Amsterdam', 'Berlin']);
        type(s, 'amtrdm');
        expect(rendered(s)).toEqual([]);
    });

    it('still ranks exact/prefix above fuzzy hits', () => {
        const s = mountFlat(['Berlin', 'Brasilia'], { fuzzy: true });
        type(s, 'br'); // prefix of both; Brasilia? 'br' prefix of 'brasilia'; Berlin prefix 'be' no
        // 'br' is a prefix of Brasilia (score 80) and a subsequence of Berlin (b..r).
        expect(rendered(s)?.[0]).toBe('Brasilia');
    });
});

describe('search by optgroup', () => {
    beforeEach(() => document.body.replaceChildren());

    function mountGrouped(opts = {}) {
        const select = document.createElement('select');
        const eu = document.createElement('optgroup');
        eu.label = 'Europe';
        eu.appendChild(new Option('Paris', 'paris'));
        const asia = document.createElement('optgroup');
        asia.label = 'Asia';
        asia.appendChild(new Option('Tokyo', 'tokyo'));
        select.append(eu, asia);
        document.body.appendChild(select);
        const instance = createSelect3(select, opts);
        instance.open();
        return instance;
    }

    it('matches options by their group label when searchGroups is on', () => {
        const s = mountGrouped({ searchGroups: true });
        type(s, 'europe');
        expect(rendered(s)).toEqual(['Paris']);
    });

    it('ignores the group label when searchGroups is off', () => {
        const s = mountGrouped();
        type(s, 'europe');
        expect(rendered(s)).toEqual([]);
    });
});

describe('display vs search independence', () => {
    beforeEach(() => document.body.replaceChildren());

    function mountWithSearchData(opts = {}) {
        const select = document.createElement('select');
        select.add(new Option('', ''));
        const au = new Option('AU', 'au');
        au.setAttribute('data-search', 'Australia');
        const nz = new Option('NZ', 'nz');
        nz.setAttribute('data-search', 'New Zealand');
        select.add(au);
        select.add(nz);
        document.body.appendChild(select);
        const instance = createSelect3(select, { searchField: ['search'], ...opts });
        instance.open();
        return instance;
    }

    it('matches a data field while displaying the (different) label', () => {
        const s = mountWithSearchData();
        type(s, 'zeal'); // only in NZ's data-search, not in any label
        expect(rendered(s)).toEqual(['NZ']);
    });

    it('does not match the visible label when searchField excludes it', () => {
        const s = mountWithSearchData();
        type(s, 'au'); // 'au' is the AU label/value but searchField is ['search'] only
        // 'au' is a prefix of "Australia" (the search field), so AU still matches by data...
        expect(rendered(s)).toEqual(['AU']);
        // ...but a string only present in the label, never in the data, finds nothing:
        const select = document.createElement('select');
        const x = new Option('XYZ', 'xyz');
        x.setAttribute('data-search', 'Apple');
        select.add(x);
        document.body.appendChild(select);
        const s2 = createSelect3(select, { searchField: ['search'] });
        s2.open();
        type(s2, 'xyz');
        expect([...s2.wrap.querySelectorAll('.s3__option')]).toHaveLength(0);
    });
});
