/**
 * optgroup-columns — lay out the dropdown's option groups in a multi-column grid.
 *
 * On init it tags the wrap with `s3--cols` (which the shipped CSS turns into a
 * CSS grid on `.s3__options`) and writes the desired column count into the
 * `--s3-cols` custom property on the listbox. Group headers (`.s3__group`) are
 * made to span every column purely via the sibling stylesheet, so this factory
 * only manages the class + the inline variable and removes both on teardown.
 */
import type { Select3 } from '../core/Select3';
import type { PluginFactory } from '../types';
import { registerPlugin } from './registry';

export const optgroupColumns: PluginFactory = (instance: Select3, options) => {
    const raw = options?.['columns'];
    // Default to 2 columns; ignore non-positive / non-finite inputs.
    const columns = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 2;

    instance.wrap.classList.add('s3--cols');
    instance.listbox.style.setProperty('--s3-cols', String(columns));

    return {
        destroy() {
            instance.wrap.classList.remove('s3--cols');
            instance.listbox.style.removeProperty('--s3-cols');
        },
    };
};

registerPlugin('optgroup-columns', optgroupColumns);

export default optgroupColumns;
