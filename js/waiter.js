import { getMenu, getTables, isMenuColorizeEnabled } from 'data';
import { getImage } from 'db';
import { state, resetWaiterState } from 'state';
import { broadcast } from 'network';
import { onOrderReceived } from 'bartender';
import { t } from 'i18n';
import { toast, registerModal, popModal, confirm } from 'ux';

// DOM Elements
const grid = document.getElementById('waiter-grid');
const breadcrumbs = document.getElementById('waiter-breadcrumbs');
const netPill = document.getElementById('waiter-net-pill');
const backBtn = document.getElementById('waiter-back-btn');

// Order Dock
const orderDock = document.getElementById('order-dock');
const orderListContainer = document.getElementById('order-list');
const orderCountBadge = document.getElementById('order-count-badge');
const sendBtn = document.getElementById('btn-send-order');
const clearBtn = document.getElementById('btn-clear-order');
const navTablesBtn = document.getElementById('btn-nav-tables');

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
const payBtns = document.querySelectorAll('.compact-payment .pay-btn');

const qtyPresets = [3, 4, 5, 8, 10, 15];
let pendingItem = null;
let pendingQty = 1;
let selectedPaymentMethod = null;
let lastGridCount = 0;
let gridObserver = null;
let lastOrderCount = 0;
let orderObserver = null;

const COLORIZE_PALETTE = [
    [244, 114, 182],
    [59, 130, 246],
    [20, 184, 166],
    [245, 158, 11],
    [168, 85, 247],
    [34, 197, 94],
    [239, 68, 68],
    [14, 165, 233],
    [132, 204, 22],
    [236, 72, 153]
];

const hslToRgb = (h, s, l) => {
    const sat = s / 100;
    const light = l / 100;
    const c = (1 - Math.abs((2 * light) - 1)) * sat;
    const hPrime = h / 60;
    const x = c * (1 - Math.abs((hPrime % 2) - 1));
    let r = 0;
    let g = 0;
    let b = 0;

    if (hPrime >= 0 && hPrime < 1) {
        r = c;
        g = x;
    } else if (hPrime < 2) {
        r = x;
        g = c;
    } else if (hPrime < 3) {
        g = c;
        b = x;
    } else if (hPrime < 4) {
        g = x;
        b = c;
    } else if (hPrime < 5) {
        r = x;
        b = c;
    } else {
        r = c;
        b = x;
    }

    const m = light - (c / 2);
    return [
        Math.round((r + m) * 255),
        Math.round((g + m) * 255),
        Math.round((b + m) * 255)
    ];
};

const getColorByIndex = (index) => {
    if (index < COLORIZE_PALETTE.length) return COLORIZE_PALETTE[index];
    const hue = (index * 137.508) % 360;
    return hslToRgb(hue, 72, 56);
};

const buildTopLevelColorMap = () => {
    const rootItems = getMenu() || [];
    const map = new Map();
    rootItems.forEach((item, index) => {
        if (!item) return;
        const key = item.id || `root-index-${index}`;
        map.set(key, getColorByIndex(index));
    });
    return map;
};

const resolveTopLevelKey = (item) => {
    const topLevel = state.currentPath.length > 0 ? state.currentPath[0] : item;
    if (!topLevel) return '';
    if (topLevel.id) return topLevel.id;
    const rootItems = getMenu() || [];
    const rootIndex = rootItems.indexOf(topLevel);
    return `root-index-${Math.max(0, rootIndex)}`;
};

const resolveColorDepth = () => state.currentPath.length;

const buildColorizedBackground = (rgb, depth) => {
    const [r, g, b] = rgb;
    const alphaA = Math.max(0.08, 0.24 - (depth * 0.035));
    const alphaB = Math.max(0.04, alphaA * 0.62);
    return `linear-gradient(155deg, rgba(${r}, ${g}, ${b}, ${alphaA}), rgba(${r}, ${g}, ${b}, ${alphaB}))`;
};

const applyImageTileBackground = (el, item, onSuccess = null) => {
    if (!item.imageId) return;
    getImage(item.imageId).then(blob => {
        if (!blob || !el.isConnected) return;
        const url = URL.createObjectURL(blob);
        el.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${url})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.textShadow = '0 1px 3px rgba(0,0,0,0.8)';
        if (typeof onSuccess === 'function') onSuccess();
    });
};

const applyColorizedTileBackground = (el, item, topLevelColorMap) => {
    const topLevelKey = resolveTopLevelKey(item);
    const rgb = topLevelColorMap.get(topLevelKey) || getColorByIndex(0);
    const depth = resolveColorDepth();
    el.style.backgroundImage = buildColorizedBackground(rgb, depth);
    el.style.backgroundSize = '';
    el.style.backgroundPosition = '';
    el.style.textShadow = 'none';
    el.style.borderTop = 'none';
};

export const initWaiter = () => {
    // Setup event listeners
    sendBtn.onclick = sendOrder;
    navTablesBtn.onclick = handleTables;
    if (backBtn) backBtn.onclick = handleBack;
    qtySteps.forEach(btn => btn.onclick = () => stepQty(Number(btn.dataset.step || 0)));
    clearQtyBtn.onclick = () => {
        pendingQty = 1;
        updateQtyDisplay();
    };
    applyQtyBtn.onclick = () => confirmQty(pendingQty);
    
    payBtns.forEach(btn => {
        btn.onclick = () => togglePayment(btn.dataset.method);
    });

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
    observeGrid();
    observeOrderList();
    bindClearHold();

    window.addEventListener('menu-colorize-change', render);
};

const scheduleGridLayout = (count) => {
    lastGridCount = count;
    requestAnimationFrame(() => applyGridLayout(count));
};

const observeGrid = () => {
    if (!grid || gridObserver) return;
    if ('ResizeObserver' in window) {
        gridObserver = new ResizeObserver(() => scheduleGridLayout(lastGridCount));
        gridObserver.observe(grid);
    } else {
        window.addEventListener('resize', () => scheduleGridLayout(lastGridCount));
    }
};

const scheduleOrderLayout = (count) => {
    lastOrderCount = count;
    requestAnimationFrame(() => applyOrderLayout(count));
};

const observeOrderList = () => {
    if (!orderListContainer || orderObserver) return;
    if ('ResizeObserver' in window) {
        orderObserver = new ResizeObserver(() => scheduleOrderLayout(lastOrderCount));
        orderObserver.observe(orderListContainer);
    } else {
        window.addEventListener('resize', () => scheduleOrderLayout(lastOrderCount));
    }
};

const applyOrderLayout = (count) => {
    if (!orderListContainer) return;
    if (count <= 0) {
        orderListContainer.style.gridTemplateColumns = '';
        orderListContainer.style.gridAutoRows = '';
        return;
    }
    const rect = orderListContainer.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const style = getComputedStyle(orderListContainer);
    const rowGap = parseFloat(style.rowGap) || parseFloat(style.gap) || 0;
    const colGap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
    const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableWidth = rect.width - paddingX;
    const availableHeight = rect.height - paddingY;

    let best = { cols: 1, rows: count, score: 0, cellHeight: 0 };
    for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const usableW = availableWidth - colGap * (cols - 1);
        const usableH = availableHeight - rowGap * (rows - 1);
        if (usableW <= 0 || usableH <= 0) continue;
        const cellW = usableW / cols;
        const cellH = usableH / rows;
        const score = Math.min(cellW, cellH);
        if (score > best.score || (score === best.score && rows < best.rows)) {
            best = { cols, rows, score, cellHeight: cellH };
        }
    }

    orderListContainer.style.gridTemplateColumns = `repeat(${best.cols}, minmax(0, 1fr))`;
    orderListContainer.style.gridAutoRows = `${Math.floor(best.cellHeight)}px`;
};

const bindClearHold = () => {
    if (!clearBtn) return;
    let holdTimer = null;
    let holdTriggered = false;
    const holdMs = 700;

    const startHold = () => {
        holdTriggered = false;
        holdTimer = setTimeout(() => {
            holdTriggered = true;
            if (navigator.vibrate) navigator.vibrate(20);
            if (window.returnToLobby) window.returnToLobby();
        }, holdMs);
    };
    const cancelHold = () => {
        if (holdTimer) clearTimeout(holdTimer);
        holdTimer = null;
    };

    clearBtn.addEventListener('pointerdown', startHold);
    clearBtn.addEventListener('pointerup', cancelHold);
    clearBtn.addEventListener('pointerleave', cancelHold);
    clearBtn.addEventListener('pointercancel', cancelHold);

    clearBtn.addEventListener('click', async (e) => {
        if (holdTriggered) {
            e.preventDefault();
            e.stopImmediatePropagation();
            return;
        }
        await clearOrder();
    });
};

const applyGridLayout = (count) => {
    if (!grid || count <= 0) return;
    const rect = grid.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const style = getComputedStyle(grid);
    const rowGap = parseFloat(style.rowGap) || parseFloat(style.gap) || 0;
    const colGap = parseFloat(style.columnGap) || parseFloat(style.gap) || 0;
    const paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    const availableWidth = rect.width - paddingX;
    const availableHeight = rect.height - paddingY;

    let best = { cols: 1, rows: count, size: 0 };
    for (let cols = 1; cols <= count; cols++) {
        const rows = Math.ceil(count / cols);
        const usableW = availableWidth - colGap * (cols - 1);
        const usableH = availableHeight - rowGap * (rows - 1);
        if (usableW <= 0 || usableH <= 0) continue;
        const size = Math.floor(Math.min(usableW / cols, usableH / rows));
        if (size > best.size || (size === best.size && rows < best.rows)) {
            best = { cols, rows, size };
        }
    }

    if (best.size <= 0) return;
    const maxCellSize = 180;
    const finalSize = Math.min(best.size, maxCellSize);
    grid.style.gridTemplateColumns = `repeat(${best.cols}, ${finalSize}px)`;
    grid.style.gridAutoRows = `${finalSize}px`;
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

const togglePayment = (method) => {
    if (selectedPaymentMethod === method) {
        selectedPaymentMethod = null;
    } else {
        selectedPaymentMethod = method;
    }
    updatePaymentDisplay();
};

const updatePaymentDisplay = () => {
    payBtns.forEach(btn => {
        btn.classList.toggle('selected', btn.dataset.method === selectedPaymentMethod);
    });
};

const render = () => {
    // Status
    if (netPill) {
        const count = Object.keys(state.peers).length;
        const label = netPill.querySelector('.label');
        if (label) {
            label.textContent = navigator.onLine
                ? (count > 0 ? `${t('setup.connected_short')} • ${count}` : t('setup.waiting_short'))
                : t('alerts.offline');
        }
        netPill.classList.toggle('connected', count > 0);
        netPill.classList.toggle('offline', !navigator.onLine);
    }

    if (navTablesBtn) {
        navTablesBtn.disabled = !state.currentTable;
    }
    if (backBtn) {
        backBtn.classList.toggle('hidden', !state.currentTable);
    }
    if (grid) {
        grid.classList.toggle('has-back', !!state.currentTable);
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
    if (grid) {
        grid.classList.remove('colorized');
    }
    
    const tables = getTables();
    
    tables.forEach(tbl => {
        const el = document.createElement('button');
        el.className = 'grid-item';
        if (state.unclearedTables.has(tbl.id)) {
            el.classList.add('has-orders');
        }
        el.innerHTML = `<div style="font-size:1.8em">${tbl.id}</div>`;
        el.onclick = () => {
            state.currentTable = tbl;
            state.currentPath = [];
            render();
        };
        grid.appendChild(el);
    });
    scheduleGridLayout(tables.length);
};

const renderMenu = (items) => {
    // Breadcrumbs
    const path = state.currentPath.map(p => p.label).join(' › ');
    breadcrumbs.textContent = path
        ? `${state.currentTable.id} › ${path}`
        : `${state.currentTable.id} › ${t('waiter.menu_root')}`;
    
    grid.innerHTML = '';
    const visibleItems = (items || []).filter(item => (item.label || '').trim().length > 0);
    const colorizeEnabled = isMenuColorizeEnabled();
    if (grid) {
        grid.classList.toggle('colorized', colorizeEnabled);
    }
    const topLevelColorMap = colorizeEnabled ? buildTopLevelColorMap() : null;
    visibleItems.forEach(item => {
        const el = document.createElement('button');
        el.className = 'grid-item';
        
        if (item.children && item.children.length > 0) {
            el.style.borderTop = `4px solid ${item.color || '#999'}`;
            el.innerHTML = `
                <div class="grid-item-content">
                    <i class="fas fa-cubes tile-icon" aria-hidden="true"></i>
                    <span class="grid-item-label">${item.label}</span>
                </div>
            `;
            el.onclick = () => {
                state.currentPath.push(item);
                render();
            };
            if (colorizeEnabled) {
                applyColorizedTileBackground(el, item, topLevelColorMap);
            } else if (item.imageId) {
                applyImageTileBackground(el, item, () => {
                    el.style.borderTop = 'none';
                });
            }
        } else {
            el.innerHTML = `
                <div class="grid-item-content">
                    <i class="fas fa-wine-glass-alt" aria-hidden="true"></i>
                    <span class="grid-item-label">${item.label}</span>
                </div>
                <small class="grid-item-price">${item.price||''}</small>
            `;
            el.onclick = () => openQty(item);

            if (colorizeEnabled) {
                applyColorizedTileBackground(el, item, topLevelColorMap);
            } else if (item.imageId) {
                applyImageTileBackground(el, item);
            }
        }
        grid.appendChild(el);
    });
    scheduleGridLayout(visibleItems.length);
};
 
const handleBack = () => {
    if (!state.currentTable) return;
    if (state.currentPath.length > 0) {
        state.currentPath.pop();
    } else {
        state.currentTable = null;
        state.currentPath = [];
    }
    render();
};

export const canNavigateBack = () => !!state.currentTable;
export const navigateBack = () => {
    if (!state.currentTable) return false;
    handleBack();
    return true;
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
    
    let color = null;
    if (isMenuColorizeEnabled()) {
         const topMap = buildTopLevelColorMap();
         const key = resolveTopLevelKey(pendingItem);
         color = topMap.get(key);
    }
    
    const itemLabel = pendingItem.label;
    state.currentOrder.push({
        id: pendingItem.id,
        label: pendingItem.label,
        qty: finalQty,
        context,
        color
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
        orderListContainer.classList.add('is-empty');
        orderListContainer.innerHTML = `<div class="empty-msg">${t('waiter.empty_order')}</div>`;
        sendBtn.disabled = true;
        sendBtn.textContent = t('actions.send');
        scheduleOrderLayout(0);
    } else {
        orderCountBadge.classList.remove('hidden');
        orderCountBadge.textContent = count;
        sendBtn.disabled = false;
        sendBtn.textContent = `${t('actions.send')} (${count})`;
        
        orderListContainer.classList.remove('is-empty');
        orderListContainer.innerHTML = '';
        state.currentOrder.forEach((item, idx) => {
            const row = document.createElement('div');
            row.className = 'order-item';
            let metaHtml = '';
            if (item.context) metaHtml += `<span class="muted">${item.context}</span>`;
            
            row.innerHTML = `
                <div class="order-item-info">
                    <div class="name"><span class="qty">${item.qty}x</span> ${item.label}</div>
                    <div style="font-size:0.8em; line-height:1.2">${metaHtml}</div>
                </div>
                <button class="order-item-remove" aria-label="${t('actions.remove')}">✕</button>
            `;
            row.querySelector('.order-item-remove').onclick = () => {
                state.currentOrder.splice(idx, 1);
                renderOrderDock();
            };
            orderListContainer.appendChild(row);
        });
        scheduleOrderLayout(count);
    }
};

const clearOrder = async () => {
    if(state.currentOrder.length > 0 && await confirm(t('confirm.clear'))) {
        state.currentOrder = [];
        selectedPaymentMethod = null;
        updatePaymentDisplay();
        renderOrderDock();
    }
};

const sendOrder = () => {
    if (!state.currentTable || state.currentOrder.length === 0) return;
    
    const itemsToSend = state.currentOrder.map(item => ({
        ...item,
        payment: selectedPaymentMethod
    }));

    // We allow sending even if offline/no peers (local echo)
    const payload = {
        type: 'new-order',
        tableId: state.currentTable.id,
        items: itemsToSend,
        timestamp: Date.now()
    };
    
    // 1. Try to send to peers
    const sent = broadcast(payload);
    
    // 2. Local Echo (always process for self)
    onOrderReceived(payload);
    
    // 3. Feedback
    state.unclearedTables.add(state.currentTable.id);
    toast(t('alerts.order_sent'), 'success');
    
    // Reset
    selectedPaymentMethod = null;
    updatePaymentDisplay();
    resetWaiterState();
    render();
};

const handleTables = () => {
    if (!state.currentTable) return;
    state.currentTable = null;
    state.currentPath = [];
    render();
};

export const onOrderCompleted = (data) => {
    if (data && data.tableId) {
        state.unclearedTables.delete(data.tableId);
        if (!state.currentTable) {
            renderTables();
        }
    }
};

export const refreshWaiter = render;
