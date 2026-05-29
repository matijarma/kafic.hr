// Pure reducer for the waiter's outbound pending-order queue.
// NO imports, NO localStorage, NO DOM — so it imports cleanly in Node for unit tests.
//
// Entry shape: { order, status: 'pending' | 'acked', attempts, firstSentAt, lastSentAt, ackedAt? }
// Actions:
//   { type: 'enqueue',    order, now }          - add a new order (idempotent by orderId)
//   { type: 'ack',        orderId, now }         - mark an order delivered
//   { type: 'retry-bump', now }                  - bump attempts/lastSentAt on all pending
//   { type: 'prune',      now, maxAgeMs }        - drop acked entries older than maxAgeMs

export const pendingReducer = (entries, action) => {
    const list = Array.isArray(entries) ? entries : [];
    switch (action && action.type) {
        case 'enqueue': {
            if (!action.order || !action.order.orderId) return list;
            if (list.some(e => e.order.orderId === action.order.orderId)) return list; // dedupe
            return [...list, {
                order: action.order,
                status: 'pending',
                attempts: 1,
                firstSentAt: action.now,
                lastSentAt: action.now
            }];
        }
        case 'ack': {
            return list.map(e =>
                e.order.orderId === action.orderId && e.status !== 'acked'
                    ? { ...e, status: 'acked', ackedAt: action.now }
                    : e
            );
        }
        case 'retry-bump': {
            return list.map(e =>
                e.status === 'pending'
                    ? { ...e, attempts: e.attempts + 1, lastSentAt: action.now }
                    : e
            );
        }
        case 'prune': {
            return list.filter(e =>
                !(e.status === 'acked' && action.now - (e.ackedAt || e.lastSentAt) > action.maxAgeMs)
            );
        }
        default:
            return list;
    }
};
