/** Every user-facing string in Select3, for localization. */
export interface Locale {
    placeholder: string;
    noResults: string;
    loadingText: string;
    loadingMoreText: string;
    createText: (q: string) => string;
    moreText: (n: number) => string;
    maxReachedText: (max: number) => string;
    selectAllText: string;
    clearAllText: string;
    okText: string;
    cancelText: string;
    captionFormat: (n: number) => string;
    captionFormatAllSelected: (n: number) => string;
}
