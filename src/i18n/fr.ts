import type { Locale } from './types';

export const fr: Locale = {
    placeholder: 'Sélectionner…',
    noResults: 'Aucun résultat',
    loadingText: 'Recherche…',
    loadingMoreText: 'Chargement…',
    createText: (q) => `Créer « ${q} »`,
    moreText: (n) => `${n} de plus, affinez votre recherche`,
    maxReachedText: (max) => `Limite de ${max} atteinte`,
    selectAllText: 'Tout sélectionner',
    clearAllText: 'Tout effacer',
    okText: 'OK',
    cancelText: 'Annuler',
    captionFormat: (n) => `${n} sélectionnés`,
    captionFormatAllSelected: (n) => `Tous les ${n} sélectionnés`,
};

export default fr;
