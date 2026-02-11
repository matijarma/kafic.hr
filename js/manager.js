import { getTableCount, setTableCount, getMenu, saveMenu } from 'data';
import { saveImage, deleteImage, getImage } from 'db';
import { t } from 'i18n';
import { toast, confirm } from 'ux';
import { state } from 'state';

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
            <header class="manager-header">
                <button class="icon-btn" id="mgr-back" aria-label="Back">
                    <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                </button>
                <h2 class="header-title">${t('manager.title')}</h2>
                <div style="width:40px"></div>
            </header>

            <div class="config-card compact-row" id="settingtoggles">
                <div>
                    <!-- Solo Mode Toggle -->
                    
                    <div class="control-group shrink">
                        <label class="section-label" data-i18n="settings.solomode">Solo Mode</label>
                        <label class="fancy-switch" aria-label="Solo Mode">
                            <input type="checkbox" id="tog-solo">
                            <span class="switch-track">
                                <span class="switch-icon left" data-i18n="settings.on"><i class="fas fa-check-circle"></i></span>
                                <span class="switch-icon right"><i class="fas fa-power-off"></i></span>
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

    // Bindings
    container.querySelector('#mgr-back').onclick = () => {
        window.dispatchEvent(new CustomEvent('nav-back'));
    };

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
                    ${isFav ? '<span style="color:var(--warning); margin-left:4px"><i class="fas fa-star"></i></span>' : ''}
                    <span class="node-warning hidden" data-action="warn">${t('manager.missing_label')}</span>
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
            const favIcon = item.isFavorite ? '<i class="fas fa-star" style="color:var(--warning)"></i>' : '<i class="far fa-star"></i>';
            
            pop.innerHTML = `
                <button class="menu-item" data-act="add">
                    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 4v16m8-8H4"/></svg> ${t('manager.add_subitem')}
                </button>
                <button class="menu-item" data-act="fav">
                    ${favIcon} ${t('manager.favorite')}
                </button>
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
