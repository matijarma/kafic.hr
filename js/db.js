
const DB_NAME = 'barlink_db';
const DB_VERSION = 1;
const STORE_IMAGES = 'images';

let dbPromise = null;

function openDB() {
    if (dbPromise) return dbPromise;

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_IMAGES)) {
                db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
            }
        };

        request.onsuccess = (e) => {
            resolve(e.target.result);
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
