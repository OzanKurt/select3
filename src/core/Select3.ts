/**
 * Select3 — a dependency-free <select> enhancer.
 *
 * Core feature set: single & multi select, type-to-filter search (diacritic
 * folded), tagging (create options), clear, full keyboard control and a
 * WAI-ARIA combobox. The native <select> stays in the DOM as the source of
 * truth and form value, and a `change` event fires on every mutation.
 *
 * Advanced features from the design spec (events bus, rich methods, AJAX
 * pagination, virtual scroll, SumoSelect UX, i18n, RTL, plugins) layer on in
 * later phases without changing this API.
 *
 * DOM is built with createElement/textContent only — never innerHTML — so
 * option labels can't inject markup.
 */

import type { Select3Options, Select3Config, Item, AddOptionInput } from '../types';
import { Emitter } from './emitter';
import type { Handler } from './emitter';
import { fold } from '../search/diacritics';
import { scoreItem } from '../search/sifter';
import { highlight } from '../search/highlight';
import { resolveDropdownParent, computeFlip, placeDropdown, resetDropdown } from '../render/position';
import { AjaxAdapter, defaultTransport, defaultProcessResults } from '../data/ajax-adapter';
import type { RemoteRow } from '../types';

declare global {
    interface HTMLSelectElement {
        _s3?: Select3;
    }
}

let uid = 0;

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
};

const iconEl = (className: string): HTMLElement => {
    const i = document.createElement('i');
    i.className = className;
    return i;
};

export class Select3 {
    select: HTMLSelectElement;
    multiple: boolean;
    config: Select3Config;
    uid: string;
    isOpen = false;
    activeIndex = 0;
    matches: Item[] = [];
    remoteValues: string[] = [];

    private _ajax: AjaxAdapter | null = null;
    private _hasMore = false;
    private _preloaded = false;
    private _onDocClick: (e: MouseEvent) => void;
    private _labelId: string | null = null;
    private _ariaLabel: string | null;
    private _ariaRequired = false;
    private _emitter = new Emitter();
    private _locked = false;
    private _portalParent: HTMLElement | null = null;
    private _reposition: () => void;

    // Visual nodes (assigned in _build, before first use).
    wrap!: HTMLDivElement;
    control!: HTMLDivElement;
    display!: HTMLDivElement;
    clear!: HTMLButtonElement;
    arrow!: HTMLSpanElement;
    dropdown!: HTMLDivElement;
    search!: HTMLInputElement;
    listbox!: HTMLDivElement;
    private _searchWrap!: HTMLDivElement;

    constructor(select: HTMLSelectElement, options: Select3Options = {}) {
        this.select = select;
        this.multiple = select.multiple;
        this.config = {
            placeholder: select.dataset.placeholder ?? options.placeholder ?? 'Select…',
            allowClear: options.allowClear ?? true,
            tags: select.hasAttribute('data-tags') || !!options.tags,
            searchable: options.searchable ?? true,
            noResults: options.noResults ?? 'No results',
            createText: options.createText ?? ((q: string) => `Create “${q}”`),
            ajax: select.dataset.ajax ?? options.ajax ?? null,
            minChars: options.minChars ?? (select.dataset.ajax || options.ajax ? 1 : 0),
            maxRender: options.maxRender ?? 100,
            loadingText: options.loadingText ?? 'Searching…',
            moreText: options.moreText ?? ((n: number) => `${n} more, refine your search`),
            closeOnSelect: options.closeOnSelect ?? !select.multiple,
            openOnFocus: options.openOnFocus ?? false,
            selectOnTab: options.selectOnTab ?? false,
            hidePlaceholder: options.hidePlaceholder ?? false,
            maxItems: options.maxItems ?? null,
            maxReachedText: options.maxReachedText ?? ((max: number) => `Limit of ${max} reached`),
            searchField: options.searchField ?? ['label'],
            sort: options.sort ?? true,
            highlight: options.highlight ?? true,
            minResultsForSearch: options.minResultsForSearch ?? 0,
            maxInputLength: options.maxInputLength ?? 0,
            appendTo: options.appendTo ?? 'auto',
            dropdownGap: options.dropdownGap ?? 4,
            dropdownZ: options.dropdownZ ?? 1100,
            debounce: options.debounce ?? 250,
            preload: options.preload ?? false,
            transport: options.transport ?? defaultTransport,
            processResults: options.processResults ?? defaultProcessResults,
            queryParam: options.queryParam ?? 'q',
            pageParam: options.pageParam ?? 'page',
            loadingMoreText: options.loadingMoreText ?? 'Loading more…',
        };
        this.uid = `s3-${++uid}`;
        this._onDocClick = (e: MouseEvent) => {
            const target = e.target as Node;
            // The dropdown may be portaled outside the wrap (modal/body), so an
            // outside click must check both the wrap and the dropdown.
            if (!this.wrap.contains(target) && !this.dropdown.contains(target)) this.close();
        };
        this._reposition = () => {
            if (this.isOpen && this._portalParent) {
                placeDropdown(
                    this.control,
                    this.dropdown,
                    this._portalParent,
                    this.config.dropdownGap,
                    this.config.dropdownZ,
                );
            }
        };

        // Resolve the native select's accessible name so the visible widgets
        // (control + search) inherit it. Prefer a wiring (aria-labelledby) over
        // copying text so the label stays the single source of truth.
        const label =
            (select.id && document.querySelector(`label[for="${select.id}"]`)) ||
            select.closest('label');
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

        if (this.config.ajax) {
            this._ajax = this._buildAjax(this.config.ajax);
            if (this.config.preload === true) this._ajax.search('');
        }
    }

    private _buildAjax(url: string): AjaxAdapter {
        return new AjaxAdapter({
            url,
            debounce: this.config.debounce,
            transport: this.config.transport,
            processResults: this.config.processResults,
            queryParam: this.config.queryParam,
            pageParam: this.config.pageParam,
            onLoading: () => this._renderMessage(this.config.loadingText),
            onResults: (rows, meta) => this._onRemoteResults(rows, meta),
            onError: () => this._renderMessage('Could not load results.'),
        });
    }

    private _onRemoteResults(
        rows: RemoteRow[],
        meta: { append: boolean; hasMore: boolean; query: string },
    ): void {
        this._hasMore = meta.hasMore;
        const incoming = rows.map((r) => r.value);
        const fresh = new Set(incoming);

        if (!meta.append) {
            // Drop previously-injected, now-unselected remote options absent from
            // the new set so stale rows don't linger.
            [...this.select.options].forEach((o) => {
                if (o.dataset.s3remote === '1' && !o.selected && !fresh.has(o.value)) o.remove();
            });
            this.remoteValues = incoming;
        } else {
            this.remoteValues = [...this.remoteValues, ...incoming];
        }

        const existing = new Set([...this.select.options].map((o) => o.value));
        rows.forEach((r) => {
            if (!existing.has(r.value)) {
                const option = new Option(r.label, r.value);
                option.dataset.s3remote = '1';
                this.select.add(option);
                existing.add(r.value);
            }
        });

        if (this.isOpen) this._renderOptions();
    }

    _items(): Item[] {
        return [...this.select.options].map((o) => ({
            value: o.value,
            label: (o.textContent ?? '').trim(),
            selected: o.selected,
            disabled: o.disabled,
            placeholder: o.value === '',
            group:
                o.parentElement?.tagName === 'OPTGROUP'
                    ? (o.parentElement as HTMLOptGroupElement).label
                    : null,
            data: { ...o.dataset },
        }));
    }

    _selected(): Item[] {
        return this._items().filter((i) => i.selected && !i.placeholder);
    }

    _build(): void {
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
        if (this.config.maxInputLength > 0) this.search.maxLength = this.config.maxInputLength;
        if (!this.config.searchable) searchWrap.style.display = 'none';
        searchWrap.append(this.search);
        this._searchWrap = searchWrap;

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

    _bind(): void {
        this.control.addEventListener('click', () => this.toggle());
        this.control.addEventListener('keydown', (e: KeyboardEvent) => {
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
            this._emitter.emit('type', { query: this.search.value });
            if (this.config.ajax) this._remoteInput();
            else this._renderOptions();
        });
        // Infinite scroll: near the bottom, ask the adapter for the next page.
        this.listbox.addEventListener('scroll', () => {
            if (!this.config.ajax || !this._hasMore || !this._ajax) return;
            const lb = this.listbox;
            if (lb.scrollTop + lb.clientHeight >= lb.scrollHeight - 24) this._ajax.more();
        });
        this.search.addEventListener('keydown', (e: KeyboardEvent) => this._onSearchKey(e));
        if (this.config.openOnFocus) {
            this.control.addEventListener('focus', () => this.open());
        }
        this.display.addEventListener('click', (e) => {
            const remove = (e.target as HTMLElement | null)?.closest<HTMLElement>('.s3__tag-remove');
            if (remove) {
                e.stopPropagation();
                this.deselect(remove.dataset.value ?? '');
            }
        });
    }

    _onSearchKey(e: KeyboardEvent): void {
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
        } else if (e.key === 'Tab' && this.config.selectOnTab) {
            // Select the active option without preventing default, so focus
            // still advances to the next field afterward.
            this._chooseActive();
        } else if (e.key === 'Backspace' && this.search.value === '' && this.multiple) {
            const selected = this._selected();
            const last = selected[selected.length - 1];
            if (last) this.deselect(last.value);
        }
    }

    toggle(): void {
        this.isOpen ? this.close() : this.open();
    }

    open(): void {
        if (this.select.disabled || this._locked || this.isOpen) return;
        if (!this._allows('beforeOpen')) return;
        this.isOpen = true;
        this.wrap.classList.add('s3--open');
        this.search.setAttribute('aria-expanded', 'true');
        this.search.value = '';
        this.activeIndex = 0;
        this._renderOptions();
        this._positionOpen();
        document.addEventListener('click', this._onDocClick);
        // Hide the search box when there are too few options to be worth filtering.
        const showSearch =
            this.config.searchable &&
            this._items().filter((i) => !i.placeholder).length > this.config.minResultsForSearch;
        this._searchWrap.style.display = showSearch ? '' : 'none';
        if (showSearch) setTimeout(() => this.search.focus(), 0);
        if (this.config.hidePlaceholder) this.sync();
        if (this.config.ajax && this.config.preload === 'focus' && !this._preloaded) {
            this._preloaded = true;
            this._ajax?.search('');
        }
        this._emitter.emit('open');
    }

    close(): void {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.wrap.classList.remove('s3--open');
        this.search.setAttribute('aria-expanded', 'false');
        this.search.removeAttribute('aria-activedescendant');
        document.removeEventListener('click', this._onDocClick);
        this._restoreDropdown();
        if (this.config.hidePlaceholder) this.sync();
        this._emitter.emit('close');
    }

    /** Attach + position the dropdown (portaled into a modal/body, or in-flow). */
    private _positionOpen(): void {
        const parent = resolveDropdownParent(this.control, this.config.appendTo);
        this._portalParent = parent;
        if (parent) {
            parent.appendChild(this.dropdown);
            this.dropdown.style.display = 'block';
            placeDropdown(this.control, this.dropdown, parent, this.config.dropdownGap, this.config.dropdownZ);
            window.addEventListener('scroll', this._reposition, true);
            window.addEventListener('resize', this._reposition);
        } else {
            const flipUp = computeFlip(
                this.control.getBoundingClientRect(),
                this.dropdown.offsetHeight || 0,
                window.innerHeight,
            );
            this.wrap.classList.toggle('s3--flip-up', flipUp);
        }
    }

    /** Undo portaling: drop listeners, clear inline coords, move back into wrap. */
    private _restoreDropdown(): void {
        if (this._portalParent) {
            window.removeEventListener('scroll', this._reposition, true);
            window.removeEventListener('resize', this._reposition);
            resetDropdown(this.dropdown);
            this.wrap.appendChild(this.dropdown);
            this._portalParent = null;
        }
        this.wrap.classList.remove('s3--flip-up');
    }

    choose(value: string): void {
        const option = [...this.select.options].find((o) => o.value === value);
        if (!option || option.disabled || this._locked) return;
        // Respect the multi-select cap: block selecting a new value when full.
        if (this.multiple && !option.selected && this.isFull()) {
            if (this.isOpen) this._renderOptions();
            return;
        }
        if (!this._allows('beforeSelect', { value })) return;

        if (this.multiple) {
            option.selected = true;
        } else {
            [...this.select.options].forEach((o) => (o.selected = o.value === value));
        }

        this._emit();
        this._emitter.emit('select', { value });
        this._emitter.emit('change', { value: this.getValue() });
        this.sync();

        if (this.config.closeOnSelect) {
            this.close();
            this.control.focus();
        } else {
            this.search.value = '';
            if (this.isOpen) this._renderOptions();
            if (this.config.searchable) this.search.focus();
        }
    }

    deselect(value: string): void {
        if (this._locked) return;
        const option = [...this.select.options].find((o) => o.value === value);
        if (option) option.selected = false;
        this._emit();
        this._emitter.emit('deselect', { value });
        this._emitter.emit('change', { value: this.getValue() });
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    clearAll(): void {
        if (this._locked) return;
        if (!this._allows('beforeClear')) return;
        [...this.select.options].forEach((o) => {
            if (o.value !== '') o.selected = false;
        });
        if (!this.multiple) {
            const placeholder = [...this.select.options].find((o) => o.value === '');
            if (placeholder) placeholder.selected = true;
        }
        this._emit();
        this._emitter.emit('clear');
        this._emitter.emit('change', { value: this.getValue() });
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    createTag(label: string): void {
        const text = label.trim();
        if (!text) return;
        // Use the same folded-label key as canCreate so a tag that already
        // exists (case/diacritic-insensitively) reuses that option's value
        // instead of creating a duplicate.
        const folded = fold(text);
        const existing = [...this.select.options].find((o) => fold((o.textContent ?? '').trim()) === folded);
        if (existing) {
            this.choose(existing.value);
            return;
        }
        this.select.add(new Option(text, text));
        this.choose(text);
    }

    _emit(): void {
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    sync(): void {
        const selected = this._selected();
        this.display.replaceChildren();

        if (!selected.length) {
            if (!(this.config.hidePlaceholder && this.isOpen)) {
                this.display.append(this._placeholderEl());
            }
        } else if (this.multiple) {
            selected.forEach((item) => this.display.append(this._tagEl(item)));
        } else {
            const single = el('span', 's3__single');
            single.textContent = selected[0]?.label ?? '';
            this.display.append(single);
        }

        const hasValue = selected.length > 0;
        // A required single-select must never be emptiable client-side, so the
        // clear control is suppressed regardless of allowClear.
        const canClear = this.config.allowClear && !(this._ariaRequired && !this.multiple);
        this.clear.style.display = canClear && hasValue ? '' : 'none';
        this.wrap.classList.toggle('s3--has-value', hasValue);
    }

    _placeholderEl(): HTMLElement {
        const span = el('span', 's3__placeholder');
        span.textContent = this.config.placeholder;
        return span;
    }

    _tagEl(item: Item): HTMLElement {
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

    /** Handle typing in AJAX mode: gate on minChars, else schedule via the adapter. */
    private _remoteInput(): void {
        const query = this.search.value.trim();
        if (query.length < this.config.minChars) {
            this._ajax?.cancel();
            this.remoteValues = [];
            this._hasMore = false;
            this._renderOptions();
            return;
        }
        this._ajax?.schedule(query);
    }

    _renderMessage(text: string): void {
        this.listbox.replaceChildren();
        const m = el('div', 's3__empty');
        m.textContent = text;
        this.listbox.append(m);
    }

    _renderOptions(): void {
        const rawQuery = this.search.value.trim();
        const query = fold(this.search.value);
        const all = this._items().filter((i) => !i.placeholder);

        let matched: Item[];
        if (this.config.ajax) {
            matched = all.filter((i) => i.selected || this.remoteValues.includes(i.value));
        } else if (!rawQuery) {
            matched = all;
        } else {
            // Score every option, drop non-matches, then rank by relevance with
            // original order as the stable tie-break.
            const scored = all
                .map((item, order) => ({ item, order, score: scoreItem(item, rawQuery, this.config.searchField) }))
                .filter((x) => x.score > 0);
            if (this.config.sort) {
                scored.sort((a, b) => b.score - a.score || a.order - b.order);
            }
            matched = scored.map((x) => x.item);
        }

        const overflow = Math.max(0, matched.length - this.config.maxRender);
        this.matches = matched.slice(0, this.config.maxRender);
        this.listbox.replaceChildren();

        // Offer "create" only when no existing option matches the folded label.
        // Compare against every option (not just the rendered matches) using the
        // same folded key createTag() reuses, so the two never disagree.
        const canCreate =
            this.config.tags &&
            !!this.search.value.trim() &&
            !all.some((i) => fold(i.label) === query);

        if (!this.matches.length && !canCreate) {
            this._renderMessage(
                this.config.ajax && this.search.value.trim().length < this.config.minChars
                    ? 'Type to search…'
                    : this.config.noResults,
            );
            return;
        }

        let lastGroup: string | null = null;
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
            if (this.config.highlight && rawQuery) {
                highlight(item.label, rawQuery).forEach((n) => label.appendChild(n));
            } else {
                label.textContent = item.label;
            }
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

        // When the multi-select cap is reached, show a localized hint; further
        // unselected options are blocked in choose().
        if (this.isFull() && this.config.maxItems != null) {
            const hint = el('div', 's3__more s3__max');
            hint.textContent = this.config.maxReachedText(this.config.maxItems);
            this.listbox.append(hint);
        }

        // Remote pagination: a sentinel row that scrolling into loads the next page.
        if (this.config.ajax && this._hasMore) {
            const loadMore = el('div', 's3__more s3__loadmore');
            loadMore.textContent = this.config.loadingMoreText;
            this.listbox.append(loadMore);
        }

        // Make sure the resting highlight is on a selectable row, never a
        // disabled one (e.g. when the first match is disabled after a search).
        const rows = [...this.listbox.querySelectorAll('.s3__option')];
        const current = rows[this.activeIndex];
        if (current && current.classList.contains('is-disabled')) {
            const next = rows.findIndex(
                (o, i) => i >= this.activeIndex && !o.classList.contains('is-disabled'),
            );
            this.activeIndex =
                next === -1 ? rows.findIndex((o) => !o.classList.contains('is-disabled')) : next;
            if (this.activeIndex === -1) this.activeIndex = 0;
        }

        this._highlight();
    }

    _move(direction: number): void {
        const options = [...this.listbox.querySelectorAll('.s3__option')];
        const count = options.length;
        if (!count) return;
        // Advance in the requested direction, skipping disabled rows so the
        // highlight never rests on an unselectable option. The loop guard caps
        // iterations at `count` in case every option is disabled.
        let index = this.activeIndex;
        for (let i = 0; i < count; i++) {
            index = (index + direction + count) % count;
            const opt = options[index];
            if (opt && !opt.classList.contains('is-disabled')) break;
        }
        this.activeIndex = index;
        this._highlight();
    }

    _highlight(): void {
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

    _chooseActive(): void {
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

    refresh(): void {
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    // ----- Events ---------------------------------------------------------

    /** Subscribe to an instance event; returns an unsubscribe function. */
    on(event: string, handler: Handler): () => void {
        return this._emitter.on(event, handler);
    }

    /** Subscribe once; auto-unsubscribes after the first emit. */
    once(event: string, handler: Handler): () => void {
        return this._emitter.once(event, handler);
    }

    /** Unsubscribe a handler, or all handlers for an event when omitted. */
    off(event: string, handler?: Handler): void {
        this._emitter.off(event, handler);
    }

    /** Emit a cancelable `before*` event; returns false if a listener prevented it. */
    private _allows(event: string, detail: Record<string, unknown> = {}): boolean {
        let allowed = true;
        this._emitter.emit(event, { ...detail, preventDefault: () => (allowed = false) });
        return allowed;
    }

    // ----- Value & option methods ----------------------------------------

    /** Current value: an array for multi-select, a string for single. */
    getValue(): string | string[] {
        const values = this._selected().map((i) => i.value);
        return this.multiple ? values : (values[0] ?? '');
    }

    /** Set the selection from a value or array of values. */
    setValue(value: string | string[]): void {
        const wanted = new Set(Array.isArray(value) ? value : value === '' ? [] : [value]);
        [...this.select.options].forEach((o) => {
            if (o.value !== '') o.selected = wanted.has(o.value);
        });
        if (!this.multiple && !wanted.size) {
            const placeholder = [...this.select.options].find((o) => o.value === '');
            if (placeholder) placeholder.selected = true;
        }
        this._emit();
        this._emitter.emit('change', { value: this.getValue() });
        this.refresh();
    }

    /** Add a native <option> if its value isn't already present. */
    addOption(input: AddOptionInput): void {
        if ([...this.select.options].some((o) => o.value === input.value)) return;
        const option = new Option(input.label, input.value, false, !!input.selected);
        if (input.disabled) option.disabled = true;
        this.select.add(option);
        this._emitter.emit('optionAdd', { value: input.value });
        if (input.selected) this._emit();
        this.refresh();
    }

    addOptions(inputs: AddOptionInput[]): void {
        inputs.forEach((i) => this.addOption(i));
    }

    /** Remove an option by value. */
    removeOption(value: string): void {
        const option = [...this.select.options].find((o) => o.value === value);
        if (!option) return;
        const wasSelected = option.selected;
        option.remove();
        this._emitter.emit('optionRemove', { value });
        if (wasSelected) this._emit();
        this.refresh();
    }

    getOption(value: string): Item | null {
        return this._items().find((i) => i.value === value) ?? null;
    }

    /** Remove every non-placeholder option. */
    clearOptions(): void {
        [...this.select.options].forEach((o) => {
            if (o.value !== '') o.remove();
        });
        this.refresh();
    }

    // ----- State methods --------------------------------------------------

    enable(): void {
        this.select.disabled = false;
        this.control.tabIndex = 0;
        this.wrap.classList.remove('s3--disabled');
    }

    disable(): void {
        this.select.disabled = true;
        this.control.tabIndex = -1;
        this.wrap.classList.add('s3--disabled');
        this.close();
    }

    /** Lock: keep the selection visible but reject all edits. */
    lock(): void {
        this._locked = true;
        this.wrap.classList.add('s3--locked');
        this.close();
    }

    unlock(): void {
        this._locked = false;
        this.wrap.classList.remove('s3--locked');
    }

    /** True when a multi-select has reached its maxItems cap. */
    isFull(): boolean {
        return this.multiple && this.config.maxItems != null && this._selected().length >= this.config.maxItems;
    }

    focus(): void {
        this.control.focus();
    }

    blur(): void {
        this.close();
        this.control.blur();
    }

    destroy(): void {
        if (this.isOpen) this.close();
        this._emitter.emit('destroy');
        document.removeEventListener('click', this._onDocClick);
        this._ajax?.destroy();
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
        this._emitter.clear();
    }
}

export function createSelect3(select: HTMLSelectElement, options: Select3Options = {}): Select3 {
    if (!(select instanceof HTMLSelectElement)) {
        throw new TypeError('createSelect3 expects a <select> element');
    }
    if (select._s3) return select._s3;
    const instance = new Select3(select, options);
    select._s3 = instance;
    return instance;
}

export default createSelect3;
