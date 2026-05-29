
const DB_NAME = 'barlink_db';
const DB_VERSION = 2; // v2: adds the 'orders' store (v1 had 'images' only)
const STORE_IMAGES = 'images';
const STORE_ORDERS = 'orders';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Additive + idempotent: each store guarded by contains() so a fresh v2
        // install creates both, and a v1->v2 upgrade keeps existing images.
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_ORDERS)) {
                const os = db.createObjectStore(STORE_ORDERS, { keyPath: 'orderId' });
                os.createIndex('byTimestamp', 'timestamp', { unique: false });
            }
        };

        request.onsuccess = (e) => {
            const db = e.target.result;
            // If another tab triggers an upgrade, close here so it isn't blocked.
            db.onversionchange = () => { db.close(); dbPromise = null; };
            resolve(db);
        };

        request.onerror = (e) => {
            console.error('IDB Error', e);
            reject(e);
        };
    });
    return dbPromise;
}

export async function saveImage(blob, forceId = null) {
    const db = await openDB();
    const id = forceId || crypto.randomUUID();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.put({ id, blob, created: Date.now() });
        
        req.onsuccess = () => resolve(id);
        req.onerror = () => reject(req.error);
    });
}

export async function getImage(id) {
    if (!id) return null;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.get(id);
        
        req.onsuccess = () => {
            const res = req.result;
            resolve(res ? res.blob : null);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function deleteImage(id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readwrite');
        const store = tx.objectStore(STORE_IMAGES);
        const req = store.delete(id);

        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

// --- Order log (Phase 3, host-local) ---

export async function saveOrder(record) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ORDERS, 'readwrite');
        const req = tx.objectStore(STORE_ORDERS).put(record); // put: re-delivery overwrites, no dup
        req.onsuccess = () => resolve(record.orderId);
        req.onerror = () => reject(req.error);
    });
}

// Bounded read via the byTimestamp index (one shift, not all history).
export async function getOrdersSince(sinceTs = 0) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ORDERS, 'readonly');
        const idx = tx.objectStore(STORE_ORDERS).index('byTimestamp');
        const out = [];
        const req = idx.openCursor(IDBKeyRange.lowerBound(sinceTs));
        req.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) { out.push(cursor.value); cursor.continue(); }
            else resolve(out);
        };
        req.onerror = () => reject(req.error);
    });
}

export async function getAllOrders() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ORDERS, 'readonly');
        const req = tx.objectStore(STORE_ORDERS).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
    });
}

export async function clearOrders() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ORDERS, 'readwrite');
        const req = tx.objectStore(STORE_ORDERS).clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
}

export async function countOrders() {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_ORDERS, 'readonly');
        const req = tx.objectStore(STORE_ORDERS).count();
        req.onsuccess = () => resolve(req.result || 0);
        req.onerror = () => reject(req.error);
    });
}
