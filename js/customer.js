// Guest self-order view (ephemeral, serverless P2P "customer" peer).
// Read-only menu browse + cart + place-order. No staff affordances, no payment.
import { getMenu, getPriceRules } from 'data';
import { buildEffectivePriceMap } from 'pricing';
import { state } from 'state';
import { broadcast, selfId, getPeerCount } from 'network';
import { enqueueOrder } from 'orders';
import { t } from 'i18n';
import { toast, icon } from 'ux';

const menuEl = document.getElementById('customer-menu');
const crumbsEl = document.getElementById('customer-breadcrumbs');
const tableChip = document.getElementById('customer-table-chip');
const cartEl = document.getElementById('customer-cart');
const cartItemsEl = document.getElementById('customer-cart-items');
const cartCountEl = document.getElementById('customer-cart-count');
const placeBtn = document.getElementById('customer-place');
const totalEl = document.getElementById('customer-total');
const netPill = document.getElementById('customer-net-pill');
const orderSent = document.getElementById('order-sent');
const orderSentReceipt = document.getElementById('order-sent-receipt');
const orderSentBack = document.getElementById('btn-order-sent-back');

let path = [];
let started = false;
let netTimer = null;

const fmtMoney = (n) => `${(Math.round((n || 0) * 100) / 100).toFixed(2)} €`;
const priceMap = () => buildEffectivePriceMap(getMenu(), getPriceRules(), new Date());
const currentLevel = () => (path.length ? (path[path.length - 1].children || []) : (getMenu() || []));

export const initCustomer = () => {
    if (tableChip) tableChip.textContent = t('bartender.table_label', { table: state.customerTable });
    if (!started) {
        if (placeBtn) placeBtn.onclick = placeOrder;
        if (orderSentBack) orderSentBack.addEventListener('click', hideOrderSent);
        netTimer = setInterval(updateNet, 4000);
        started = true;
    }
    path = [];
    renderMenu();
    renderCart();
    updateNet();
};

const updateNet = () => {
    if (!netPill) return;
    const label = netPill.querySelector('.label');
    const online = navigator.onLine && getPeerCount() > 0;
    netPill.classList.toggle('connected', online);
    if (label) label.textContent = online ? t('setup.connected_short') : t('customer.connecting');
};

// Called by app.js after a sync-menu lands while in customer mode.
export const refreshCustomerMenu = () => { if (state.isCustomer) renderMenu(); };

const renderMenu = () => {
    const menu = getMenu() || [];
    if (!menu.length) {
        menuEl.innerHTML = `<div class="customer-empty">
            <div class="empty-state-tile">${icon('cup')}</div>
            <p class="empty-title">${t('customer.loading')}</p>
            <button class="btn-secondary" id="customer-retry">${t('customer.retry')}</button>
        </div>`;
        const r = document.getElementById('customer-retry');
        if (r) r.onclick = () => { try { broadcast({ type: 'menu-request' }); } catch (e) {} toast(t('customer.loading'), 'info'); };
        return;
    }

    crumbsEl.textContent = path.map(p => p.label).join(' › ');
    crumbsEl.classList.toggle('hidden', !path.length);

    const items = currentLevel();
    const pm = priceMap();
    menuEl.innerHTML = '';

    if (path.length) {
        const back = document.createElement('button');
        back.className = 'customer-row back';
        back.innerHTML = `${icon('arrow-left')} <span>${t('actions.back')}</span>`;
        back.onclick = () => { path.pop(); renderMenu(); };
        menuEl.appendChild(back);
    }

    items.forEach(item => {
        if (!item || !(item.label || '').trim()) return;
        const isCat = item.children && item.children.length;
        const row = document.createElement('div');
        row.className = 'customer-row';
        if (isCat) {
            row.classList.add('cat');
            row.innerHTML = `<span class="cr-name">${item.label}</span>${icon('chevron-right')}`;
            row.onclick = () => { path.push(item); renderMenu(); };
        } else {
            const oos = item.track && (Number(item.stock) || 0) <= 0;
            const inCart = state.customerCart.find(c => c.id === item.id);
            const price = pm[item.id] || 0;
            row.innerHTML = `
                <div class="cr-info"><span class="cr-name">${item.label}</span><span class="cr-price">${fmtMoney(price)}</span></div>
                ${oos ? `<span class="cr-oos">${t('stock.out_of_stock')}</span>`
                    : (inCart ? `<div class="cr-qty"><button class="cr-step" data-d="-1">−</button><span>${inCart.qty}</span><button class="cr-step" data-d="1">+</button></div>`
                        : `<button class="cr-add" aria-label="add">${icon('plus')}</button>`)}
            `;
            if (!oos) {
                const add = row.querySelector('.cr-add');
                if (add) add.onclick = () => changeQty(item, 1);
                row.querySelectorAll('.cr-step').forEach(b => b.onclick = () => changeQty(item, Number(b.dataset.d)));
            }
        }
        menuEl.appendChild(row);
    });
};

const changeQty = (item, delta) => {
    const cart = state.customerCart;
    let entry = cart.find(c => c.id === item.id);
    if (!entry && delta > 0) {
        entry = { id: item.id, label: item.label, qty: 0, context: path.map(p => p.label).join(' ') };
        cart.push(entry);
    }
    if (!entry) return;
    entry.qty = Math.max(0, entry.qty + delta);
    if (entry.qty === 0) cart.splice(cart.indexOf(entry), 1);
    renderMenu();
    renderCart();
};

const renderCart = () => {
    const cart = state.customerCart;
    const count = cart.reduce((s, c) => s + c.qty, 0);
    if (cartCountEl) cartCountEl.textContent = count;
    if (!count) { cartEl.classList.add('hidden'); return; }
    cartEl.classList.remove('hidden');
    const pm = priceMap();
    const total = cart.reduce((s, c) => s + (pm[c.id] || 0) * c.qty, 0);
    cartItemsEl.innerHTML = cart.map(c =>
        `<div class="cc-row"><span class="cc-qty">${c.qty}×</span><span class="cc-name">${c.label}</span><span class="cc-price">${fmtMoney((pm[c.id] || 0) * c.qty)}</span></div>`
    ).join('');
    totalEl.textContent = fmtMoney(total);
    placeBtn.disabled = count === 0;
};

const newOrderId = () => (crypto.randomUUID ? crypto.randomUUID() : `${selfId}-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const placeOrder = () => {
    const cart = state.customerCart;
    if (!cart.length) return;
    if (getPeerCount() === 0 && !navigator.onLine) {
        toast(t('customer.offline'), 'error');
    }
    const items = cart.map(c => ({ id: c.id, label: c.label, qty: c.qty, context: c.context || '', payment: null }));
    const payload = {
        type: 'new-order',
        orderId: newOrderId(),
        tableId: state.customerTable,
        items,
        timestamp: Date.now(),
        senderId: selfId,
        origin: 'customer',
        guestName: t('customer.guest')
    };
    enqueueOrder(payload);   // persisted + retried on reconnect (reuses staff pipeline)
    broadcast(payload);
    showOrderSent(payload);
    state.customerCart = [];
    renderMenu();
    renderCart();
};

let osTimer = null;
const hideOrderSent = () => { if (osTimer) { clearTimeout(osTimer); osTimer = null; } if (orderSent) orderSent.classList.add('hidden'); };
const showOrderSent = (payload) => {
    if (!orderSent) return;
    const pm = priceMap();
    const lineT = (it) => (pm[it.id] || 0) * (it.qty || 0);
    const total = payload.items.reduce((s, it) => s + lineT(it), 0);
    const rows = payload.items.map(it =>
        `<div class="os-row"><span class="os-qty">${it.qty}×</span><span class="os-name">${it.label}</span><span class="os-price">${fmtMoney(lineT(it))}</span></div>`
    ).join('');
    if (orderSentReceipt) {
        orderSentReceipt.innerHTML =
            `<div class="os-table">${t('bartender.table_label', { table: payload.tableId })}</div>` +
            `<div class="os-items">${rows}</div>` +
            `<div class="os-total"><span>${t('order_sent.total')}</span><span>${fmtMoney(total)}</span></div>`;
    }
    orderSent.classList.remove('hidden');
    if (osTimer) clearTimeout(osTimer);
    osTimer = setTimeout(hideOrderSent, 2200);
};
