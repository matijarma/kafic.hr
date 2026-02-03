import { getMenu, getTables } from 'data';
import { getImage } from 'db';
import { state, resetWaiterState } from 'state';
import { broadcast } from 'network';
import { onOrderReceived } from 'bartender';
import { t } from 'i18n';
import { toast, registerModal, popModal, confirm } from 'ux';

// DOM Elements
const grid = document.getElementById('waiter-grid');
const breadcrumbs = document.getElementById('waiter-breadcrumbs');
const backBtn = document.getElementById('waiter-back-btn');
const netPill = document.getElementById('waiter-net-pill');

// Order Dock
const orderDock = document.getElementById('order-dock');
const orderListContainer = document.getElementById('order-list');
const orderCountBadge = document.getElementById('order-count-badge');
const sendBtn = document.getElementById('btn-send-order');
const clearBtn = document.getElementById('btn-clear-order');

// Qty Modal
const qtyModal = document.getElementById('qty-modal');
const qtyGrid = document.getElementById('qty-grid-container');
const qtyTitle = document.getElementById('qty-item-title');
const qtyPath = document.getElementById('qty-item-path');
const qtyValue = document.getElementById('qty-value');
const closeQtyBtn = document.getElementById('btn-close-qty');
const clearQtyBtn = document.getElementById('btn-clear-qty');
const applyQtyBtn = document.getElementById('btn-apply-qty');
const qtySteps = document.querySelectorAll('.qty-step');

const qtyPresets = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24];
let pendingItem = null;
let pendingQty = 1;

export const initWaiter = () => {
    // Setup event listeners
    backBtn.onclick = handleBack;
    clearBtn.onclick = clearOrder;
    sendBtn.onclick = sendOrder;
    qtySteps.forEach(btn => btn.onclick = () => stepQty(Number(btn.dataset.step || 0)));
    clearQtyBtn.onclick = () => {
        pendingQty = 1;
        updateQtyDisplay();
    };
    applyQtyBtn.onclick = () => confirmQty(pendingQty);
    
    closeQtyBtn.onclick = () => {
        qtyModal.removeAttribute('open');
        popModal();
        pendingItem = null;
    };
    
    // Qty Modal Close on Backdrop
    qtyModal.onclick = (e) => {
        if (e.target === qtyModal) {
             qtyModal.removeAttribute('open');
             popModal();
             pendingItem = null;
        }
    };

    buildQtyGrid();
    updateQtyDisplay();
    render();
};

const buildQtyGrid = () => {
    qtyGrid.innerHTML = '';
    qtyPresets.forEach(q => {
        const btn = document.createElement('button');
        btn.textContent = q;
        btn.setAttribute('aria-label', `${q}`);
        btn.onclick = () => setQty(q);
        qtyGrid.appendChild(btn);
    });
};

const clampQty = (value) => Math.min(99, Math.max(1, Math.round(value)));
const setQty = (value) => {
    pendingQty = clampQty(value);
    updateQtyDisplay();
};
const stepQty = (delta) => setQty(pendingQty + delta);
const updateQtyDisplay = () => {
    qtyValue.textContent = pendingQty;
};

const render = () => {
    // Status
    if (netPill) {
        netPill.classList.toggle('connected', Object.keys(state.peers).length > 0);
        if (!netPill.textContent) netPill.textContent = state.sessionCode || t('setup.waiting_short');
    }

    // Grid Content
    if (!state.currentTable) {
        renderTables();
    } else {
        const level = state.currentPath.length > 0 
            ? state.currentPath[state.currentPath.length-1].children 
            : getMenu();
        renderMenu(level);
    }

    renderOrderDock();
};

const renderTables = () => {
    breadcrumbs.textContent = t('waiter.select_table');
    grid.innerHTML = '';
    
    // Smart Grid Sizing
    const tables = getTables();
    const count = tables.length;
    let cols = 4;
    // Prefer 4 unless 3 gives a better fill (e.g. 6, 9, 15, 21...) AND 4 leaves many orphans
    // But user asked for "divisable by 3 or 4" slider, so we can infer intent.
    // If divisible by 4, use 4. If divisible by 3 but not 4, use 3.
    // Default 4.
    if (count % 4 !== 0 && count % 3 === 0) cols = 3;
    
    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    
    tables.forEach(tbl => {
        const el = document.createElement('button');
        el.className = 'grid-item';
        el.innerHTML = `<div style="font-size:1.8em">${tbl.id}</div>`;
        el.onclick = () => {
            state.currentTable = tbl;
            state.currentPath = [];
            render();
        };
        grid.appendChild(el);
    });
};

const renderMenu = (items) => {
    // Breadcrumbs
    const path = state.currentPath.map(p => p.label).join(' › ');
    breadcrumbs.textContent = path ? `${state.currentTable.id} › ${path}` : `${state.currentTable.id} › Menu`;
    
    grid.innerHTML = '';
    items.forEach(item => {
        const el = document.createElement('button');
        el.className = 'grid-item';
        
        if (item.children && item.children.length > 0) {
            el.style.borderTop = `4px solid ${item.color || '#999'}`;
            el.innerHTML = `<span>${item.label}</span>`;
            el.onclick = () => {
                state.currentPath.push(item);
                render();
            };
        } else {
            el.innerHTML = `<span>${item.label}</span><small style="opacity:0.6">${item.price||''}</small>`;
            el.onclick = () => openQty(item);

            if (item.imageId) {
                getImage(item.imageId).then(blob => {
                    if (blob) {
                        const url = URL.createObjectURL(blob);
                        el.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${url})`;
                        el.style.backgroundSize = 'cover';
                        el.style.backgroundPosition = 'center';
                        el.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
                    }
                });
            }
        }
        grid.appendChild(el);
    });
};

const openQty = (item) => {
    pendingItem = item;
    pendingQty = 1;
    qtyTitle.textContent = item.label;
    const context = state.currentPath.map(p => p.label).join(' › ');
    if (qtyPath) {
        qtyPath.textContent = context;
        qtyPath.classList.toggle('hidden', !context);
    }
    updateQtyDisplay();
    qtyModal.setAttribute('open', 'true');
    registerModal(() => {
        qtyModal.removeAttribute('open');
        pendingItem = null;
    });
};

const confirmQty = (qty) => {
    if (!pendingItem) return;
    const context = state.currentPath.map(p => p.label).join(' ');
    const finalQty = clampQty(qty);
    
    const itemLabel = pendingItem.label;
    state.currentOrder.push({
        id: pendingItem.id,
        label: pendingItem.label,
        qty: finalQty,
        context
    });
    
    qtyModal.removeAttribute('open');
    popModal(); // Remove history state
    pendingItem = null;
    const addedMsg = t('alerts.item_added', { qty: finalQty, item: itemLabel });
    toast(addedMsg !== 'alerts.item_added' ? addedMsg : `${finalQty}x ${itemLabel} added`, 'success');
    renderOrderDock();
};

const renderOrderDock = () => {
    const count = state.currentOrder.length;
    
    if (count === 0) {
        orderCountBadge.classList.add('hidden');
        orderListContainer.innerHTML = `<div class="empty-msg">${t('waiter.empty_order')}</div>`;
        sendBtn.disabled = true;
        sendBtn.textContent = t('actions.send');
    } else {
        orderCountBadge.classList.remove('hidden');
        orderCountBadge.textContent = count;
        sendBtn.disabled = false;
        sendBtn.textContent = `${t('actions.send')} (${count})`;
        
        orderListContainer.innerHTML = '';
        state.currentOrder.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'order-item';
            row.innerHTML = `
                <div><span class="qty">${item.qty}x</span> ${item.label}${item.context ? `<div class="muted">${item.context}</div>` : ''}</div>
                <button class="text-btn danger small" aria-label="Remove">✕</button>
            `;
            row.querySelector('button').onclick = () => {
                state.currentOrder.splice(idx, 1);
                renderOrderDock();
            };
            orderListContainer.appendChild(row);
        });
        
        // Auto-scroll to bottom
        orderListContainer.scrollTop = orderListContainer.scrollHeight;
    }
};

const clearOrder = async () => {
    if(state.currentOrder.length > 0 && await confirm(t('confirm.clear'))) {
        state.currentOrder = [];
        renderOrderDock();
    }
};

const sendOrder = () => {
    if (!state.currentTable || state.currentOrder.length === 0) return;
    
    // We allow sending even if offline/no peers (local echo)
    const payload = {
        type: 'new-order',
        tableId: state.currentTable.id,
        items: state.currentOrder,
        timestamp: Date.now()
    };
    
    // 1. Try to send to peers
    const sent = broadcast(payload);
    
    // 2. Local Echo (always process for self)
    onOrderReceived(payload);
    
    // 3. Feedback
    toast(t('alerts.order_sent'), 'success');
    resetWaiterState();
    render();
};

const handleBack = () => {
    if (state.currentPath.length > 0) {
        // Go up one level in menu
        state.currentPath.pop();
        render();
    } else if (state.currentTable) {
        // Go back to table selection
        state.currentTable = null;
        render();
    } else {
        // At root (Table Selection), so return to Lobby
        if (window.returnToLobby) window.returnToLobby();
    }
};

export const refreshWaiter = render;
