// Pure, deterministic multi-bartender claim resolution. No DOM/db -> Node-testable.
// A claim = { orderId, byId, byName, at }. Every device converges to the same winner
// without negotiation: earliest `at` wins; ties broken by lexicographically smallest byId.
// Claims expire after CLAIM_TTL so a crashed owner doesn't lock an order forever.

export const CLAIM_TTL_MS = 90000;

export const isExpired = (claim, now = Date.now(), ttl = CLAIM_TTL_MS) =>
    !claim || (now - (claim.at || 0)) > ttl;

// Should `incoming` replace `existing` as the accepted claim for an order?
export const claimWins = (incoming, existing) => {
    if (!incoming) return false;
    if (!existing) return true;
    if (incoming.at !== existing.at) return incoming.at < existing.at;
    return String(incoming.byId) < String(existing.byId);
};

// Merge an incoming claim into the claims map (mutates a copy, returns it).
export const applyClaim = (claims, claim) => {
    const next = { ...(claims || {}) };
    if (claim && claim.orderId && claimWins(claim, next[claim.orderId])) {
        next[claim.orderId] = { byId: claim.byId, byName: claim.byName, at: claim.at };
    }
    return next;
};

// The active owner of an order, or null (none / expired).
export const ownerOf = (claims, orderId, now = Date.now(), ttl = CLAIM_TTL_MS) => {
    const c = claims && claims[orderId];
    return (c && !isExpired(c, now, ttl)) ? c : null;
};
