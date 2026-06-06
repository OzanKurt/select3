import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function mountTags(config = {}) {
    const select = document.createElement('select');
    select.multiple = true;
    select.setAttribute('data-tags', '');
    document.body.appendChild(select);
    return { select, instance: createSelect3(select, config) };
}

const selected = (select: HTMLSelectElement) => [...select.selectedOptions].map((o) => o.value);
const values = (select: HTMLSelectElement) => [...select.options].map((o) => o.value);

describe('tagging extras', () => {
    beforeEach(() => document.body.replaceChildren());

    it('creates a tag from a token separator while typing', () => {
        const { select, instance } = mountTags({ tokenSeparators: [','] });
        instance.open();
        instance.search.value = 'red,';
        instance.search.dispatchEvent(new Event('input'));
        expect(selected(select)).toContain('red');
        expect(instance.search.value).toBe('');
    });

    it('splits a pasted multi-token string, keeping the remainder', () => {
        const { select, instance } = mountTags({ tokenSeparators: [','] });
        instance.open();
        instance.search.value = 'red,green,bl';
        instance.search.dispatchEvent(new Event('input'));
        expect(values(select)).toContain('red');
        expect(values(select)).toContain('green');
        expect(values(select)).not.toContain('bl');
        expect(instance.search.value).toBe('bl');
    });

    it('rejects tags that fail the createFilter', () => {
        const { select, instance } = mountTags({ createFilter: /^[a-z]+$/ });
        instance.createTag('abc');
        instance.createTag('12!');
        expect(values(select)).toContain('abc');
        expect(values(select)).not.toContain('12!');
    });

    it('removes a created tag on deselect when persist is false', () => {
        const { select, instance } = mountTags({ persist: false });
        instance.createTag('temp');
        expect(values(select)).toContain('temp');
        instance.deselect('temp');
        expect(values(select)).not.toContain('temp');
    });

    it('keeps a created tag on deselect by default', () => {
        const { select, instance } = mountTags();
        instance.createTag('keep');
        instance.deselect('keep');
        expect(values(select)).toContain('keep');
    });

    it('addPrecedence makes Enter create the typed tag instead of a match', () => {
        const select = document.createElement('select');
        select.multiple = true;
        select.setAttribute('data-tags', '');
        select.add(new Option('Reddish', 'reddish'));
        document.body.appendChild(select);
        const instance = createSelect3(select, { addPrecedence: true });
        instance.open();
        instance.search.value = 'red';
        instance.search.dispatchEvent(new Event('input'));
        instance.search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(selected(select)).toContain('red');
    });
});
