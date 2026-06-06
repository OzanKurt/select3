# @ozankurt/select3

Modern, dependency-free `<select>` enhancer. No jQuery, no runtime dependencies.
A from-scratch successor to Select2 / Tom Select / SumoSelect that progressively
enhances a native `<select>` while keeping it as the single source of truth.

Written in TypeScript, shipped as tree-shakeable ESM with full type definitions.

## Features

- Single and multiple selection (reads `<select>` / `<select multiple>`)
- Relevance-scoring search with diacritic folding, multi-field search, and match highlighting
- Tagging: create options on the fly, `tokenSeparators`, `createFilter`, `persist`, `addPrecedence`
- AJAX remote options: request cancellation, caching, debounce, infinite-scroll pagination, `preload`
- SumoSelect UX: Select-All (with indeterminate), Clear-All, OK/Cancel staging, "N selected" caption, checkbox options
- Multi-level optgroups, `maxItems`, `closeOnSelect`, `openOnFocus`, `selectOnTab`, lock/disable
- Events bus (`on`/`once`/`off`) + a rich imperative methods API
- Template slots and rich per-option data (icon / image / description / badge)
- Localization: shipped language packs + global and per-instance overrides
- Theming via CSS custom properties, a `classNames` map, theme presets, RTL, and size variants
- Positioning that flips/shifts, plus **modal compatibility** (Bootstrap 4/5/6 + Tailwind/Alpine)
- Virtual scrolling for very large lists; native OS-picker fallback on mobile
- Plugins (drag-drop reorder, CSV output, optgroup columns) + a plugin host for your own
- Framework adapters for React, Vue, and Alpine
- Full WAI-ARIA combobox semantics and keyboard navigation

## Install

```bash
npm install @ozankurt/select3
```

## Usage

```js
import { createSelect3 } from '@ozankurt/select3';
import '@ozankurt/select3/css';

const s3 = createSelect3(document.querySelector('select'), { placeholder: 'Pick a city…' });
// later: s3.destroy();
```

The original `<select>` stays in the DOM and in sync, so form submission and
validation keep working. Options can be set as the second argument or via
`data-*` attributes (`data-placeholder`, `data-tags`, `data-ajax`).

## Events

```js
const off = s3.on('change', ({ value }) => console.log(value));
s3.on('select', ({ value }) => {});
s3.on('open', () => {});      // also: close, deselect, clear, type, optionAdd, optionRemove
off(); // unsubscribe
```

## Methods

`open` `close` `toggle` · `choose(v)` `deselect(v)` `clearAll` `selectAll` ·
`getValue` `setValue(v)` · `addOption(o)` `addOptions([])` `removeOption(v)` `getOption(v)` `clearOptions` ·
`enable` `disable` `lock` `unlock` `isFull` · `focus` `blur` `sync` `refresh` `destroy` ·
tagging: `createTag(label)` · OK/Cancel: `confirm` `cancel`.

## Rich option data + templates

Per-option data flows from `data-*`, array objects, or AJAX rows and renders by default:

```html
<option value="au" data-icon="fi fi-au" data-description="Oceania" data-badge="Popular">Australia</option>
```

Override any slot (string → safe text, Node → inserted as-is; never innerHTML):

```js
createSelect3(el, {
  templates: {
    option: (item, { escape }) => { const n = document.createElement('span'); n.textContent = item.label; return n; },
    noResults: (q) => `No match for “${q}”`,
    caption: (n, total) => `${n} of ${total}`,
  },
});
```

## Localization

```js
import { setLocale } from '@ozankurt/select3';
import { tr } from '@ozankurt/select3/i18n/tr';   // en, es, fr, de, tr ship

setLocale(tr);                                     // global default
createSelect3(el, { locale: tr });                 // or per-instance (wins)
```

## Theming & style

- CSS variables (`--color-*`, `--select3-dropdown-z`) — override on `.s3` or a parent.
- `classNames: { wrap, control, dropdown, option, tag, search }` to inject your own classes.
- Presets: `import '@ozankurt/select3/themes/bootstrap5'` or `/themes/tailwind`.
- `size: 'sm' | 'md' | 'lg'`, and `rtl: true` (auto-detected from `[dir=rtl]`).

## Modal compatibility

Works inside Bootstrap 4/5/6 modals and Tailwind/Alpine (`x-trap`) modals. By
default (`appendTo: 'auto'`) the dropdown is portaled into the nearest modal
ancestor so focus traps don't steal the search box and `overflow:hidden` can't
clip it. Override with `appendTo: 'body' | element` / `dropdownParent`.

## AJAX

Endpoint receives `?q=` (and `?page=` for pagination); return
`[{ value, label }]` or `{ results, hasMore }` (map other shapes via
`processResults`). In-flight requests abort on change; responses are cached and
discarded if stale.

## Virtual scroll & native mobile

```js
createSelect3(el, { virtualScroll: true, itemHeight: 36 }); // smooth at 100k+ options
createSelect3(el, { nativeOnMobile: 'auto' });              // OS picker on touch devices (default)
```

## Plugins

```js
import { registerPlugin } from '@ozankurt/select3';
import '@ozankurt/select3/plugins/drag-drop';        // self-registers 'drag-drop'
import '@ozankurt/select3/plugins/drag-drop.css';

createSelect3(el, { multiple: true, plugins: ['drag-drop', { name: 'csv-output', options: { separator: ';' } }] });
```

Built-ins: `drag-drop` (reorder tags), `csv-output` (mirror to a hidden CSV input),
`optgroup-columns` (grid layout). Write your own: a factory
`(instance, options?) => ({ destroy?() })`.

## Framework adapters

```jsx
import Select3React from '@ozankurt/select3/react';
import { useSelect3, Select3Vue } from '@ozankurt/select3/vue';
import select3Plugin from '@ozankurt/select3/alpine'; // Alpine.plugin(select3Plugin)
```

React / Vue / Alpine are optional peer dependencies.

## Accessibility

The focused search input is the `combobox` (`aria-expanded` / `aria-controls` /
`aria-activedescendant`); the listbox and options are labelled and an accessible
name is resolved from the `<label>` (or `aria-label`). Arrow keys move the active
option (skipping disabled rows), Enter selects, Escape closes.

## License

MIT © Ozan Kurt
