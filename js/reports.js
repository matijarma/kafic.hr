// Pure aggregation over the host-local order log. No DOM, no db, no i18n imports
// -> unit-testable in Node. Input: array of order records (see bartender.persistOrder).
//
// Record shape:
//   { orderId, timestamp, completedAt, tableId, tableLabel, waiterName, senderId,
//     payment, items: [{ id, label, qty, unitPrice, lineTotal }], orderTotal }

const round2 = (n) => Math.round((n || 0) * 100) / 100;

export const summary = (orders) => {
    const byPayment = {};
    let orderCount = 0, itemCount = 0, revenue = 0;
    for (const o of orders || []) {
        orderCount++;
        const total = o.orderTotal || 0;
        revenue += total;
        for (const it of o.items || []) itemCount += it.qty || 0;
        const p = o.payment || 'unknown';
        if (!byPayment[p]) byPayment[p] = { orders: 0, revenue: 0 };
        byPayment[p].orders++;
        byPayment[p].revenue += total;
    }
    Object.values(byPayment).forEach(v => { v.revenue = round2(v.revenue); });
    return { orderCount, itemCount, revenue: round2(revenue), byPayment };
};

export const salesByItem = (orders) => {
    const map = new Map();
    for (const o of orders || []) {
        for (const it of o.items || []) {
            const key = it.id || it.label;
            const cur = map.get(key) || { id: it.id, label: it.label, qty: 0, revenue: 0 };
            cur.qty += it.qty || 0;
            cur.revenue += it.lineTotal || 0;
            if (it.label) cur.label = it.label; // freshest label wins
            map.set(key, cur);
        }
    }
    return [...map.values()]
        .map(v => ({ ...v, revenue: round2(v.revenue) }))
        .sort((a, b) => b.qty - a.qty || b.revenue - a.revenue);
};

export const byTable = (orders) => {
    const map = new Map();
    for (const o of orders || []) {
        const key = o.tableId;
        const cur = map.get(key) || { tableId: o.tableId, label: o.tableLabel || String(o.tableId), orders: 0, revenue: 0 };
        cur.orders++;
        cur.revenue += o.orderTotal || 0;
        map.set(key, cur);
    }
    return [...map.values()]
        .map(v => ({ ...v, revenue: round2(v.revenue) }))
        .sort((a, b) => (a.tableId || 0) - (b.tableId || 0));
};

export const byWaiter = (orders) => {
    const map = new Map();
    for (const o of orders || []) {
        const key = o.waiterName || o.senderId || 'unknown';
        const cur = map.get(key) || { name: o.waiterName || o.senderId || '', orders: 0, revenue: 0 };
        cur.orders++;
        cur.revenue += o.orderTotal || 0;
        map.set(key, cur);
    }
    return [...map.values()]
        .map(v => ({ ...v, revenue: round2(v.revenue) }))
        .sort((a, b) => b.revenue - a.revenue);
};

const csvField = (val) => {
    const s = String(val == null ? '' : val);
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// --- Analytics (Phase 2, pure) ---

// 24-slot array keyed by hour-of-day from each order's timestamp (drives the heatmap).
export const byHour = (orders) => {
    const slots = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0, items: 0, revenue: 0 }));
    for (const o of orders || []) {
        if (!o.timestamp) continue;
        const h = new Date(o.timestamp).getHours();
        if (h < 0 || h > 23) continue;
        const s = slots[h];
        s.orders++;
        for (const it of o.items || []) s.items += it.qty || 0;
        s.revenue += o.orderTotal || 0;
    }
    slots.forEach(s => { s.revenue = round2(s.revenue); });
    return slots;
};

// Top N best-selling items by qty (thin wrapper over salesByItem).
export const bestSellers = (orders, n = 5) => salesByItem(orders).slice(0, Math.max(0, n));

// Average order value (revenue / orderCount), guarded against /0.
export const averageOrderValue = (orders) => {
    const s = summary(orders);
    return s.orderCount > 0 ? round2(s.revenue / s.orderCount) : 0;
};

// Map archived shift aggregates to a compact trend series (oldest -> newest).
export const trendAcrossShifts = (shiftRecords) => {
    return [...(shiftRecords || [])]
        .sort((a, b) => (a.startTs || 0) - (b.startTs || 0))
        .map(s => {
            const sum = s.summary || {};
            return {
                shiftId: s.shiftId,
                startTs: s.startTs,
                endTs: s.endTs,
                revenue: round2(sum.revenue || 0),
                orderCount: sum.orderCount || 0,
                aov: sum.orderCount ? round2((sum.revenue || 0) / sum.orderCount) : 0
            };
        });
};

// Frozen aggregate persisted at shift close (see db.saveShift). Snapshots all the
// breakdowns + byHour so history survives even after the raw order log is cleared.
export const buildShiftAggregate = (orders, meta = {}) => ({
    shiftId: meta.shiftId,
    startTs: meta.startTs || 0,
    endTs: meta.endTs || 0,
    closedBy: meta.closedBy || '',
    summary: summary(orders),
    byItem: salesByItem(orders),
    byTable: byTable(orders),
    byWaiter: byWaiter(orders),
    byHour: byHour(orders)
});

// RFC-4180-ish, one row per line item. Raw numbers + ISO timestamps (spreadsheet-safe).
export const toCsv = (orders) => {
    const header = ['orderId', 'timestamp', 'table', 'waiter', 'payment', 'item', 'qty', 'unitPrice', 'lineTotal'];
    const rows = [header.join(',')];
    for (const o of orders || []) {
        const ts = o.timestamp ? new Date(o.timestamp).toISOString() : '';
        for (const it of o.items || []) {
            rows.push([
                csvField(o.orderId), csvField(ts), csvField(o.tableLabel || o.tableId),
                csvField(o.waiterName || o.senderId || ''), csvField(o.payment || ''),
                csvField(it.label), csvField(it.qty), csvField(it.unitPrice), csvField(it.lineTotal)
            ].join(','));
        }
    }
    return rows.join('\r\n');
};
