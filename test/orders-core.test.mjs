// Run: node --test   (Node 18+, no install needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pendingReducer } from '../js/orders-core.js';

const order = (id, table = 1) => ({ orderId: id, tableId: table, items: [] });

test('enqueue adds a pending entry', () => {
    const s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1000 });
    assert.equal(s.length, 1);
    assert.equal(s[0].status, 'pending');
    assert.equal(s[0].attempts, 1);
    assert.equal(s[0].firstSentAt, 1000);
    assert.equal(s[0].lastSentAt, 1000);
});

test('enqueue is idempotent by orderId', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1 });
    s = pendingReducer(s, { type: 'enqueue', order: order('a'), now: 2 });
    assert.equal(s.length, 1, 'duplicate orderId must not be added twice');
});

test('enqueue ignores orders without an orderId', () => {
    const s = pendingReducer([], { type: 'enqueue', order: { tableId: 1 }, now: 1 });
    assert.equal(s.length, 0);
});

test('ack flips matching entry to acked and stamps ackedAt', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1 });
    s = pendingReducer(s, { type: 'ack', orderId: 'a', now: 5000 });
    assert.equal(s[0].status, 'acked');
    assert.equal(s[0].ackedAt, 5000);
});

test('ack is idempotent and only affects the matching order', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1 });
    s = pendingReducer(s, { type: 'enqueue', order: order('b'), now: 1 });
    s = pendingReducer(s, { type: 'ack', orderId: 'a', now: 10 });
    s = pendingReducer(s, { type: 'ack', orderId: 'a', now: 20 }); // re-ack: no change
    const a = s.find(e => e.order.orderId === 'a');
    const b = s.find(e => e.order.orderId === 'b');
    assert.equal(a.ackedAt, 10, 're-ack must not overwrite the original ack time');
    assert.equal(b.status, 'pending', 'other orders untouched');
});

test('ack of unknown orderId is a no-op', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1 });
    s = pendingReducer(s, { type: 'ack', orderId: 'zzz', now: 5 });
    assert.equal(s[0].status, 'pending');
});

test('retry-bump increments attempts/lastSentAt for pending only', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('a'), now: 1 });
    s = pendingReducer(s, { type: 'enqueue', order: order('b'), now: 1 });
    s = pendingReducer(s, { type: 'ack', orderId: 'b', now: 2 });
    s = pendingReducer(s, { type: 'retry-bump', now: 9000 });
    const a = s.find(e => e.order.orderId === 'a');
    const b = s.find(e => e.order.orderId === 'b');
    assert.equal(a.attempts, 2);
    assert.equal(a.lastSentAt, 9000);
    assert.equal(b.attempts, 1, 'acked orders are not retried');
});

test('prune removes acked entries older than maxAgeMs, keeps recent + pending', () => {
    let s = pendingReducer([], { type: 'enqueue', order: order('old'), now: 0 });
    s = pendingReducer(s, { type: 'enqueue', order: order('new'), now: 0 });
    s = pendingReducer(s, { type: 'enqueue', order: order('live'), now: 0 });
    s = pendingReducer(s, { type: 'ack', orderId: 'old', now: 0 });
    s = pendingReducer(s, { type: 'ack', orderId: 'new', now: 9000 });
    s = pendingReducer(s, { type: 'prune', now: 10000, maxAgeMs: 5000 });
    const ids = s.map(e => e.order.orderId).sort();
    assert.deepEqual(ids, ['live', 'new'], 'old acked pruned; recent acked + pending kept');
});

test('unknown action returns the list unchanged', () => {
    const input = [{ order: order('a'), status: 'pending', attempts: 1 }];
    assert.equal(pendingReducer(input, { type: 'nope' }), input);
});

test('non-array entries are tolerated', () => {
    const s = pendingReducer(undefined, { type: 'enqueue', order: order('a'), now: 1 });
    assert.equal(s.length, 1);
});
