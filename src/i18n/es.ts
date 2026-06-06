import type { Locale } from './types';

export const es: Locale = {
    placeholder: 'Seleccionar…',
    noResults: 'Sin resultados',
    loadingText: 'Buscando…',
    loadingMoreText: 'Cargando más…',
    createText: (q) => `Crear “${q}”`,
    moreText: (n) => `${n} más, refina tu búsqueda`,
    maxReachedText: (max) => `Límite de ${max} alcanzado`,
    selectAllText: 'Seleccionar todo',
    clearAllText: 'Limpiar todo',
    okText: 'Aceptar',
    cancelText: 'Cancelar',
    captionFormat: (n) => `${n} seleccionados`,
    captionFormatAllSelected: (n) => `Todos los ${n} seleccionados`,
};

export default es;
