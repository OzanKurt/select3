import { defineConfig } from 'tsup';

export default defineConfig({
    entry: {
        index: 'src/index.ts',
        'i18n/en': 'src/i18n/en.ts',
        'i18n/es': 'src/i18n/es.ts',
        'i18n/fr': 'src/i18n/fr.ts',
        'i18n/de': 'src/i18n/de.ts',
        'i18n/tr': 'src/i18n/tr.ts',
        'plugins/drag-drop': 'src/plugins/drag-drop.ts',
        'plugins/csv-output': 'src/plugins/csv-output.ts',
        'plugins/optgroup-columns': 'src/plugins/optgroup-columns.ts',
    },
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2021',
});
