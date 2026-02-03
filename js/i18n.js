import { locales } from 'locales';

let currentLang = 'hr';

export const initI18n = (lang) => {
    if (locales[lang]) currentLang = lang;
    updateDOM();
    updateToggles();
};

export const t = (key, params = {}) => {
    const keys = key.split('.');
    let value = locales[currentLang];
    for (const k of keys) {
        value = value?.[k];
        if (!value) return key; 
    }
    if (typeof value === 'string') {
        Object.keys(params).forEach(k => value = value.replace(`{${k}}`, params[k]));
    }
    return value;
};

export const updateDOM = () => {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.dataset.i18n;
        if (el.tagName === 'INPUT' && el.type === 'text') {
            el.placeholder = t(key);
        } else {
            el.textContent = t(key);
        }
    });
};

const updateToggles = () => {
    document.querySelectorAll('[data-set-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.setLang === currentLang);
    });
};

export const setLanguage = (lang) => {
    if (locales[lang]) {
        currentLang = lang;
        localStorage.setItem('barlink_lang', lang);
        updateDOM();
        updateToggles();
    }
};

export const getLanguage = () => currentLang;
