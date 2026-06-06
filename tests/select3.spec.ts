import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';

function mountSelect({ multiple = false, tags = false, cities = ['Amsterdam', 'Athens', 'Berlin'] } = {}) {
    const select = document.createElement('select');
    if (multiple) select.multiple = true;
    if (tags) select.setAttribute('data-tags', '');
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    const instance = createSelect3(select);
    return { select, instance };
}

describe('Select3 client-side filtering', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders all non-placeholder options when opened', () => {
        const { instance } = mountSelect();
        instance.open();
        expect(instance.wrap.querySelectorAll('.s3__option')).toHaveLength(3);
    });

    it('filters by the search query (diacritic-folded)', () => {
        const { instance } = mountSelect();
        instance.open();
        instance.search.value = 'ams';
        instance.search.dispatchEvent(new Event('input'));
        const labels = [...instance.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent!.trim());
        expect(labels).toEqual(['Amsterdam']);
    });

    it('selecting an option updates the native <select>', () => {
        const { select, instance } = mountSelect();
        instance.choose('berlin');
        expect(select.value).toBe('berlin');
    });
});

describe('Select3 tag creation', () => {
    beforeEach(() => document.body.replaceChildren());

    it('creates a new option from a typed value', () => {
        const { select, instance } = mountSelect({ tags: true });
        instance.createTag('Cairo');
        expect([...select.options].map((o) => o.value)).toContain('Cairo');
        expect(select.value).toBe('Cairo');
    });

    it('reuses an existing option (folded label) instead of duplicating', () => {
        const { select, instance } = mountSelect({ tags: true });
        const before = select.options.length;
        instance.createTag('Berlin');
        instance.createTag('Berlin');
        expect([...select.options].filter((o) => o.value === 'berlin').length).toBe(1);
        expect(select.value).toBe('berlin');
        expect(select.options.length).toBe(before);
    });
});
