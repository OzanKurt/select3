# @ozankurt/select3

Modern, dependency-free `<select>` replacement — the successor to Select2 / Tom Select / SumoSelect.

This package is developed as a standalone module and linked into the SmartAdmin
rebuild app (`../new`) via a local `file:` dependency, so it can later be
extracted to its own repo / Satis without touching consumers.

- **Feature spec:** [`../../select3-plan.md`](../../select3-plan.md)
- **Consumed in the app via:** the Blade `<x-form.select>` component
- **Status:** skeleton. Core (single/multi, scoring search, DOM/array/AJAX
  adapters, WAI-ARIA combobox) lands first; virtual scroll, Select-All / OK-Cancel
  UX, plugins, i18n and RTL follow.

```js
import { createSelect3 } from '@ozankurt/select3';

const instance = createSelect3(document.querySelector('select'));
// instance.destroy();
```
