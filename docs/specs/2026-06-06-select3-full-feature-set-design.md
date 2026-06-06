# Select3 — Full Feature Set Design

- Date: 2026-06-06
- Status: Approved (design); pending implementation plan
- Scope: Bring `@ozankurt/select3` to full feature parity with Select2 + Tom Select + SumoSelect, plus first-class localization, style customization, and modal compatibility.

---

## 1. Goals

1. Implement every **behavioral** feature in the `select3-plan.md` "Select3 Target" column.
2. Implement the **infrastructure** tier: TypeScript rewrite with type defs, DOM virtual scrolling, native-mobile fallback, shipped i18n packs, and framework adapters (React / Vue / Alpine / vanilla).
3. **Localization**: pluggable language packs + global and per-instance overrides, every user-facing string translatable, locale-aware counts.
4. **Style customization**: CSS custom properties, a `classNames` injection map, and shipped theme presets.
5. **Modal compatibility**: dropdown works correctly inside Bootstrap 4/5/6 modals and Tailwind/Alpine (`x-trap`) modals — no clipping, no focus-trap fights.
6. Stay **zero runtime dependencies**. Keep the public API backward compatible with v0.1.0.

## 2. Non-goals

- Bootstrap CSS framework coupling (we ship optional theme presets, not a hard dependency).
- A jQuery adapter (the point is to replace jQuery).
- SSR rendering of the enhanced widget (progressive enhancement on the client only; native `<select>` is the SSR surface).
- Server pagination protocol beyond a documented JSON shape (consumers map via `processResults`).

---

## 3. Architecture

### 3.1 Language & build

- **TypeScript**, compiled with **tsup** (esbuild) to ESM + `.d.ts` into `dist/`.
- Zero runtime deps. `devDependencies`: `typescript`, `tsup`.
- `package.json` exports map points at `dist/`; `sideEffects` limited to CSS.
- A `prepublishOnly` build guarantees `dist/` ships. Source stays in `src/`.

### 3.2 Module layout

```
src/
  index.ts                 # public entry: createSelect3, Select3, VERSION, setLocale, registerPlugin
  core/
    Select3.ts             # orchestrator class (thin; delegates to modules)
    state.ts               # selection + UI state, staging buffer for OK/Cancel
    options.ts             # config resolution (defaults + data-* + ctor opts)
    emitter.ts             # on/off/once/emit event bus
  data/
    model.ts               # Item/Optgroup normalized model
    dom-adapter.ts         # read/write the native <select> (source of truth)
    array-adapter.ts       # options passed via config
    ajax-adapter.ts        # remote: debounce, cache, pagination, abort, transport
  search/
    sifter.ts              # scoring engine (multi-field, prefix/token weighting)
    diacritics.ts          # fold (NFD + \p{Diacritic})
    highlight.ts           # mark matched substrings (safe nodes)
  render/
    dropdown.ts            # listbox, groups, messages, checkbox rows, create row
    control.ts             # control, tags, single value, caption, clear, arrow
    position.ts            # flip/shift positioner + portal/appendTo (modal compat)
    virtual.ts             # windowed rendering for large lists
    templates.ts           # default template slots + escape
  a11y/
    aria.ts                # roles/relationships/live region
    keyboard.ts            # key map (incl. select-all shortcuts, caret nav)
  i18n/
    types.ts               # Locale interface
    en.ts ...              # shipped packs
  plugins/
    index.ts               # hook registry + built-ins (drag-drop, csv-output, optgroup-columns)
  themes/
    select3.css            # default (CSS custom properties)
    bootstrap5.css         # preset
    tailwind.css           # preset
  frameworks/
    react.tsx  vue.ts  alpine.ts
```

The current single `select3.js` is decomposed into the above. Each module has one purpose and a typed interface so it is testable in isolation.

### 3.3 Public API surface (backward compatible)

```ts
// unchanged from 0.1.0
createSelect3(el, options?) => Select3
export { Select3 }; export const VERSION; export default createSelect3;

// new top-level
export function setLocale(locale: Partial<Locale>): void;   // global default
export function registerPlugin(name: string, factory: PluginFactory): void;
```

`createSelect3` keeps returning the instance and remains idempotent (`el._s3`). All existing methods (`open/close/choose/deselect/clearAll/createTag/sync/refresh/destroy`) keep their signatures.

### 3.4 State model

```
CLOSED → OPENING → OPEN → CLOSING → CLOSED
                    ↕
        SEARCHING / LOADING / CONFIRMING (OK-Cancel staging)
```

Selection state lives in `state.ts`. In OK/Cancel mode, edits write to a **staging buffer**; commit on OK applies to the native `<select>` and emits one change; Cancel discards the buffer. In normal mode, edits apply immediately (current behavior).

### 3.5 Data flow

```
config + data-* ─▶ options.ts
native <select> ─▶ dom-adapter ─┐
config.options ─▶ array-adapter ─┼─▶ model ─▶ sifter (client) ─▶ virtual ─▶ render
remote (ajax)  ─▶ ajax-adapter ─┘                 (server search bypasses sifter)
            selection state ◀────── user actions (click/keyboard) ──────┘
```

---

## 4. Feature specifications

### 4.1 Core selection
Single, multi, required (aria-required + non-emptiable single), disabled, locked (selectable display, no edits). `duplicates` allows the same value twice in multi (tag mode).

### 4.2 Behaviors (config flags)
`closeOnSelect` (default: true single / false multi), `openOnFocus`, `selectOnTab`, `hidePlaceholder`, `clearAfterSelect`, `maxItems` (+ `isFull()`, disables further selection and shows a localized "max reached" hint), `scrollToSelectedOnOpen`.

### 4.3 Search
- `sifter.ts`: relevance scoring — exact > prefix > token-prefix > substring; multi-field via `searchField: string[]` (reads `data-*` on options or array fields); `sortField`; tie-break by original order.
- `highlight.ts`: wraps matches in `<mark>` using text nodes (no innerHTML).
- Diacritic folding retained. `minChars` (alias `minimumInputLength`), `minResultsForSearch` (hide search box under N options), `maxInputLength`.
- Server mode (ajax) bypasses the client matcher.

### 4.4 Tagging
`tags`, `createTag(label)` (dedupe by folded label — current behavior), `tokenSeparators: string[]` (auto-create on delimiter/paste), `createFilter` (RegExp | string | fn), `persist` (keep created items after deselect), `addPrecedence` (Enter picks "create" over first match).

### 4.5 Data sources & AJAX
- DOM options + `options` array + remote.
- `ajax-adapter`: configurable `debounce` (default 250ms), `cache` (Map keyed by query+page), `AbortController` (current), `processResults(raw, page) => {results, hasMore}`, custom `transport(url, opts)`, `preload` (`true` | `'focus'`).
- **Pagination / infinite scroll**: scroll-near-bottom triggers next page; appends; localized loading-more / no-more rows. Built-in, not a plugin.

### 4.6 SumoSelect UX (multi)
- **Select-All** row with indeterminate (partial) state; respects `maxItems` and disabled/locked options.
- **Clear-All** row.
- **OK/Cancel** staging mode (`okCancel: true`): footer with localized OK/Cancel; `clickAway: 'commit' | 'revert'`.
- **Caption**: `csvDispCount` (show names up to N, then "N selected"), `captionFormat` / `captionFormatAllSelected`, `prefix`. Replaces the all-tags display when configured.
- **Checkbox options** (`checkboxes: true`): render a checkbox affordance per option in multi.

### 4.7 Templating
Slot map `templates`/`render`: `option`, `item`, `optgroupHeader`, `optgroup`, `noResults`, `loading`, `loadingMore`, `noMoreResults`, `create`, `caption`, `dropdown`. Each receives `(data, { escape })`. Returning a string is escaped; returning a `Node` is inserted as-is (consumer owns safety). Default templates live in `templates.ts`.

### 4.8 Optgroups
Multi-level nesting (indentation + nested headers). Built-in `optgroup-columns` plugin for column layout.

### 4.9 Positioning & modal compatibility
- `position.ts`: compute available space, **flip** up/down, **shift** to stay in viewport; reposition on scroll/resize (rAF-batched); strategy `absolute` (default, in-flow parent) or `fixed` (when portaled).
- `appendTo: 'self' | 'body' | HTMLElement`; `dropdownParent` alias.
- **Auto modal detection**: if not explicitly set, walk ancestors for `.modal, [role="dialog"], [x-trap], .fixed[x-data]`; if found, portal the dropdown **into that element** so the modal's focus trap treats the search input as inside the modal. This fixes:
  - **Bootstrap 4** (`$.modal` `enforceFocus`) and **Bootstrap 5/6** (`FocusTrap` on `focusin`) yanking focus back.
  - **Tailwind/Alpine** modals using `@alpinejs/focus` `x-trap`.
- Clipping solved by portaling out of `overflow:hidden` ancestors when `appendTo` is `body`/element, with `fixed` positioning.
- `--select3-dropdown-z` (default high) layers above overlays. Closes on ancestor scroll only when portaled to body (configurable).

### 4.10 Virtual scrolling
`virtual.ts`: when matches exceed a threshold, render only the visible window + buffer using spacer elements; preserves keyboard nav + aria-activedescendant by mapping index→element on demand. Handles 100k+ options. `maxRender` remains as a simpler cap for non-virtual mode / small lists.

### 4.11 Native-mobile fallback
`nativeOnMobile` (default: feature-detect coarse pointer + small viewport): keep the native `<select>` interactive (show the OS picker) and skip the custom dropdown, while still styling the control. Opt-out via config.

### 4.12 Events API
`emitter.ts`: `on/off/once/emit`. Events: `initialize`, `change`, `open`, `close`, `select`, `deselect`, `clear`, `optionAdd`, `optionRemove`, `type`, `load`, `loadMore`, `okCancel:ok`, `okCancel:cancel`, `destroy`. Preventable variants (`beforeOpen`, `beforeSelect`, `beforeClear`) via a cancelable payload. Native `change` on the `<select>` still fires for form/back-compat.

### 4.13 Methods API
Existing + : `addOption`, `addOptions`, `updateOption`, `removeOption`, `getOption`, `clearOptions`, `refreshOptions`, `addItem`, `removeItem`, `setValue`, `getValue`, `enable`, `disable`, `lock`, `unlock`, `isFull`, `clearCache`, `load`, `focus`, `blur`, `setLocale` (instance), `positionDropdown`.

### 4.14 i18n
`Locale` interface with all strings (placeholder, noResults, loading, loadingMore, noMoreResults, create, more, selectAll, clearAll, ok, cancel, maxReached, nSelected(count,total)). Shipped packs `en, es, fr, de, tr` (extensible) via `@ozankurt/select3/i18n/<code>`. Global `setLocale()`; per-instance `i18n`/`locale` wins. Counts via `Intl.NumberFormat`. RTL pairs with locale but is independent (`dir`).

### 4.15 Theming & style customization
- CSS custom properties (`--select3-*`) with fallbacks to host `--color-*`.
- `classNames` option: `{ wrap, control, dropdown, option, tag, search, ... }` merged onto defaults.
- Theme presets: `@ozankurt/select3/css` (default), `/themes/bootstrap5`, `/themes/tailwind`.
- Density/size (`size: 'sm'|'md'|'lg'`) + radius vars. `[dir="rtl"]` styles.

### 4.16 Plugin / hook system
`registerPlugin(name, factory)`. Factory gets the instance + lifecycle hooks (`before/after/around` on named methods) and render hooks. Built-ins: `drag-drop` (reorder multi tags; no external dep — pointer events), `csv-output` (mirror value to a single comma-joined hidden input; `csvSepChar`), `optgroup-columns`.

### 4.17 Framework adapters
- `frameworks/vanilla` = `createSelect3` (already).
- `react.tsx`: `<Select3 value onChange options ...>` wrapper managing lifecycle + controlled value.
- `vue.ts`: composable/component with `v-model`.
- `alpine.ts`: `Alpine.directive('select3', ...)` magic for `x-select3`.
- Each is a separate subpath export so tree-shaking keeps vanilla lean.

### 4.18 Accessibility
WAI-ARIA 1.2 combobox: search input `role=combobox` + `aria-expanded/controls/activedescendant` (current); listbox + options labelled; live region for load/no-results; full keyboard map incl. `Ctrl+A`/`Ctrl+Shift+A` (select/deselect all in multi), caret nav between tags, Home/End, type-ahead.

---

## 5. Testing strategy

- **Vitest + jsdom** unit specs per module: sifter scoring, diacritics, fold/dedupe, state + staging (OK/Cancel), emitter, ajax-adapter (mock fetch: debounce/cache/pagination/abort), tagging (tokenSeparators/createFilter/persist), caption formatting, i18n resolution, classNames merge.
- **Positioning/modal**: jsdom can't layout, so positioner math is unit-tested with injected rects; real modal focus-trap behavior is covered by **app integration** (Playwright) in `new/` against BS5-like and Alpine `x-trap` modals.
- **App integration**: existing `new/` Vitest specs extended; Playwright smoke for modal + virtual scroll + select-all.
- **A11y**: assert roles/relationships and keyboard flows in jsdom.
- Backward-compat: existing `new/tests/js/select3.spec.js` must stay green.

## 6. Packaging & versioning

- Decompose to `dist/` build; `exports`: `.`, `./css`, `./themes/*`, `./i18n/*`, `./react`, `./vue`, `./alpine`.
- Public API additions are non-breaking; the internal rewrite is a **minor** bump to **0.2.0** (pre-1.0 allows internal churn) unless we choose 1.0.0 at the end.
- Consuming app `new/` repointed to the new version; its imports (`@ozankurt/select3`, `/css`) unchanged.

## 7. Phasing

- **P0 — Scaffold**: TS + tsup build, dist exports, move current code to `src/core` + modules behind the same API, keep tests green. Establish CI-able `npm run build` + `npm test` (Vitest at package level).
- **P1 — Core split + Events + Methods**: emitter, full methods API, behavior flags (closeOnSelect/openOnFocus/selectOnTab/maxItems/duplicates/hidePlaceholder).
- **P2 — Search**: sifter scoring + multi-field + highlight; minResultsForSearch; maxInputLength.
- **P3 — Positioning & modal-compat**: position.ts (flip/shift), appendTo/dropdownParent, auto modal detection + portal, fixed strategy, z-index var. App Playwright modal tests.
- **P4 — Data/AJAX**: ajax-adapter (cache, pagination/infinite scroll, configurable debounce, processResults, transport, preload).
- **P5 — SumoSelect UX**: select-all/indeterminate, clear-all, OK/Cancel staging + clickAway, caption (csvDispCount/captionFormat), checkbox options.
- **P6 — Templating + i18n + RTL + themes + style customization**: template slots, locale packs + setLocale, classNames, theme presets, size/density, RTL.
- **P7 — Tagging extras**: tokenSeparators, createFilter, persist, addPrecedence.
- **P8 — Virtual scroll + native-mobile fallback**.
- **P9 — Plugins**: hook registry + drag-drop, csv-output, optgroup-columns.
- **P10 — Framework adapters**: react, vue, alpine.
- **P11 — Docs + demo + review**: README/API docs, a `/forms` showcase in `new/`, full adversarial review, version bump + publish, repoint app.

Each phase: implement → Vitest → keep prior phases green → commit (conventional, no AI attribution).

## 8. Risks / mitigations

- **TS build adds a dist step** → consumers must get built output; mitigate with `prepublishOnly` + verify `dist/` resolves in `new/`.
- **Modal focus traps differ across BS4/5/6 + Alpine** → portal-into-modal strategy is the common fix; cover each in Playwright.
- **Virtual scroll vs aria-activedescendant** → map index→element lazily; test keyboard nav at scale.
- **Scope is large** → strict phasing; every phase independently shippable and green.

## 9. Open questions (resolved defaults)

- Final version: ship phases under `0.2.x`, cut **1.0.0** at P11. (Default: yes.)
- i18n packs to ship first: en, es, fr, de, tr. (Extensible later.)
- Adapters: ship react + vue + alpine; Angular deferred (community). (Default: yes.)
