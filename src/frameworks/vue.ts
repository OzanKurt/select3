/**
 * Select3 for Vue 3 — a thin wrapper around {@link createSelect3}.
 *
 * Two entry points are provided, both peer-importing Vue (never bundling it):
 *
 *  1. {@link useSelect3} — a composable. Pass a template ref to a native
 *     `<select>`; it creates the instance in `onMounted`, destroys it in
 *     `onUnmounted`, and hands back the instance plus a `value` ref kept in
 *     sync via the `change` event.
 *
 *  2. {@link Select3Vue} (default export) — a `v-model`-compatible component
 *     that renders the native `<select>`, its `<option>`s, and the enhanced
 *     widget for you.
 *
 * @example Composable
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { useSelect3 } from '@ozankurt/select3/vue';
 * import '@ozankurt/select3/css';
 *
 * const el = ref<HTMLSelectElement | null>(null);
 * const { value } = useSelect3(el, { placeholder: 'Pick a country' });
 * // `value` tracks the live selection ('' / string / string[]).
 * </script>
 *
 * <template>
 *   <select ref="el">
 *     <option value="">Pick a country</option>
 *     <option value="au">Australia</option>
 *     <option value="nz">New Zealand</option>
 *   </select>
 * </template>
 * ```
 *
 * @example Component with v-model
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import Select3Vue from '@ozankurt/select3/vue';
 * import '@ozankurt/select3/css';
 *
 * const picked = ref<string[]>(['a']);
 * </script>
 *
 * <template>
 *   <Select3Vue
 *     v-model="picked"
 *     multiple
 *     placeholder="Pick some"
 *     :options="[
 *       { value: 'a', label: 'Alpha' },
 *       { value: 'b', label: 'Beta' },
 *       { value: 'c', label: 'Gamma', disabled: true },
 *     ]"
 *   />
 * </template>
 * ```
 */

import { ref, shallowRef, onMounted, onUnmounted, watch, defineComponent, h } from 'vue';
import type { Ref, ShallowRef, PropType } from 'vue';
import createSelect3 from '../core/Select3';
import type { Select3 } from '../core/Select3';
import type { Select3Options } from '../types';

/** A single `<option>` descriptor rendered inside the native `<select>`. */
export interface Select3VueOption {
    value: string;
    label: string;
    disabled?: boolean;
}

/** What {@link useSelect3} returns: the live instance and a synced value ref. */
export interface UseSelect3Return {
    /** The Select3 instance, or `null` until the component is mounted. */
    instance: ShallowRef<Select3 | null>;
    /** Live selection: a string for single-select, an array for multiple. */
    value: Ref<string | string[]>;
}

/** Are two selection values equal? Order-insensitive for arrays. */
const sameValue = (a: string | string[], b: string | string[]): boolean => {
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        const set = new Set(a);
        return b.every((v) => set.has(v));
    }
    return a === b;
};

/**
 * Composable wrapper around {@link createSelect3}.
 *
 * @param elRef    A ref pointing at the native `<select>` to enhance.
 * @param options  Standard {@link Select3Options} (plugins, ajax, templates, …).
 * @returns        `{ instance, value }` — see {@link UseSelect3Return}.
 */
export function useSelect3(
    elRef: Ref<HTMLSelectElement | null>,
    options: Select3Options = {},
): UseSelect3Return {
    const instance = shallowRef<Select3 | null>(null);
    const value = ref<string | string[]>('');

    onMounted(() => {
        const select = elRef.value;
        if (!select) return;
        const created = createSelect3(select, options);
        instance.value = created;
        value.value = created.getValue();
        created.on('change', (detail) => {
            value.value = (detail as { value: string | string[] }).value;
        });
    });

    onUnmounted(() => {
        instance.value?.destroy();
        instance.value = null;
    });

    return { instance, value };
}

/**
 * `v-model`-compatible Select3 component. See the file-level JSDoc for usage.
 *
 * It renders a native `<select>` (the source of truth Select3 enhances) plus
 * its `<option>`s, creates the instance on mount, mirrors `modelValue` into the
 * selection, reports user edits via `update:modelValue`, and cleans up on
 * unmount.
 */
export const Select3Vue = defineComponent({
    name: 'Select3Vue',
    props: {
        /** Bound value: a string for single-select, an array for multiple. */
        modelValue: {
            type: [String, Array] as PropType<string | string[]>,
            default: '',
        },
        /** Options rendered as native `<option>` elements. */
        options: {
            type: Array as PropType<Select3VueOption[]>,
            default: () => [],
        },
        /** Whether the underlying `<select>` allows multiple selection. */
        multiple: {
            type: Boolean,
            default: false,
        },
        /** Placeholder shown when nothing is selected. */
        placeholder: {
            type: String as PropType<string | undefined>,
            default: undefined,
        },
        /** Extra {@link Select3Options} forwarded to the instance. */
        select3Options: {
            type: Object as PropType<Select3Options>,
            default: () => ({}),
        },
    },
    emits: {
        // Typed payload validator; returns true to accept the emit.
        'update:modelValue': (_value: string | string[]): boolean => true,
    },
    setup(props, { emit }) {
        const elRef = shallowRef<HTMLSelectElement | null>(null);
        const instance = shallowRef<Select3 | null>(null);
        // Tracks the value the instance currently reflects, so we can skip
        // echoing a v-model update straight back through `update:modelValue`
        // and avoid redundant setValue() calls that re-render the dropdown.
        let lastValue: string | string[] = props.modelValue;

        onMounted(() => {
            const select = elRef.value;
            if (!select) return;
            const created = createSelect3(select, {
                ...props.select3Options,
                placeholder: props.placeholder,
            });
            instance.value = created;

            // Normalize the initial bound value onto the selection.
            created.setValue(props.modelValue);
            lastValue = created.getValue();

            created.on('change', (detail) => {
                const next = (detail as { value: string | string[] }).value;
                // Skip the echo from a programmatic setValue() (the watch already
                // advanced lastValue before calling it); only emit real edits.
                if (sameValue(next, lastValue)) return;
                lastValue = next;
                emit('update:modelValue', next);
            });
        });

        onUnmounted(() => {
            instance.value?.destroy();
            instance.value = null;
        });

        // Mirror the bound value into the instance, guarding against echoing
        // the value the instance just reported back to us.
        watch(
            () => props.modelValue,
            (next) => {
                const inst = instance.value;
                if (!inst) return;
                if (sameValue(next, lastValue)) return;
                lastValue = next;
                inst.setValue(next);
            },
        );

        // Keep the native <option> set in sync, then refresh the instance so
        // the enhanced UI reflects added/removed options. Re-apply the bound
        // value in case its option was only just added.
        watch(
            () => props.options,
            () => {
                const inst = instance.value;
                if (!inst) return;
                inst.refresh();
                if (!sameValue(inst.getValue(), lastValue)) inst.setValue(lastValue);
            },
            { deep: true },
        );

        return () =>
            h(
                'select',
                {
                    ref: elRef,
                    multiple: props.multiple,
                    'aria-label': props.placeholder,
                },
                props.options.map((opt) =>
                    h(
                        'option',
                        { key: opt.value, value: opt.value, disabled: opt.disabled },
                        opt.label,
                    ),
                ),
            );
    },
});

export default Select3Vue;
