// Local backup / restore — the serverless replacement for cloud backup.
// Exports a single versioned JSON file (settings + menu images + optional order log);
// imports with replace/merge. No server involved.
import { getMenu } from 'data';
import { getImage, saveImage, getAllOrders, saveOrder } from 'db';
import { t } from 'i18n';
import { toast } from 'ux';

// Business-data settings only — device/session-local keys are intentionally excluded.
const SETTINGS_KEYS = [
    'barlink_menu', 'barlink_table_count', 'barlink_hand', 'barlink_lang',
    'barlink_theme', 'barlink_solo', 'barlink_sync_mode', 'barlink_price_rules', 'barlink_shift_start'
];

const blobToDataUrl = (blob) => new Promise((res) => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(blob); });
const dataUrlToBlob = async (url) => (await fetch(url)).blob();

const collectImageIds = (menu) => {
    const ids = new Set();
    const walk = (nodes) => (nodes || []).forEach(n => { if (n.imageId) ids.add(n.imageId); if (n.children) walk(n.children); });
    walk(menu);
    return [...ids];
};

export const exportBackup = async ({ includeOrders = false } = {}) => {
    const settings = {};
    SETTINGS_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) settings[k] = v; });

    const images = [];
    for (const id of collectImageIds(getMenu())) {
        try { const blob = await getImage(id); if (blob) images.push({ id, data: await blobToDataUrl(blob) }); } catch (e) {}
    }

    const backup = { kafic_backup: 1, exportedAt: Date.now(), app: 'kafic.hr', settings, images, includesOrders: !!includeOrders };
    if (includeOrders) { try { backup.orders = await getAllOrders(); } catch (e) { backup.orders = []; } }

    const json = JSON.stringify(backup);
    const stamp = new Date().toISOString().slice(0, 10);
    try {
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `kafic-backup-${stamp}.json`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        toast(t('backup.exported'), 'success');
    } catch (e) {
        try { await navigator.clipboard.writeText(json); toast(t('backup.exported'), 'success'); } catch (e2) { toast(t('backup.invalid'), 'error'); }
    }
    return backup;
};

// strategy: 'replace' (overwrite) | 'merge' (only fill missing settings). Orders always idempotent by orderId.
export const importBackup = async (file, { strategy = 'replace' } = {}) => {
    let data;
    try { data = JSON.parse(await file.text()); } catch (e) { toast(t('backup.invalid'), 'error'); return false; }
    if (!data || data.kafic_backup == null) { toast(t('backup.invalid'), 'error'); return false; }

    const settings = data.settings || {};
    Object.entries(settings).forEach(([k, v]) => {
        if (!SETTINGS_KEYS.includes(k)) return;
        if (strategy === 'merge' && localStorage.getItem(k) != null) return;
        try { localStorage.setItem(k, v); } catch (e) {}
    });

    for (const img of (data.images || [])) {
        try { const blob = await dataUrlToBlob(img.data); await saveImage(blob, img.id); } catch (e) {}
    }

    if (Array.isArray(data.orders)) {
        for (const o of data.orders) { try { await saveOrder(o); } catch (e) {} } // put = idempotent
    }

    return true;
};
