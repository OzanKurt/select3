import type { Locale } from './i18n/types';

/** Where the dropdown is attached. 'auto' portals into a modal ancestor if any. */
export type AppendTo = 'auto' | 'self' | 'body' | HTMLElement;

/** Extra classes merged onto Select3's elements for style customization. */
export interface ClassNames {
    wrap?: string;
    control?: string;
    dropdown?: string;
    listbox?: string;
    option?: string;
    tag?: string;
    search?: string;
}

/** A live plugin instance; the host only calls destroy() on teardown. */
export interface Select3Plugin {
    destroy?(): void;
}

/**
 * Wires behavior to an instance using its public API and events. `instance` is
 * the Select3 instance (typed as `any` here to avoid a types<->core import cycle;
 * plugin authors import the `Select3` type for their own parameter typing).
 */
export type PluginFactory = (instance: any, options?: Record<string, unknown>) => Select3Plugin | void;

/** Passed to every template slot; `escape` HTML-escapes interpolated strings. */
export interface RenderContext {
    escape: (s: string) => string;
}

/**
 * Custom render slots. Each returns a string (inserted as safe text) or a DOM
 * Node (inserted as-is — the caller owns its safety; Select3 never uses innerHTML).
 */
export interface Select3Templates {
    option?: (item: Item, ctx: RenderContext) => string | Node;
    item?: (item: Item, ctx: RenderContext) => string | Node;
    optgroupHeader?: (group: string, ctx: RenderContext) => string | Node;
    noResults?: (query: string, ctx: RenderContext) => string | Node;
    loading?: (ctx: RenderContext) => string | Node;
    loadingMore?: (ctx: RenderContext) => string | Node;
    create?: (query: string, ctx: RenderContext) => string | Node;
    caption?: (count: number, total: number, ctx: RenderContext) => string | Node;
}

/** A normalized remote row. `value`/`label` are required; extra fields are kept. */
export interface RemoteRow {
    value: string;
    label: string;
    [key: string]: unknown;
}

/** Result of mapping a raw server response into rows + a "more pages" flag. */
export interface ProcessedResults {
    results: RemoteRow[];
    hasMore: boolean;
}

/** Swap out the network layer (default uses fetch). */
export type Transport = (url: string, init: { signal: AbortSignal }) => Promise<unknown>;

/** Map a raw response (per page) into normalized results. */
export type ProcessResults = (raw: unknown, page: number) => ProcessedResults;

/** Public option bag accepted by createSelect3 / new Select3. All optional. */
/** select3's own controls that draw an icon. */
export type IconName = 'arrow' | 'clear' | 'remove' | 'check' | 'spinner';

/** An icon-font class list (rendered as an empty <i>), or a function returning a node. */
export type IconSource = string | (() => Node);

/**
 * 'svg' (default): built-in inline SVGs, no dependency.
 * 'fontawesome': Font Awesome 6 classes; load Font Awesome yourself.
 * A map overrides single icons; the rest stay SVG.
 */
export type IconSet = 'svg' | 'fontawesome' | Partial<Record<IconName, IconSource>>;

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
    // Behavior flags (P1).
    closeOnSelect?: boolean;
    openOnFocus?: boolean;
    selectOnTab?: boolean;
    hidePlaceholder?: boolean;
    maxItems?: number | null;
    maxReachedText?: (max: number) => string;
    // Search (P2).
    searchField?: string[];
    /** true = rank by relevance, false = original order, or a custom comparator. */
    sort?: boolean | ((a: Item, b: Item) => number);
    highlight?: boolean;
    /** Also match the query as an in-order subsequence (typo/abbreviation tolerant). */
    fuzzy?: boolean;
    /** Include each option's optgroup label in the searchable haystack. */
    searchGroups?: boolean;
    minResultsForSearch?: number;
    maxInputLength?: number;
    // Positioning & modal compatibility (P3).
    appendTo?: AppendTo;
    dropdownGap?: number;
    dropdownZ?: number;
    // Data / AJAX (P4).
    debounce?: number;
    preload?: boolean | 'focus';
    transport?: Transport;
    processResults?: ProcessResults;
    queryParam?: string;
    pageParam?: string;
    loadingMoreText?: string;
    /** Cache TTL (ms) for AJAX results; >0 serves stale results then revalidates. 0 = forever. */
    cacheTTL?: number;
    // SumoSelect UX (P5).
    selectAll?: boolean;
    selectAllText?: string;
    clearAllText?: string;
    okCancel?: boolean;
    okText?: string;
    cancelText?: string;
    clickAway?: 'commit' | 'revert';
    csvDispCount?: number;
    captionFormat?: (n: number) => string;
    captionFormatAllSelected?: (n: number) => string;
    captionPrefix?: string;
    checkboxes?: boolean;
    // Tagging extras (P7).
    tokenSeparators?: string[];
    createFilter?: RegExp | string | ((input: string) => boolean);
    persist?: boolean;
    addPrecedence?: boolean;
    /** Custom (optionally async) tag creation; return an option, or null/false to reject. */
    create?: (label: string) => CreatedOption | null | false | Promise<CreatedOption | null | false>;
    // Localization & style customization (P6).
    i18n?: Partial<Locale>;
    locale?: Partial<Locale>;
    classNames?: ClassNames;
    rtl?: boolean;
    /**
     * Apply a shipped theme preset by name (adds `s3--theme-<name>` to the wrap).
     * Load the matching CSS once, e.g. import '@ozankurt/select3/themes/bootstrap5'.
     * Built-in presets: 'bootstrap4', 'bootstrap5', 'tailwind'.
     */
    theme?: string | null;
    size?: 'sm' | 'md' | 'lg';
    /** Icons for the arrow, clear, tag remove, check and spinner (`data-icons`). Default 'svg'. */
    icons?: IconSet;
    templates?: Select3Templates;
    // UX pack: recent values, a result-count footer, and a loading spinner.
    /** Remember recently-chosen values (localStorage) and float them to the top. */
    recent?: boolean | { key?: string; max?: number };
    /**
     * Values always listed first, above every optgroup, in this order (e.g. a
     * "Same as company" default). Options with `data-pinned` are pinned too.
     */
    pinned?: string[];
    /** Show a "N results" summary row at the foot of the dropdown. */
    showCount?: boolean;
    countText?: (n: number) => string;
    // Virtual scroll (P8): window large lists to a handful of rendered rows.
    virtualScroll?: boolean;
    itemHeight?: number;
    // Native fallback (P8): keep the OS <select> picker on touch devices.
    nativeOnMobile?: boolean | 'auto';
    // Plugins (P9).
    plugins?: Array<string | PluginFactory | { name: string; options?: Record<string, unknown> }>;
}

/** Resolved, fully-populated config held on the instance. */
export type Select3Config = Required<
    Omit<
        Select3Options,
        | 'ajax'
        | 'maxItems'
        | 'i18n'
        | 'locale'
        | 'createFilter'
        | 'plugins'
        | 'nativeOnMobile'
        | 'create'
        | 'recent'
    >
> & {
    ajax: string | null;
    maxItems: number | null;
    /** Normalized from RegExp/string/function into a single predicate. */
    createFilter: (input: string) => boolean;
    create: ((label: string) => CreatedOption | null | false | Promise<CreatedOption | null | false>) | null;
    recent: { key: string; max: number } | null;
};

/** A normalized view of a native <option>. */
export interface Item {
    value: string;
    label: string;
    selected: boolean;
    disabled: boolean;
    placeholder: boolean;
    group: string | null;
    /** Listed above all groups (via the `pinned` option or `data-pinned`). */
    pinned?: boolean;
    /** The option's data-* attributes, for multi-field search. */
    data?: Record<string, string | undefined>;
}

/** Shape accepted by addOption()/addOptions(). */
export interface AddOptionInput {
    value: string;
    label: string;
    selected?: boolean;
    disabled?: boolean;
}

/** Returned by the async/custom `create` hook; merged into a new <option>. */
export interface CreatedOption {
    value: string;
    label?: string;
    [key: string]: unknown;
}
