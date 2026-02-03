
// Default Data
const DEFAULT_TABLE_COUNT = 20;

const DEFAULT_MENU = [
    {
        id: 'topli', type: 'cat', label: 'Topli napitci',
        children: [
            { id: 'esp', type: 'node', label: 'Espresso', price: 1.5 },
            { id: 'dbl', type: 'node', label: 'Dupli espresso', price: 2.2 },
            { id: 'mac', type: 'node', label: 'Macchiato', price: 1.9 },
            { id: 'cap', type: 'node', label: 'Cappuccino', price: 2.3 },
            { id: 'lat', type: 'node', label: 'Caffe latte', price: 2.5 },
            { id: 'kakao', type: 'node', label: 'Kakao', price: 2.4 },
            {
                id: 'cajevi', type: 'cat', label: 'Čajevi',
                children: [
                    { id: 'caj-zeleni', type: 'node', label: 'Zeleni čaj', price: 2.0 },
                    { id: 'caj-crni', type: 'node', label: 'Crni čaj', price: 2.0 },
                    { id: 'caj-vocni', type: 'node', label: 'Voćni čaj', price: 2.0 },
                    { id: 'caj-kamilica', type: 'node', label: 'Kamilica', price: 2.0 }
                ]
            }
        ]
    },
    {
        id: 'bezalk', type: 'cat', label: 'Bezalkoholna pića',
        children: [
            { id: 'cola', type: 'node', label: 'Coca-Cola', price: 2.6 },
            { id: 'cola-zero', type: 'node', label: 'Coca-Cola Zero', price: 2.6 },
            { id: 'fanta', type: 'node', label: 'Fanta', price: 2.6 },
            { id: 'sprite', type: 'node', label: 'Sprite', price: 2.6 },
            { id: 'mineralna', type: 'node', label: 'Mineralna voda', price: 2.0 },
            { id: 'prirodna', type: 'node', label: 'Prirodna voda', price: 1.6 },
            { id: 'ledeni', type: 'node', label: 'Ledeni čaj', price: 2.8 },
            {
                id: 'sokovi', type: 'cat', label: 'Sokovi',
                children: [
                    { id: 'sok-naranca', type: 'node', label: 'Naranča', price: 2.6 },
                    { id: 'sok-jabuka', type: 'node', label: 'Jabuka', price: 2.6 },
                    { id: 'sok-marelica', type: 'node', label: 'Marelica', price: 2.6 }
                ]
            }
        ]
    },
    {
        id: 'pivo', type: 'cat', label: 'Pivo',
        children: [
            { id: 'ozujsko', type: 'node', label: 'Ožujsko 0,5', price: 3.0 },
            { id: 'karlovacko', type: 'node', label: 'Karlovačko 0,5', price: 3.0 },
            { id: 'pan', type: 'node', label: 'Pan 0,5', price: 3.2 },
            { id: 'heineken', type: 'node', label: 'Heineken', price: 3.8 },
            { id: 'stella', type: 'node', label: 'Stella Artois', price: 3.8 },
            {
                id: 'craft', type: 'cat', label: 'Craft',
                children: [
                    { id: 'craft-ipa', type: 'node', label: 'IPA', price: 4.5 },
                    { id: 'craft-apa', type: 'node', label: 'APA', price: 4.5 },
                    { id: 'craft-lager', type: 'node', label: 'Lager', price: 4.2 }
                ]
            }
        ]
    },
    {
        id: 'zestoka', type: 'cat', label: 'Žestoka pića',
        children: [
            { id: 'pelinkovac', type: 'node', label: 'Pelinkovac', price: 2.8 },
            { id: 'rakija-sljiv', type: 'node', label: 'Rakija šljivovica', price: 2.8 },
            { id: 'rakija-loza', type: 'node', label: 'Rakija loza', price: 2.8 },
            { id: 'vodka', type: 'node', label: 'Vodka', price: 3.2 },
            { id: 'gin', type: 'node', label: 'Gin', price: 3.2 },
            { id: 'rum', type: 'node', label: 'Rum', price: 3.2 },
            { id: 'whiskey', type: 'node', label: 'Whiskey', price: 3.6 },
            {
                id: 'likeri', type: 'cat', label: 'Likeri',
                children: [
                    { id: 'jager', type: 'node', label: 'Jägermeister', price: 3.4 },
                    { id: 'amaretto', type: 'node', label: 'Amaretto', price: 3.4 },
                    { id: 'baileys', type: 'node', label: 'Baileys', price: 3.6 }
                ]
            }
        ]
    },
    {
        id: 'vina', type: 'cat', label: 'Vina',
        children: [
            { id: 'grasevina', type: 'node', label: 'Graševina', price: 3.2 },
            { id: 'malvazija', type: 'node', label: 'Malvazija', price: 3.2 },
            { id: 'plavac', type: 'node', label: 'Plavac', price: 3.4 },
            { id: 'merlot', type: 'node', label: 'Merlot', price: 3.4 },
            { id: 'rose', type: 'node', label: 'Rose', price: 3.2 },
            {
                id: 'pjenucci', type: 'cat', label: 'Pjenušci',
                children: [
                    { id: 'prosecco', type: 'node', label: 'Prosecco', price: 4.2 },
                    { id: 'brut', type: 'node', label: 'Brut', price: 4.0 }
                ]
            }
        ]
    },
    {
        id: 'ostalo', type: 'cat', label: 'Ostalo',
        children: [
            { id: 'energetsko', type: 'node', label: 'Energetsko piće', price: 3.4 },
            { id: 'tonic', type: 'node', label: 'Tonic', price: 2.8 },
            { id: 'bitter', type: 'node', label: 'Bitter lemon', price: 2.8 },
            { id: 'limonada', type: 'node', label: 'Domaća limunada', price: 2.8 },
            { id: 'led', type: 'node', label: 'Led', price: 0.8 },
            {
                id: 'grickalice', type: 'cat', label: 'Grickalice',
                children: [
                    { id: 'cips', type: 'node', label: 'Čips', price: 1.8 },
                    { id: 'kikiriki', type: 'node', label: 'Kikiriki', price: 1.8 },
                    { id: 'orasci', type: 'node', label: 'Oraščići', price: 2.0 }
                ]
            }
        ]
    }
];

// Active Data
let tableCount = DEFAULT_TABLE_COUNT;
let activeMenu = null;

// Initialize
function initData() {
    try {
        const storedCount = localStorage.getItem('barlink_table_count');
        if (storedCount) {
            tableCount = parseInt(storedCount, 10) || DEFAULT_TABLE_COUNT;
        } else {
            // Migration: Check for old tables array
            const oldTables = localStorage.getItem('barlink_tables');
            if (oldTables) {
                const arr = JSON.parse(oldTables);
                if (Array.isArray(arr)) tableCount = arr.length;
            }
        }
    } catch (e) { console.error(e); }

    try {
        const storedMenu = localStorage.getItem('barlink_menu');
        activeMenu = storedMenu ? JSON.parse(storedMenu) : DEFAULT_MENU;
    } catch (e) { activeMenu = DEFAULT_MENU; }
}

initData();

// Getters
export const getTableCount = () => tableCount;
export const getTables = () => {
    // Generate array on fly
    return Array.from({ length: tableCount }, (_, i) => ({ id: i + 1, label: `Table ${i + 1}` }));
};
export const getMenu = () => activeMenu;

// Setters
export const setTableCount = (count) => {
    tableCount = Math.max(1, parseInt(count) || 1);
    localStorage.setItem('barlink_table_count', tableCount);
};

// Deprecated but kept for now if used elsewhere, though manager handles it
export const saveTables = (arr) => {
    if (Array.isArray(arr)) setTableCount(arr.length);
};

export const saveMenu = (newMenu) => {
    activeMenu = newMenu;
    localStorage.setItem('barlink_menu', JSON.stringify(activeMenu));
};
