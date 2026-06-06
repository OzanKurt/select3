/** Where the dropdown is attached. 'auto' portals into a modal ancestor if any. */
export type AppendTo = 'auto' | 'self' | 'body' | HTMLElement;

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
    sort?: boolean;
    highlight?: boolean;
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
}

/** Resolved, fully-populated config held on the instance. */
export type Select3Config = Required<Omit<Select3Options, 'ajax' | 'maxItems'>> & {
    ajax: string | null;
    maxItems: number | null;
};

/** A normalized view of a native <option>. */
export interface Item {
    value: string;
    label: string;
    selected: boolean;
    disabled: boolean;
    placeholder: boolean;
    group: string | null;
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
