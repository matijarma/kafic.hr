import { getTableCount, setTableCount, getMenu, saveMenu, getShiftStart, startNewShift, getPriceRules, savePriceRules } from 'data';
import { saveImage, deleteImage, getImage, getOrdersSince, clearOrders, countOrders, saveShift, getRecentShifts, deleteShift } from 'db';
import { t, getLanguage } from 'i18n';
import { toast, confirm, icon } from 'ux';
import { state } from 'state';
import { summary, salesByItem, byTable, byWaiter, toCsv, byHour, averageOrderValue, buildShiftAggregate } from 'reports';
import { renderQR } from 'qr';

let container = null;
let activePopover = null;

// valid steps logic
/*
const getValidTableCounts = () => {
    const arr = [];
    for (let i = 6; i <= 60; i++) {
        if (i % 3 === 0 || i % 4 === 0) arr.push(i);
    }
    return arr;
};
const VALID_COUNTS = getValidTableCounts();
*/

export function initManager(targetElement) {
    container = targetElement;
    render();
    
    // Global click to close popovers
    document.addEventListener('click', (e) => {
        if (activePopover && !activePopover.contains(e.target) && !e.target.closest('.node-menu-btn')) {
            closePopover();
        }
    });
}

function closePopover() {
    if (activePopover) {
        activePopover.remove();
        activePopover = null;
        // Clean up active states on buttons
        document.querySelectorAll('.node-menu-btn.active').forEach(b => b.classList.remove('active'));
    }
}

function render() {
    if (!container) return;
    const currentCount = getTableCount();
    
    const menu = getMenu();

    container.innerHTML = `
        <div class="manager-container">
            <div class="config-card" id="reports-section"></div>
            <div class="config-card" id="shift-history-section"></div>
            <div class="config-card" id="pricing-section"></div>
            <div class="config-card" id="table-qr-section"></div>

            <div class="config-card compact-row" id="settingtoggles">
                <div>
                    <!-- Solo Mode Toggle -->
                    
                    <div class="control-group shrink">
                        <label class="section-label" data-i18n="settings.solomode">Solo Mode</label>
                        <label class="fancy-switch" aria-label="Solo Mode">
                            <input type="checkbox" id="tog-solo">
                            <span class="switch-track">
                                <span class="switch-icon left" data-i18n="settings.on">${icon('check-circle')}</span>
                                <span class="switch-icon right">${icon('power-off')}</span>
                                <span class="switch-thumb"></span>
                            </span>
                        </label>
                    </div>
                
                    <div class="v-sep"></div>

                    <!-- Hand Toggle -->
                    <div class="control-group shrink">
                        <label class="section-label">${t('settings.handed')}</label>
                        <label class="fancy-switch" aria-label="${t('settings.handed')}">
                            <input type="checkbox" id="tog-hand">
                            <span class="switch-track">
                                <span class="switch-icon left" data-i18n="setup.lijevo">L</span>
                                <span class="switch-icon right" data-i18n="setup.desno">D</span>
                                <span class="switch-thumb"></span>
                            </span>
                        </label>
                    </div>
                </div>
                <!-- Table Count -->
                <div class="control-group grow">
                    <div class="slider-header">
                        <label class="section-label">${t('manager.table_count')}</label>
                        <span class="slider-val-badge" id="disp-count">${currentCount}</span>
                    </div>
                    <input type="range" id="inp-table-count" min="10" max="48" step="1" value="${currentCount}">
                </div>
            </div>

            <div class="config-card flex-fill">
                
                <div class="section-header">
                    <label class="section-label">${t('manager.menu_structure')}</label>
                </div>
                <div class="tree-editor" id="menu-tree"></div>
                
                <button class="btn-ghost full-width" id="btn-add-root">
                    <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                    ${t('manager.add_item')}
                </button>
            </div>
        </div>
    `;

    // Async-fill the reports section (reads the IndexedDB order log).
    renderReports();
    renderHistory();
    renderPricing();
    renderTableQRs();

    // Bindings
    const inpSlider = container.querySelector('#inp-table-count');
    const dispCount = container.querySelector('#disp-count');
    const togHand = container.querySelector('#tog-hand');
    const togSolo = container.querySelector('#tog-solo');

    // Solo Logic
    togSolo.checked = state.soloMode;
    togSolo.onchange = () => {
        state.soloMode = togSolo.checked;
        localStorage.setItem('barlink_solo', state.soloMode ? '1' : '0');
        // If we just enabled solo mode, ensure we broadcast locally
        // (Wait, this is handled by the app logic consuming state.soloMode)
    };

    // Hand Logic
    const savedHand = localStorage.getItem('barlink_hand') || 'right';
    // Let's say Checked = LEFT, Unchecked = RIGHT
    togHand.checked = (savedHand === 'left');
    
    const applyHanded = (isLeft) => {
        const hand = isLeft ? 'left' : 'right';
        localStorage.setItem('barlink_hand', hand);
        document.body.dataset.hand = hand;
    };
    // Apply initial
    applyHanded(togHand.checked);

    togHand.onchange = () => {
        applyHanded(togHand.checked);
    };

    // Slider Logic
    inpSlider.oninput = () => {
        dispCount.textContent = inpSlider.value;
    };
    
    inpSlider.onchange = () => {
        setTableCount(parseInt(inpSlider.value));
    };

    const treeRoot = container.querySelector('#menu-tree');
    renderTree(treeRoot, menu);

    container.querySelector('#btn-add-root').onclick = () => {
        menu.push({ id: crypto.randomUUID(), label: '', children: [] });
        saveMenu(menu);
        renderTree(treeRoot, menu);
    };
}

function countFavorites(items) {
    let count = 0;
    for (const item of items) {
        if (item.isFavorite) count++;
        if (item.children) count += countFavorites(item.children);
    }
    return count;
}

function renderTree(containerEl, items, depth = 0) {
    containerEl.innerHTML = '';
    
    items.forEach((item, idx) => {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'node';
        if (depth === 0) nodeEl.classList.add('node-root');

        const hasChildren = item.children && item.children.length > 0;
        const depthStep = Math.min(depth, 8);
        const isFav = !!item.isFavorite;
        
        // Use a content wrapper for easy flex management
        nodeEl.innerHTML = `
            <div class="node-row" style="--node-depth:${depthStep}">
                <div class="node-main">
                    <div class="node-toggle ${hasChildren ? '' : 'invisible'}" data-action="toggle">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M9 18l6-6-6-6" /></svg>
                    </div>
                    <div class="node-thumb-mini hidden" data-action="img"></div>
                    <input type="text" class="node-input" value="${item.label}" placeholder="${t('manager.label_placeholder')}">
                    ${isFav ? `<span class="node-fav-star">${icon('star')}</span>` : ''}
                    <span class="node-warning hidden" data-action="warn">${t('manager.missing_label')}</span>
                    ${(!hasChildren && item.track) ? `<span class="node-stock-chip ${(Number(item.stock) || 0) <= 0 ? 'oos' : ((Number(item.stock) || 0) <= 5 ? 'low' : '')}" contenteditable="true" data-action="stock-edit" title="${t('stock.in_stock')}">${Number(item.stock) || 0}</span>` : ''}
                </div>
                <div class="node-price-col">
                    <div class="node-price-tag ${hasChildren ? 'hidden' : ''}" contenteditable="true">${item.price || ''}</div>
                </div>
                <div class="node-menu-btn" data-action="menu">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                </div>
            </div>
            <div class="node-children ${item._isOpen ? '' : 'closed'}"></div>
        `;

        const toggleBtn = nodeEl.querySelector('[data-action="toggle"]');
        const childrenContainer = nodeEl.querySelector('.node-children');
        const labelInput = nodeEl.querySelector('.node-input');
        const priceTag = nodeEl.querySelector('.node-price-tag');
        const menuBtn = nodeEl.querySelector('[data-action="menu"]');
        const thumbEl = nodeEl.querySelector('[data-action="img"]');
        const warnEl = nodeEl.querySelector('[data-action="warn"]');

        // Toggle Logic
        toggleBtn.onclick = () => {
            item._isOpen = !item._isOpen;
            childrenContainer.classList.toggle('closed', !item._isOpen);
            toggleBtn.classList.toggle('open', item._isOpen);
        };
        if(item._isOpen) toggleBtn.classList.add('open');

        const updateLabelState = () => {
            const isEmpty = !labelInput.value.trim();
            nodeEl.classList.toggle('missing-label', isEmpty);
            if (warnEl) warnEl.classList.toggle('hidden', !isEmpty);
        };
        updateLabelState();

        // Label Input
        labelInput.oninput = updateLabelState;
        labelInput.onchange = () => {
            item.label = labelInput.value;
            saveMenu(getMenu());
            updateLabelState();
        };

        // Price Input (ContentEditable for cleaner look)
        priceTag.onblur = () => {
            const val = parseFloat(priceTag.innerText);
            item.price = isNaN(val) ? 0 : val;
            priceTag.innerText = item.price || '';
            saveMenu(getMenu());
        };
        priceTag.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                priceTag.blur();
            }
        };

        // Inventory stock chip (leaf items with tracking on)
        const stockChip = nodeEl.querySelector('[data-action="stock-edit"]');
        if (stockChip) {
            stockChip.onblur = () => {
                const v = parseInt(stockChip.innerText, 10);
                item.stock = isNaN(v) ? 0 : Math.max(0, v);
                stockChip.innerText = item.stock;
                stockChip.classList.remove('low', 'oos');
                if (item.stock <= 0) stockChip.classList.add('oos');
                else if (item.stock <= 5) stockChip.classList.add('low');
                saveMenu(getMenu());
            };
            stockChip.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); stockChip.blur(); } };
        }

        // Image Handling
        const updateImage = () => {
            if (item.imageId) {
                thumbEl.classList.remove('hidden');
                getImage(item.imageId).then(blob => {
                    if(blob) thumbEl.style.backgroundImage = `url(${URL.createObjectURL(blob)})`;
                });
            } else {
                thumbEl.classList.add('hidden');
            }
        };
        updateImage();

        // Menu Logic
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            closePopover(); // Close others
            
            menuBtn.classList.add('active');
            
            const pop = document.createElement('div');
            pop.className = 'popover-menu';
            const addImageLabel = item.imageId ? t('manager.change_image') : t('manager.add_image');
            const favIcon = item.isFavorite ? icon('star', 'fav-on') : icon('star-o');
            
            pop.innerHTML = `
                <button class="menu-item" data-act="add">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg> ${t('manager.add_subitem')}
                </button>
                <button class="menu-item" data-act="fav">
                    ${favIcon} ${t('manager.favorite')}
                </button>
                ${!hasChildren ? `<button class="menu-item" data-act="stock">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg> ${item.track ? t('stock.untrack') : t('stock.track')}
                </button>` : ''}
                <button class="menu-item" data-act="img">
                     <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg> ${addImageLabel}
                </button>
                ${item.imageId ? `<button class="menu-item" data-act="rm-img"><svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"/></svg> ${t('manager.remove_image')}</button>` : ''}
                <div style="height:1px; background:var(--border-strong); margin:4px 0;"></div>
                <button class="menu-item danger" data-act="del">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> ${t('manager.delete_item')}
                </button>
            `;
            
            // Positioning logic
            const rect = menuBtn.getBoundingClientRect();
            pop.style.top = `${rect.bottom + 4}px`;
            // Align right edge
            const left = Math.max(10, rect.right - 180);
            pop.style.left = `${left}px`;
            
            document.body.appendChild(pop);
            activePopover = pop;
            
            // Menu Actions
            const fileInput = document.createElement('input');
            fileInput.type = 'file';
            fileInput.accept = 'image/*';
            fileInput.onchange = async () => {
                 if (fileInput.files[0]) {
                    const blob = fileInput.files[0];
                    if (item.imageId) await deleteImage(item.imageId);
                    item.imageId = await saveImage(blob);
                    saveMenu(getMenu());
                    updateImage();
                    closePopover();
                }
            };

            pop.querySelector('[data-act="fav"]').onclick = () => {
                if (!item.isFavorite) {
                    const total = countFavorites(getMenu());
                    if (total >= 5) {
                        toast(t('manager.max_favs'), 'error'); 
                        closePopover();
                        return;
                    }
                    item.isFavorite = true;
                } else {
                    item.isFavorite = false;
                }
                saveMenu(getMenu());
                closePopover();
                renderTree(containerEl, items, depth); // Re-render logic adjusted to keep context
            };

            pop.querySelector('[data-act="add"]').onclick = () => {
                if (!item.children) item.children = [];
                item.children.push({ id: crypto.randomUUID(), label: '', price: 0 });
                item._isOpen = true;
                saveMenu(getMenu());
                closePopover();
                // We need to re-render to show the new structure
                // Ideally we'd just render children, but we need to update the parent row state (toggle visibility)
                toggleBtn.classList.remove('invisible');
                toggleBtn.classList.add('open');
                priceTag.classList.add('hidden');
                childrenContainer.classList.remove('closed');
                renderTree(childrenContainer, item.children, depth + 1);
            };

            const stockActBtn = pop.querySelector('[data-act="stock"]');
            if (stockActBtn) stockActBtn.onclick = () => {
                item.track = !item.track;
                if (item.track && item.stock == null) item.stock = 0;
                saveMenu(getMenu());
                closePopover();
                renderTree(containerEl, items, depth);
            };

            pop.querySelector('[data-act="img"]').onclick = () => fileInput.click();
            
            if(pop.querySelector('[data-act="rm-img"]')) {
                pop.querySelector('[data-act="rm-img"]').onclick = async () => {
                    await deleteImage(item.imageId);
                    delete item.imageId;
                    saveMenu(getMenu());
                    updateImage();
                    closePopover();
                };
            }

            pop.querySelector('[data-act="del"]').onclick = async () => {
                closePopover();
                if (await confirm(t('manager.delete_item') + '?')) {
                    items.splice(idx, 1);
                    saveMenu(getMenu());
                    renderTree(containerEl, items);
                }
            };
        };

        containerEl.appendChild(nodeEl);

        // Recursion
        if (hasChildren) {
            renderTree(childrenContainer, item.children, depth + 1);
        }
    });
}

// --- Reports (Phase 3, host-local) ---

const PAY_ORDER = ['cash', 'card', 'virman', 'house', 'unknown'];

const localeTag = () => (getLanguage() === 'hr' ? 'hr-HR' : 'en-US');
const fmtMoney = (n) => {
    try { return new Intl.NumberFormat(localeTag(), { style: 'currency', currency: 'EUR' }).format(n || 0); }
    catch (e) { return (n || 0).toFixed(2); }
};
const fmtTime = (ts) => {
    if (!ts) return '—';
    try { return new Date(ts).toLocaleString(localeTag(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
    catch (e) { return ''; }
};
const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function renderReports() {
    const host = container && container.querySelector('#reports-section');
    if (!host) return;

    let orders = [];
    let total = 0;
    try {
        orders = await getOrdersSince(getShiftStart());
        total = await countOrders();
    } catch (e) {
        console.warn('[reports] load failed', e);
    }

    if (!orders.length) {
        host.innerHTML = `
            <div class="section-header"><label class="section-label">${t('reports.title')}</label></div>
            <div class="empty-state"><div class="icon">✓</div><p>${t('reports.empty')}</p></div>
            ${total > 0 ? `<div class="reports-actions"><button class="btn-ghost danger-text" id="btn-clear-log">${t('reports.clear_log')}</button></div>` : ''}
        `;
        bindReportButtons(host, []);
        return;
    }

    const sum = summary(orders);
    const sinceStr = fmtTime(getShiftStart());
    const aov = averageOrderValue(orders);
    const hours = byHour(orders);
    const peak = hours.reduce((a, b) => (b.orders > a.orders ? b : a), hours[0]);

    const payRows = PAY_ORDER
        .filter(k => sum.byPayment[k])
        .map(k => {
            const label = k === 'unknown' ? t('reports.payment_unknown') : t('payment.' + k);
            const v = sum.byPayment[k];
            return `<div class="pay-stat"><span>${escHtml(label)}</span><span>${v.orders} · ${fmtMoney(v.revenue)}</span></div>`;
        }).join('');

    const rows = (arr, cells) => arr.map(x => `<tr>${cells(x)}</tr>`).join('');
    const itemRows = rows(salesByItem(orders), i => `<td>${escHtml(i.label)}</td><td class="num">${i.qty}</td><td class="num">${fmtMoney(i.revenue)}</td>`);
    const tableRows = rows(byTable(orders), tb => `<td>${escHtml(tb.label)}</td><td class="num">${tb.orders}</td><td class="num">${fmtMoney(tb.revenue)}</td>`);
    const waiterRows = rows(byWaiter(orders), w => `<td>${escHtml(w.name || t('reports.unknown_waiter'))}</td><td class="num">${w.orders}</td><td class="num">${fmtMoney(w.revenue)}</td>`);

    host.innerHTML = `
        <div class="section-header">
            <label class="section-label">${t('reports.title')}</label>
            <span class="reports-since">${t('reports.shift_since')} ${escHtml(sinceStr)}</span>
        </div>
        <div class="reports-kpis">
            <div class="kpi"><span class="kpi-val">${sum.orderCount}</span><span class="kpi-label">${t('reports.orders')}</span></div>
            <div class="kpi"><span class="kpi-val">${sum.itemCount}</span><span class="kpi-label">${t('reports.items')}</span></div>
            <div class="kpi accent"><span class="kpi-val">${fmtMoney(sum.revenue)}</span><span class="kpi-label">${t('reports.revenue')}</span></div>
        </div>
        <div class="reports-payments">
            <div class="mini-label">${t('reports.payment_breakdown')}</div>
            ${payRows}
        </div>
        <div class="reports-mini">
            <div class="mini-stat"><span class="mini-stat-val">${fmtMoney(aov)}</span><span class="mini-stat-label">${t('reports.avg_order')}</span></div>
            <div class="mini-stat"><span class="mini-stat-val">${peak.orders > 0 ? String(peak.hour).padStart(2, '0') + ':00' : '—'}</span><span class="mini-stat-label">${t('reports.peak_hour')}</span></div>
        </div>
        <details class="reports-details">
            <summary>${t('reports.heatmap')}</summary>
            ${renderHeatmap(hours)}
        </details>
        <details class="reports-details">
            <summary>${t('reports.by_item')}</summary>
            <table class="reports-table"><tbody>${itemRows}</tbody></table>
        </details>
        <details class="reports-details">
            <summary>${t('reports.by_table')}</summary>
            <table class="reports-table"><tbody>${tableRows}</tbody></table>
        </details>
        <details class="reports-details">
            <summary>${t('reports.by_waiter')}</summary>
            <table class="reports-table"><tbody>${waiterRows}</tbody></table>
        </details>
        <div class="reports-actions">
            <button class="btn-ghost" id="btn-export-csv">${t('reports.export_csv')}</button>
            <button class="btn-ghost" id="btn-close-shift">${t('reports.close_shift')}</button>
            <button class="btn-ghost danger-text" id="btn-clear-log">${t('reports.clear_log')}</button>
        </div>
    `;
    bindReportButtons(host, orders);
}

function bindReportButtons(host, orders) {
    const exportBtn = host.querySelector('#btn-export-csv');
    if (exportBtn) exportBtn.onclick = () => exportCsv(orders);

    const closeBtn = host.querySelector('#btn-close-shift');
    if (closeBtn) closeBtn.onclick = async () => {
        // Archive a frozen aggregate of the closing shift before advancing the boundary.
        try {
            if (orders && orders.length) {
                const agg = buildShiftAggregate(orders, {
                    shiftId: (crypto.randomUUID ? crypto.randomUUID() : 's-' + Date.now()),
                    startTs: getShiftStart(),
                    endTs: Date.now(),
                    closedBy: state.workerName || ''
                });
                await saveShift(agg);
            }
        } catch (e) { console.warn('[shift] archive failed', e); }
        startNewShift();
        renderReports();
        renderHistory();
        toast(t('reports.shift_closed'), 'success');
    };

    const clearBtn = host.querySelector('#btn-clear-log');
    if (clearBtn) clearBtn.onclick = async () => {
        if (await confirm(t('reports.clear_confirm'))) {
            try { await clearOrders(); } catch (e) {}
            renderReports();
            toast(t('reports.log_cleared'), 'success');
        }
    };
}

function renderHeatmap(slots) {
    const max = Math.max(1, ...slots.map(s => s.revenue));
    const cells = slots.map(s => {
        const pct = s.revenue > 0 ? Math.round(15 + (s.revenue / max) * 85) : 0;
        const bg = pct > 0 ? `background: color-mix(in srgb, var(--accent) ${pct}%, transparent);` : '';
        const title = `${String(s.hour).padStart(2, '0')}:00 · ${s.orders} · ${fmtMoney(s.revenue)}`;
        return `<div class="heat-cell" style="${bg}" title="${escHtml(title)}"><span>${s.hour}</span></div>`;
    }).join('');
    return `<div class="heatmap">${cells}</div>`;
}

async function renderHistory() {
    const host = container && container.querySelector('#shift-history-section');
    if (!host) return;
    let shifts = [];
    try { shifts = await getRecentShifts(30); } catch (e) { console.warn('[history] load failed', e); }

    if (!shifts.length) {
        host.innerHTML = `<div class="section-header"><label class="section-label">${t('reports.history')}</label></div>
            <p class="reports-since">${t('reports.no_history')}</p>`;
        return;
    }

    const cards = shifts.map(s => {
        const sum = s.summary || {};
        const itemRows = (s.byItem || []).slice(0, 20)
            .map(i => `<tr><td>${escHtml(i.label)}</td><td class="num">${i.qty}</td><td class="num">${fmtMoney(i.revenue)}</td></tr>`).join('');
        return `<details class="shift-history-item">
            <summary>
                <span class="sh-range">${escHtml(fmtTime(s.startTs))}</span>
                <span class="sh-kpi">${sum.orderCount || 0} · ${fmtMoney(sum.revenue || 0)}</span>
            </summary>
            <div class="sh-body">
                <div class="reports-kpis">
                    <div class="kpi"><span class="kpi-val">${sum.orderCount || 0}</span><span class="kpi-label">${t('reports.orders')}</span></div>
                    <div class="kpi"><span class="kpi-val">${sum.itemCount || 0}</span><span class="kpi-label">${t('reports.items')}</span></div>
                    <div class="kpi accent"><span class="kpi-val">${fmtMoney(sum.revenue || 0)}</span><span class="kpi-label">${t('reports.revenue')}</span></div>
                </div>
                ${itemRows ? `<table class="reports-table"><tbody>${itemRows}</tbody></table>` : ''}
                <div class="reports-actions"><button class="btn-ghost danger-text" data-del-shift="${escHtml(s.shiftId)}">${t('actions.remove')}</button></div>
            </div>
        </details>`;
    }).join('');

    host.innerHTML = `<div class="section-header"><label class="section-label">${t('reports.history')}</label></div>${cards}`;
    host.querySelectorAll('[data-del-shift]').forEach(btn => {
        btn.onclick = async () => {
            try { await deleteShift(btn.getAttribute('data-del-shift')); } catch (e) {}
            renderHistory();
        };
    });
}

function renderTableQRs() {
    const host = container && container.querySelector('#table-qr-section');
    if (!host) return;
    const code = state.sessionCode;
    if (!code) {
        host.innerHTML = `<div class="section-header"><label class="section-label">${t('manager.table_qrs')}</label></div><p class="reports-since">${t('setup.no_peers')}</p>`;
        return;
    }
    host.innerHTML = `
        <details class="reports-details">
            <summary><label class="section-label">${t('manager.table_qrs')}</label></summary>
            <div class="table-qr-actions"><button class="btn-ghost" id="btn-print-qrs">${t('manager.print_qrs')}</button></div>
            <div class="table-qr-grid" id="table-qr-grid"></div>
        </details>
    `;
    const det = host.querySelector('details');
    const grid = host.querySelector('#table-qr-grid');
    const renderGrid = () => {
        if (grid.dataset.rendered) return;
        grid.dataset.rendered = '1';
        const base = location.origin + location.pathname;
        for (let id = 1; id <= getTableCount(); id++) {
            const card = document.createElement('div');
            card.className = 'table-qr-card';
            card.innerHTML = `<canvas></canvas><span>${t('bartender.table_label', { table: id })}</span>`;
            grid.appendChild(card);
            renderQR(card.querySelector('canvas'), `${base}?n=${code}&t=${id}&r=customer`, 130);
        }
    };
    det.addEventListener('toggle', () => { if (det.open) renderGrid(); });
    const printBtn = host.querySelector('#btn-print-qrs');
    if (printBtn) printBtn.onclick = () => {
        det.open = true;
        renderGrid();
        document.body.classList.add('printing-qrs');
        window.print();
        setTimeout(() => document.body.classList.remove('printing-qrs'), 800);
    };
}

function flattenMenuOptions(menu) {
    const opts = [];
    const walk = (nodes, prefix) => {
        (nodes || []).forEach(n => {
            const label = (prefix ? prefix + ' › ' : '') + (n.label || '?');
            if (n.children) { opts.push({ type: 'cat', id: n.id, label: label + ' ▸' }); walk(n.children, label); }
            else opts.push({ type: 'item', id: n.id, label });
        });
    };
    walk(menu, '');
    return opts;
}

function renderPricing() {
    const host = container && container.querySelector('#pricing-section');
    if (!host) return;
    const rules = getPriceRules();
    const opts = flattenMenuOptions(getMenu());
    const days = getLanguage() === 'hr' ? ['N', 'P', 'U', 'S', 'Č', 'P', 'S'] : ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const ruleRows = rules.map(r => {
        const scopeLabel = (opts.find(o => o.type === (r.scope && r.scope.type) && o.id === (r.scope && r.scope.id)) || {}).label || '—';
        const win = (r.from && r.to) ? `${r.from}–${r.to}` : t('pricing.all_day');
        const modeLabel = r.mode === 'abs' ? fmtMoney(r.value) : (r.mode === 'pct' ? `−${r.value}%` : `${r.value > 0 ? '+' : ''}${r.value} €`);
        return `<div class="price-rule ${r.active === false ? 'inactive' : ''}">
            <div class="pr-main">
                <span class="pr-label">${escHtml(r.label || t('pricing.rule'))}</span>
                <span class="pr-meta">${escHtml(scopeLabel)} · ${escHtml(win)} · ${escHtml(modeLabel)}</span>
            </div>
            <button class="icon-btn small" data-toggle-rule="${escHtml(r.id)}" aria-label="toggle">${r.active === false ? icon('play') : icon('check-circle')}</button>
            <button class="icon-btn small" data-del-rule="${escHtml(r.id)}" aria-label="delete">${icon('trash')}</button>
        </div>`;
    }).join('');

    host.innerHTML = `
        <div class="section-header"><label class="section-label">${t('pricing.title')}</label></div>
        <div class="price-rule-list">${ruleRows || `<p class="reports-since">${t('pricing.none')}</p>`}</div>
        <details class="reports-details">
            <summary>＋ ${t('pricing.add_rule')}</summary>
            <div class="rule-form">
                <input type="text" id="pr-label" class="rule-input" placeholder="${t('pricing.label_ph')}" maxlength="40">
                <select id="pr-scope" class="rule-input">${opts.map(o => `<option value="${o.type}:${escHtml(o.id)}">${escHtml(o.label)}</option>`).join('')}</select>
                <div class="rule-row">
                    <select id="pr-mode" class="rule-input">
                        <option value="pct">${t('pricing.pct')}</option>
                        <option value="abs">${t('pricing.abs')}</option>
                        <option value="delta">${t('pricing.delta')}</option>
                    </select>
                    <input type="number" id="pr-value" class="rule-input" step="0.01" placeholder="0">
                </div>
                <div class="rule-row">
                    <input type="time" id="pr-from" class="rule-input" aria-label="${t('pricing.from')}">
                    <input type="time" id="pr-to" class="rule-input" aria-label="${t('pricing.to')}">
                </div>
                <div class="rule-days">${days.map((d, i) => `<label class="day-chip"><input type="checkbox" value="${i}"><span>${d}</span></label>`).join('')}</div>
                <button class="btn-primary full-width" id="pr-save">${t('actions.save')}</button>
            </div>
        </details>
    `;

    host.querySelectorAll('[data-del-rule]').forEach(btn => {
        btn.onclick = () => { savePriceRules(getPriceRules().filter(r => r.id !== btn.getAttribute('data-del-rule'))); renderPricing(); };
    });
    host.querySelectorAll('[data-toggle-rule]').forEach(btn => {
        btn.onclick = () => {
            const id = btn.getAttribute('data-toggle-rule');
            const list = getPriceRules().map(r => r.id === id ? { ...r, active: r.active === false } : r);
            savePriceRules(list); renderPricing();
        };
    });
    const saveBtn = host.querySelector('#pr-save');
    if (saveBtn) saveBtn.onclick = () => {
        const scopeRaw = host.querySelector('#pr-scope').value || '';
        const [stype, ...idParts] = scopeRaw.split(':');
        const rule = {
            id: (crypto.randomUUID ? crypto.randomUUID() : 'r-' + Date.now()),
            label: (host.querySelector('#pr-label').value || '').trim() || t('pricing.rule'),
            scope: { type: stype, id: idParts.join(':') },
            mode: host.querySelector('#pr-mode').value,
            value: parseFloat(host.querySelector('#pr-value').value) || 0,
            days: [...host.querySelectorAll('.rule-days input:checked')].map(c => Number(c.value)),
            from: host.querySelector('#pr-from').value || '',
            to: host.querySelector('#pr-to').value || '',
            active: true
        };
        savePriceRules([...getPriceRules(), rule]);
        renderPricing();
        toast(t('pricing.saved'), 'success');
    };
}

function exportCsv(orders) {
    const csv = toCsv(orders);
    const stamp = new Date().toISOString().slice(0, 10);
    try {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `kafic-shift-${stamp}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        toast(t('reports.exported'), 'success');
    } catch (e) {
        // Locked-down PWA contexts: fall back to clipboard.
        if (navigator.clipboard) {
            navigator.clipboard.writeText(csv)
                .then(() => toast(t('reports.copied'), 'success'))
                .catch(() => {});
        }
    }
}
