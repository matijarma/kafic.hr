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
    barOrders: [] // List of received orders
};

export const resetWaiterState = () => {
    state.currentTable = null;
    state.currentPath = []; // Back to root
    state.currentOrder = [];
};

export const clearRuntimeState = () => {
    state.role = null;
    state.roomId = '';
    state.sessionCode = '';
    state.isHost = false;
    state.workerName = '';
    state.peers = {};
    state.barOrders = [];
    resetWaiterState();
};
