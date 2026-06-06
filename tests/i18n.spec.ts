import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createSelect3, setLocale } from '../src';
import { resolveLocale } from '../src/i18n/registry';
import { en } from '../src/i18n/en';
import { tr } from '../src/i18n/tr';

function mount(opts = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    select.add(new Option('Apple', 'apple'));
    document.body.appendChild(select);
    return createSelect3(select, opts);
}

describe('i18n', () => {
    beforeEach(() => document.body.replaceChildren());
    // Reset the global default so one test can't leak into the next.
    afterEach(() => setLocale(en));

    it('resolves a per-instance locale pack', () => {
        expect(resolveLocale({ locale: tr }).placeholder).toBe('Seçiniz…');
    });

    it('lets per-instance i18n win over the global default', () => {
        setLocale({ placeholder: 'Global' });
        expect(resolveLocale({ i18n: { placeholder: 'Local' } }).placeholder).toBe('Local');
    });

    it('applies the locale placeholder to the rendered control', () => {
        const s3 = mount({ locale: tr });
        expect(s3.wrap.querySelector('.s3__placeholder')?.textContent).toBe('Seçiniz…');
    });

    it('setLocale changes the global default for new instances', () => {
        setLocale(tr);
        const s3 = mount();
        expect(s3.config.noResults).toBe('Sonuç yok');
        expect(s3.config.selectAllText).toBe('Tümünü seç');
    });

    it('keeps explicit options above the locale', () => {
        const s3 = mount({ locale: tr, placeholder: 'Custom' });
        expect(s3.wrap.querySelector('.s3__placeholder')?.textContent).toBe('Custom');
    });
});
