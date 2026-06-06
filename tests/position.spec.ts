import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';
import type { Select3Options } from '../src/index';
import { resolveDropdownParent, computeFlip } from '../src/render/position';

function mount(opts: Select3Options = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    ['Alpha', 'Beta'].forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    return createSelect3(select, opts);
}

describe('position helpers', () => {
    beforeEach(() => document.body.replaceChildren());

    it('resolveDropdownParent returns an explicit element', () => {
        const host = document.createElement('div');
        expect(resolveDropdownParent(document.createElement('div'), host)).toBe(host);
    });

    it("resolveDropdownParent 'self' => null", () => {
        expect(resolveDropdownParent(document.createElement('div'), 'self')).toBeNull();
    });

    it("resolveDropdownParent 'body' => document.body", () => {
        expect(resolveDropdownParent(document.createElement('div'), 'body')).toBe(document.body);
    });

    it("'auto' detects a modal ancestor", () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        const ctrl = document.createElement('div');
        modal.appendChild(ctrl);
        document.body.appendChild(modal);
        expect(resolveDropdownParent(ctrl, 'auto')).toBe(modal);
    });

    it("'auto' detects an Alpine x-trap ancestor", () => {
        const trap = document.createElement('div');
        trap.setAttribute('x-trap', 'open');
        const ctrl = document.createElement('div');
        trap.appendChild(ctrl);
        document.body.appendChild(trap);
        expect(resolveDropdownParent(ctrl, 'auto')).toBe(trap);
    });

    it("'auto' returns null without a modal", () => {
        const ctrl = document.createElement('div');
        document.body.appendChild(ctrl);
        expect(resolveDropdownParent(ctrl, 'auto')).toBeNull();
    });

    it('computeFlip stays down when there is room below', () => {
        expect(computeFlip({ top: 10, bottom: 40 }, 200, 800)).toBe(false);
    });

    it('computeFlip flips up when blocked below but open above', () => {
        expect(computeFlip({ top: 700, bottom: 760 }, 200, 800)).toBe(true);
    });
});

describe('dropdown portaling', () => {
    beforeEach(() => document.body.replaceChildren());

    it('portals to body on open and restores on close', () => {
        const s = mount({ appendTo: 'body' });
        s.open();
        expect(s.dropdown.parentElement).toBe(document.body);
        expect(s.dropdown.style.display).toBe('block');
        expect(s.dropdown.style.position).toBe('fixed');
        s.close();
        expect(s.dropdown.parentElement).toBe(s.wrap);
        expect(s.dropdown.style.display).toBe('');
        expect(s.dropdown.style.position).toBe('');
    });

    it('auto-portals into a modal ancestor (BS/Alpine focus-trap compatibility)', () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        document.body.appendChild(modal);
        const select = document.createElement('select');
        select.add(new Option('', ''));
        select.add(new Option('A', 'a'));
        modal.appendChild(select);
        const s = createSelect3(select);
        s.open();
        expect(s.dropdown.parentElement).toBe(modal);
        s.close();
        expect(s.dropdown.parentElement).toBe(s.wrap);
    });

    it('stays open when clicking inside the portaled dropdown', () => {
        const s = mount({ appendTo: 'body' });
        s.open();
        s.search.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(s.isOpen).toBe(true);
    });

    it('closes when clicking outside', () => {
        const s = mount({ appendTo: 'body' });
        s.open();
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        expect(s.isOpen).toBe(false);
    });
});
