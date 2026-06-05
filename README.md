# @ozankurt/select3

Modern, dependency-free `<select>` enhancer. No jQuery, no runtime dependencies.
A from-scratch successor to Select2 / Tom Select / SumoSelect that progressively
enhances a native `<select>` while keeping it as the single source of truth.

## Features

- Single and multiple selection (reads `<select>` / `<select multiple>`)
- Scoring search with diacritic folding
- Tagging (create options on the fly, deduped by folded label)
- AJAX remote options with request cancellation and a render cap
- Optgroup support
- Full WAI-ARIA combobox semantics and keyboard navigation
- Clearable, with a guard so required single selects cannot be emptied
- Themeable via plain CSS variables

## Install

```bash
npm install @ozankurt/select3
```

## Usage

```js
import { createSelect3 } from '@ozankurt/select3';
import '@ozankurt/select3/css';

const instance = createSelect3(document.querySelector('select'), {
    placeholder: 'Pick a city…',
});

// later
instance.destroy();
```

The original `<select>` stays in the DOM and in sync, so normal form submission
and validation keep working.

## Options

Pass options as the second argument, or set the `data-*` equivalents on the
element (the data attribute wins where both exist).

| Option        | Data attribute     | Default                   | Description                                        |
| ------------- | ------------------ | ------------------------- | -------------------------------------------------- |
| `placeholder` | `data-placeholder` | `"Select…"`               | Empty-state text.                                  |
| `allowClear`  | —                  | `true`                    | Show a clear control (hidden for required single). |
| `tags`        | `data-tags`        | `false`                   | Allow creating new options by typing.              |
| `searchable`  | —                  | `true`                    | Show the search field.                             |
| `ajax`        | `data-ajax`        | `null`                    | URL to fetch remote options from.                  |
| `minChars`    | —                  | `1` ajax / `0`            | Minimum query length before searching.             |
| `maxRender`   | —                  | `100`                     | Cap on rendered options (rest behind a hint).      |
| `noResults`   | —                  | `"No results"`            | Empty-results message.                             |
| `loadingText` | —                  | `"Searching…"`            | Shown while an AJAX request is in flight.          |
| `createText`  | —                  | `` q => `Create “${q}”` `` | Label for the "create tag" row.                   |
| `moreText`    | —                  | function                  | Label for the overflow hint.                       |

### AJAX

The endpoint receives the query as `?q=` and must return JSON shaped as:

```json
[{ "value": "ams", "label": "Amsterdam" }]
```

In-flight requests are aborted when the query changes, and responses are
discarded if they arrive after the dropdown closes or a newer request was sent.

## API

```js
import createSelect3, { Select3, VERSION } from '@ozankurt/select3';

const s3 = createSelect3(el, options); // create (returns the instance)
s3.open();          // open the dropdown
s3.close();         // close it
s3.choose(value);   // select an option by value
s3.createTag(label);// create (or reuse) a tag, when tags are enabled
s3.sync();          // re-render from the native <select>
s3.destroy();       // unbind, restore the original <select>
```

## Accessibility

The focused search input carries the `combobox` role with
`aria-expanded` / `aria-controls` / `aria-activedescendant`; the listbox and its
options are fully labelled, and an accessible name is resolved from the
associated `<label>` (or the select's `aria-label`). Arrow keys move the active
option (skipping disabled rows), Enter selects, Escape closes.

## License

MIT © Ozan Kurt
