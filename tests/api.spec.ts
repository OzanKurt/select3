import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3, Emitter } from '../src/index';
import type { Select3Options } from '../src/index';

function mountSelect({
    multiple = false,
    tags = false,
    cities = ['Amsterdam', 'Athens', 'Berlin'],
    opts = {} as Select3Options,
} = {}) {
    const select = document.createElement('select');
    if (multiple) select.multiple = true;
    if (tags) select.setAttribute('data-tags', '');
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    const instance = createSelect3(select, opts);
    return { select, instance };
}

describe('Emitter', () => {
    it('on/emit/off', () => {
        const e = new Emitter();
        let n = 0;
        const off = e.on('x', () => (n += 1));
        e.emit('x');
        off();
        e.emit('x');
        expect(n).toBe(1);
    });

    it('once fires a single time', () => {
        const e = new Emitter();
        let n = 0;
        e.once('x', () => (n += 1));
        e.emit('x');
        e.emit('x');
        expect(n).toBe(1);
    });
});

describe('Instance events', () => {
    beforeEach(() => document.body.replaceChildren());

    it('emits select then change on choose', () => {
        const { instance } = mountSelect();
        const log: string[] = [];
        instance.on('select', (p: any) => log.push(`select:${p.value}`));
        instance.on('change', () => log.push('change'));
        instance.choose('berlin');
        expect(log).toEqual(['select:berlin', 'change']);
    });

    it('emits deselect on multi remove', () => {
        const { instance } = mountSelect({ multiple: true });
        const log: string[] = [];
        instance.on('deselect', (p: any) => log.push(p.value));
        instance.choose('berlin');
        instance.deselect('berlin');
        expect(log).toEqual(['berlin']);
    });

    it('beforeSelect can cancel the selection', () => {
        const { select, instance } = mountSelect();
        instance.on('beforeSelect', (p: any) => {
            if (p.value === 'berlin') p.preventDefault();
        });
        instance.choose('berlin');
        expect(select.value).toBe('');
    });

    it('emits open and close', () => {
        const { instance } = mountSelect();
        const log: string[] = [];
        instance.on('open', () => log.push('open'));
        instance.on('close', () => log.push('close'));
        instance.open();
        instance.close();
        expect(log).toEqual(['open', 'close']);
    });
});

describe('Behavior flags', () => {
    beforeEach(() => document.body.replaceChildren());

    it('single select closes on choose (closeOnSelect default true)', () => {
        const { instance } = mountSelect();
        instance.open();
        instance.choose('berlin');
        expect(instance.isOpen).toBe(false);
    });

    it('multi stays open on choose (closeOnSelect default false)', () => {
        const { instance } = mountSelect({ multiple: true });
        instance.open();
        instance.choose('berlin');
        expect(instance.isOpen).toBe(true);
    });

    it('multi with closeOnSelect:true closes', () => {
        const { instance } = mountSelect({ multiple: true, opts: { closeOnSelect: true } });
        instance.open();
        instance.choose('berlin');
        expect(instance.isOpen).toBe(false);
    });

    it('maxItems caps the multi-select', () => {
        const { instance } = mountSelect({ multiple: true, opts: { maxItems: 1 } });
        instance.choose('berlin');
        expect(instance.isFull()).toBe(true);
        instance.choose('athens');
        expect(instance.getValue()).toEqual(['berlin']);
    });

    it('hidePlaceholder hides the placeholder while open', () => {
        const { instance } = mountSelect({ opts: { hidePlaceholder: true } });
        expect(instance.wrap.querySelector('.s3__placeholder')).not.toBeNull();
        instance.open();
        expect(instance.wrap.querySelector('.s3__placeholder')).toBeNull();
        instance.close();
        expect(instance.wrap.querySelector('.s3__placeholder')).not.toBeNull();
    });

    it('openOnFocus opens on control focus', () => {
        const { instance } = mountSelect({ opts: { openOnFocus: true } });
        instance.control.dispatchEvent(new FocusEvent('focus'));
        expect(instance.isOpen).toBe(true);
    });

    it('selectOnTab selects the active option on Tab', () => {
        const { select, instance } = mountSelect({ opts: { selectOnTab: true } });
        instance.open();
        instance.search.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
        expect(select.value).toBe('amsterdam');
    });
});

describe('Methods API', () => {
    beforeEach(() => document.body.replaceChildren());

    it('getValue/setValue (single)', () => {
        const { select, instance } = mountSelect();
        instance.setValue('berlin');
        expect(instance.getValue()).toBe('berlin');
        expect(select.value).toBe('berlin');
    });

    it('getValue/setValue (multi, option order)', () => {
        const { instance } = mountSelect({ multiple: true });
        instance.setValue(['berlin', 'athens']);
        expect(instance.getValue()).toEqual(['athens', 'berlin']);
    });

    it('addOption/removeOption', () => {
        const { select, instance } = mountSelect();
        instance.addOption({ value: 'cairo', label: 'Cairo' });
        expect([...select.options].map((o) => o.value)).toContain('cairo');
        instance.removeOption('cairo');
        expect([...select.options].map((o) => o.value)).not.toContain('cairo');
    });

    it('enable/disable', () => {
        const { select, instance } = mountSelect();
        instance.disable();
        expect(select.disabled).toBe(true);
        expect(instance.wrap.classList.contains('s3--disabled')).toBe(true);
        instance.enable();
        expect(select.disabled).toBe(false);
        expect(instance.wrap.classList.contains('s3--disabled')).toBe(false);
    });

    it('lock blocks edits until unlocked', () => {
        const { select, instance } = mountSelect();
        instance.lock();
        instance.choose('berlin');
        expect(select.value).toBe('');
        instance.unlock();
        instance.choose('berlin');
        expect(select.value).toBe('berlin');
    });
});
