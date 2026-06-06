# P0 — TypeScript Scaffold & Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert `@ozankurt/select3` to a TypeScript package with a tsup build and a package-level Vitest suite, keeping behavior and the public API identical to v0.1.0.

**Architecture:** Migrate `src/*.js` to typed TypeScript under `src/` (light decomposition into `types.ts`, `util.ts`, `core/Select3.ts`, `index.ts`). Build with tsup → `dist/` (ESM + `.d.ts`). Ship `dist/` + the CSS. Add a self-contained Vitest suite so select3 develops independently of the consuming app.

**Tech Stack:** TypeScript, tsup (esbuild), Vitest + jsdom. Zero runtime deps.

---

### Task 1: Build & test toolchain

**Files:**
- Create: `tsconfig.json`
- Create: `tsup.config.ts`
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: tsconfig.json** — strict, ESNext, DOM libs, no emit (tsup emits).

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "declaration": true,
    "emitDeclarationOnly": false,
    "noEmit": true,
    "skipLibCheck": true,
    "verbatimModuleSyntax": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 2: tsup.config.ts** — bundle `src/index.ts` to ESM + dts; copy CSS to dist.

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  publicDir: false,
  onSuccess: 'node -e "require(\'fs\').copyFileSync(\'src/select3.css\',\'dist/select3.css\')"',
});
```

- [ ] **Step 3: vitest.config.ts** — jsdom + setup for scrollIntoView.

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.{test,spec}.ts'],
    setupFiles: ['tests/setup.ts'],
    globals: true,
  },
});
```

- [ ] **Step 4: package.json** — exports→dist, build/test scripts, devDeps, files.

```json
{
  "name": "@ozankurt/select3",
  "version": "0.2.0",
  "description": "Modern, dependency-free <select> enhancer: single/multi, scoring search, tagging, AJAX and a WAI-ARIA combobox. The successor to Select2 / Tom Select / SumoSelect.",
  "type": "module",
  "main": "./dist/index.js",
  "module": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" },
    "./css": "./dist/select3.css"
  },
  "files": ["dist", "README.md"],
  "sideEffects": ["*.css"],
  "scripts": {
    "build": "tsup",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "prepublishOnly": "npm run build"
  },
  "devDependencies": {
    "jsdom": "^25.0.0",
    "tsup": "^8.0.0",
    "typescript": "^5.6.0",
    "vitest": "^4.0.0"
  },
  "keywords": ["select","select2","tom-select","combobox","dropdown","autocomplete","tagging","multiselect","accessibility","aria","vanilla-js","no-jquery"],
  "repository": { "type": "git", "url": "git+https://github.com/OzanKurt/select3.git" },
  "homepage": "https://github.com/OzanKurt/select3#readme",
  "bugs": { "url": "https://github.com/OzanKurt/select3/issues" },
  "license": "MIT",
  "author": "Ozan Kurt"
}
```

- [ ] **Step 5: Install + commit.**

```bash
npm install
git add package.json package-lock.json tsconfig.json tsup.config.ts vitest.config.ts
git commit -m "build: add typescript + tsup + vitest toolchain"
```

---

### Task 2: Extract types & utils (TypeScript)

**Files:**
- Create: `src/types.ts`
- Create: `src/util.ts`
- Test: `tests/util.spec.ts`

- [ ] **Step 1: `tests/setup.ts`** — stub layout APIs jsdom lacks.

```ts
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}
```

- [ ] **Step 2: Failing test for `fold` + `el`.**

```ts
import { describe, expect, it } from 'vitest';
import { fold, el } from '../src/util';

describe('util', () => {
  it('folds case + diacritics', () => {
    expect(fold('Ámsterdam')).toBe('amsterdam');
    expect(fold('  CAFÉ ')).toBe(' café '.trimStart() ? 'cafe ' : 'cafe ');
  });
  it('creates an element with a class', () => {
    const node = el('div', 's3__x');
    expect(node.tagName).toBe('DIV');
    expect(node.className).toBe('s3__x');
  });
});
```

- [ ] **Step 3: Run — expect FAIL (module missing).**

Run: `npm test -- tests/util.spec.ts`
Expected: FAIL (cannot find `../src/util`).

- [ ] **Step 4: `src/types.ts`** — config + item model.

```ts
export interface Select3Item {
  value: string;
  label: string;
  selected: boolean;
  disabled: boolean;
  placeholder: boolean;
  group: string | null;
}

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
```

- [ ] **Step 5: `src/util.ts`** — typed helpers (moved from select3.js).

```ts
let uid = 0;
export const nextUid = (): string => `s3-${++uid}`;

export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

export const iconEl = (className: string): HTMLElement => {
  const i = document.createElement('i');
  i.className = className;
  return i;
};

export const fold = (s: string | null | undefined): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
```

- [ ] **Step 6: Run — expect PASS.**

Run: `npm test -- tests/util.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit.**

```bash
git add src/types.ts src/util.ts tests/setup.ts tests/util.spec.ts
git commit -m "refactor: extract typed util + types modules"
```

---

### Task 3: Port Select3 class to TypeScript

**Files:**
- Create: `src/core/Select3.ts` (typed port of `src/select3.js`)
- Modify: `src/index.ts` (was `index.js`)
- Delete: `src/select3.js`, `src/index.js`

- [ ] **Step 1: `src/core/Select3.ts`** — move the class verbatim, add types, import `{ el, iconEl, fold, nextUid }` from `../util` and `Select3Item, Select3Options` from `../types`. Replace the local `uid`/`el`/`iconEl`/`fold` with the imports; type fields (`select: HTMLSelectElement`, `config: Required<...>` where practical, `wrap/control/... : HTMLElement`, `matches: Select3Item[]`). Keep every method body and behavior identical. Export `class Select3` and `createSelect3`.

- [ ] **Step 2: `src/index.ts`** — re-export.

```ts
import createSelect3, { Select3 } from './core/Select3';
export const VERSION = '0.2.0';
export { Select3, createSelect3 };
export type { Select3Item, Select3Options } from './types';
export default createSelect3;
```

- [ ] **Step 3: Delete old JS entry files.**

```bash
git rm src/select3.js src/index.js
```

- [ ] **Step 4: Typecheck.**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit.**

```bash
git add src/core/Select3.ts src/index.ts
git commit -m "refactor: port Select3 to typescript"
```

---

### Task 4: Port the behavior suite to the package

**Files:**
- Create: `tests/select3.spec.ts` (port of the app's `new/tests/js/select3.spec.js`, importing from `../src`)

- [ ] **Step 1: Write the suite** — mount helper + the existing cases (renders all, filters diacritic-folded, choose updates native value, tag create, tag reuse-by-folded-label), importing `createSelect3` from `../src`.

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createSelect3 } from '../src';

function mountSelect({ multiple = false, tags = false, cities = ['Amsterdam', 'Athens', 'Berlin'] } = {}) {
  const select = document.createElement('select');
  if (multiple) select.multiple = true;
  if (tags) select.setAttribute('data-tags', '');
  select.add(new Option('', ''));
  cities.forEach((c) => select.add(new Option(c, c.toLowerCase())));
  document.body.appendChild(select);
  return { select, instance: createSelect3(select) };
}

describe('Select3 core', () => {
  beforeEach(() => document.body.replaceChildren());

  it('renders all non-placeholder options when opened', () => {
    const { instance } = mountSelect();
    instance.open();
    expect(instance.wrap.querySelectorAll('.s3__option')).toHaveLength(3);
  });

  it('filters by query (diacritic-folded)', () => {
    const { instance } = mountSelect();
    instance.open();
    instance.search.value = 'ams';
    instance.search.dispatchEvent(new Event('input'));
    const labels = [...instance.wrap.querySelectorAll('.s3__option')].map((o) => o.textContent?.trim());
    expect(labels).toEqual(['Amsterdam']);
  });

  it('choose updates the native value', () => {
    const { select, instance } = mountSelect();
    instance.choose('berlin');
    expect(select.value).toBe('berlin');
  });

  it('creates a tag from typed value', () => {
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
    expect([...select.options].filter((o) => o.value === 'berlin')).toHaveLength(1);
    expect(select.value).toBe('berlin');
    expect(select.options.length).toBe(before);
  });
});
```

- [ ] **Step 2: Run — expect PASS.**

Run: `npm test`
Expected: PASS (util + core specs).

- [ ] **Step 3: Commit.**

```bash
git add tests/select3.spec.ts
git commit -m "test: port behavior suite to the package"
```

---

### Task 5: Build + verify dist resolves

**Files:**
- Create: `.gitignore` (add `dist/`, `node_modules/`) if not present
- Create: `.npmignore` is unnecessary (use `files`)

- [ ] **Step 1: Build.**

Run: `npm run build`
Expected: `dist/index.js`, `dist/index.d.ts`, `dist/select3.css` emitted; no errors.

- [ ] **Step 2: Verify the built entry imports + the named exports exist.**

Run: `node --input-type=module -e "import('./dist/index.js').then(m=>{if(!m.createSelect3||!m.Select3||m.VERSION!=='0.2.0')process.exit(1);console.log('ok',m.VERSION)})"`
Expected: `ok 0.2.0`.

- [ ] **Step 3: Ensure `dist/` is gitignored** (built artifact; shipped via npm `files`, not git).

```
node_modules/
dist/
*.log
```

- [ ] **Step 4: Commit.**

```bash
git add .gitignore
git commit -m "build: ignore dist; ship via npm files"
```

---

## Self-Review

- **Spec coverage (P0):** TS rewrite toolchain ✓ (Task 1), typed modules ✓ (Tasks 2-3), package-level Vitest ✓ (Tasks 2,4), build to dist + exports ✓ (Tasks 1,5), behavior + API unchanged ✓ (Task 3 verbatim port; Task 4 same assertions). Backward-compat public API (`createSelect3/Select3/VERSION/default`) ✓.
- **Placeholders:** none — every step has concrete content/commands.
- **Type consistency:** `Select3Item`/`Select3Options` names match across types.ts, index.ts, Select3.ts, tests. `fold/el/iconEl/nextUid` names match util.ts ↔ Select3.ts.
- **Deferred to later phases (correct):** module split for search/render/data/a11y/i18n (P1-P6), events/methods (P1). P0 intentionally keeps the class monolithic-but-typed; feature phases extract modules as they touch them.

## Notes for execution

- The consuming app currently installs `@ozankurt/select3@^0.1.0` from the registry, so P0 changes do not affect the app until republish (P11). Develop against the package's own Vitest suite.
- CSS export moves to `./dist/select3.css` (copied in build). The app imports `@ozankurt/select3/css`; this keeps working after the eventual republish.
