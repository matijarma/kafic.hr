// I/O layer over the pure pendingReducer: persistence + retry + status listener.
import { pendingReducer } from 'orders-core';
import { readJSON, writeJSON, scopedKey } from 'storage';
import { state } from 'state';

const KEY_BASE = 'kafic_pending_orders';
const PRUNE_MAX_AGE_MS = 60000;   // drop acked entries after 60s
const RETRY_DEBOUNCE_MS = 1500;   // coalesce reconnect bursts (join/network-update/connected)

let listener = null;
let retryTimer = null;

const key = () => scopedKey(KEY_BASE, state.sessionCode);
const load = () => {
    const v = readJSON(key(), []);
    return Array.isArray(v) ? v : [];
};
const save = (entries) => {
    writeJSON(key(), entries);
    if (listener) { try { listener(entries); } catch (e) {} }
    return entries;
};
const dispatch = (action) => save(pendingReducer(load(), action));

export const enqueueOrder = (order) => dispatch({ type: 'enqueue', order, now: Date.now() });
export const markAcked = (orderId) => dispatch({ type: 'ack', orderId, now: Date.now() });
export const getPending = () => load();
export const pruneAcked = (maxAgeMs = PRUNE_MAX_AGE_MS) => dispatch({ type: 'prune', now: Date.now(), maxAgeMs });
export const setStatusListener = (fn) => { listener = fn; };

// Re-broadcast all still-pending orders. Debounced so a reconnect burst sends once.
export const retryAll = (broadcastFn) => {
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        const pending = load().filter(e => e.status === 'pending');
        if (pending.length === 0) return;
        pending.forEach(e => { try { broadcastFn(e.order); } catch (err) {} });
        dispatch({ type: 'retry-bump', now: Date.now() });
    }, RETRY_DEBOUNCE_MS);
};
