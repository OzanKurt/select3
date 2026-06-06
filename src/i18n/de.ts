import type { Locale } from './types';

export const de: Locale = {
    placeholder: 'Auswählen…',
    noResults: 'Keine Ergebnisse',
    loadingText: 'Suche…',
    loadingMoreText: 'Lade mehr…',
    createText: (q) => `„${q}“ erstellen`,
    moreText: (n) => `${n} weitere, Suche verfeinern`,
    maxReachedText: (max) => `Limit von ${max} erreicht`,
    selectAllText: 'Alle auswählen',
    clearAllText: 'Alle löschen',
    okText: 'OK',
    cancelText: 'Abbrechen',
    captionFormat: (n) => `${n} ausgewählt`,
    captionFormatAllSelected: (n) => `Alle ${n} ausgewählt`,
};

export default de;
