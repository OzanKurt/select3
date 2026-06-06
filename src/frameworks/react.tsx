/**
 * Select3React — a thin, controlled React wrapper around {@link createSelect3}.
 *
 * It renders a real native `<select>` (the source of truth Select3 enhances),
 * creates the instance on mount, mirrors the controlled `value` prop into the
 * instance, and reports user edits back through `onChange`. React is a *peer*
 * dependency: it is imported, never bundled.
 *
 * @example
 * ```tsx
 * import { useState } from 'react';
 * import Select3React from '@ozankurt/select3/react';
 * import '@ozankurt/select3/css';
 *
 * function Example() {
 *   const [value, setValue] = useState<string>('au');
 *   return (
 *     <Select3React
 *       value={value}
 *       onChange={(v) => setValue(v as string)}
 *       placeholder="Pick a country"
 *       options={[
 *         { value: 'au', label: 'Australia' },
 *         { value: 'nz', label: 'New Zealand' },
 *         { value: 'fj', label: 'Fiji', disabled: true },
 *       ]}
 *     />
 *   );
 * }
 * ```
 *
 * @example Multiple selection
 * ```tsx
 * const [tags, setTags] = useState<string[]>(['a']);
 * <Select3React
 *   multiple
 *   value={tags}
 *   onChange={(v) => setTags(v as string[])}
 *   options={[
 *     { value: 'a', label: 'Alpha' },
 *     { value: 'b', label: 'Beta' },
 *   ]}
 * />
 * ```
 */

import { useEffect, useRef } from 'react';
import type { ReactElement } from 'react';
import createSelect3 from '../core/Select3';
import type { Select3 } from '../core/Select3';
import type { Select3Options } from '../types';

/** A single `<option>` descriptor rendered inside the native `<select>`. */
export interface Select3ReactOption {
    value: string;
    label: string;
    disabled?: boolean;
}

/**
 * Props for {@link Select3React}. Component-specific props sit alongside the
 * full {@link Select3Options} bag, which is passed straight through to the
 * underlying instance (plugins, ajax, templates, i18n, etc.).
 */
export type Select3ReactProps = {
    /** Controlled value: a string for single-select, an array for multiple. */
    value?: string | string[];
    /** Options rendered as native `<option>` elements. */
    options?: Select3ReactOption[];
    /** Whether the underlying `<select>` allows multiple selection. */
    multiple?: boolean;
    /** Fired on every committed selection change. */
    onChange?: (value: string | string[]) => void;
    /** Placeholder shown when nothing is selected. */
    placeholder?: string;
} & Select3Options;

/** Are two controlled values equal? Order-insensitive for arrays. */
const sameValue = (a: string | string[], b: string | string[]): boolean => {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        const set = new Set(a);
        return b.every((v) => set.has(v));
    }
    return a === b;
};

/**
 * Controlled Select3 component. See the file-level JSDoc for usage examples.
 */
export default function Select3React(props: Select3ReactProps): ReactElement {
    const {
        value,
        options = [],
        multiple = false,
        onChange,
        placeholder,
        ...select3Options
    } = props;

    const selectRef = useRef<HTMLSelectElement | null>(null);
    const instanceRef = useRef<Select3 | null>(null);
    // Tracks the value currently reflected by the instance so we can both avoid
    // echoing a controlled update straight back through onChange and skip
    // redundant setValue() calls that would re-render the dropdown.
    const lastValueRef = useRef<string | string[] | undefined>(value);
    // Keep the latest onChange without re-running the create/destroy effect.
    const onChangeRef = useRef<Select3ReactProps['onChange']>(onChange);
    onChangeRef.current = onChange;

    // Create the instance once on mount; tear it down on unmount.
    useEffect(() => {
        const select = selectRef.current;
        if (!select) return;

        // `placeholder` is a Select3Options field; forward it (it was pulled out
        // of the rest object only so it can also drive the accessible name).
        const instance = createSelect3(select, { ...select3Options, placeholder });
        instanceRef.current = instance;

        // Apply the initial controlled value (the rendered <option selected>
        // already covers this, but be explicit so arrays/strings normalize).
        if (value !== undefined) {
            instance.setValue(value);
            lastValueRef.current = instance.getValue();
        } else {
            lastValueRef.current = instance.getValue();
        }

        const off = instance.on('change', (detail) => {
            const next = (detail as { value: string | string[] }).value;
            lastValueRef.current = next;
            onChangeRef.current?.(next);
        });

        return () => {
            off();
            instance.destroy();
            instanceRef.current = null;
        };
        // Create/destroy is intentionally mount-scoped. Option and value updates
        // are handled by the dedicated effects below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Mirror the controlled value into the instance when it changes, guarding
    // against echoing the value the instance just reported back to us.
    useEffect(() => {
        const instance = instanceRef.current;
        if (!instance || value === undefined) return;
        const last = lastValueRef.current;
        if (last !== undefined && sameValue(value, last)) return;
        lastValueRef.current = value;
        instance.setValue(value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    // Keep the native <option> set in sync, then refresh the instance so the
    // enhanced UI reflects added/removed options.
    useEffect(() => {
        const instance = instanceRef.current;
        if (!instance) return;
        instance.refresh();
        // Re-apply the controlled value in case the relevant option was just
        // added (selection set on a not-yet-present value is otherwise dropped).
        const current = lastValueRef.current;
        if (current !== undefined && !sameValue(instance.getValue(), current)) {
            instance.setValue(current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [options]);

    return (
        <select ref={selectRef} multiple={multiple} aria-label={placeholder}>
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                </option>
            ))}
        </select>
    );
}
