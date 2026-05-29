// Thin, quota-safe localStorage helpers for Phase 2 runtime-state persistence.
// Scoped to NEW kafic_* keys only — existing barlink_* keys are untouched.

export const readJSON = (key, fallback = null) => {
    try {
        const raw = localStorage.getItem(key);
        return raw == null ? fallback : JSON.parse(raw);
    } catch (e) {
        console.warn('[storage] read failed', key, e);
        return fallback;
    }
};

export const writeJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (e) {
        // Never let a full/blocked store break the order flow.
        console.warn('[storage] write failed', key, e);
        return false;
    }
};

// Set <-> Array helpers (avoids the JSON.stringify(Set) -> {} footgun).
export const readSet = (key) => {
    const arr = readJSON(key, []);
    return new Set(Array.isArray(arr) ? arr : []);
};

export const writeSet = (key, set) => writeJSON(key, [...set]);

export const removeKey = (key) => {
    try { localStorage.removeItem(key); } catch (e) {}
};

// Session-scoped key: base + session code.
export const scopedKey = (base, code) => `${base}__${code || 'nocode'}`;

// All per-session bases introduced in Phase 2.
const SCOPED_BASES = [
    'kafic_pending_orders', // waiter: unacked outbound queue
    'kafic_bar_orders',     // bartender: received orders
    'kafic_uncleared',      // waiter: table indicators
    'kafic_seen_orderids'   // bartender: dedup set
];

export const clearScoped = (code) => {
    SCOPED_BASES.forEach(base => removeKey(scopedKey(base, code)));
};
