// Receipt / kitchen-ticket printing.
// Primary path: window.print() of a narrow receipt — works everywhere (AirPrint / system / Save-to-PDF).
// Progressive enhancement: ESC/POS over Web Bluetooth (Android-Chrome only); degrades to window.print().
import { t } from 'i18n';
import { toast } from 'ux';

const fmtMoney = (n) => `${(Math.round((n || 0) * 100) / 100).toFixed(2)} €`;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const lineOf = (it) => (it.lineTotal != null ? it.lineTotal : (it.unitPrice || 0) * (it.qty || 0));

export const printReceipt = (order) => {
    const items = order.items || [];
    const total = order.orderTotal != null ? order.orderTotal : items.reduce((s, it) => s + lineOf(it), 0);
    const rows = items.map(it => {
        const main = `<tr><td class="q">${it.qty}×</td><td class="n">${esc(it.label)}</td><td class="p">${fmtMoney(lineOf(it))}</td></tr>`;
        const note = it.note ? `<tr><td></td><td class="note" colspan="2">“${esc(it.note)}”</td></tr>` : '';
        return main + note;
    }).join('');
    const title = order.tableLabel || (order.tableId != null ? `Stol ${order.tableId}` : 'kafić.hr');

    let host = document.getElementById('print-receipt-host');
    if (!host) { host = document.createElement('div'); host.id = 'print-receipt-host'; document.body.appendChild(host); }
    host.innerHTML = `
        <div class="receipt-print">
            <h2>kafić.hr</h2>
            <div class="rp-table">${esc(title)}</div>
            <div class="rp-time">${new Date(order.timestamp || Date.now()).toLocaleString()}</div>
            <table class="rp-items">${rows}</table>
            <div class="rp-total"><span>${t('order_sent.total')}</span><span>${fmtMoney(total)}</span></div>
        </div>`;

    document.body.classList.add('printing-receipt');
    const cleanup = () => { document.body.classList.remove('printing-receipt'); host.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    try { window.print(); } catch (e) { cleanup(); }
    setTimeout(cleanup, 2000); // fallback if afterprint never fires
};

// Capability check for the hardware path (Android-Chrome / desktop Chrome+Edge only).
export const canBluetoothPrint = () => typeof navigator !== 'undefined' && !!navigator.bluetooth;

// ESC/POS over BLE is printer-specific; this is the connection hook. On any failure or
// unsupported platform it degrades to the universal window.print() path.
export const printReceiptBluetooth = async (order) => {
    if (!canBluetoothPrint()) { printReceipt(order); return false; }
    try {
        await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [0x18f0] });
        // A specific printer's GATT write would go here. Until a printer is paired/profiled,
        // fall back to the universal print so the receipt always comes out.
        printReceipt(order);
        return true;
    } catch (e) {
        toast(t('print.no_printer'), 'info');
        printReceipt(order);
        return false;
    }
};
