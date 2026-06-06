import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';
import type { Select3Options } from '../src';
import { optgroupColumns } from '../src/plugins/optgroup-columns';

/** Mount a multi-select whose options live inside two <optgroup>s. */
function mount(opts: Select3Options = {}) {
    const select = document.createElement('select');
    select.multiple = true;

    const fruit = document.createElement('optgroup');
    fruit.label = 'Fruit';
    fruit.append(new Option('Apple', 'apple'), new Option('Banana', 'banana'));

    const veg = document.createElement('optgroup');
    veg.label = 'Veg';
    veg.append(new Option('Carrot', 'carrot'), new Option('Daikon', 'daikon'));

    select.append(fruit, veg);
    document.body.appendChild(select);
    return { select, instance: createSelect3(select, opts) };
}

describe('optgroup-columns plugin', () => {
    beforeEach(() => document.body.replaceChildren());

    it('adds s3--cols and sets --s3-cols to the configured count', () => {
        const { instance } = mount({ plugins: [{ name: 'optgroup-columns', options: { columns: 3 } }] });
        instance.open();
        expect(instance.wrap.classList.contains('s3--cols')).toBe(true);
        expect(instance.listbox.style.getPropertyValue('--s3-cols')).toBe('3');
    });

    it('defaults to 2 columns when none is configured', () => {
        const { instance } = mount({ plugins: [optgroupColumns] });
        expect(instance.listbox.style.getPropertyValue('--s3-cols')).toBe('2');
    });

    it('renders a group header per optgroup inside the listbox', () => {
        const { instance } = mount({ plugins: [optgroupColumns] });
        instance.open();
        const headers = [...instance.listbox.querySelectorAll('.s3__group')].map((h) => h.textContent);
        expect(headers).toEqual(['Fruit', 'Veg']);
    });

    it('clamps a non-positive column count back to the default', () => {
        const { instance } = mount({ plugins: [{ name: 'optgroup-columns', options: { columns: 0 } }] });
        expect(instance.listbox.style.getPropertyValue('--s3-cols')).toBe('2');
    });

    it('removes the class and inline var on destroy', () => {
        const { instance } = mount({ plugins: [optgroupColumns] });
        instance.destroy();
        expect(instance.wrap.classList.contains('s3--cols')).toBe(false);
        expect(instance.listbox.style.getPropertyValue('--s3-cols')).toBe('');
    });
});
