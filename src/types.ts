/** Where the dropdown is attached. 'auto' portals into a modal ancestor if any. */
export type AppendTo = 'auto' | 'self' | 'body' | HTMLElement;

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
