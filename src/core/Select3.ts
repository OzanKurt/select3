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

import type {
    Select3Options,
    Select3Config,
    Item,
    AddOptionInput,
    RenderContext,
    PluginFactory,
    Select3Plugin,
    CreatedOption,
} from '../types';
import { getPlugin } from '../plugins/registry';
import { Emitter } from './emitter';
import type { Handler } from './emitter';
import { fold } from '../search/diacritics';
import { scoreItem } from '../search/sifter';
import { highlight } from '../search/highlight';
import { resolveDropdownParent, computeFlip, placeDropdown, resetDropdown } from '../render/position';
import { computeWindow } from '../render/virtual';
import { AjaxAdapter, defaultTransport, defaultProcessResults } from '../data/ajax-adapter';
import { resolveLocale } from '../i18n/registry';
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

/** Merge a space-separated class string onto a node (style customization). */
const addClasses = (node: HTMLElement, classes?: string): void => {
    if (classes) node.classList.add(...classes.split(/\s+/).filter(Boolean));
};

/** HTML-escape a string, for templates that assemble markup strings themselves. */
const escape = (s: string): string =>
    s.replace(
        /[&<>"']/g,
        (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c,
    );

/** Escape a string for safe use inside a RegExp character class. */
const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** True on touch/small-viewport devices where the OS <select> picker is better. */
const prefersNativePicker = (): boolean => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 640;
};

/** Normalize the createFilter option (RegExp | string | fn) into a predicate. */
const normalizeCreateFilter = (
    cf: RegExp | string | ((input: string) => boolean) | undefined,
): ((input: string) => boolean) => {
    if (cf == null) return () => true;
    if (typeof cf === 'function') return cf;
    const re = cf instanceof RegExp ? cf : new RegExp(cf);
    return (input: string) => re.test(input);
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
    private _okSnapshot: string[] | null = null;
    private _plugins: Select3Plugin[] = [];
    private _virtual = false;
    private _virtualRender: (() => void) | null = null;
    private _vRaf = 0;
    private _vRows: Array<{ group: string } | { index: number }> = [];
    private _native = false;
    private _onNativeChange: (() => void) | null = null;

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
        const locale = resolveLocale(options);
        this.config = {
            placeholder: select.dataset.placeholder ?? options.placeholder ?? locale.placeholder,
            allowClear: options.allowClear ?? true,
            tags: select.hasAttribute('data-tags') || !!options.tags,
            searchable: options.searchable ?? true,
            noResults: options.noResults ?? locale.noResults,
            createText: options.createText ?? locale.createText,
            ajax: select.dataset.ajax ?? options.ajax ?? null,
            minChars: options.minChars ?? (select.dataset.ajax || options.ajax ? 1 : 0),
            maxRender: options.maxRender ?? 100,
            loadingText: options.loadingText ?? locale.loadingText,
            moreText: options.moreText ?? locale.moreText,
            closeOnSelect: options.closeOnSelect ?? !select.multiple,
            openOnFocus: options.openOnFocus ?? false,
            selectOnTab: options.selectOnTab ?? false,
            hidePlaceholder: options.hidePlaceholder ?? false,
            maxItems: options.maxItems ?? null,
            maxReachedText: options.maxReachedText ?? locale.maxReachedText,
            searchField: options.searchField ?? ['label'],
            sort: options.sort ?? true,
            highlight: options.highlight ?? true,
            fuzzy: options.fuzzy ?? false,
            searchGroups: options.searchGroups ?? false,
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
            loadingMoreText: options.loadingMoreText ?? locale.loadingMoreText,
            cacheTTL: options.cacheTTL ?? 0,
            selectAll: options.selectAll ?? false,
            selectAllText: options.selectAllText ?? locale.selectAllText,
            clearAllText: options.clearAllText ?? locale.clearAllText,
            okCancel: options.okCancel ?? false,
            okText: options.okText ?? locale.okText,
            cancelText: options.cancelText ?? locale.cancelText,
            clickAway: options.clickAway ?? 'commit',
            csvDispCount: options.csvDispCount ?? 0,
            captionFormat: options.captionFormat ?? locale.captionFormat,
            captionFormatAllSelected: options.captionFormatAllSelected ?? locale.captionFormatAllSelected,
            captionPrefix: options.captionPrefix ?? '',
            checkboxes: options.checkboxes ?? false,
            classNames: options.classNames ?? {},
            rtl:
                options.rtl ??
                (select.closest('[dir="rtl"]') !== null ||
                    (typeof document !== 'undefined' && document.dir === 'rtl')),
            theme: options.theme ?? null,
            size: options.size ?? 'md',
            templates: options.templates ?? {},
            showCount: options.showCount ?? false,
            countText: options.countText ?? ((n: number) => `${n} result${n === 1 ? '' : 's'}`),
            tokenSeparators: options.tokenSeparators ?? [],
            createFilter: normalizeCreateFilter(options.createFilter),
            persist: options.persist ?? true,
            addPrecedence: options.addPrecedence ?? false,
            create: options.create ?? null,
            recent: options.recent
                ? {
                      key:
                          (options.recent === true ? undefined : options.recent.key) ??
                          `s3-recent-${select.id || select.name || 'select3'}`,
                      max: (options.recent === true ? undefined : options.recent.max) ?? 5,
                  }
                : null,
            pinned: options.pinned ?? [],
            virtualScroll: options.virtualScroll ?? false,
            itemHeight: options.itemHeight ?? 36,
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

        const nom = options.nativeOnMobile ?? 'auto';
        this._native = nom === true || (nom === 'auto' && prefersNativePicker());

        this._build();
        this._bind();
        this.sync();

        if (this.config.ajax) {
            this._ajax = this._buildAjax(this.config.ajax);
            if (this.config.preload === true) this._ajax.search('');
        }

        // Plugins: instantiate each factory (inline, named, or { name, options })
        // against this instance. A returned object with destroy() is torn down later.
        for (const entry of options.plugins ?? []) {
            let factory: PluginFactory | undefined;
            let opts: Record<string, unknown> | undefined;
            if (typeof entry === 'function') {
                factory = entry;
            } else if (typeof entry === 'string') {
                factory = getPlugin(entry);
            } else {
                factory = getPlugin(entry.name);
                opts = entry.options;
            }
            const created = factory?.(this, opts);
            if (created) this._plugins.push(created);
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
            cacheTTL: this.config.cacheTTL,
            onLoading: () => {
                this.wrap.classList.add('s3--loading');
                this._renderMessage(
                    this.config.templates.loading
                        ? this._slotNode(this.config.templates.loading(this._ctx()))
                        : this.config.loadingText,
                );
            },
            onResults: (rows, meta) => {
                this.wrap.classList.remove('s3--loading');
                this._onRemoteResults(rows, meta);
            },
            onError: () => {
                this.wrap.classList.remove('s3--loading');
                this._renderMessage('Could not load results.');
            },
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
            // the new set so stale rows don't linger, then prune emptied groups.
            [...this.select.options].forEach((o) => {
                if (o.dataset.s3remote === '1' && !o.selected && !fresh.has(o.value)) o.remove();
            });
            this._pruneRemoteGroups();
            this.remoteValues = incoming;
        } else {
            this.remoteValues = [...this.remoteValues, ...incoming];
        }

        const existing = new Set([...this.select.options].map((o) => o.value));
        rows.forEach((r) => {
            if (existing.has(r.value)) return;
            const option = new Option(r.label, r.value);
            option.dataset.s3remote = '1';
            // Carry rich per-row data so remote options render icon/image/etc.
            for (const key of ['icon', 'image', 'description', 'badge', 'meta'] as const) {
                const v = r[key];
                if (typeof v === 'string' && v !== '') option.dataset[key] = v;
            }
            if (r.pinned === true) option.dataset.pinned = '';
            // Group remote options into an <optgroup> when the row names one.
            const group = typeof r.group === 'string' ? r.group : '';
            if (group) {
                this._remoteOptgroup(group).appendChild(option);
            } else {
                this.select.add(option);
            }
            existing.add(r.value);
        });

        if (this.isOpen) this._renderOptions();
    }

    /** Find or create the remote <optgroup> with the given label. */
    private _remoteOptgroup(label: string): HTMLOptGroupElement {
        const found = [...this.select.querySelectorAll('optgroup')].find((g) => g.label === label);
        if (found) return found as HTMLOptGroupElement;
        const og = document.createElement('optgroup');
        og.label = label;
        og.dataset.s3remote = '1';
        this.select.add(og);
        return og;
    }

    /** Remove remote-created <optgroup>s that no longer hold any options. */
    private _pruneRemoteGroups(): void {
        this.select.querySelectorAll('optgroup').forEach((g) => {
            const og = g as HTMLOptGroupElement;
            if (og.dataset.s3remote === '1' && og.children.length === 0) og.remove();
        });
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
            pinned:
                this.config.pinned.includes(o.value) ||
                (o.dataset.pinned !== undefined && o.dataset.pinned !== 'false'),
            data: { ...o.dataset },
        }));
    }

    _selected(): Item[] {
        return this._items().filter((i) => i.selected && !i.placeholder);
    }

    _build(): void {
        if (this._native) {
            // Native mode: keep the real <select> interactive (it overlays the
            // styled control transparently), so a tap opens the OS picker.
            this.select.classList.add('s3-native-overlay');
        } else {
            this.select.classList.add('s3-native');
            this.select.tabIndex = -1;
            this.select.setAttribute('aria-hidden', 'true');
        }

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

        // Loading spinner — revealed by .s3--loading during AJAX requests.
        const spinner = el('span', 's3__spinner');
        spinner.append(iconEl('fa-solid fa-spinner'));
        this.control.append(spinner);

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

        // OK/Cancel footer (staging mode): edits apply on OK, revert otherwise.
        if (this.config.okCancel) {
            const footer = el('div', 's3__footer');
            const cancel = el('button', 's3__btn s3__btn-cancel');
            cancel.type = 'button';
            cancel.textContent = this.config.cancelText;
            cancel.addEventListener('click', (e) => {
                e.stopPropagation();
                this.cancel();
            });
            const ok = el('button', 's3__btn s3__btn-ok');
            ok.type = 'button';
            ok.textContent = this.config.okText;
            ok.addEventListener('click', (e) => {
                e.stopPropagation();
                this.confirm();
            });
            footer.append(cancel, ok);
            this.dropdown.append(footer);
        }

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

        // Style customization: merge user classes + apply RTL direction.
        const cn = this.config.classNames;
        addClasses(this.wrap, cn.wrap);
        addClasses(this.control, cn.control);
        addClasses(this.dropdown, cn.dropdown);
        addClasses(this.listbox, cn.listbox);
        addClasses(this.search, cn.search);
        if (this.config.rtl) this.wrap.setAttribute('dir', 'rtl');
        if (this.config.size !== 'md') this.wrap.classList.add(`s3--${this.config.size}`);
        if (this.config.theme) this.wrap.classList.add(`s3--theme-${this.config.theme}`);

        this.wrap.append(this.control, this.dropdown);
        this.select.after(this.wrap);
        if (this.select.disabled) this.wrap.classList.add('s3--disabled');

        if (this._native) {
            this.wrap.classList.add('s3--native');
            // Move the transparent native <select> on top of the styled control.
            this.wrap.appendChild(this.select);
            this._onNativeChange = () => {
                this.sync();
                this._emitter.emit('change', { value: this.getValue() });
            };
            this.select.addEventListener('change', this._onNativeChange);
        }
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
            // Tagging: split on token separators (typed or pasted) into tags.
            if (this.config.tags && this.config.tokenSeparators.length && this._consumeSeparators()) return;
            if (this.config.ajax) this._remoteInput();
            else this._renderOptions();
        });
        // Scroll: drive virtual-list windowing, else AJAX infinite-scroll paging.
        this.listbox.addEventListener('scroll', () => {
            if (this._virtual) {
                if (this._vRaf) return;
                this._vRaf = requestAnimationFrame(() => {
                    this._vRaf = 0;
                    this._virtualRender?.();
                });
                return;
            }
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
        if (this._native) return; // the OS picker handles opening in native mode
        if (this.select.disabled || this._locked || this.isOpen) return;
        if (!this._allows('beforeOpen')) return;
        this.isOpen = true;
        // Snapshot the selection so OK/Cancel can commit or revert the staging.
        if (this.config.okCancel) this._okSnapshot = this._selected().map((i) => i.value);
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
        // Finalize OK/Cancel staging on dismissal (outside click / Escape).
        if (this.config.okCancel && this._okSnapshot !== null) {
            if (this.config.clickAway === 'revert') this._revertStaging();
            else this._commitStaging();
        }
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

        this._emitter.emit('select', { value });
        if (this.config.recent) this._recordRecent(value);
        this._changed();
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
        if (option) {
            option.selected = false;
            // persist:false discards a user-created tag once it is removed.
            if (!this.config.persist && option.dataset.s3created === '1') option.remove();
        }
        this._emitter.emit('deselect', { value });
        this._changed();
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
        this._emitter.emit('clear');
        this._changed();
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    /** Select every enabled option (multi only); respects the maxItems cap. */
    selectAll(): void {
        if (this._locked || !this.multiple) return;
        const enabled = [...this.select.options].filter((o) => o.value !== '' && !o.disabled);
        const cap = this.config.maxItems;
        enabled.forEach((o, i) => {
            if (cap == null || i < cap) o.selected = true;
        });
        this._emitter.emit('selectAll');
        this._changed();
        this.sync();
        if (this.isOpen) this._renderOptions();
    }

    /** OK: commit the staged selection (no-op when not in okCancel mode). */
    confirm(): void {
        if (this.config.okCancel) this._commitStaging();
        this.close();
    }

    /** Cancel: revert to the snapshot taken when the dropdown opened. */
    cancel(): void {
        if (this.config.okCancel) this._revertStaging();
        this.close();
    }

    /** Dispatch the native change + the `change` event, unless staging edits. */
    private _changed(): void {
        if (this.config.okCancel && this._okSnapshot !== null) return;
        this._emit();
        this._emitter.emit('change', { value: this.getValue() });
    }

    private _commitStaging(): void {
        const snapshot = this._okSnapshot ?? [];
        const current = this._selected().map((i) => i.value);
        const changed = current.length !== snapshot.length || current.some((v) => !snapshot.includes(v));
        this._okSnapshot = null;
        if (changed) {
            this._emit();
            this._emitter.emit('change', { value: this.getValue() });
        }
        this._emitter.emit('okCancel:ok');
    }

    private _revertStaging(): void {
        const snapshot = new Set(this._okSnapshot ?? []);
        this._okSnapshot = null;
        [...this.select.options].forEach((o) => {
            if (o.value !== '') o.selected = snapshot.has(o.value);
        });
        if (!this.multiple && !snapshot.size) {
            const placeholder = [...this.select.options].find((o) => o.value === '');
            if (placeholder) placeholder.selected = true;
        }
        this.sync();
        this._emitter.emit('okCancel:cancel');
    }

    /** Split the search value on token separators, creating a tag per token. */
    private _consumeSeparators(): boolean {
        const seps = this.config.tokenSeparators;
        const cls = seps.map(escapeRegExp).join('');
        const pattern = new RegExp(`[${cls}]`);
        const value = this.search.value;
        if (!pattern.test(value)) return false;
        const parts = value.split(new RegExp(`[${cls}]`));
        const remainder = parts.pop() ?? '';
        parts.forEach((p) => {
            const token = p.trim();
            if (token) this.createTag(token);
        });
        this.search.value = remainder;
        if (this.isOpen) this._renderOptions();
        return true;
    }

    createTag(label: string): void {
        const text = label.trim();
        // createFilter (RegExp/string/fn) can reject invalid tags before creation.
        if (!text || !this.config.createFilter(text)) return;
        // Use the same folded-label key as canCreate so a tag that already
        // exists (case/diacritic-insensitively) reuses that option's value
        // instead of creating a duplicate.
        const folded = fold(text);
        const existing = [...this.select.options].find((o) => fold((o.textContent ?? '').trim()) === folded);
        if (existing) {
            this.choose(existing.value);
            return;
        }

        // Custom (optionally async) creation hook — e.g. persist the tag server-side.
        if (this.config.create) {
            const result = this.config.create(text);
            if (result instanceof Promise) {
                this.wrap.classList.add('s3--loading');
                if (this.isOpen) this._renderMessage(this.config.loadingText);
                result
                    .then((row) => {
                        this.wrap.classList.remove('s3--loading');
                        if (row) this._addCreated(row);
                        else if (this.isOpen) this._renderOptions();
                    })
                    .catch(() => {
                        this.wrap.classList.remove('s3--loading');
                        if (this.isOpen) this._renderOptions();
                    });
                return;
            }
            if (result) this._addCreated(result);
            return;
        }

        const option = new Option(text, text);
        // Mark user-created options so persist:false can drop them on deselect.
        option.dataset.s3created = '1';
        this.select.add(option);
        this.choose(text);
    }

    /** Add an option from a (custom/async) create result, then select it. */
    private _addCreated(row: CreatedOption): void {
        const value = String(row.value);
        if ([...this.select.options].some((o) => o.value === value)) {
            this.choose(value);
            return;
        }
        const option = new Option(String(row.label ?? value), value);
        option.dataset.s3created = '1';
        for (const key of ['icon', 'image', 'description', 'badge'] as const) {
            const v = row[key];
            if (typeof v === 'string' && v !== '') option.dataset[key] = v;
        }
        this.select.add(option);
        this.choose(value);
    }

    /** Recently-chosen values (most recent first), read from localStorage. */
    private _getRecent(): string[] {
        const cfg = this.config.recent;
        if (!cfg) return [];
        try {
            const raw = localStorage.getItem(cfg.key);
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr.filter((v): v is string => typeof v === 'string') : [];
        } catch {
            return [];
        }
    }

    private _recordRecent(value: string): void {
        const cfg = this.config.recent;
        if (!cfg || value === '') return;
        try {
            const list = [value, ...this._getRecent().filter((v) => v !== value)].slice(0, cfg.max);
            localStorage.setItem(cfg.key, JSON.stringify(list));
        } catch {
            /* storage unavailable — recents are best-effort */
        }
    }

    /** Reorder so recently-chosen items lead (recency order); the rest unchanged. */
    private _applyRecent(items: Item[]): Item[] {
        const recent = this._getRecent();
        if (!recent.length) return items;
        const rank = new Map(recent.map((v, i) => [v, i] as const));
        return [...items].sort((a, b) => (rank.get(a.value) ?? Infinity) - (rank.get(b.value) ?? Infinity));
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
            const total = this._items().filter((i) => !i.placeholder).length;
            if (this.config.csvDispCount > 0 && selected.length > this.config.csvDispCount) {
                // Past the threshold, collapse the tags into an "N selected" caption.
                const allSelected = total > 0 && selected.length >= total;
                const caption = el('span', 's3__caption');
                const capTpl = this.config.templates.caption;
                if (capTpl) {
                    caption.append(this._slotNode(capTpl(selected.length, total, this._ctx())));
                } else {
                    caption.textContent =
                        this.config.captionPrefix +
                        (allSelected
                            ? this.config.captionFormatAllSelected(selected.length)
                            : this.config.captionFormat(selected.length));
                }
                this.display.append(caption);
            } else {
                selected.forEach((item) => this.display.append(this._tagEl(item)));
            }
        } else {
            const single = el('span', 's3__single');
            const item = selected[0];
            const itemTpl = this.config.templates.item;
            if (item && itemTpl) single.append(this._slotNode(itemTpl(item, this._ctx())));
            else single.textContent = item?.label ?? '';
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
        const text = el('span', 's3__tag-label');
        const itemTpl = this.config.templates.item;
        if (itemTpl) {
            text.append(this._slotNode(itemTpl(item, this._ctx())));
        } else {
            if (item.data?.icon) text.append(iconEl(`${item.data.icon} s3__tag-icon`));
            text.append(document.createTextNode(item.label));
        }
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

    _renderMessage(content: string | Node): void {
        this.listbox.replaceChildren();
        const m = el('div', 's3__empty');
        if (typeof content === 'string') m.textContent = content;
        else m.append(content);
        this.listbox.append(m);
    }

    private _ctx(): RenderContext {
        return { escape };
    }

    /** A template result becomes a Node; a string is inserted as safe text. */
    private _slotNode(result: string | Node): Node {
        return typeof result === 'string' ? document.createTextNode(result) : result;
    }

    /** Rich (or templated) content for one dropdown option. */
    private _optionContent(item: Item, rawQuery: string): Node {
        const tpl = this.config.templates.option;
        if (tpl) return this._slotNode(tpl(item, this._ctx()));

        const data = item.data ?? {};
        const frag = document.createDocumentFragment();
        if (data.image) {
            const img = el('img', 's3__image');
            img.src = data.image;
            img.alt = '';
            frag.append(img);
        } else if (data.icon) {
            frag.append(iconEl(`${data.icon} s3__icon`));
        }

        const main = el('span', 's3__option-main');
        const label = el('span', 's3__label');
        if (this.config.highlight && rawQuery) {
            highlight(item.label, rawQuery).forEach((n) => label.appendChild(n));
        } else {
            label.textContent = item.label;
        }
        main.append(label);
        if (data.description) {
            const desc = el('span', 's3__desc');
            desc.textContent = data.description;
            main.append(desc);
        }
        frag.append(main);

        if (data.badge) {
            const badge = el('span', 's3__badge');
            badge.textContent = data.badge;
            frag.append(badge);
        }
        if (data.meta) {
            const meta = el('span', 's3__meta');
            meta.textContent = data.meta;
            frag.append(meta);
        }
        return frag;
    }

    /** Pinned items render without a group header, above every optgroup. */
    private _displayGroup(item: Item): string | null {
        return item.pinned ? null : item.group;
    }

    /** Move pinned items to the front: `pinned` option order first, then DOM order. */
    private _applyPinned(items: Item[]): Item[] {
        if (!items.some((i) => i.pinned)) return items;
        const order = this.config.pinned;
        const rank = (i: Item): number => {
            const at = order.indexOf(i.value);
            return at === -1 ? order.length : at;
        };
        const pinned = items.filter((i) => i.pinned).sort((a, b) => rank(a) - rank(b));
        return [...pinned, ...items.filter((i) => !i.pinned)];
    }

    /** Build one dropdown option row (shared by the normal + virtual renderers). */
    private _buildOption(item: Item, index: number, rawQuery: string, checkboxMode: boolean): HTMLDivElement {
        const option = el('div', 's3__option');
        option.id = `${this.uid}-opt-${index}`;
        option.dataset.index = String(index);
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', item.selected ? 'true' : 'false');
        option.classList.toggle('is-selected', item.selected);
        option.classList.toggle('is-disabled', item.disabled);
        option.classList.toggle('is-pinned', !!item.pinned);
        // The last pinned row gets a divider separating it from the groups below.
        if (item.pinned && !this.matches[index + 1]?.pinned && this.matches.length > index + 1) {
            option.classList.add('s3__option--pinned-last');
        }

        if (checkboxMode) {
            option.classList.add('s3__option--cb');
            const box = el('span', 's3__checkbox');
            if (item.selected) box.classList.add('is-checked');
            option.append(box);
        }

        option.append(this._optionContent(item, rawQuery));
        if (item.selected && !checkboxMode) option.append(iconEl('fa-solid fa-check s3__check'));

        option.addEventListener('mouseenter', () => {
            this.activeIndex = index;
            this._highlight();
        });
        option.addEventListener('click', () => {
            if (item.disabled) return;
            item.selected && this.multiple ? this.deselect(item.value) : this.choose(item.value);
        });
        return option;
    }

    /**
     * Render only the visible window of a large list, with spacer divs above and
     * below so the scrollbar stays proportional. Optgroup headers are flattened
     * into the row list so groups survive virtualization (select-all / create are
     * still omitted in virtual mode).
     */
    private _renderVirtual(matched: Item[], rawQuery: string): void {
        this.matches = matched;
        this._virtual = true;
        if (!matched.length) {
            this._virtualRender = null;
            this._vRows = [];
            this._renderMessage(this.config.noResults);
            return;
        }
        const itemH = this.config.itemHeight;
        const checkboxMode = this.multiple && this.config.checkboxes;

        // Flatten to display rows, inserting a header whenever the group changes.
        const rows: Array<{ group: string } | { index: number }> = [];
        let lastGroup: string | null = null;
        matched.forEach((item, index) => {
            const group = this._displayGroup(item);
            if (group && group !== lastGroup) rows.push({ group });
            lastGroup = group;
            rows.push({ index });
        });
        this._vRows = rows;

        this._virtualRender = (): void => {
            const win = computeWindow(this.listbox.scrollTop, this.listbox.clientHeight || 240, itemH, rows.length);
            this.listbox.replaceChildren();
            const top = el('div', 's3__vspace');
            top.style.height = `${win.padTop}px`;
            this.listbox.append(top);
            for (let i = win.start; i < win.end; i++) {
                const row = rows[i];
                if (!row) continue;
                if ('group' in row) {
                    const header = el('div', 's3__group');
                    const tpl = this.config.templates.optgroupHeader;
                    if (tpl) header.append(this._slotNode(tpl(row.group, this._ctx())));
                    else header.textContent = row.group;
                    header.style.height = `${itemH}px`;
                    this.listbox.append(header);
                } else {
                    const item = matched[row.index];
                    if (!item) continue;
                    const option = this._buildOption(item, row.index, rawQuery, checkboxMode);
                    option.style.height = `${itemH}px`;
                    this.listbox.append(option);
                }
            }
            const bottom = el('div', 's3__vspace');
            bottom.style.height = `${win.padBottom}px`;
            this.listbox.append(bottom);
            this._highlight();
        };
        this._virtualRender();
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
            // original order as the stable tie-break. searchGroups widens the
            // haystack to the optgroup label; fuzzy adds subsequence matching.
            const fields = this.config.searchGroups
                ? [...this.config.searchField, 'group']
                : this.config.searchField;
            const scored = all
                .map((item, order) => ({ item, order, score: scoreItem(item, rawQuery, fields, this.config.fuzzy) }))
                .filter((x) => x.score > 0);
            const sorter = this.config.sort;
            if (typeof sorter === 'function') {
                scored.sort((a, b) => sorter(a.item, b.item));
            } else if (sorter) {
                scored.sort((a, b) => b.score - a.score || a.order - b.order);
            }
            matched = scored.map((x) => x.item);
        }

        // Recent: float recently-chosen values to the top (flat lists, empty query).
        if (!rawQuery && this.config.recent && !all.some((i) => i.group)) {
            matched = this._applyRecent(matched);
        }

        // Pinned: always lead the list (also while searching, if they match).
        matched = this._applyPinned(matched);

        // Virtual scroll: window a large (non-AJAX) list to a few rendered rows.
        this._virtual = false;
        if (this.config.virtualScroll && !this.config.ajax) {
            this._renderVirtual(matched, rawQuery);
            return;
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
            const typeToSearch = this.config.ajax && this.search.value.trim().length < this.config.minChars;
            if (typeToSearch) {
                this._renderMessage('Type to search…');
            } else if (this.config.templates.noResults) {
                this._renderMessage(this._slotNode(this.config.templates.noResults(rawQuery, this._ctx())));
            } else {
                this._renderMessage(this.config.noResults);
            }
            return;
        }

        // SumoSelect-style Select-All / Clear-All header (multi only).
        if (this.multiple && this.config.selectAll) {
            const enabled = all.filter((i) => !i.disabled);
            const selCount = enabled.filter((i) => i.selected).length;
            const allSelected = enabled.length > 0 && selCount === enabled.length;

            const row = el('div', 's3__selectall');
            const box = el('span', 's3__checkbox');
            if (allSelected) box.classList.add('is-checked');
            else if (selCount > 0) box.classList.add('is-indeterminate');
            const label = el('span');
            label.textContent = this.config.selectAllText;
            row.append(box, label);
            row.addEventListener('click', () => (allSelected ? this.clearAll() : this.selectAll()));
            this.listbox.append(row);

            const clear = el('button', 's3__clearall');
            clear.type = 'button';
            clear.textContent = this.config.clearAllText;
            clear.addEventListener('click', (e) => {
                e.stopPropagation();
                this.clearAll();
            });
            this.listbox.append(clear);
        }

        const checkboxMode = this.multiple && this.config.checkboxes;
        let lastGroup: string | null = null;
        this.matches.forEach((item, idx) => {
            const group = this._displayGroup(item);
            if (group && group !== lastGroup) {
                const header = el('div', 's3__group');
                const groupTpl = this.config.templates.optgroupHeader;
                if (groupTpl) header.append(this._slotNode(groupTpl(group, this._ctx())));
                else header.textContent = group;
                this.listbox.append(header);
            }
            lastGroup = group;
            this.listbox.append(this._buildOption(item, idx, rawQuery, checkboxMode));
        });

        if (canCreate) {
            const create = el('div', 's3__option s3__create');
            const q = this.search.value.trim();
            const createTpl = this.config.templates.create;
            if (createTpl) create.append(this._slotNode(createTpl(q, this._ctx())));
            else create.textContent = this.config.createText(q);
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
            const moreTpl = this.config.templates.loadingMore;
            if (moreTpl) loadMore.append(this._slotNode(moreTpl(this._ctx())));
            else loadMore.textContent = this.config.loadingMoreText;
            this.listbox.append(loadMore);
        }

        // Optional result-count summary footer.
        if (this.config.showCount) {
            const count = el('div', 's3__count');
            count.textContent = this.config.countText(this.matches.length);
            this.listbox.append(count);
        }

        // With addPrecedence, the create row (rendered right after the matches)
        // becomes the default highlighted action so Enter creates the tag.
        if (canCreate && this.config.addPrecedence) this.activeIndex = this.matches.length;

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
        if (this._virtual) {
            const count = this.matches.length;
            if (!count) return;
            let index = this.activeIndex;
            for (let i = 0; i < count; i++) {
                index = (index + direction + count) % count;
                if (!this.matches[index]?.disabled) break;
            }
            this.activeIndex = index;
            // Keep the active row in view, then re-window around the new position.
            // Use the option's row position (headers shift it) for the scroll math.
            const itemH = this.config.itemHeight;
            const vh = this.listbox.clientHeight || 240;
            const rowPos = this._vRows.findIndex((r) => 'index' in r && r.index === index);
            const top = (rowPos < 0 ? index : rowPos) * itemH;
            if (top < this.listbox.scrollTop) this.listbox.scrollTop = top;
            else if (top + itemH > this.listbox.scrollTop + vh) this.listbox.scrollTop = top + itemH - vh;
            this._virtualRender?.();
            return;
        }
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
        if (this._virtual) {
            const rows = [...this.listbox.querySelectorAll<HTMLElement>('.s3__option')];
            rows.forEach((o) => o.classList.toggle('is-active', Number(o.dataset.index) === this.activeIndex));
            const active = this.listbox.querySelector<HTMLElement>(`.s3__option[data-index="${this.activeIndex}"]`);
            if (active) {
                active.scrollIntoView({ block: 'nearest' });
                this.search.setAttribute('aria-activedescendant', active.id);
            } else {
                this.search.removeAttribute('aria-activedescendant');
            }
            return;
        }
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
        if (this._virtual) {
            const item = this.matches[this.activeIndex];
            if (item && !item.disabled) {
                item.selected && this.multiple ? this.deselect(item.value) : this.choose(item.value);
            }
            return;
        }
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
        this._pruneRemoteGroups();
        if (this._onNativeChange) {
            this.select.removeEventListener('change', this._onNativeChange);
            this._onNativeChange = null;
        }
        // Restore the native <select> beside the wrap before discarding it (in
        // native mode the select lives inside the wrap), so the element survives.
        this.wrap.before(this.select);
        this.wrap.remove();
        this.select.classList.remove('s3-native', 's3-native-overlay');
        this.select.removeAttribute('aria-hidden');
        this.select.tabIndex = 0;
        if (this._ariaRequired) this.select.required = true;
        delete this.select._s3;
        this._plugins.forEach((p) => p.destroy?.());
        this._plugins = [];
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
