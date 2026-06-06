import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function mount(config = {}) {
    const select = document.createElement('select');
    select.add(new Option('', ''));
    select.add(new Option('A', 'a'));
    select.add(new Option('B', 'b'));
    document.body.appendChild(select);
    return { select, instance: createSelect3(select, config) };
}

describe('native mobile fallback', () => {
    beforeEach(() => document.body.replaceChildren());

    it('keeps the native select interactive and overlaid', () => {
        const { select, instance } = mount({ nativeOnMobile: true });
        expect(instance.wrap.classList.contains('s3--native')).toBe(true);
        expect(select.classList.contains('s3-native-overlay')).toBe(true);
        expect(select.getAttribute('aria-hidden')).toBeNull();
        expect(select.parentElement).toBe(instance.wrap);
    });

    it('does not open the custom dropdown in native mode', () => {
        const { instance } = mount({ nativeOnMobile: true });
        instance.open();
        expect(instance.isOpen).toBe(false);
        expect(instance.wrap.classList.contains('s3--open')).toBe(false);
    });

    it('syncs the control display from a native change', () => {
        const { select, instance } = mount({ nativeOnMobile: true });
        select.value = 'b';
        select.dispatchEvent(new Event('change'));
        expect(instance.wrap.querySelector('.s3__single')?.textContent).toBe('B');
    });

    it('restores the native select on destroy', () => {
        const { select, instance } = mount({ nativeOnMobile: true });
        instance.destroy();
        expect(document.body.contains(select)).toBe(true);
        expect(select.classList.contains('s3-native-overlay')).toBe(false);
        expect(document.querySelector('.s3')).toBeNull();
    });

    it('stays enhanced (non-native) when nativeOnMobile is auto under jsdom', () => {
        expect(mount().instance.wrap.classList.contains('s3--native')).toBe(false);
    });
});
