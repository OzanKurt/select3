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
        };
        this.uid = `s3-${++uid}`;
        this.isOpen = false;
        this.activeIndex = 0;
        this.matches = [];
        this._onDocClick = (e) => {
            if (!this.wrap.contains(e.target)) this.close();
        };

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
        this.control.setAttribute('role', 'combobox');
        this.control.setAttribute('aria-haspopup', 'listbox');
        this.control.setAttribute('aria-expanded', 'false');
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
        this.search.setAttribute('role', 'searchbox');
        this.search.setAttribute('aria-autocomplete', 'list');
        if (!this.config.searchable) searchWrap.style.display = 'none';
        searchWrap.append(this.search);

        this.listbox = el('div', 's3__options');
        this.listbox.id = `${this.uid}-list`;
        this.listbox.setAttribute('role', 'listbox');
        if (this.multiple) this.listbox.setAttribute('aria-multiselectable', 'true');

        this.dropdown.append(searchWrap, this.listbox);
        this.control.setAttribute('aria-controls', this.listbox.id);

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
            this._renderOptions();
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
        this.control.setAttribute('aria-expanded', 'true');
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
        this.control.setAttribute('aria-expanded', 'false');
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
        const value = label.trim();
        if (!value) return;
        if (![...this.select.options].some((o) => o.value === value)) {
            this.select.add(new Option(value, value));
        }
        this.choose(value);
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
        this.clear.style.display = this.config.allowClear && hasValue ? '' : 'none';
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

    _renderOptions() {
        const query = fold(this.search.value);
        this.matches = this._items().filter((i) => !i.placeholder && (!query || fold(i.label).includes(query)));
        this.listbox.replaceChildren();

        const canCreate = this.config.tags && this.search.value.trim() && !this.matches.some((m) => fold(m.label) === query);

        if (!this.matches.length && !canCreate) {
            const empty = el('div', 's3__empty');
            empty.textContent = this.config.noResults;
            this.listbox.append(empty);
            return;
        }

        this.matches.forEach((item, idx) => {
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

        this._highlight();
    }

    _move(direction) {
        const count = this.listbox.querySelectorAll('.s3__option').length;
        if (!count) return;
        this.activeIndex = (this.activeIndex + direction + count) % count;
        this._highlight();
    }

    _highlight() {
        const options = [...this.listbox.querySelectorAll('.s3__option')];
        options.forEach((o, i) => o.classList.toggle('is-active', i === this.activeIndex));
        const active = options[this.activeIndex];
        if (active) {
            active.scrollIntoView({ block: 'nearest' });
            this.control.setAttribute('aria-activedescendant', active.id);
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
