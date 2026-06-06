import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function mount(config = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    select.add(new Option('A', 'a'));
    document.body.appendChild(select);
    return createSelect3(select, config);
}

describe('style customization', () => {
    beforeEach(() => document.body.replaceChildren());

    it('merges custom classNames onto the elements', () => {
        const s3 = mount({ classNames: { wrap: 'my-wrap', control: 'my-control x' } });
        expect(s3.wrap.classList.contains('my-wrap')).toBe(true);
        expect(s3.control.classList.contains('my-control')).toBe(true);
        expect(s3.control.classList.contains('x')).toBe(true);
    });

    it('applies a size class for non-default sizes', () => {
        expect(mount({ size: 'lg' }).wrap.classList.contains('s3--lg')).toBe(true);
        expect(mount({ size: 'sm' }).wrap.classList.contains('s3--sm')).toBe(true);
    });

    it('adds no size class for the default md', () => {
        expect(mount().wrap.className).not.toContain('s3--md');
    });

    it('sets dir=rtl when enabled explicitly', () => {
        expect(mount({ rtl: true }).wrap.getAttribute('dir')).toBe('rtl');
    });

    it('auto-detects rtl from an ancestor [dir=rtl]', () => {
        const box = document.createElement('div');
        box.setAttribute('dir', 'rtl');
        document.body.appendChild(box);
        const select = document.createElement('select');
        select.add(new Option('A', 'a'));
        box.appendChild(select);
        expect(createSelect3(select).wrap.getAttribute('dir')).toBe('rtl');
    });
});
