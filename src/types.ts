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
}

/** Resolved, fully-populated config held on the instance. */
export type Select3Config = Required<Omit<Select3Options, 'ajax'>> & { ajax: string | null };

/** A normalized view of a native <option>. */
export interface Item {
    value: string;
    label: string;
    selected: boolean;
    disabled: boolean;
    placeholder: boolean;
    group: string | null;
}
