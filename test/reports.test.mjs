// Run: node --test test/reports.test.mjs   (Node 18+, no install)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summary, salesByItem, byTable, byWaiter, toCsv } from '../js/reports.js';

// Two orders: table 1 (cash, 2x espresso @1.5 = 3.00), table 2 (card, 1x cola @2.6 = 2.60)
const ORDERS = [
    {
        orderId: 'o1', timestamp: 1700000000000, tableId: 1, tableLabel: 'Stol 1',
        waiterName: 'Ana', senderId: 'p1', payment: 'cash',
        items: [{ id: 'esp', label: 'Espresso', qty: 2, unitPrice: 1.5, lineTotal: 3.0 }],
        orderTotal: 3.0
    },
    {
        orderId: 'o2', timestamp: 1700000100000, tableId: 2, tableLabel: 'Stol 2',
        waiterName: 'Ivo', senderId: 'p2', payment: 'card',
        items: [
            { id: 'cola', label: 'Coca-Cola', qty: 1, unitPrice: 2.6, lineTotal: 2.6 },
            { id: 'esp', label: 'Espresso', qty: 1, unitPrice: 1.5, lineTotal: 1.5 }
        ],
        orderTotal: 4.1
    }
];

test('summary aggregates counts, revenue, and payment breakdown', () => {
    const s = summary(ORDERS);
    assert.equal(s.orderCount, 2);
    assert.equal(s.itemCount, 4); // 2 + 1 + 1
    assert.equal(s.revenue, 7.1); // 3.0 + 4.1
    assert.equal(s.byPayment.cash.orders, 1);
    assert.equal(s.byPayment.cash.revenue, 3.0);
    assert.equal(s.byPayment.card.orders, 1);
    assert.equal(s.byPayment.card.revenue, 4.1);
});

test('summary on empty input is all-zero', () => {
    const s = summary([]);
    assert.deepEqual({ o: s.orderCount, i: s.itemCount, r: s.revenue }, { o: 0, i: 0, r: 0 });
    assert.deepEqual(s.byPayment, {});
});

test('salesByItem merges by id and sorts by qty desc', () => {
    const items = salesByItem(ORDERS);
    assert.equal(items[0].id, 'esp');     // 3 total (2 + 1) -> first
    assert.equal(items[0].qty, 3);
    assert.equal(items[0].revenue, 4.5);  // 3.0 + 1.5
    assert.equal(items[1].id, 'cola');
    assert.equal(items[1].qty, 1);
});

test('byTable groups per table sorted ascending', () => {
    const tables = byTable(ORDERS);
    assert.deepEqual(tables.map(t => t.tableId), [1, 2]);
    assert.equal(tables[0].revenue, 3.0);
    assert.equal(tables[1].revenue, 4.1);
});

test('byWaiter groups per waiter sorted by revenue desc', () => {
    const w = byWaiter(ORDERS);
    assert.equal(w[0].name, 'Ivo');  // 4.1 > 3.0
    assert.equal(w[0].revenue, 4.1);
    assert.equal(w[1].name, 'Ana');
});

test('money rounding avoids float drift', () => {
    const drift = [{
        orderId: 'd', timestamp: 1, tableId: 1, payment: 'cash',
        items: [{ id: 'x', label: 'X', qty: 3, unitPrice: 0.1, lineTotal: 0.30000000000000004 }],
        orderTotal: 0.30000000000000004
    }];
    assert.equal(summary(drift).revenue, 0.3);
    assert.equal(salesByItem(drift)[0].revenue, 0.3);
});

test('toCsv emits a header + one row per line item with escaping', () => {
    const csv = toCsv([{
        orderId: 'o1', timestamp: 1700000000000, tableId: 1, tableLabel: 'Stol 1',
        waiterName: 'Ann, "the boss"', senderId: 'p1', payment: 'cash',
        items: [{ id: 'esp', label: 'Espresso', qty: 2, unitPrice: 1.5, lineTotal: 3.0 }],
        orderTotal: 3.0
    }]);
    const lines = csv.split('\r\n');
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^orderId,timestamp,table,waiter,payment,item,qty,unitPrice,lineTotal$/);
    assert.match(lines[1], /"Ann, ""the boss"""/); // comma + quotes escaped
    assert.match(lines[1], /2023-11-14T/);          // ISO timestamp
});

test('payment defaults to "unknown" bucket when missing', () => {
    const s = summary([{ orderId: 'x', timestamp: 1, tableId: 1, items: [], orderTotal: 0 }]);
    assert.ok(s.byPayment.unknown);
    assert.equal(s.byPayment.unknown.orders, 1);
});
