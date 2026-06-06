import type { Locale } from './types';

export const tr: Locale = {
    placeholder: 'Seçiniz…',
    noResults: 'Sonuç yok',
    loadingText: 'Aranıyor…',
    loadingMoreText: 'Daha fazla yükleniyor…',
    createText: (q) => `“${q}” oluştur`,
    moreText: (n) => `${n} tane daha, aramanızı daraltın`,
    maxReachedText: (max) => `${max} sınırına ulaşıldı`,
    selectAllText: 'Tümünü seç',
    clearAllText: 'Tümünü temizle',
    okText: 'Tamam',
    cancelText: 'İptal',
    captionFormat: (n) => `${n} seçildi`,
    captionFormatAllSelected: (n) => `Tümü seçildi (${n})`,
};

export default tr;
