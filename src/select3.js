/**
 * Select3 — a dependency-free <select> enhancer.
 *
 * Core feature set: single & multi select, type-to-filter search (diacritic
 * folded), tagging (create options), clear, full keyboard control and a
 * WAI-ARIA combobox. The native <select> stays in the DOM as the source of
 * truth and form value, and a `change` event fires on every mutation.
 *
 * Advanced features from select3-plan.md (AJAX, virtual scroll, optgroups,
 * Select-All / OK-Cancel, i18n, RTL) layer on later without changing this API.
 *
 * DOM is built with createElement/textContent only — never innerHTML — so
 * option labels can't inject markup.
 */

let uid = 0;

const el = (tag, className) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
};

const iconEl = (className) => {
    const i = document.createElement('i');
    i.className = className;
    return i;
};

const fold = (s) =>
    (s || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '');

export class Select3 {
    constructor(select, options = {}) {
        this.select = select;
        this.multiple = select.multiple;
        this.config = {
            placeholder: select.dataset.placeholder ?? options.placeholder ?? 'Select…',
            allowClear: options.allowClear ?? true,
            tags: select.hasAttribute('data-tags') || !!options.tags,
            searchable: options.searchable ?? true,
            noResults: options.noResults ?? 'No results',
            createText: options.createText ?? ((q) => `Create “${q}”`),
            ajax: select.dataset.ajax ?? options.ajax ?? null,
            minChars: options.minChars ?? (select.dataset.ajax || options.ajax ? 1 : 0),
            maxRender: options.maxRender ?? 100,
            loadingText: options.loadingText ?? 'Searching…',
            moreText: options.moreText ?? ((n) => `${n} more — refine your search`),
        };
        this.uid = `s3-${++uid}`;
        this.isOpen = false;
        this.activeIndex = 0;
        this.matches = [];
        this.remoteValues = [];
        this._debounce = null;
        this._abort = null;
        this._remoteToken = 0;
        this._onDocClick = (e) => {
            if (!this.wrap.contains(e.target)) this.close();
        };

        // Resolve the native select's accessible name so the visible widgets
        // (control + search) inherit it. Prefer a wiring (aria-labelledby) over
        // copying text so the label stays the single source of truth.
        const label =
            (select.id && document.querySelector(`label[for="${select.id}"]`)) ||
            select.closest('label');
        this._labelId = null;
        this._ariaLabel = select.getAttribute('aria-label');
        if (label) {
            if (!label.id) label.id = `${this.uid}-label`;
            this._labelId = label.id;
        }

        // Required on a hidden field breaks constraint validation; the server
        // validates instead, so surface it via aria only.
        if (select.required) {
            select.required = false;
            this._ariaRequired = true;
        }

        this._build();
        this._bind();
        this.sync();
    }

    _items() {
        return [...this.select.options].map((o) => ({
            value: o.value,
            label: o.textContent.trim(),
            selected: o.selected,
            disabled: o.disabled,
            placeholder: o.value === '',
            group: o.parentElement?.tagName === 'OPTGROUP' ? o.parentElement.label : null,
        }));
    }

    _selected() {
        return this._items().filter((i) => i.selected && !i.placeholder);
    }

    _build() {
        this.select.classList.add('s3-native');
        this.select.tabIndex = -1;
        this.select.setAttribute('aria-hidden', 'true');

        this.wrap = el('div', `s3 ${this.multiple ? 's3--multi' : 's3--single'}`);

        this.control = el('div', 's3__control');
        this.control.tabIndex = this.select.disabled ? -1 : 0;
        // The control opens the listbox but is not the combobox itself; the
        // focused search input carries the combobox semantics (see below).
        this.control.setAttribute('aria-haspopup', 'listbox');
        if (this._ariaRequired) this.control.setAttribute('aria-required', 'true');

        this.display = el('div', 's3__display');
        this.control.append(this.display);

        this.clear = el('button', 's3__clear');
        this.clear.type = 'button';
        this.clear.tabIndex = -1;
        this.clear.setAttribute('aria-label', 'Clear selection');
        this.clear.append(iconEl('fa-solid fa-xmark'));
        this.control.append(this.clear);

        this.arrow = el('span', 's3__arrow');
        this.arrow.append(iconEl('fa-solid fa-chevron-down'));
        this.control.append(this.arrow);

        this.dropdown = el('div', 's3__dropdown');
        const searchWrap = el('div', 's3__search-wrap');
        this.search = el('input', 's3__search');
        this.search.type = 'text';
        // The search input is the focused combobox: it owns the listbox
        // relationship, expanded state and active-descendant pointer.
        this.search.setAttribute('role', 'combobox');
        this.search.setAttribute('aria-autocomplete', 'list');
        this.search.setAttribute('aria-expanded', 'false');
        if (this._ariaRequired) this.search.setAttribute('aria-required', 'true');
        if (!this.config.searchable) searchWrap.style.display = 'none';
        searchWrap.append(this.search);

        this.listbox = el('div', 's3__options');
        this.listbox.id = `${this.uid}-list`;
        this.listbox.setAttribute('role', 'listbox');
        if (this.multiple) this.listbox.setAttribute('aria-multiselectable', 'true');

        this.dropdown.append(searchWrap, this.listbox);
        this.search.setAttribute('aria-controls', this.listbox.id);

        // Accessible name: wire the resolved label to the visible widgets, or
        // copy aria-label when there is no labelable element.
        if (this._labelId) {
            this.control.setAttribute('aria-labelledby', this._labelId);
            this.search.setAttribute('aria-labelledby', this._labelId);
            this.listbox.setAttribute('aria-labelledby', this._labelId);
        } else if (this._ariaLabel) {
            this.control.setAttribute('aria-label', this._ariaLabel);
            this.search.setAttribute('aria-label', this._ariaLabel);
            this.listbox.setAttribute('aria-label', this._ariaLabel);
        }

        this.wrap.append(this.control, this.dropdown);
        this.select.after(this.wrap);
        if (this.select.disabled) this.wrap.classList.add('s3--disabled');
    }

    _bind() {
        this.control.addEventListener('click', () => this.toggle());
        this.control.addEventListener('keydown', (e) => {
            if (!this.isOpen && ['Enter', ' ', 'ArrowDown'].includes(e.key)) {
                e.preventDefault();
                this.open();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });
        this.clear.addEventListener('click', (e) => {
            e.stopPropagation();
            this.clearAll();
        });
        this.search.addEventListener('input', () => {
            this.activeIndex = 0;
            if (this.config.ajax) this._scheduleRemote();
            else this._renderOptions();
        });
        this.search.addEventListener('keydown', (e) => this._onSearchKey(e));
        this.display.addEventListener('click', (e) => {
            const remove = e.target.closest('.s3__tag-remove');
            if (remove) {
                e.stopPropagation();
                this.deselect(remove.dataset.value);
            }
        });
    }

    _onSearchKey(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            this._move(1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this._move(-1);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            this._chooseActive();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
            this.control.focus();
        } else if (e.key === 'Backspace' && this.search.value === '' && this.multiple) {
            const selected = this._selected();
            if (selected.length) this.deselect(selected[selected.length - 1].value);
        }
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        if (this.select.disabled || this.isOpen) return;
        this.isOpen = true;
        this.wrap.classList.add('s3--open');
        this.search.setAttribute('aria-expanded', 'true');
        this.search.value = '';
        this.activeIndex = 0;
        this._renderOptions();
        document.addEventListener('click', this._onDocClick);
        if (this.config.searchable) setTimeout(() => this.search.focus(), 0);
    }

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.wrap.classList.remove('s3--open');
        this.search.setAttribute('aria-expanded', 'false');
        this.search.removeAttribute('aria-activedescendant');
        document.removeEventListener('click', this._onDocClick);
    }

    choose(value) {
        const option = [...this.select.options].find((o) => o.value === value);
        if (!option || option.disabled) return;

        if (this.multiple) {
            option.selected = true;
        } else {
            [...this.select.options].forEach((o) => (o.selected = o.value === value));
        }

        this._emit();
        this.sync();

        if (this.multiple) {
            this.search.value = '';
            this._renderOptions();
            this.search.focus();
        } else {
            this.close();
            this.control.focus();
        }
    }

    deselect(value) {
        const option = [...this.select.options].find((o) => o.value === value);
        if (option) option.selected = false;
        this._emit();
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    clearAll() {
        [...this.select.options].forEach((o) => {
            if (o.value !== '') o.selected = false;
        });
        if (!this.multiple) {
            const placeholder = [...this.select.options].find((o) => o.value === '');
            if (placeholder) placeholder.selected = true;
        }
        this._emit();
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    createTag(label) {
        const text = label.trim();
        if (!text) return;
        // Use the same folded-label key as canCreate so a tag that already
        // exists (case/diacritic-insensitively) reuses that option's value
        // instead of creating a duplicate.
        const folded = fold(text);
        const existing = [...this.select.options].find((o) => fold(o.textContent.trim()) === folded);
        if (existing) {
            this.choose(existing.value);
            return;
        }
        this.select.add(new Option(text, text));
        this.choose(text);
    }

    _emit() {
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    sync() {
        const selected = this._selected();
        this.display.replaceChildren();

        if (!selected.length) {
            this.display.append(this._placeholderEl());
        } else if (this.multiple) {
            selected.forEach((item) => this.display.append(this._tagEl(item)));
        } else {
            const single = el('span', 's3__single');
            single.textContent = selected[0].label;
            this.display.append(single);
        }

        const hasValue = selected.length > 0;
        // A required single-select must never be emptiable client-side, so the
        // clear control is suppressed regardless of allowClear.
        const canClear = this.config.allowClear && !(this._ariaRequired && !this.multiple);
        this.clear.style.display = canClear && hasValue ? '' : 'none';
        this.wrap.classList.toggle('s3--has-value', hasValue);
    }

    _placeholderEl() {
        const span = el('span', 's3__placeholder');
        span.textContent = this.config.placeholder;
        return span;
    }

    _tagEl(item) {
        const tag = el('span', 's3__tag');
        const text = el('span');
        text.textContent = item.label;
        const remove = el('button', 's3__tag-remove');
        remove.type = 'button';
        remove.dataset.value = item.value;
        remove.setAttribute('aria-label', `Remove ${item.label}`);
        remove.append(iconEl('fa-solid fa-xmark'));
        tag.append(text, remove);
        return tag;
    }

    /** Debounced remote search (AJAX mode). */
    _scheduleRemote() {
        clearTimeout(this._debounce);
        if (this.search.value.trim().length < this.config.minChars) {
            // Abort any pending request so a late response can't repopulate.
            if (this._abort) this._abort.abort();
            this._abort = null;
            this.remoteValues = [];
            this._renderOptions();
            return;
        }
        this._renderMessage(this.config.loadingText);
        this._debounce = setTimeout(() => this._remoteSearch(this.search.value.trim()), 250);
    }

    async _remoteSearch(query) {
        // Cancel the previous in-flight request and stamp this one so we can
        // discard responses that resolve out of order or after close.
        if (this._abort) this._abort.abort();
        const controller = new AbortController();
        this._abort = controller;
        const token = ++this._remoteToken;

        try {
            const sep = this.config.ajax.includes('?') ? '&' : '?';
            const res = await fetch(`${this.config.ajax}${sep}q=${encodeURIComponent(query)}`, {
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            if (!res.ok) throw new Error(res.status);
            const data = await res.json();

            // Bail if a newer request superseded us or the dropdown closed.
            if (token !== this._remoteToken || !this.isOpen) return;

            const rows = Array.isArray(data) ? data : (data.results ?? data.data ?? []);
            const newValues = rows.map((r) => String(r.value ?? r.id));
            const fresh = new Set(newValues);

            // Prune previously-injected remote options that are no longer in the
            // result set and not currently selected, so stale rows don't linger.
            [...this.select.options].forEach((o) => {
                if (o.dataset.s3remote === '1' && !o.selected && !fresh.has(o.value)) {
                    o.remove();
                }
            });

            const existing = new Set([...this.select.options].map((o) => o.value));
            rows.forEach((r) => {
                const value = String(r.value ?? r.id);
                if (!existing.has(value)) {
                    const option = new Option(String(r.label ?? r.text ?? value), value);
                    option.dataset.s3remote = '1';
                    this.select.add(option);
                    existing.add(value);
                }
            });
            this.remoteValues = newValues;
            this._renderOptions();
        } catch (e) {
            if (e?.name === 'AbortError') return;
            if (token !== this._remoteToken || !this.isOpen) return;
            this._renderMessage('Could not load results.');
        }
    }

    _renderMessage(text) {
        this.listbox.replaceChildren();
        const m = el('div', 's3__empty');
        m.textContent = text;
        this.listbox.append(m);
    }

    _renderOptions() {
        const query = fold(this.search.value);
        const all = this._items().filter((i) => !i.placeholder);

        const matched = this.config.ajax
            ? all.filter((i) => i.selected || this.remoteValues.includes(i.value))
            : all.filter((i) => !query || fold(i.label).includes(query));

        const overflow = Math.max(0, matched.length - this.config.maxRender);
        this.matches = matched.slice(0, this.config.maxRender);
        this.listbox.replaceChildren();

        // Offer "create" only when no existing option matches the folded label.
        // Compare against every option (not just the rendered matches) using the
        // same folded key createTag() reuses, so the two never disagree.
        const canCreate =
            this.config.tags &&
            this.search.value.trim() &&
            !all.some((i) => fold(i.label) === query);

        if (!this.matches.length && !canCreate) {
            this._renderMessage(
                this.config.ajax && this.search.value.trim().length < this.config.minChars
                    ? 'Type to search…'
                    : this.config.noResults,
            );
            return;
        }

        let lastGroup = null;
        this.matches.forEach((item, idx) => {
            if (item.group && item.group !== lastGroup) {
                const header = el('div', 's3__group');
                header.textContent = item.group;
                this.listbox.append(header);
            }
            lastGroup = item.group;

            const option = el('div', 's3__option');
            option.id = `${this.uid}-opt-${idx}`;
            option.setAttribute('role', 'option');
            option.setAttribute('aria-selected', item.selected ? 'true' : 'false');
            option.classList.toggle('is-selected', item.selected);
            option.classList.toggle('is-disabled', item.disabled);

            const label = el('span');
            label.textContent = item.label;
            option.append(label);
            if (item.selected) option.append(iconEl('fa-solid fa-check s3__check'));

            option.addEventListener('mouseenter', () => {
                this.activeIndex = idx;
                this._highlight();
            });
            option.addEventListener('click', () => {
                if (item.disabled) return;
                item.selected && this.multiple ? this.deselect(item.value) : this.choose(item.value);
            });
            this.listbox.append(option);
        });

        if (canCreate) {
            const create = el('div', 's3__option s3__create');
            create.textContent = this.config.createText(this.search.value.trim());
            create.addEventListener('click', () => this.createTag(this.search.value));
            this.listbox.append(create);
        }

        if (overflow > 0) {
            const more = el('div', 's3__more');
            more.textContent = this.config.moreText(overflow);
            this.listbox.append(more);
        }

        // Make sure the resting highlight is on a selectable row, never a
        // disabled one (e.g. when the first match is disabled after a search).
        const rows = [...this.listbox.querySelectorAll('.s3__option')];
        const current = rows[this.activeIndex];
        if (current && current.classList.contains('is-disabled')) {
            const next = rows.findIndex((o, i) => i >= this.activeIndex && !o.classList.contains('is-disabled'));
            this.activeIndex = next === -1
                ? rows.findIndex((o) => !o.classList.contains('is-disabled'))
                : next;
            if (this.activeIndex === -1) this.activeIndex = 0;
        }

        this._highlight();
    }

    _move(direction) {
        const options = [...this.listbox.querySelectorAll('.s3__option')];
        const count = options.length;
        if (!count) return;
        // Advance in the requested direction, skipping disabled rows so the
        // highlight never rests on an unselectable option. The loop guard caps
        // iterations at `count` in case every option is disabled.
        let index = this.activeIndex;
        for (let i = 0; i < count; i++) {
            index = (index + direction + count) % count;
            if (!options[index].classList.contains('is-disabled')) break;
        }
        this.activeIndex = index;
        this._highlight();
    }

    _highlight() {
        const options = [...this.listbox.querySelectorAll('.s3__option')];
        options.forEach((o, i) => o.classList.toggle('is-active', i === this.activeIndex));
        const active = options[this.activeIndex];
        if (active) {
            active.scrollIntoView({ block: 'nearest' });
            this.search.setAttribute('aria-activedescendant', active.id);
        } else {
            this.search.removeAttribute('aria-activedescendant');
        }
    }

    _chooseActive() {
        const active = this.listbox.querySelectorAll('.s3__option')[this.activeIndex];
        if (!active) return;
        if (active.classList.contains('s3__create')) {
            this.createTag(this.search.value);
            return;
        }
        const item = this.matches[this.activeIndex];
        if (item && !item.disabled) {
            item.selected && this.multiple ? this.deselect(item.value) : this.choose(item.value);
        }
    }

    refresh() {
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    destroy() {
        document.removeEventListener('click', this._onDocClick);
        clearTimeout(this._debounce);
        if (this._abort) this._abort.abort();
        this._abort = null;
        // Restore the original <select> option set by dropping every option we
        // injected from AJAX, regardless of selected state.
        [...this.select.options].forEach((o) => {
            if (o.dataset.s3remote === '1') o.remove();
        });
        this.wrap.remove();
        this.select.classList.remove('s3-native');
        this.select.removeAttribute('aria-hidden');
        this.select.tabIndex = 0;
        if (this._ariaRequired) this.select.required = true;
        delete this.select._s3;
    }
}

export function createSelect3(select, options = {}) {
    if (!(select instanceof HTMLSelectElement)) {
        throw new TypeError('createSelect3 expects a <select> element');
    }
    if (select._s3) return select._s3;
    const instance = new Select3(select, options);
    select._s3 = instance;
    return instance;
}

export default createSelect3;
