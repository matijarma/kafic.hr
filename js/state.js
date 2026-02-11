export const state = {
    role: null, // 'waiter' | 'bartender'
    roomId: '',
    sessionCode: '',
    isHost: false,
    workerName: '',
    peers: {},
    currentTable: null,
    currentPath: [], // Array of menu objects (breadcrumbs)
    currentOrder: [], // Items pending send
    barOrders: [], // List of received orders
    unclearedTables: new Set(), // Set of tableIds that have pending orders
    soloMode: false, // New solo mode toggle
    syncMode: 'nosync' // 'nosync' | 'slave' | 'host'
};

export const resetWaiterState = () => {
    state.currentTable = null;
    state.currentPath = []; // Back to root
    state.currentOrder = [];
    // We do NOT reset unclearedTables here, as that persists across table selection
};

export const clearRuntimeState = () => {
    state.role = null;
    state.roomId = '';
    state.sessionCode = '';
    state.isHost = false;
    state.workerName = '';
    state.peers = {};
    state.barOrders = [];
    state.unclearedTables = new Set();
    state.soloMode = false;
    resetWaiterState();
};
