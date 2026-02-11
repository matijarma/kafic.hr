import { t } from 'i18n';
import { toast } from 'ux';
import { state } from 'state';

const feed = document.getElementById('bartender-feed');
const tableCards = new Map();
let onComplete = () => {};

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

export const onOrderReceived = (data) => {
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
    notify(data);
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
        ? `<span class="order-payment-icon"><i class="fas fa-${iconMap[payment]}" title="${payment}"></i></span>` 
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

    orderEl.querySelector('[data-action="done"]').onclick = () => {
        orderEl.style.opacity = '0';
        orderEl.style.transform = 'scale(0.98)';
        setTimeout(() => {
            orderEl.remove();
            updateTableCount(card);
            if (card.ordersEl.children.length === 0) {
                // Table is fully cleared
                onComplete(card.tableId);
                
                card.el.remove();
                tableCards.delete(card.tableId);
                checkEmpty();
            }
        }, 160);
    };

    card.ordersEl.prepend(orderEl);
    updateTableCount(card);
};

const updateTableCount = (card) => {
    if (!card?.countEl) return;
    const count = card.ordersEl.children.length;
    card.countEl.textContent = count;
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
