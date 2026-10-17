/**
 * The README's images, captured from examples/showcase.html.
 *
 * Run with `npm run screenshots`. Starts the examples server through Vite's
 * Node API, opens one select per shot with Playwright (typing into its search
 * box where the shot needs it) and writes PNGs into docs/images/, clipped to
 * that field and its open dropdown. Fixed viewport, deviceScaleFactor 2,
 * reduced motion and animations disabled, and every wait is a condition.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const outDir = resolve(root, 'docs/images');
const VIEWPORT = { width: 1000, height: 1000 };
const PAD = 16;

const SHOTS = [
    { file: 'fuzzy-search.png', field: 'office', type: 'rtdm', scheme: 'light' },
    { file: 'multi-select.png', field: 'reviewers', scheme: 'light' },
    { file: 'pinned-groups.png', field: 'timezone', scheme: 'light' },
    { file: 'tagging.png', field: 'labels', type: 'design-system', scheme: 'light' },
    { file: 'dark.png', field: 'reviewers', scheme: 'dark' },
];

const server = await createServer({ configFile: resolve(root, 'vite.examples.config.js'), logLevel: 'warn' });
await server.listen();
const base = server.resolvedUrls.local[0].replace(/\/$/, '');

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 2, reducedMotion: 'reduce' });
const page = await context.newPage();

mkdirSync(outDir, { recursive: true });

try {
    for (const shot of SHOTS) {
        await page.emulateMedia({ colorScheme: shot.scheme, reducedMotion: 'reduce' });
        await page.goto(`${base}/showcase.html?scheme=${shot.scheme}`, { waitUntil: 'load' });
        await page.locator('body[data-ready="true"]').waitFor();

        await page.evaluate((field) => window.showcase[field].open(), shot.field);
        const dropdown = page.locator('.s3__dropdown:visible');
        await dropdown.waitFor();

        if (shot.type) {
            await dropdown.locator('input').fill(shot.type);
            await page.waitForFunction(() => document.querySelector('.s3__dropdown .s3__option, .s3__dropdown .s3__create') !== null);
        }

        // Move the pointer away so no row shows a hover state.
        await page.mouse.move(0, 0);

        const boxes = [await page.locator(`#field-${shot.field}`).boundingBox(), await dropdown.boundingBox()];
        const x = Math.min(...boxes.map((b) => b.x)) - PAD;
        const y = Math.min(...boxes.map((b) => b.y)) - PAD;
        const right = Math.max(...boxes.map((b) => b.x + b.width)) + PAD;
        const bottom = Math.max(...boxes.map((b) => b.y + b.height)) + PAD;

        const png = await page.screenshot({ clip: { x, y, width: right - x, height: bottom - y }, animations: 'disabled', caret: 'hide' });
        writeFileSync(resolve(outDir, shot.file), png);
        console.log(`${shot.file.padEnd(20)} ${(png.length / 1024).toFixed(1)} KB`);
    }
} finally {
    await browser.close();
    await server.close();
}
