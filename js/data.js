
// Default Data
const DEFAULT_TABLE_COUNT = 20;

const DEFAULT_MENU = [
    {
        id: 'coffee', type: 'cat', label: 'Coffee',
        children: [
            { id: 'esp', type: 'node', label: 'Espresso', price: 1.5 },
            { id: 'dbl', type: 'node', label: 'Double Espresso', price: 2.2 },
            { id: 'amr', type: 'node', label: 'Americano', price: 2.0 }
        ]
    },
    {
        id: 'drinks', type: 'cat', label: 'Drinks',
        children: [
            { id: 'coke', type: 'node', label: 'Cola', price: 2.5 },
            { id: 'water', type: 'node', label: 'Water', price: 0 }
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
