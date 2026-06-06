# Select3 P0 — Scaffold (TypeScript + build + self-tests) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `@ozankurt/select3` from a single hand-shipped JS file into a TypeScript package that builds to `dist/` (ESM + `.d.ts`) and tests itself with Vitest, while keeping the public API and the consuming app green.

**Architecture:** Introduce a `tsup` (esbuild) build and a package-level Vitest suite. Port the existing `select3.js` to `src/core/Select3.ts` with explicit types and a thin `src/index.ts`. The fine-grained module split (search/render/data/…) happens in later phases; P0 only establishes the toolchain, types, build output, and test harness. The native `<select>` stays the source of truth and the public API (`createSelect3`, `Select3`, `VERSION`, default) is unchanged.

**Tech Stack:** TypeScript 5, tsup, Vitest + jsdom, ESM.

**Phase roadmap:** This plan is P0 of the design in `docs/specs/2026-06-06-select3-full-feature-set-design.md` §7. P1–P11 each get their own plan authored when reached (interfaces firm up per phase). Every phase stays independently shippable and green.

---

## File Structure

- `packages/select3/package.json` — exports → `dist/`, `build`/`test` scripts, `prepublishOnly`, devDeps.
- `packages/select3/tsconfig.json` — TS config (strict, ESNext, DOM lib).
- `packages/select3/tsup.config.ts` — build: entry `src/index.ts`, format esm, dts, sourcemap.
- `packages/select3/vitest.config.ts` — jsdom env, include `tests/**/*.spec.ts`, setup stub.
- `packages/select3/tests/setup.ts` — jsdom `scrollIntoView` stub.
- `packages/select3/src/index.ts` — public entry (was `src/index.js`).
- `packages/select3/src/core/Select3.ts` — the class, typed (was `src/select3.js`).
- `packages/select3/src/types.ts` — `Select3Options`, `Select3Config`, `Item` types.
- `packages/select3/src/select3.css` — unchanged (moves only if needed; stays at `src/select3.css`).
- `packages/select3/tests/select3.spec.ts` — ported from `new/tests/js/select3.spec.js`.
- `packages/select3/.gitignore` — add `dist/`, `node_modules/`.
- `new/package.json` — repoint dependency to `file:../packages/select3` for the dev loop.

---

## Task 1: Repoint the app to the local package for development

**Files:**
- Modify: `new/package.json` (dependency line)

- [ ] **Step 1: Edit the dependency**

In `new/package.json` change:
```json
"@ozankurt/select3": "^0.1.0",
```
to:
```json
"@ozankurt/select3": "file:../packages/select3",
```

- [ ] **Step 2: Reinstall the link**

Run: `cd new && npm install`
Expected: `npm ls @ozankurt/select3` shows `@ozankurt/select3@0.1.0 -> ./../packages/select3`

- [ ] **Step 3: Verify the app still builds and JS tests pass**

Run: `cd new && npm run build && npm run test:js`
Expected: build succeeds; `Tests 11 passed (11)` (consumes `src/index.js` still — dist not built yet).

- [ ] **Step 4: Commit (in the new/ repo)**

```bash
cd new && git add package.json package-lock.json
git commit -m "chore(deps): link select3 locally for development"
```

---

## Task 2: Add the TypeScript toolchain and build

**Files:**
- Create: `packages/select3/tsconfig.json`
- Create: `packages/select3/tsup.config.ts`
- Modify: `packages/select3/package.json`
- Modify: `packages/select3/.gitignore`

- [ ] **Step 1: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "strict": true,
    "declaration": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "types": []
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Write `tsup.config.ts`**

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2021',
});
```

- [ ] **Step 3: Update `package.json`** (scripts, exports, files, devDeps)

Set:
```json
"main": "./dist/index.js",
"module": "./dist/index.js",
"types": "./dist/index.d.ts",
"exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./css": "./src/select3.css"
},
"files": ["dist", "src/select3.css", "README.md"],
"scripts": {
    "build": "tsup",
    "test": "vitest run",
    "prepublishOnly": "npm run build"
},
"devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "^5.5.0",
    "vitest": "^4.0.0",
    "jsdom": "^25.0.0"
}
```

- [ ] **Step 4: Add build artifacts to `.gitignore`**

Append to `packages/select3/.gitignore`:
```
node_modules/
dist/
```

- [ ] **Step 5: Install dev deps**

Run: `cd packages/select3 && npm install`
Expected: installs tsup, typescript, vitest, jsdom; `found 0 vulnerabilities`.

- [ ] **Step 6: Commit**

```bash
cd packages/select3 && git add tsconfig.json tsup.config.ts package.json package-lock.json .gitignore
git commit -m "build: add TypeScript + tsup toolchain"
```

---

## Task 3: Add types and port the entry to TypeScript

**Files:**
- Create: `packages/select3/src/types.ts`
- Create: `packages/select3/src/core/Select3.ts` (port of `src/select3.js`)
- Create: `packages/select3/src/index.ts` (replaces `src/index.js`)
- Delete: `packages/select3/src/select3.js`, `packages/select3/src/index.js`

- [ ] **Step 1: Write `src/types.ts`**

```ts
export interface Select3Options {
    placeholder?: string;
    allowClear?: boolean;
    tags?: boolean;
    searchable?: boolean;
    noResults?: string;
    createText?: (q: string) => string;
    ajax?: string | null;
    minChars?: number;
    maxRender?: number;
    loadingText?: string;
    moreText?: (n: number) => string;
}

export type Select3Config = Required<Omit<Select3Options, 'ajax'>> & { ajax: string | null };

export interface Item {
    value: string;
    label: string;
    selected: boolean;
    disabled: boolean;
    placeholder: boolean;
    group: string | null;
}
```

- [ ] **Step 2: Port `select3.js` to `src/core/Select3.ts`**

Copy the current `src/select3.js` content verbatim into `src/core/Select3.ts`, then apply ONLY these typing changes (logic unchanged):
- Add at top: `import type { Select3Options, Select3Config, Item } from '../types';`
- Class fields declared with types, e.g.:
```ts
export class Select3 {
    select: HTMLSelectElement;
    multiple: boolean;
    config: Select3Config;
    uid: string;
    isOpen = false;
    activeIndex = 0;
    matches: Item[] = [];
    remoteValues: string[] = [];
    private _debounce: ReturnType<typeof setTimeout> | null = null;
    private _abort: AbortController | null = null;
    private _remoteToken = 0;
    private _onDocClick: (e: MouseEvent) => void;
    private _labelId: string | null = null;
    private _ariaLabel: string | null;
    private _ariaRequired = false;
    // visual nodes
    wrap!: HTMLDivElement; control!: HTMLDivElement; display!: HTMLDivElement;
    clear!: HTMLButtonElement; arrow!: HTMLSpanElement; dropdown!: HTMLDivElement;
    search!: HTMLInputElement; listbox!: HTMLDivElement;
    constructor(select: HTMLSelectElement, options: Select3Options = {}) { /* unchanged body */ }
    // ...all methods unchanged, with param/return types added: _items(): Item[], choose(value: string), etc.
}
```
- The `el`/`iconEl`/`fold` helpers get param/return types: `(tag: string, className?: string) => HTMLElement`, `(s: string) => string`.
- `createSelect3(select: HTMLSelectElement, options: Select3Options = {}): Select3` — body unchanged; the `select._s3` marker uses an augmented type:
```ts
declare global {
    interface HTMLSelectElement { _s3?: Select3; }
}
```

- [ ] **Step 3: Write `src/index.ts`**

```ts
/**
 * @ozankurt/select3 — dependency-free <select> enhancer.
 * See docs/specs for the roadmap.
 */
import createSelect3, { Select3 } from './core/Select3';
import type { Select3Options, Select3Config, Item } from './types';

export const VERSION = '0.2.0';
export { Select3, createSelect3 };
export type { Select3Options, Select3Config, Item };
export default createSelect3;
```

- [ ] **Step 4: Delete the old JS files**

Run: `cd packages/select3 && git rm src/select3.js src/index.js`

- [ ] **Step 5: Type-check + build**

Run: `cd packages/select3 && npx tsc --noEmit && npm run build`
Expected: no type errors; `dist/index.js` and `dist/index.d.ts` emitted.

- [ ] **Step 6: Commit**

```bash
cd packages/select3 && git add -A
git commit -m "refactor: port to TypeScript (typed core + entry)"
```

---

## Task 4: Add the package-level Vitest suite

**Files:**
- Create: `packages/select3/vitest.config.ts`
- Create: `packages/select3/tests/setup.ts`
- Create: `packages/select3/tests/select3.spec.ts`

- [ ] **Step 1: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.spec.ts'],
        setupFiles: ['tests/setup.ts'],
        globals: true,
    },
});
```

- [ ] **Step 2: Write `tests/setup.ts`**

```ts
// jsdom lacks layout APIs our code calls.
if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = function scrollIntoView() {};
}
```

- [ ] **Step 3: Write `tests/select3.spec.ts`** (port of the app's spec, importing from `src`)

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src/index';

function mountSelect({ multiple = false, tags = false, cities = ['Amsterdam', 'Athens', 'Berlin'] } = {}) {
    const select = document.createElement('select');
    if (multiple) select.multiple = true;
    if (tags) select.setAttribute('data-tags', '');
    select.add(new Option('', ''));
    cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
    document.body.appendChild(select);
    const instance = createSelect3(select);
    return { select, instance };
}

describe('Select3 client-side filtering', () => {
    beforeEach(() => document.body.replaceChildren());

    it('renders all non-placeholder options when opened', () => {
        const { instance } = mountSelect();
        instance.open();
        expect(instance.wrap.querySelectorAll('.s3__option')).toHaveLength(3);
    });

    it('filters by the search query (diacritic-folded)', () => {
        const { instance } = mountSelect();
        instance.open();
        instance.search.value = 'ams';
        instance.search.dispatchEvent(new Event('input'));
        const labels = [...instance.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent!.trim());
        expect(labels).toEqual(['Amsterdam']);
    });

    it('selecting an option updates the native <select>', () => {
        const { select, instance } = mountSelect();
        instance.choose('berlin');
        expect(select.value).toBe('berlin');
    });
});

describe('Select3 tag creation', () => {
    beforeEach(() => document.body.replaceChildren());

    it('creates a new option from a typed value', () => {
        const { select, instance } = mountSelect({ tags: true });
        instance.createTag('Cairo');
        expect([...select.options].map((o) => o.value)).toContain('Cairo');
        expect(select.value).toBe('Cairo');
    });

    it('reuses an existing option (folded label) instead of duplicating', () => {
        const { select, instance } = mountSelect({ tags: true });
        const before = select.options.length;
        instance.createTag('Berlin');
        instance.createTag('Berlin');
        expect([...select.options].filter((o) => o.value === 'berlin').length).toBe(1);
        expect(select.value).toBe('berlin');
        expect(select.options.length).toBe(before);
    });
});
```

- [ ] **Step 4: Run the package tests**

Run: `cd packages/select3 && npm test`
Expected: `Tests 5 passed (5)`.

- [ ] **Step 5: Commit**

```bash
cd packages/select3 && git add vitest.config.ts tests/
git commit -m "test: add package-level Vitest suite"
```

---

## Task 5: Verify the consuming app against the built package

**Files:**
- Modify: `new/package.json` (rebuild link to pick up dist + exports)

- [ ] **Step 1: Reinstall + rebuild the app**

Run: `cd new && npm install && npm run build`
Expected: Vite build succeeds resolving `@ozankurt/select3` → `dist/index.js`.

- [ ] **Step 2: Run app JS tests**

Run: `cd new && npm run test:js`
Expected: `Tests 11 passed (11)`.

- [ ] **Step 3: Run app PHP tests (unaffected, sanity)**

Run: `cd new && php artisan test`
Expected: all green (77 passed).

- [ ] **Step 4: Commit any app lockfile change**

```bash
cd new && git add package-lock.json
git commit -m "chore(deps): resolve select3 via its built dist"
```

---

## Self-Review

- **Spec coverage (P0 only):** TS rewrite toolchain (Task 2–3), dist exports (Task 2–3), package self-tests (Task 4), API unchanged (Task 3 keeps signatures + `index.ts` exports), app stays green (Task 1, 5). Later phases tracked in spec §7.
- **Placeholder scan:** none — every step has concrete content/commands.
- **Type consistency:** `Select3Options`/`Select3Config`/`Item` defined in `types.ts` (Task 3) and consumed in `core/Select3.ts` + `index.ts`; `VERSION` bumped to `0.2.0` consistently; `_s3` marker augmented once.
- **Note:** `VERSION` becomes `0.2.0` here but is not published until P11; the app consumes via `file:` link during development.
