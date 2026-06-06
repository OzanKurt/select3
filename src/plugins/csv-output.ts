/**
 * csv-output plugin.
 *
 * Mirrors the current selection into a single hidden <input> as a
 * delimiter-joined string, so a backend that wants ONE field (e.g. `tags_csv`)
 * gets a comma-separated value instead of the native `name[]` array.
 *
 * The native <select> keeps submitting its own value; this hidden input is an
 * ADDITIONAL field, kept in sync on init and on every `change`.
 */

import type { Select3 } from '../core/Select3';
import type { PluginFactory } from '../types';
import { registerPlugin } from './registry';

interface CsvOutputOptions {
    /** Hidden input name. Defaults to the select's name + '_csv'. */
    name?: string;
    /** Delimiter joining the values. Defaults to ','. */
    separator?: string;
}

export const csvOutput: PluginFactory = (instance: Select3, options?: Record<string, unknown>) => {
    const opts = (options ?? {}) as CsvOutputOptions;
    const separator = typeof opts.separator === 'string' ? opts.separator : ',';
    const name =
        typeof opts.name === 'string' && opts.name !== ''
            ? opts.name
            : `${instance.select.name}_csv`;

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;

    // Insert right after the native <select> so it sits in the same form.
    instance.select.insertAdjacentElement('afterend', input);

    const write = (): void => {
        const value = instance.getValue();
        input.value = Array.isArray(value) ? value.join(separator) : value;
    };

    write();
    const off = instance.on('change', write);

    return {
        destroy() {
            off();
            input.remove();
        },
    };
};

registerPlugin('csv-output', csvOutput);

export default csvOutput;
