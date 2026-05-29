import { t } from 'i18n';
import { toast, toastAction, icon } from 'ux';
import { state } from 'state';
import { broadcast, selfId } from 'network';
import { readJSON, writeJSON, readSet, writeSet, scopedKey } from 'storage';

const feed = document.getElementById('bartender-feed');
const tableCards = new Map();
let onComplete = () => {};

// --- Persistence + dedup (host-local) ---
const barOrdersKey = () => scopedKey('kafic_bar_orders', state.sessionCode);
const seenKey = () => scopedKey('kafic_seen_orderids', state.sessionCode);
const persistBarOrders = () => writeJSON(barOrdersKey(), state.barOrders);
const removeBarOrder = (orderId) => {
    const i = state.barOrders.findIndex(o => o && o.orderId === orderId);
    if (i >= 0) { state.barOrders.splice(i, 1); persistBarOrders(); }
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

export const initBartender = () => {
    render();
};

export const setOrderCompletionHandler = (fn) => {
    onComplete = fn;
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

    const itemsHtml = data.items.map(item => {
        let style = '';
        if (item.color) {
            const [r,g,b] = item.color;
            // Use a very light background + a left border for color identification
            style = `style="background: rgba(${r},${g},${b},0.12); border-left: 4px solid rgb(${r},${g},${b});"`;
        }

        return `
        <div class="feed-item" ${style}>
            <div class="feed-item-name">
                <span class="qty">${item.qty}x</span> 
                <span class="label-text">${item.label}</span>
            </div>
            ${item.context ? `<div class="feed-item-context">${item.context}</div>` : ''}
        </div>
        `;
    }).join('');

    const orderEl = document.createElement('div');
    orderEl.className = 'feed-order';
    orderEl.dataset.orderId = data.orderId;
    orderEl.innerHTML = `
        <div class="feed-order-header">
            <div class="feed-meta">
                <span class="feed-order-time">${time}</span>
                ${payIcon}
            </div>
            <button class="feed-btn feed-order-done" data-action="done">${t('actions.mark_done')}</button>
        </div>
        <div class="feed-order-items">
            ${itemsHtml}
        </div>
    `;

    orderRegistry.set(data.orderId, { orderEl, card, data });
    orderEl.querySelector('[data-action="done"]').onclick = () => beginCompletion(data.orderId);

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

const updateTableCount = (card) => {
    if (!card?.countEl) return;
    card.countEl.textContent = visibleOrderCount(card);
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
    if (tableCards.size === 0) {
        feed.innerHTML = `
            <div class="empty-state">
                <div class="icon">✓</div>
                <p>${t('bartender.all_done')}</p>
            </div>
        `;
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
