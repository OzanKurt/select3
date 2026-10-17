import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// Serves examples/ with the package aliased at its sources, so changes show on reload.
export default defineConfig({
    root: resolve(import.meta.dirname, 'examples'),
    resolve: {
        alias: {
            '@ozankurt/select3/css': resolve(import.meta.dirname, 'src/select3.css'),
            '@ozankurt/select3': resolve(import.meta.dirname, 'src/index.ts'),
        },
    },
    server: { port: 5184, strictPort: true },
});
