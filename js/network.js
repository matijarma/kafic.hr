import { joinRoom, selfId } from 'trystero';

const CONFIG = { appId: 'bar-link-v1' };

let room = null;
let sendAction = null;
let currentRoomId = '';
let currentSessionCode = '';
let currentIsHost = false;
let listenersBound = false;

// Reconnect & Heartbeat Configuration
let reconnectTimer = null;
let heartbeatInterval = null;
let lastReconnectAt = 0;

const RECONNECT_DEBOUNCE_MS = 1000;
const RECONNECT_COOLDOWN_MS = 3000;
const HEARTBEAT_MS = 2000;      // Ping every 2s
const PEER_TIMEOUT_MS = 6000;   // Dead after 6s (3 missed beats)

let onData = () => {};
let onStatus = () => {};

// Map<peerId, timestamp>
const presence = new Map();

const peerCount = () => presence.size;

const updateLastSeen = (peerId) => {
    if (!peerId) return;
    const now = Date.now();
    const isNew = !presence.has(peerId);
    presence.set(peerId, now);

    if (isNew) {
        onStatus({ type: 'join', peerId, peers: peerCount() });
        onStatus({ type: 'peers', peers: peerCount() });
    }
};

const checkHealth = () => {
    const now = Date.now();
    let changed = false;
    let hadPeers = presence.size > 0;

    for (const [peerId, lastSeen] of presence) {
        if (now - lastSeen > PEER_TIMEOUT_MS) {
            console.warn(`[Network] Peer timeout: ${peerId}`);
            presence.delete(peerId);
            onStatus({ type: 'leave', peerId, peers: presence.size });
            changed = true;
        }
    }

    if (changed) {
        onStatus({ type: 'peers', peers: presence.size });
    }

    // If we had peers but lost them all, we might be the one disconnected.
    // Trigger a reconnect to register our new network state.
    if (hadPeers && presence.size === 0) {
        console.log('[Network] Lost all peers. Triggering self-healing...');
        scheduleSoftReconnect(true);
    }
};

const startHeartbeat = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
        // 1. Send Ping
        if (room && sendAction) {
            try {
                // Lightweight heartbeat payload
                sendAction({ __hb: 1, t: Date.now() });
            } catch (e) {
                console.warn('[Network] Heartbeat send failed', e);
                // If we can't even send a heartbeat, we are likely broken.
                scheduleSoftReconnect(true);
            }
        }
        // 2. Check Pulse
        checkHealth();
    }, HEARTBEAT_MS);
};

const stopHeartbeat = () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = null;
};

const scheduleSoftReconnect = (force = false) => {
    const now = Date.now();
    // Allow forced reconnects to bypass cooldown if critical
    if (!force && now - lastReconnectAt < RECONNECT_COOLDOWN_MS) return;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    
    console.log(`[Network] Scheduling reconnect... (Force: ${force})`);
    
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        lastReconnectAt = Date.now();
        softReconnect();
    }, RECONNECT_DEBOUNCE_MS);
};

const setupRoom = (roomId) => {
    if (!roomId) return null;
    try {
        console.log(`[Network] Joining room: ${roomId}`);
        room = joinRoom(CONFIG, roomId);
    } catch (e) {
        console.error('[Network] joinRoom failed', e);
        onStatus({ type: 'error', error: e });
        throw e;
    }

    const [send, get] = room.makeAction('order');
    sendAction = send;

    get((data, peerId) => {
        // Always update health on ANY data received
        updateLastSeen(peerId);
        
        // Filter out heartbeats
        if (data && data.__hb) return;
        
        handleIncoming(data, peerId);
    });

    room.onPeerJoin((peerId) => {
        console.log(`[Network] Trystero: peer join ${peerId}`);
        updateLastSeen(peerId);
        // Immediately ping back so they know we exist
        try { sendAction({ __hb: 1, t: Date.now() }, peerId); } catch(e){}
    });

    room.onPeerLeave((peerId) => {
        console.log(`[Network] Trystero: peer leave ${peerId}`);
        if (presence.has(peerId)) {
            presence.delete(peerId);
            onStatus({ type: 'leave', peerId, peers: peerCount() });
            onStatus({ type: 'peers', peers: peerCount() });
        }
    });

    onStatus({ type: 'connected', peers: peerCount() });
    startHeartbeat();
    
    return room;
};

const handleIncoming = (data, peerId) => {
    if (data && typeof data === 'object') {
        if (data.type === 'NETWORK_UPDATE') {
            if (peerId) onStatus({ type: 'network-update', peerId, at: data.at });
            return;
        }
    }
    onData(data, peerId);
};

const sendPayload = (payload, targetId) => {
    if (!sendAction) return false;
    
    try {
        if (targetId) {
            sendAction(payload, targetId);
        } else {
            sendAction(payload);
        }
        return true;
    } catch (e) {
        console.error('[Network] Send failed. Network might be unstable.', e);
        // Immediate reaction to send failure
        scheduleSoftReconnect(true);
        return false;
    }
};

const bindNetworkListeners = () => {
    if (listenersBound) return;
    listenersBound = true;
    window.addEventListener('online', () => {
        console.log('[Network] OS reports Online');
        scheduleSoftReconnect(true);
    });
    window.addEventListener('offline', () => {
        console.log('[Network] OS reports Offline');
        // Don't reconnect if offline, just wait
    });
    if (navigator.connection) {
        navigator.connection.addEventListener('change', () => {
             console.log('[Network] Connection type changed');
             scheduleSoftReconnect(true);
        });
    }
};

const softReconnect = () => {
    if (!currentRoomId) return;
    console.log('[Network] >>> RECONNECTING <<<');
    
    // 1. Teardown
    stopHeartbeat();
    try { room?.leave(); } catch (e) {}
    room = null;
    sendAction = null;
    
    // 2. Clear peers (UI must update to show disconnected state)
    if (presence.size > 0) {
        presence.clear();
        onStatus({ type: 'peers', peers: 0 });
    }

    // 3. Re-initiate after a brief tick to allow socket cleanup
    setTimeout(() => {
        setupRoom(currentRoomId);
        
        // Announce return
        setTimeout(() => {
            sendPayload({ type: 'NETWORK_UPDATE', peerId: selfId, at: Date.now() });
        }, 500);
    }, 100);
};

export const initNetwork = (roomId, onDataCallback, onStatusChange = () => {}, restoredSessionData = null) => {
    onData = onDataCallback || (() => {});
    onStatus = onStatusChange || (() => {});
    currentRoomId = roomId || restoredSessionData?.roomId || '';
    currentSessionCode = restoredSessionData?.sessionCode || '';
    currentIsHost = Boolean(restoredSessionData?.isHost);

    if (!currentSessionCode && currentRoomId?.startsWith('barlink-')) {
        currentSessionCode = currentRoomId.replace('barlink-', '').toUpperCase();
    }

    setupRoom(currentRoomId);
    bindNetworkListeners();

    return room;
};

export const broadcast = (payload, targetId) => {
    if (!payload) return false;
    if (!sendAction) {
        console.warn('No peer connection; payload not sent');
        return false;
    }
    return sendPayload(payload, targetId);
};

export const getPeerCount = () => peerCount();
export { selfId };
