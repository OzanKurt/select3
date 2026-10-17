import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function opt(label: string, value: string, data: Record<string, string> = {}): HTMLOptionElement {
    const o = new Option(label, value);
    Object.entries(data).forEach(([k, v]) => o.setAttribute(`data-${k}`, v));
    return o;
}

function group(label: string, options: HTMLOptionElement[]): HTMLOptGroupElement {
    const g = document.createElement('optgroup');
    g.label = label;
    options.forEach((o) => g.appendChild(o));
    return g;
}

/** Timezone-shaped fixture: two region groups plus an optional loose option. */
function mount(config = {}, extra: Array<HTMLOptionElement | HTMLOptGroupElement> = []) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    select.append(
        group('Africa', [opt('Abidjan', 'Africa/Abidjan', { meta: '+00:00' }), opt('Cairo', 'Africa/Cairo', { meta: '+03:00' })]),
        group('Europe', [opt('Istanbul', 'Europe/Istanbul', { meta: '+03:00' }), opt('London', 'Europe/London', { meta: '+01:00' })]),
        ...extra,
    );
    document.body.appendChild(select);
    return createSelect3(select, config);
}

const rows = (s: ReturnType<typeof mount>) =>
    [...s.wrap.querySelectorAll('.s3__options > *')].map((n) =>
        n.classList.contains('s3__group') ? `#${n.textContent}` : n.querySelector('.s3__label')?.textContent,
    );

describe('pinned options', () => {
    beforeEach(() => document.body.replaceChildren());

    it('lists a data-pinned option above every group, without a header', () => {
        const s = mount({}, [opt('Same as company (Europe/London)', 'inherit', { pinned: '' })]);
        s.open();
        expect(rows(s)).toEqual([
            'Same as company (Europe/London)',
            '#Africa',
            'Abidjan',
            'Cairo',
            '#Europe',
            'Istanbul',
            'London',
        ]);
        const first = s.wrap.querySelector('.s3__option');
        expect(first?.classList.contains('is-pinned')).toBe(true);
        expect(first?.classList.contains('s3__option--pinned-last')).toBe(true);
    });

    it('pins values from the pinned option in the given order, lifting them out of their group', () => {
        const s = mount({ pinned: ['Europe/London', 'Africa/Cairo'] });
        s.open();
        expect(rows(s)).toEqual(['London', 'Cairo', '#Africa', 'Abidjan', '#Europe', 'Istanbul']);
        const pinnedLast = s.wrap.querySelectorAll('.s3__option--pinned-last');
        expect(pinnedLast).toHaveLength(1);
        expect(pinnedLast[0]?.textContent).toContain('Cairo');
    });

    it('keeps matching pinned options first while searching and hides non-matching ones', () => {
        const s = mount({ pinned: ['Europe/London'] });
        s.open();
        s.search.value = 'ist';
        s.search.dispatchEvent(new Event('input'));
        expect(rows(s)).toEqual(['#Europe', 'Istanbul']);

        s.search.value = 'lon';
        s.search.dispatchEvent(new Event('input'));
        expect(rows(s)).toEqual(['London']);
    });

    it('ignores data-pinned="false"', () => {
        const s = mount({}, [opt('Loose', 'loose', { pinned: 'false' })]);
        s.open();
        expect(s.wrap.querySelector('.is-pinned')).toBeNull();
    });

    it('works with virtual scroll', () => {
        const s = mount({ pinned: ['Europe/London'], virtualScroll: true });
        s.open();
        expect(rows(s).filter(Boolean).slice(0, 3)).toEqual(['London', '#Africa', 'Abidjan']);
    });
});

describe('meta text', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders data-meta as trailing secondary text', () => {
        const s = mount();
        s.open();
        expect(s.wrap.querySelector('.s3__option .s3__meta')?.textContent).toBe('+00:00');
    });

    it('matches extra fields like the offset via searchField', () => {
        const s = mount({ searchField: ['label', 'meta'] });
        s.open();
        s.search.value = '+03:00';
        s.search.dispatchEvent(new Event('input'));
        expect(rows(s)).toEqual(['#Africa', 'Cairo', '#Europe', 'Istanbul']);
    });
});
