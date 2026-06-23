import { t } from 'i18n';
import { toast, toastAction, icon } from 'ux';
import { state } from 'state';
import { broadcast, selfId } from 'network';
import { readJSON, writeJSON, readSet, writeSet, scopedKey } from 'storage';
import { saveOrder, getOrdersSince } from 'db';
import { getMenu, saveMenu, ensureShiftStart, getShiftStart, getPriceRules, getTableCount } from 'data';
import { buildEffectivePriceMap } from 'pricing';
import { printReceipt } from 'printing';
import { applyClaim, ownerOf } from 'claims';

const feed = document.getElementById('bartender-feed');
const openPill = document.getElementById('feed-open-pill');
const tableCards = new Map();
let onComplete = () => {};

// Order age buckets for the colour-coded left bar (recomputed on a tick).
const computeAgeClass = (ts) => {
    const ageMs = Date.now() - (ts || Date.now());
    return ageMs < 60000 ? 'fresh' : ageMs < 240000 ? 'aging' : 'overdue';
};

// --- Persistence + dedup (host-local) ---
const barOrdersKey = () => scopedKey('kafic_bar_orders', state.sessionCode);
const seenKey = () => scopedKey('kafic_seen_orderids', state.sessionCode);
const persistBarOrders = () => writeJSON(barOrdersKey(), state.barOrders);
const removeBarOrder = (orderId) => {
    const i = state.barOrders.findIndex(o => o && o.orderId === orderId);
    if (i >= 0) { state.barOrders.splice(i, 1); persistBarOrders(); }
};

// --- Multi-bartender claim (advisory: shows who's making an order; never gates completion) ---
const claimsKey = () => scopedKey('kafic_claims', state.sessionCode);
let claims = {};
const loadClaims = () => { claims = readJSON(claimsKey(), {}) || {}; };
const persistClaims = () => writeJSON(claimsKey(), claims);

const renderClaimBadge = (orderEl, orderId) => {
    if (!orderEl) return;
    const o = ownerOf(claims, orderId);
    let badge = orderEl.querySelector('.claim-badge');
    if (o && o.byId !== selfId) {
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'claim-badge';
            const meta = orderEl.querySelector('.feed-meta');
            if (meta) meta.appendChild(badge);
        }
        badge.textContent = t('bartender.claimed_by', { name: o.byName || '—' });
        orderEl.classList.add('claimed-by-other');
    } else {
        if (badge) badge.remove();
        orderEl.classList.remove('claimed-by-other');
    }
};

const claimOrder = (orderId) => {
    const claim = { orderId, byId: selfId, byName: state.workerName || '', at: Date.now() };
    claims = applyClaim(claims, claim);
    persistClaims();
    try { broadcast({ type: 'order-claim', ...claim }); } catch (e) {}
    const reg = orderRegistry.get(orderId);
    if (reg) renderClaimBadge(reg.orderEl, orderId);
};

// Claim received from another bartender device.
export const onClaim = (data) => {
    claims = applyClaim(claims, data);
    persistClaims();
    const reg = orderRegistry.get(data.orderId);
    if (reg) renderClaimBadge(reg.orderEl, data.orderId);
};

// Build an id -> price lookup from the host's own menu (waiters never send price),
// applying any active scheduled-pricing rules at capture time (authoritative).
const buildPriceMap = () => buildEffectivePriceMap(getMenu(), getPriceRules(), new Date());

// Persist a received order to the host-local log (IndexedDB), snapshotting prices
// at capture time so later menu edits don't rewrite past shift revenue.
const persistOrder = async (data) => {
    try {
        ensureShiftStart();
        const prices = buildPriceMap();
        const items = (data.items || []).map(it => {
            const qty = it.qty || 0;
            const unitPrice = typeof prices[it.id] === 'number' ? prices[it.id] : 0;
            return { id: it.id, label: it.label, qty, unitPrice, lineTotal: Math.round(unitPrice * qty * 100) / 100, note: it.note || '' };
        });
        const orderTotal = Math.round(items.reduce((s, i) => s + i.lineTotal, 0) * 100) / 100;
        const waiterName = (state.peers[data.senderId] && state.peers[data.senderId].name)
            || (state.soloMode ? state.workerName : '') || '';
        await saveOrder({
            orderId: data.orderId,
            timestamp: data.timestamp || Date.now(),
            completedAt: null,
            tableId: data.tableId,
            tableLabel: t('bartender.table_label', { table: data.tableId }),
            waiterName,
            senderId: data.senderId || '',
            payment: (data.items && data.items[0] && data.items[0].payment) || 'unknown',
            items,
            orderTotal
        });

        // Inventory: decrement tracked leaf nodes (host-authoritative) + broadcast updates.
        try {
            const menu = getMenu();
            const byId = {};
            const walk = (nodes) => (nodes || []).forEach(n => { if (n.children) walk(n.children); else if (n.id != null) byId[n.id] = n; });
            walk(menu);
            let changed = false;
            (data.items || []).forEach(it => {
                const node = byId[it.id];
                if (node && node.track) {
                    node.stock = Math.max(0, (Number(node.stock) || 0) - (it.qty || 0));
                    changed = true;
                    broadcast({ type: 'stock-update', id: it.id, stock: node.stock });
                }
            });
            if (changed) saveMenu(menu);
        } catch (e) { /* inventory is best-effort, never block */ }
    } catch (e) {
        console.warn('[reports] persistOrder failed', e); // never block order display
    }
};

// --- Deferred completion (undo window) ---
const FINALIZE_DELAY_MS = 5000;
const orderRegistry = new Map();      // orderId -> { orderEl, card, data }
const pendingCompletions = new Map(); // orderId -> finalize timer

// Sound
let ctx = null;
try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
} catch (e) {
    ctx = null;
}

let ageTick = null;
const AGE_TICK_MS = 30000;
const refreshAges = () => {
    orderRegistry.forEach(({ orderEl, data }) => {
        if (!orderEl) return;
        const cls = computeAgeClass(data.timestamp);
        orderEl.classList.remove('fresh', 'aging', 'overdue');
        orderEl.classList.add(cls);
    });
};

export const initBartender = () => {
    loadClaims();
    render();
    if (ageTick) clearInterval(ageTick);
    ageTick = setInterval(refreshAges, AGE_TICK_MS);
};

export const setOrderCompletionHandler = (fn) => {
    onComplete = fn;
};

// Apply a per-item "done" toggle received from another bartender device.
export const onItemDone = (data) => {
    const reg = orderRegistry.get(data.orderId);
    if (!reg) return;
    const el = reg.orderEl.querySelector(`.feed-item[data-item-idx="${data.itemIdx}"]`);
    if (el) el.classList.toggle('done', !!data.done);
    reg.data.doneItems = reg.data.doneItems || [];
    const at = reg.data.doneItems.indexOf(data.itemIdx);
    if (data.done && at < 0) reg.data.doneItems.push(data.itemIdx);
    if (!data.done && at >= 0) reg.data.doneItems.splice(at, 1);
    persistBarOrders();
};

export const onOrderReceived = (data, opts = {}) => {
    const silent = opts.silent === true; // silent = rehydration replay (no ack/notify/persist)

    // Ensure every order has an id (older payloads / solo edge cases).
    if (!data.orderId) {
        data.orderId = 'local-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    }

    if (!silent) {
        // Only the bar (bartender role, or solo device) handles incoming orders.
        // In a mesh, a new-order also reaches other waiters — they must ignore it.
        const isBar = state.role === 'bartender' || state.soloMode;
        if (!isBar) return;

        // Security: drop malformed/abusive guest orders (out-of-range table or unknown items).
        if (data.origin === 'customer') {
            const maxT = getTableCount();
            const tid = Number(data.tableId);
            if (!Number.isInteger(tid) || tid < 1 || tid > maxT) return;
            const ids = new Set();
            const walk = (nodes) => (nodes || []).forEach(n => { if (n.children) walk(n.children); else if (n.id != null) ids.add(n.id); });
            walk(getMenu());
            if (!(data.items || []).length || !(data.items || []).every(it => ids.has(it.id))) return;
        }

        // Acknowledge receipt so the waiter's pending order flips to "delivered".
        // Re-ack duplicates too (cheap, helps a retrying waiter), but don't re-render them.
        broadcast({
            type: 'order-ack', orderId: data.orderId,
            byId: selfId, byName: state.workerName, at: Date.now()
        });

        // Dedup against the persisted seen-set (survives reload; blocks resurrection
        // of an already-completed order if a waiter retries late).
        const seen = readSet(seenKey());
        if (seen.has(data.orderId)) return;
        seen.add(data.orderId);
        writeSet(seenKey(), seen);

        state.barOrders.push(data);
        persistBarOrders();
        persistOrder(data); // host-local order log (fire-and-forget)
    }

    let card = tableCards.get(data.tableId);
    if (!card) {
        card = createTableCard(data.tableId);
        tableCards.set(data.tableId, card);
    }

    addOrderToCard(card, data);

    // Insert at top, but after empty state if it exists
    const empty = feed.querySelector('.empty-state');
    if (empty) empty.remove();

    feed.prepend(card.el);
    if (!silent) notify(data);
};

// Rebuild the feed from persisted orders after a reload/resume.
export const rehydrateBarOrders = () => {
    tableCards.forEach(c => c.el.remove());
    tableCards.clear();
    orderRegistry.clear();
    pendingCompletions.forEach(timer => clearTimeout(timer));
    pendingCompletions.clear();
    feed.innerHTML = '';

    let stored = readJSON(barOrdersKey(), []);
    if (!Array.isArray(stored)) stored = [];
    // Drop anything older than 12h to avoid stale carry-over.
    const cutoff = Date.now() - 12 * 3600 * 1000;
    state.barOrders = stored.filter(o => o && (o.timestamp || 0) >= cutoff);
    persistBarOrders();

    state.barOrders.forEach(o => onOrderReceived(o, { silent: true }));
    checkEmpty();
};

const createTableCard = (tableId) => {
    const el = document.createElement('div');
    el.className = 'feed-card';

    let html = `
        <div class="feed-header">
            <div class="feed-title-row">
                <span class="feed-table-chip">${tableId}</span>
                <span class="feed-title">${t('bartender.table_label', { table: tableId })}</span>
                <span class="feed-count" data-count>0</span>
            </div>
        </div>
        <div class="feed-orders"></div>
    `;
    
    el.innerHTML = html;

    return {
        el,
        ordersEl: el.querySelector('.feed-orders'),
        countEl: el.querySelector('[data-count]'),
        tableId
    };
};

const addOrderToCard = (card, data) => {
    const time = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Extract payment from first item (batch level)
    const payment = data.items[0]?.payment;
    const iconMap = { cash: 'money-bill-alt', card: 'credit-card', virman: 'file-invoice', house: 'gift' };
    const payIcon = payment 
        ? `<span class="order-payment-icon">${icon(iconMap[payment])}</span>`
        : '';

    const doneSet = new Set(data.doneItems || []);
    const itemsHtml = data.items.map((item, idx) => {
        let style = '';
        if (item.color) {
            const [r,g,b] = item.color;
            // Use a very light background + a left border for color identification
            style = `style="background: rgba(${r},${g},${b},0.12); border-left: 4px solid rgb(${r},${g},${b});"`;
        }

        return `
        <div class="feed-item ${doneSet.has(idx) ? 'done' : ''}" data-item-idx="${idx}" ${style}>
            <div class="feed-item-name">
                <span class="qty">${item.qty}×</span>
                <span class="label-text">${item.label}</span>
            </div>
            ${item.context ? `<div class="feed-item-context">${item.context}</div>` : ''}
            ${item.note ? `<div class="feed-item-note">“${item.note}”</div>` : ''}
        </div>
        `;
    }).join('');

    const orderEl = document.createElement('div');
    orderEl.className = 'feed-order ' + computeAgeClass(data.timestamp) + (data.origin === 'customer' ? ' customer' : '');
    orderEl.dataset.orderId = data.orderId;
    const guestBadge = data.origin === 'customer' ? `<span class="guest-badge">${icon('cup')} ${t('customer.guest')}</span>` : '';
    orderEl.innerHTML = `
        <div class="feed-order-header">
            <div class="feed-meta">
                <span class="feed-order-time">${time}</span>
                ${payIcon}
                ${guestBadge}
            </div>
            <button class="feed-icon-btn" data-action="print" aria-label="print">${icon('file-invoice')}</button>
        </div>
        <div class="feed-order-items">
            ${itemsHtml}
        </div>
        <button class="feed-btn feed-order-done" data-action="done">${icon('check-circle')} ${t('actions.mark_done')}</button>
    `;

    orderRegistry.set(data.orderId, { orderEl, card, data });
    renderClaimBadge(orderEl, data.orderId);
    orderEl.querySelector('[data-action="done"]').onclick = () => beginCompletion(data.orderId);
    const printBtn = orderEl.querySelector('[data-action="print"]');
    if (printBtn) printBtn.onclick = (e) => {
        e.stopPropagation();
        const prices = buildPriceMap();
        printReceipt({
            tableId: data.tableId,
            tableLabel: t('bartender.table_label', { table: data.tableId }),
            timestamp: data.timestamp,
            items: (data.items || []).map(it => ({ label: it.label, qty: it.qty, note: it.note, unitPrice: prices[it.id] || 0 }))
        });
    };

    // Per-item "done" strike — progress only; does NOT finalize the order (that's the Done button + undo).
    orderEl.querySelectorAll('.feed-item').forEach(el => {
        el.addEventListener('click', () => {
            claimOrder(data.orderId); // first interaction = "I'm making this"
            const idx = Number(el.dataset.itemIdx);
            data.doneItems = data.doneItems || [];
            const at = data.doneItems.indexOf(idx);
            const nowDone = at < 0;
            if (nowDone) data.doneItems.push(idx); else data.doneItems.splice(at, 1);
            el.classList.toggle('done', nowDone);
            persistBarOrders();
            broadcast({ type: 'item-done', orderId: data.orderId, itemIdx: idx, done: nowDone });
        });
    });

    // Swipe-to-complete
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    orderEl.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        isSwiping = true;
        orderEl.style.transition = 'none';
    }, { passive: true });

    orderEl.addEventListener('touchmove', (e) => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX - startX;
        if (currentX > 0) {
            orderEl.style.transform = `translateX(${currentX}px)`;
            orderEl.style.opacity = Math.max(0.3, 1 - (currentX / 250));
        }
    }, { passive: true });

    const handleSwipeEnd = () => {
        if (!isSwiping) return;
        isSwiping = false;
        orderEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
        if (currentX > 100) {
            beginCompletion(data.orderId); // routes through the same undo window
        } else {
            // Reset
            orderEl.style.transform = 'translateX(0)';
            orderEl.style.opacity = '1';
        }
        currentX = 0;
    };

    orderEl.addEventListener('touchend', handleSwipeEnd);
    orderEl.addEventListener('touchcancel', handleSwipeEnd);

    card.ordersEl.prepend(orderEl);
    updateTableCount(card);
};

// Orders not mid-completion (used for counts + card visibility).
const visibleOrderCount = (card) =>
    [...card.ordersEl.children].filter(c => !c.classList.contains('completing')).length;

const totalOpen = () => {
    let n = 0;
    tableCards.forEach(c => { n += visibleOrderCount(c); });
    return n;
};
const updateOpenPill = () => {
    if (!openPill) return;
    const n = totalOpen();
    if (n > 0) {
        openPill.textContent = t('bartender.open_count', { count: n });
        openPill.classList.remove('hidden');
    } else {
        openPill.classList.add('hidden');
    }
};

const updateTableCount = (card) => {
    if (card?.countEl) card.countEl.textContent = visibleOrderCount(card);
    updateOpenPill();
};

const refreshCardVisual = (card) => {
    updateTableCount(card);
    // Hide the card while all its orders are mid-completion; restored on undo.
    card.el.style.display = visibleOrderCount(card) === 0 ? 'none' : '';
};

// Start the undo window: collapse the order visually, defer the real completion.
const beginCompletion = (orderId) => {
    const reg = orderRegistry.get(orderId);
    if (!reg || pendingCompletions.has(orderId)) return;
    claimOrder(orderId);
    const { orderEl, card } = reg;

    orderEl.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
    orderEl.style.opacity = '0';
    orderEl.style.transform = 'translateX(100%)';
    setTimeout(() => {
        orderEl.classList.add('completing');
        orderEl.style.display = 'none';
        refreshCardVisual(card);
    }, 200);

    const timer = setTimeout(() => finalizeCompletion(orderId), FINALIZE_DELAY_MS);
    pendingCompletions.set(orderId, timer);

    toastAction(
        t('alerts.order_done_undo'),
        t('actions.undo'),
        () => undoCompletion(orderId),
        { type: 'info', duration: FINALIZE_DELAY_MS }
    );
};

const undoCompletion = (orderId) => {
    const timer = pendingCompletions.get(orderId);
    if (timer) clearTimeout(timer);
    pendingCompletions.delete(orderId);

    const reg = orderRegistry.get(orderId);
    if (!reg) return;
    const { orderEl, card } = reg;

    orderEl.classList.remove('completing');
    orderEl.style.display = '';
    orderEl.style.opacity = '1';
    orderEl.style.transform = 'translateX(0)';

    // Card may have been hidden (or the empty-state shown) — bring it back.
    card.el.style.display = '';
    if (!feed.contains(card.el)) {
        const empty = feed.querySelector('.empty-state');
        if (empty) empty.remove();
        feed.prepend(card.el);
    }
    refreshCardVisual(card);
};

// Undo window elapsed: permanently remove the order; if the table is now empty,
// broadcast the table completion to peers (deferred until here — never premature).
const finalizeCompletion = (orderId) => {
    pendingCompletions.delete(orderId);
    const reg = orderRegistry.get(orderId);
    if (!reg) return;
    const { orderEl, card } = reg;

    orderEl.remove();
    orderRegistry.delete(orderId);
    removeBarOrder(orderId);
    updateTableCount(card);

    if (visibleOrderCount(card) === 0 && tableCards.has(card.tableId)) {
        onComplete(card.tableId); // broadcasts 'order-completed'
        card.el.remove();
        tableCards.delete(card.tableId);
        checkEmpty();
    }
};

const checkEmpty = () => {
    updateOpenPill();
    if (tableCards.size === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-tile">
                    ${icon('cup')}
                    <span class="empty-check">${icon('check-circle')}</span>
                </div>
                <p class="empty-title">${t('bartender.all_done')}</p>
                <p class="empty-sub">${t('bartender.empty_sub')}</p>
                <span class="listening-pill"><span class="dot"></span>${t('bartender.listening')}</span>
                <div class="served-stat"><span id="served-today">—</span></div>
            </div>
        `;
        // Served-today is host-local and async; fill it in after rendering (advisory).
        getOrdersSince(getShiftStart()).then(list => {
            const el = document.getElementById('served-today');
            if (el) el.textContent = t('bartender.served_today', { count: Array.isArray(list) ? list.length : 0 });
        }).catch(() => {});
    }
};

const render = () => {
    checkEmpty();
};

const notify = (data) => {
    if (state.soloMode) return;
    try {
        if (ctx) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
        }
        toast(t('alerts.new_order', { table: data.tableId }), 'info');
    } catch(e) {}
};
