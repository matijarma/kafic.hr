import { state } from 'state';

const STORAGE_KEY = 'barlink_session';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // URL friendly, no confusing chars

export const generateJoinCode = () => {
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    }
    return code;
};

export const roomIdFromCode = (code) => `barlink-${code.toLowerCase()}`;

export const saveSession = (session) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const loadSession = () => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed;
    } catch (e) {
        console.warn('Failed to load session', e);
        return null;
    }
};

export const clearSavedSession = () => {
    localStorage.removeItem(STORAGE_KEY);
};

export const syncStateToSession = (session) => {
    state.sessionCode = session.sessionCode;
    state.roomId = session.roomId;
    state.isHost = session.isHost;
    state.workerName = session.workerName;
    state.role = session.role || null;
};
