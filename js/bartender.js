import { t } from 'i18n';
import { toast } from 'ux';

const feed = document.getElementById('bartender-feed');
const tableCards = new Map();

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

export const onOrderReceived = (data) => {
    // Remove existing card for table if exists (update)
    if (tableCards.has(data.tableId)) {
        tableCards.get(data.tableId).remove();
        tableCards.delete(data.tableId);
    }
    
    const card = createCard(data);
    tableCards.set(data.tableId, card);
    
    // Insert at top, but after empty state if it exists
    const empty = feed.querySelector('.empty-state');
    if (empty) empty.remove();
    
    feed.prepend(card);
    notify(data);
};

const createCard = (data) => {
    const el = document.createElement('div');
    el.className = 'feed-card';
    
    const time = new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    
    let html = `
        <div class="feed-header">
            <span>Table ${data.tableId}</span>
            <span style="font-weight:400; font-size:0.9em; opacity:0.7">${time}</span>
        </div>
        <div class="feed-items">
    `;
    
    data.items.forEach(item => {
        html += `
            <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px dashed var(--bg-surface-2)">
                <span><b>${item.qty}</b> ${item.label}</span>
                <small style="opacity:0.7">${item.context||''}</small>
            </div>
        `;
    });
    
    html += `</div>
        <button class="feed-btn" data-action="done">${t('actions.mark_done')}</button>
    `;
    
    el.innerHTML = html;
    
    el.querySelector('[data-action="done"]').onclick = () => {
        el.style.opacity = '0';
        el.style.transform = 'scale(0.95)';
        setTimeout(() => {
            el.remove();
            tableCards.delete(data.tableId);
            checkEmpty();
        }, 200);
    };
    
    return el;
};

const checkEmpty = () => {
    if (feed.children.length === 0) {
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
