import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';
import { csvOutput } from '../src/plugins/csv-output';

function mountMulti(name = 'tags') {
    const select = document.createElement('select');
    select.multiple = true;
    select.name = name;
    select.add(new Option('Alpha', 'alpha'));
    select.add(new Option('Beta', 'beta'));
    select.add(new Option('Gamma', 'gamma'));
    document.body.appendChild(select);
    return select;
}

/** The hidden input the plugin inserts right after the native select. */
function hiddenAfter(select: HTMLSelectElement): HTMLInputElement | null {
    const next = select.nextElementSibling;
    return next instanceof HTMLInputElement && next.type === 'hidden' ? next : null;
}

describe('csv-output plugin', () => {
    beforeEach(() => document.body.replaceChildren());

    it('inserts a hidden input after the select and joins the selection with ","', () => {
        const select = mountMulti();
        const s3 = createSelect3(select, { plugins: [csvOutput] });

        s3.choose('alpha');
        s3.choose('gamma');

        const input = hiddenAfter(select);
        expect(input).not.toBeNull();
        expect(input?.name).toBe('tags_csv');
        expect(input?.value).toBe('alpha,gamma');
    });

    it('updates the hidden value when the selection changes', () => {
        const select = mountMulti();
        const s3 = createSelect3(select, { plugins: [csvOutput] });
        const input = hiddenAfter(select);

        s3.choose('alpha');
        s3.choose('beta');
        expect(input?.value).toBe('alpha,beta');

        s3.deselect('alpha');
        expect(input?.value).toBe('beta');
    });

    it('honors custom name and separator options', () => {
        const select = mountMulti();
        const s3 = createSelect3(select, {
            plugins: [{ name: 'csv-output', options: { name: 'picked', separator: '|' } }],
        });

        s3.choose('alpha');
        s3.choose('beta');

        const input = hiddenAfter(select);
        expect(input?.name).toBe('picked');
        expect(input?.value).toBe('alpha|beta');
    });

    it('writes the current value on init for a pre-selected single select', () => {
        const select = document.createElement('select');
        select.name = 'fruit';
        select.add(new Option('', ''));
        const beta = new Option('Beta', 'beta');
        beta.selected = true;
        select.add(beta);
        document.body.appendChild(select);

        createSelect3(select, { plugins: [csvOutput] });

        const input = hiddenAfter(select);
        expect(input?.name).toBe('fruit_csv');
        expect(input?.value).toBe('beta');
    });

    it('removes the hidden input and stops syncing on destroy', () => {
        const select = mountMulti();
        const s3 = createSelect3(select, { plugins: [csvOutput] });
        expect(hiddenAfter(select)).not.toBeNull();

        s3.destroy();
        expect(hiddenAfter(select)).toBeNull();
    });
});
