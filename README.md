# @ozankurt/select3

[![npm](https://img.shields.io/npm/v/@ozankurt/select3.svg)](https://www.npmjs.com/package/@ozankurt/select3)
[![types](https://img.shields.io/npm/types/@ozankurt/select3.svg)](https://www.npmjs.com/package/@ozankurt/select3)
[![license](https://img.shields.io/npm/l/@ozankurt/select3.svg)](./LICENSE)
[![no deps](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#)

Modern, **dependency-free** `<select>` enhancer. No jQuery, no runtime dependencies.
A from-scratch successor to Select2 / Tom Select / SumoSelect that progressively
enhances a native `<select>` while keeping it as the single source of truth — so
form submission, validation, and reset all keep working.

Written in **TypeScript**, shipped as tree-shakeable **ESM** with full type
definitions. Works with any bundler (Vite, webpack, Rollup, esbuild).

```js
import { createSelect3 } from '@ozankurt/select3';
import '@ozankurt/select3/css';

const s3 = createSelect3(document.querySelector('select'), {
  placeholder: 'Pick a city…',
  fuzzy: true,
  tags: true,
});
```

## Why select3

| | Select2 | Tom Select | SumoSelect | **select3** |
|---|---|---|---|---|
| Dependencies | jQuery | none | jQuery | **none** |
| TypeScript / ESM | no | yes | no | **yes** |
| Fuzzy search | no | partial | no | **yes** |
| Virtual scroll | no | plugin | no | **built-in** |
| Select-All / OK-Cancel | no | no | yes | **yes** |
| AJAX + pagination | yes | yes | no | **yes** |
| Rich options (icon/image) | templates | templates | no | **built-in + templates** |
| WAI-ARIA combobox | broken | basic | none | **full** |
| Framework adapters | jQuery | vanilla | jQuery | **React / Vue / Alpine** |

---

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Options reference](#options-reference)
- [Search](#search) · [Tagging](#tagging) · [AJAX](#ajax)
- [Rich option data & templates](#rich-option-data--templates)
- [Multi-select UX](#multi-select-ux)
- [Theming & styling](#theming--styling)
- [Modal compatibility](#modal-compatibility)
- [Virtual scroll & native mobile](#virtual-scroll--native-mobile)
- [Events](#events) · [Methods](#methods)
- [Localization](#localization)
- [Plugins](#plugins) · [Framework adapters](#framework-adapters)
- [Accessibility](#accessibility)

---

## Install

```bash
npm install @ozankurt/select3
```

```js
import createSelect3 from '@ozankurt/select3';
import '@ozankurt/select3/css';
```

## Quick start

```js
const s3 = createSelect3(document.querySelector('select'), { placeholder: 'Pick a city…' });
// later
s3.destroy();
```

The native `<select>` stays in the DOM and in sync. Configure via the options
argument **or** `data-*` attributes on the element (the data attribute wins):

```html
<select data-select3 data-placeholder="Pick a city…" data-tags data-ajax="/cities">
  <option value="ams">Amsterdam</option>
</select>
```

Per-`<option>` rich data: `data-icon`, `data-image`, `data-description`, `data-badge`
(and any `data-*` you want to make searchable via `searchField`).

---

## Options reference

All options are optional. Pass them as the second argument to `createSelect3(el, options)`.

### Core

| Option | Type | Default | Description |
|---|---|---|---|
| `placeholder` | `string` | locale | Empty-state text (`data-placeholder`). |
| `allowClear` | `boolean` | `true` | Show the clear (×) control. Suppressed for a required single-select. |
| `searchable` | `boolean` | `true` | Show the search input. |
| `closeOnSelect` | `boolean` | `!multiple` | Close the dropdown after a pick. |
| `openOnFocus` | `boolean` | `false` | Open when the control gains focus. |
| `hidePlaceholder` | `boolean` | `false` | Hide the placeholder while open. |
| `maxItems` | `number \| null` | `null` | Cap selections in multi-select. |
| `selectOnTab` | `boolean` | `false` | Tab selects the active option. |

### Search

| Option | Type | Default | Description |
|---|---|---|---|
| `searchField` | `string[]` | `['label']` | Fields to match (`'label'`, `'group'`, or any `data-*` key). |
| `fuzzy` | `boolean` | `false` | Also match an in-order subsequence (typo/abbreviation tolerant). |
| `searchGroups` | `boolean` | `false` | Include the optgroup label in the haystack. |
| `sort` | `boolean \| (a,b) => number` | `true` | Rank by relevance, keep original order (`false`), or a custom comparator. |
| `highlight` | `boolean` | `true` | Wrap matched text in `<mark>`. |
| `minResultsForSearch` | `number` | `0` | Hide the search box below N options. |
| `maxInputLength` | `number` | `0` | Max chars in the search input (0 = no limit). |
| `maxRender` | `number` | `100` | Cap rendered rows (see `virtualScroll` for huge lists). |

### Tagging

| Option | Type | Default | Description |
|---|---|---|---|
| `tags` | `boolean` | `false` | Allow creating options by typing (`data-tags`). |
| `tokenSeparators` | `string[]` | `[]` | Auto-create a tag when one of these is typed/pasted. |
| `createFilter` | `RegExp \| string \| (s) => boolean` | — | Validate a new tag before creating it. |
| `persist` | `boolean` | `true` | Keep created options after deselect. |
| `addPrecedence` | `boolean` | `false` | Enter creates the tag instead of picking a match. |
| `createText` | `(q) => string` | locale | Label for the "create" row. |
| `create` | `(label) => option \| null \| false \| Promise<…>` | — | Custom/async tag creation (e.g. persist server-side, then select). |

### Data / AJAX

| Option | Type | Default | Description |
|---|---|---|---|
| `ajax` | `string \| null` | `null` | Remote endpoint (`data-ajax`). |
| `minChars` | `number` | `1` ajax / `0` | Chars before searching. |
| `debounce` | `number` | `250` | Debounce (ms) for remote search. |
| `preload` | `boolean \| 'focus'` | `false` | Load page 1 on init or first focus. |
| `queryParam` / `pageParam` | `string` | `'q'` / `'page'` | Request param names. |
| `processResults` | `(raw, page) => {results, hasMore}` | default | Map any server shape. |
| `transport` | `(url, {signal}) => Promise` | `fetch` | Swap the network layer. |
| `cacheTTL` | `number` | `0` | ms before cached results are served stale and revalidated (SWR). 0 = forever. |

### Multi-select UX

| Option | Type | Default | Description |
|---|---|---|---|
| `selectAll` | `boolean` | `false` | Select-All / Clear-All header (with indeterminate). |
| `checkboxes` | `boolean` | `false` | Checkbox affordance per option. |
| `okCancel` | `boolean` | `false` | Stage edits; commit on OK, revert on Cancel. |
| `clickAway` | `'commit' \| 'revert'` | `'commit'` | OK/Cancel behaviour on outside click. |
| `csvDispCount` | `number` | `0` | Collapse tags into an "N selected" caption past N. |
| `captionFormat` / `captionFormatAllSelected` | `(n[, total]) => string` | locale | Caption text. |
| `captionPrefix` | `string` | `''` | Text prepended to the caption. |

### Display, theming & behaviour

| Option | Type | Default | Description |
|---|---|---|---|
| `templates` | `Select3Templates` | `{}` | Custom render slots (see below). |
| `theme` | `string \| null` | `null` | Apply a preset: `'bootstrap4'`, `'bootstrap5'`, `'tailwind'`. |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Control density. |
| `rtl` | `boolean` | auto | Right-to-left (auto-detected from `[dir=rtl]`). |
| `classNames` | `{ wrap, control, dropdown, listbox, option, tag, search }` | `{}` | Inject your own classes. |
| `appendTo` | `'auto' \| 'self' \| 'body' \| HTMLElement` | `'auto'` | Dropdown parent (see [modals](#modal-compatibility)). |
| `dropdownGap` / `dropdownZ` | `number` | `4` / `1100` | Gap + z-index of the portaled dropdown. |
| `virtualScroll` | `boolean` | `false` | Window large lists. |
| `itemHeight` | `number` | `36` | Row height for virtual scroll. |
| `tree` | `boolean` | `false` | Hierarchical mode (options linked by `data-parent`). |
| `treeIndent` | `number` | `18` | Indent (px) per tree level. |
| `nativeOnMobile` | `boolean \| 'auto'` | `'auto'` | Use the OS picker on touch devices. |
| `recent` | `boolean \| { key?, max? }` | — | Float recently-chosen values to the top (localStorage-backed). |
| `showCount` / `countText` | `boolean` / `(n) => string` | `false` | Result-count footer row. |
| `i18n` / `locale` | `Partial<Locale>` | — | Per-instance translations. |
| `plugins` | `(string \| factory \| {name, options})[]` | `[]` | Attach plugins. |

---

## Search

```js
createSelect3(el, {
  fuzzy: true,                      // "amtrdm" matches "Amsterdam"
  searchGroups: true,              // also match the optgroup label
  searchField: ['label', 'iso'],  // match label + a data-iso attribute
});
```

**Independent display vs search:** point `searchField` at `data-*` fields and the
visible label is never matched — show `AU`, search `Australia`:

```html
<option value="au" data-search="Australia">AU</option>
```
```js
createSelect3(el, { searchField: ['search'] });
```

## Tagging

```js
createSelect3(el, {
  tags: true,
  tokenSeparators: [',', ' '],     // typing/pasting splits into tags
  createFilter: /^[\w.+-]+@[\w-]+\.\w+$/, // only valid emails
  persist: false,                  // drop created tags on deselect
});
```

## AJAX

The endpoint receives `?q=` (and `?page=` for pagination) and returns either a
bare array or `{ results, hasMore }`:

```json
[{ "value": "ams", "label": "Amsterdam", "icon": "fi fi-nl", "group": "Europe" }]
```

Requests are debounced, de-duplicated, cached, and aborted when superseded.
Remote rows may carry `icon` / `image` / `description` / `badge` (rendered on the
option) and a `group` (placed into the matching `<optgroup>`). Map any other
server shape with `processResults`.

## Rich option data & templates

Icons/images/descriptions/badges render by default from `data-*` (or array/AJAX
fields) — no template needed:

```html
<option value="au" data-icon="fi fi-au" data-description="Oceania" data-badge="Popular">Australia</option>
```

Override any slot. Return a **string** (inserted as safe text) or a **DOM Node**
(inserted as-is). select3 never uses `innerHTML`.

```js
createSelect3(el, {
  templates: {
    option: (item, { escape }) => { const n = document.createElement('span'); n.textContent = item.label; return n; },
    item: (item) => `★ ${item.label}`,
    optgroupHeader: (group) => group.toUpperCase(),
    noResults: (q) => `No match for “${q}”`,
    caption: (n, total) => `${n} of ${total}`,
    create: (q) => `Add “${q}”`,
    loading: () => 'Searching…',
    loadingMore: () => 'Loading more…',
  },
});
```

## Multi-select UX

```js
createSelect3(el, {
  selectAll: true,        // Select-All / Clear-All with indeterminate state
  checkboxes: true,       // checkbox per option
  okCancel: true,         // stage edits, commit on OK
  csvDispCount: 3,        // show 3 tags, then "N selected"
  maxItems: 5,
});
```

## Tree / hierarchical select

Link options with `data-parent` (the parent option's value) and select3 renders a
collapsible tree. In multi-select, checking a branch toggles all its descendant
leaves (partial selection = indeterminate); a search reveals matching leaves with
their ancestors. Arrow Right/Left expand/collapse the focused branch.

```html
<select multiple data-select3>
  <option value="electronics">Electronics</option>
  <option value="phones" data-parent="electronics">Phones</option>
  <option value="iphone" data-parent="phones">iPhone</option>
  <option value="pixel" data-parent="phones">Pixel</option>
  <option value="clothing">Clothing</option>
  <option value="shirt" data-parent="clothing">Shirt</option>
</select>
```
```js
createSelect3(el, { tree: true });
```

The native `<select>` stays flat (leaves are the form value); the hierarchy is
reconstructed from `data-parent`.

## Theming & styling

- **CSS variables** — override `--color-*` (and `--select3-dropdown-z`) on `.s3` or any ancestor.
- **`classNames`** — inject your own classes on each part.
- **Theme presets** — load one CSS file, then opt in per instance:

```js
import '@ozankurt/select3/themes/bootstrap5'; // or bootstrap4, tailwind
createSelect3(el, { theme: 'bootstrap5' });    // adds .s3--theme-bootstrap5
```

- **`size`** (`sm`/`md`/`lg`) and **`rtl`** (auto from `[dir=rtl]`).

## Modal compatibility

Works inside **Bootstrap 4/5/6** modals and **Tailwind/Alpine** (`x-trap`) modals.
With the default `appendTo: 'auto'` the dropdown is portaled into the nearest modal
ancestor, so focus traps don't steal the search box and `overflow:hidden` can't
clip it. Override with `appendTo: 'body' | element` or `dropdownParent`.

## Virtual scroll & native mobile

```js
createSelect3(el, { virtualScroll: true, itemHeight: 36 }); // smooth at 100k+ options
createSelect3(el, { nativeOnMobile: 'auto' });              // OS picker on touch (default)
```

## Events

`instance.on(event, handler)` returns an unsubscribe function; `once` and `off`
are also available. The native `<select>` still fires `change` for forms.

| Event | Payload | Fires when |
|---|---|---|
| `change` | `{ value }` | Selection committed |
| `select` / `deselect` | `{ value }` | An option is (de)selected |
| `clear` | — | Cleared |
| `open` / `close` | — | Dropdown toggled |
| `type` | `{ query }` | User typed in the search box |
| `optionAdd` / `optionRemove` | `{ value }` | Option set changed |
| `okCancel:ok` / `okCancel:cancel` | — | OK/Cancel staging resolved |
| `destroy` | — | Instance torn down |

Cancelable `beforeOpen` / `beforeSelect` / `beforeClear` receive a `preventDefault`.

## Methods

```ts
open() · close() · toggle()
choose(value) · deselect(value) · clearAll() · selectAll()
getValue(): string | string[] · setValue(value)
addOption({value,label,selected?,disabled?}) · addOptions([...]) · removeOption(value) · getOption(value) · clearOptions()
enable() · disable() · lock() · unlock() · isFull()
createTag(label) · confirm() · cancel()         // tagging · OK-Cancel
focus() · blur() · sync() · refresh() · destroy()
on(event, fn) · once(event, fn) · off(event, fn?)
```

## Localization

```js
import { setLocale } from '@ozankurt/select3';
import { tr } from '@ozankurt/select3/i18n/tr';   // ships en, es, fr, de, tr

setLocale(tr);                       // global default
createSelect3(el, { locale: tr });   // per-instance (wins)
```

Every user-facing string is translatable via the `Locale` interface.

## Plugins

```js
import { registerPlugin } from '@ozankurt/select3';
import '@ozankurt/select3/plugins/drag-drop';
import '@ozankurt/select3/plugins/drag-drop.css';

createSelect3(el, {
  multiple: true,
  plugins: ['drag-drop', { name: 'csv-output', options: { separator: ';' } }],
});
```

Built-ins: **`drag-drop`** (reorder tags), **`csv-output`** (mirror to a hidden
comma-joined input), **`optgroup-columns`** (grid layout). Write your own — a
factory `(instance, options?) => ({ destroy?() })` using the public API/events.

## Framework adapters

React / Vue / Alpine are optional peer dependencies; each is a subpath export.

```jsx
import Select3React from '@ozankurt/select3/react';
import { useSelect3, Select3Vue } from '@ozankurt/select3/vue';
import select3Plugin from '@ozankurt/select3/alpine'; // Alpine.plugin(select3Plugin)
```

## Accessibility

The focused search input is the `combobox` (`aria-expanded` / `aria-controls` /
`aria-activedescendant`); the listbox and options are labelled, and the accessible
name resolves from the associated `<label>` (or `aria-label`). Keyboard: arrows
move the active option (skipping disabled rows), Enter selects, Escape closes,
Backspace removes the last tag, `Ctrl+A` selects all (multi).

## License

MIT © Ozan Kurt
