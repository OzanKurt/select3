import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';
import type { Select3Options } from '../src/index';

function mount({
    multiple = true,
    cities = ['Amsterdam', 'Athens', 'Berlin'],
    opts = {} as Select3Options,
} = {}) {
    const select = document.createElement('select');
    if (multiple) select.multiple = true;
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    return { select, instance: createSelect3(select, opts) };
}

const values = (i: ReturnType<typeof createSelect3>) => i.getValue() as string[];

describe('Select-All / Clear-All', () => {
    beforeEach(() => document.body.replaceChildren());

    it('selectAll selects every enabled option', () => {
        const { instance } = mount({ opts: { selectAll: true } });
        instance.selectAll();
        expect(values(instance)).toEqual(['amsterdam', 'athens', 'berlin']);
    });

    it('selectAll respects maxItems', () => {
        const { instance } = mount({ opts: { selectAll: true, maxItems: 2 } });
        instance.selectAll();
        expect(values(instance).length).toBe(2);
    });

    it('renders a tri-state select-all row that toggles', () => {
        const { instance } = mount({ opts: { selectAll: true } });
        instance.open();
        let row = instance.wrap.querySelector<HTMLElement>('.s3__selectall')!;
        expect(row).not.toBeNull();
        row.click();
        expect(values(instance).length).toBe(3);
        row = instance.wrap.querySelector<HTMLElement>('.s3__selectall')!;
        expect(row.querySelector('.s3__checkbox')?.classList.contains('is-checked')).toBe(true);
        row.click();
        expect(values(instance).length).toBe(0);
    });
});

describe('Caption', () => {
    beforeEach(() => document.body.replaceChildren());

    it('collapses to "N selected" past csvDispCount', () => {
        const { instance } = mount({ opts: { csvDispCount: 1 } });
        instance.setValue(['amsterdam', 'athens']);
        expect(instance.wrap.querySelector('.s3__caption')?.textContent).toBe('2 selected');
    });

    it('uses the all-selected caption when everything is chosen', () => {
        const { instance } = mount({ opts: { csvDispCount: 1 } });
        instance.setValue(['amsterdam', 'athens', 'berlin']);
        expect(instance.wrap.querySelector('.s3__caption')?.textContent).toBe('All 3 selected');
    });

    it('keeps tags at or below the threshold', () => {
        const { instance } = mount({ opts: { csvDispCount: 2 } });
        instance.setValue(['amsterdam', 'athens']);
        expect(instance.wrap.querySelector('.s3__caption')).toBeNull();
        expect(instance.wrap.querySelectorAll('.s3__tag').length).toBe(2);
    });
});

describe('Checkbox options', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders and checks a checkbox per option', () => {
        const { instance } = mount({ opts: { checkboxes: true } });
        instance.open();
        expect(instance.wrap.querySelector('.s3__option .s3__checkbox')).not.toBeNull();
        instance.wrap.querySelector<HTMLElement>('.s3__option')!.click();
        expect(
            instance.wrap.querySelector('.s3__option .s3__checkbox')?.classList.contains('is-checked'),
        ).toBe(true);
    });
});

describe('OK / Cancel staging', () => {
    beforeEach(() => document.body.replaceChildren());

    it('stages edits and commits a single change on confirm()', () => {
        const { select, instance } = mount({ opts: { okCancel: true } });
        let changes = 0;
        instance.on('change', () => (changes += 1));
        instance.open();
        instance.choose('berlin');
        expect(changes).toBe(0);
        expect(select.value).toBe('berlin');
        instance.confirm();
        expect(changes).toBe(1);
    });

    it('reverts staged edits on cancel()', () => {
        const { instance } = mount({ opts: { okCancel: true } });
        instance.setValue(['amsterdam']);
        let changes = 0;
        instance.on('change', () => (changes += 1));
        instance.open();
        instance.choose('berlin');
        instance.deselect('amsterdam');
        instance.cancel();
        expect(values(instance)).toEqual(['amsterdam']);
        expect(changes).toBe(0);
    });

    it('clickAway:revert discards staged edits when closed by outside click', () => {
        const { instance } = mount({ opts: { okCancel: true, clickAway: 'revert' } });
        instance.open();
        instance.choose('berlin');
        instance.close();
        expect(values(instance)).toEqual([]);
    });
});
