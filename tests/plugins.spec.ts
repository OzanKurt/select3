import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSelect3, registerPlugin } from '../src';

function mount(config = {}) {
    const select = document.createElement('select');
    select.add(new Option('A', 'a'));
    document.body.appendChild(select);
    return createSelect3(select, config);
}

describe('plugin host', () => {
    beforeEach(() => document.body.replaceChildren());

    it('runs an inline plugin factory with the instance', () => {
        const seen: unknown[] = [];
        const s3 = mount({ plugins: [(inst: unknown) => void seen.push(inst)] });
        expect(seen[0]).toBe(s3);
    });

    it('resolves a registered plugin by name with options', () => {
        let received: unknown;
        registerPlugin('demo-opts', (_inst, o) => void (received = o));
        mount({ plugins: [{ name: 'demo-opts', options: { x: 1 } }] });
        expect(received).toEqual({ x: 1 });
    });

    it('ignores an unknown plugin name without throwing', () => {
        expect(() => mount({ plugins: ['does-not-exist'] })).not.toThrow();
    });

    it('calls plugin.destroy() when the instance is destroyed', () => {
        const destroy = vi.fn();
        const s3 = mount({ plugins: [() => ({ destroy })] });
        s3.destroy();
        expect(destroy).toHaveBeenCalledOnce();
    });
});
