import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';
import { computeWindow } from '../src/render/virtual';

describe('computeWindow', () => {
    it('returns an empty window for an empty list', () => {
        expect(computeWindow(0, 240, 36, 0)).toEqual({ start: 0, end: 0, padTop: 0, padBottom: 0 });
    });

    it('windows from the top with a buffer', () => {
        const w = computeWindow(0, 240, 40, 1000, 4);
        expect(w.start).toBe(0);
        expect(w.end).toBe(14); // ceil(240/40)=6 visible + 8 buffer
        expect(w.padTop).toBe(0);
        expect(w.padBottom).toBe((1000 - 14) * 40);
    });

    it('windows around a scrolled position', () => {
        const w = computeWindow(4000, 240, 40, 1000, 4);
        expect(w.start).toBe(96); // floor(4000/40)=100, minus 4 buffer
        expect(w.padTop).toBe(96 * 40);
    });

    it('clamps the end to the total', () => {
        const w = computeWindow(39600, 240, 40, 1000, 4);
        expect(w.end).toBe(1000);
        expect(w.padBottom).toBe(0);
    });
});

describe('virtual scroll integration', () => {
    beforeEach(() => document.body.replaceChildren());

    function mountBig(n = 1000) {
        const select = document.createElement('select');
        for (let i = 0; i < n; i++) select.add(new Option(`Item ${i}`, String(i)));
        document.body.appendChild(select);
        return createSelect3(select, { virtualScroll: true, itemHeight: 36 });
    }

    it('renders only a window of rows, not the whole list', () => {
        const s3 = mountBig(1000);
        s3.open();
        const rendered = s3.wrap.querySelectorAll('.s3__option').length;
        expect(rendered).toBeGreaterThan(0);
        expect(rendered).toBeLessThan(60);
        expect(s3.matches.length).toBe(1000);
    });

    it('renders two spacer divs for the off-screen rows', () => {
        const s3 = mountBig(1000);
        s3.open();
        expect(s3.wrap.querySelectorAll('.s3__vspace').length).toBe(2);
    });

    it('selecting a windowed option updates the native value', () => {
        const s3 = mountBig(100);
        s3.open();
        (s3.wrap.querySelector('.s3__option') as HTMLElement).click();
        expect((document.querySelector('select') as HTMLSelectElement).value).toBe('0');
    });

    it('keeps optgroup headers in virtual mode', () => {
        const select = document.createElement('select');
        const a = document.createElement('optgroup');
        a.label = 'Group A';
        for (let i = 0; i < 50; i++) a.appendChild(new Option(`A${i}`, `a${i}`));
        const b = document.createElement('optgroup');
        b.label = 'Group B';
        for (let i = 0; i < 50; i++) b.appendChild(new Option(`B${i}`, `b${i}`));
        select.append(a, b);
        document.body.appendChild(select);

        const s3 = createSelect3(select, { virtualScroll: true, itemHeight: 36 });
        s3.open();

        const headers = [...s3.wrap.querySelectorAll('.s3__group')].map((h) => h.textContent?.trim());
        expect(headers).toContain('Group A'); // header survives virtualization
        const rendered = s3.wrap.querySelectorAll('.s3__option').length;
        expect(rendered).toBeGreaterThan(0);
        expect(rendered).toBeLessThan(60); // still windowed, not all 100
    });
});
