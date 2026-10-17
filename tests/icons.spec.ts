import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function mount(config = {}, { multiple = false } = {}) {
    const select = document.createElement('select');
    select.multiple = multiple;
    if (!multiple) select.add(new Option('', ''));
    select.add(new Option('A', 'a', true, true));
    select.add(new Option('B', 'b'));
    document.body.appendChild(select);
    return createSelect3(select, config);
}

const svgIn = (node: Element | null) => node?.querySelector('svg') ?? null;

describe('icons', () => {
    beforeEach(() => document.body.replaceChildren());

    it('draws built-in SVG icons by default, with no icon font', () => {
        const s3 = mount();
        s3.open();

        expect(svgIn(s3.arrow)).not.toBeNull();
        expect(svgIn(s3.clear)).not.toBeNull();
        expect(svgIn(s3.wrap.querySelector('.s3__spinner'))).not.toBeNull();
        expect(document.querySelector('.s3__option svg.s3__check')).not.toBeNull();
        expect(document.querySelector('[class*="fa-"]')).toBeNull();
    });

    it('draws an SVG remove button on tags', () => {
        const s3 = mount({}, { multiple: true });

        expect(svgIn(s3.wrap.querySelector('.s3__tag-remove'))).not.toBeNull();
    });

    it('hides the SVG icons from assistive technology', () => {
        const s3 = mount();
        const svg = svgIn(s3.arrow)!;

        expect(svg.getAttribute('aria-hidden')).toBe('true');
        expect(svg.getAttribute('focusable')).toBe('false');
        expect(svg.classList.contains('s3__svg')).toBe(true);
    });

    it('uses Font Awesome classes with icons: "fontawesome"', () => {
        const s3 = mount({ icons: 'fontawesome' }, { multiple: true });
        s3.open();

        expect(s3.arrow.querySelector('i')!.className).toBe('fa-solid fa-chevron-down');
        expect(s3.clear.querySelector('i')!.className).toBe('fa-solid fa-xmark');
        expect(s3.wrap.querySelector('.s3__spinner i')!.className).toBe('fa-solid fa-spinner');
        expect(s3.wrap.querySelector('.s3__tag-remove i')!.className).toBe('fa-solid fa-xmark');
        expect(svgIn(s3.wrap)).toBeNull();
    });

    it('uses Font Awesome for the selected-option check', () => {
        const s3 = mount({ icons: 'fontawesome' });
        s3.open();

        expect(document.querySelector('.s3__option i.s3__check')!.className).toBe('fa-solid fa-check s3__check');
    });

    it('takes a map of class lists and functions, falling back to SVG', () => {
        const s3 = mount({
            icons: {
                arrow: 'bi bi-chevron-down',
                check: () => {
                    const node = document.createElement('span');
                    node.textContent = 'ok';
                    return node;
                },
            },
        });
        s3.open();

        expect(s3.arrow.querySelector('i')!.className).toBe('bi bi-chevron-down');
        const check = document.querySelector('.s3__option .s3__check')!;
        expect(check.tagName).toBe('SPAN');
        expect(check.textContent).toBe('ok');
        expect(svgIn(s3.clear)).not.toBeNull();
    });

    it('reads the icon set from data-icons', () => {
        const select = document.createElement('select');
        select.add(new Option('A', 'a'));
        select.dataset.icons = 'fontawesome';
        document.body.appendChild(select);
        const s3 = createSelect3(select);

        expect(s3.arrow.querySelector('i')!.className).toBe('fa-solid fa-chevron-down');
    });

    it('keeps option data-icon classes as they are', () => {
        const select = document.createElement('select');
        const option = new Option('Australia', 'au');
        option.dataset.icon = 'fi fi-au';
        select.add(option);
        document.body.appendChild(select);
        const s3 = createSelect3(select);
        s3.open();

        expect(document.querySelector('.s3__option i.fi.fi-au')).not.toBeNull();
    });
});
