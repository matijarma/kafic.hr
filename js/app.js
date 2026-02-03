import { initNetwork, broadcast } from 'network';
import { state, resetWaiterState } from 'state';
import { generateJoinCode, roomIdFromCode, saveSession, loadSession, clearSavedSession, syncStateToSession } from 'session';
import { initWaiter, refreshWaiter } from 'waiter';
import { initBartender, onOrderReceived } from 'bartender';
import { initManager } from 'manager';
import { renderQR } from 'qr';
import { initI18n, t, setLanguage, getLanguage, updateDOM } from 'i18n';
import { initUX, toast, confirm as confirmModal } from 'ux';

// Elements
const views = {
    setup: document.getElementById('view-setup'),
    waiter: document.getElementById('view-waiter'),
    bartender: document.getElementById('view-bartender'),
    manager: document.getElementById('view-manager')
};
const slides = {
    home: document.getElementById('setup-home'),
    join: document.getElementById('setup-join'),
    lobby: document.getElementById('setup-lobby')
};
const versionPill = document.getElementById('version-pill');
const offlinePill = document.getElementById('offline-pill');
const btnInstallApp = document.getElementById('btn-install-app');
const themeMeta = document.querySelector('meta[name="theme-color"]');

// Global Headers
const headerUsername = document.getElementById('header-username');
const btnToggleTheme = document.getElementById('btn-toggle-theme');
const btnToggleLang = document.getElementById('btn-toggle-lang');
const btnResetApp = document.getElementById('btn-reset-app');
const logoHome = document.getElementById('logo-home');

// Setup Action Buttons
const btnHost = document.getElementById('btn-host');
const btnJoin = document.getElementById('btn-join');
const btnResume = document.getElementById('btn-resume');
const resumeDock = document.getElementById('resume-dock');
const resumeCodeDisplay = document.getElementById('resume-code-display');

// Join
const joinInput = document.getElementById('join-code-input');
const btnConfirmJoin = document.getElementById('btn-confirm-join');
const btnScan = document.getElementById('btn-scan');
const btnPaste = document.getElementById('btn-paste');
const joinHint = document.getElementById('join-hint');
const joinStatus = document.getElementById('join-status');

// Lobby
const qrCanvas = document.getElementById('qr-canvas');
const displayCode = document.getElementById('display-code');
const btnCopyLink = document.getElementById('btn-copy-link');
const peerCountLabel = document.getElementById('peer-count-label');
const leaveLobbyBtn = document.getElementById('leave-lobby-btn');
const btnManage = document.getElementById('btn-manage');
const roleBtns = document.querySelectorAll('.role-card[data-role]');

// Role Back Buttons
const waiterExitBtn = document.getElementById('waiter-exit-btn');
const bartenderBackBtn = document.getElementById('bartender-back-btn');

// Scanner
const scanOverlay = document.getElementById('scan-overlay');
const scanVideo = document.getElementById('scan-video');
const btnCloseScan = document.getElementById('btn-close-scan');

const APP_VERSION = document.documentElement.dataset.version || window.__APP_VERSION__ || 'dev';
let stopScan = null;
let hasNetwork = false;
let waiterStarted = false;
let bartenderStarted = false;
let deferredInstallPrompt = null;

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const setBodyView = (viewId = 'setup') => {
    document.body.dataset.view = viewId;
};
const syncUsernameWidth = () => {
    if (!headerUsername) return;
    const base = headerUsername.value?.trim() || headerUsername.placeholder || '';
    const size = clamp(base.length + 1, 8, 20);
    headerUsername.setAttribute('size', size);
};

function formatJoinCode(val = '') {
    if (!val) return '';
    try {
        // If a full URL is pasted, pull ?join=
        const maybeUrl = new URL(val);
        const joinParam = maybeUrl.searchParams.get('join');
        if (joinParam) val = joinParam;
    } catch (e) {
        const match = val.match(/join=([A-Za-z0-9]+)/i);
        if (match) val = match[1];
    }
    return val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
}

// --- BOOTSTRAP ---
bootstrap();

function bootstrap() {
    setBodyView('setup');
    // 1. I18n
    const savedLang = localStorage.getItem('barlink_lang') || 'hr';
    initI18n(savedLang);
    updateLangBtn(savedLang);
    if (versionPill) versionPill.textContent = `v${APP_VERSION}`;
    if (offlinePill) offlinePill.textContent = t('alerts.offline');

    // 2. Welcome note collapse state
    const welcomeNote = document.getElementById('welcome-note');
    if (welcomeNote) {
        const stored = localStorage.getItem('barlink_welcome_open');
        if (stored === '0') welcomeNote.removeAttribute('open');
        welcomeNote.addEventListener('toggle', () => {
            localStorage.setItem('barlink_welcome_open', welcomeNote.open ? '1' : '0');
        });
    }

    // 3. UX (Back button handler)
    initUX((historyState) => {
        if (!historyState) {
            // Root
            goToSlide('home');
            return;
        }
        if (historyState.view) {
            goToView(historyState.view, false);
        } else if (historyState.slide) {
            goToSlide(historyState.slide, false);
        }
    });

    // 4. User Name Load
    const savedName = localStorage.getItem('barlink_name');
    if (savedName) {
        headerUsername.value = savedName;
        state.workerName = savedName;
    }
    syncUsernameWidth();
    
    // 5. Session Check
    const session = loadSession();
    if (session && session.sessionCode) {
        resumeDock.classList.remove('hidden');
        resumeCodeDisplay.textContent = session.sessionCode;
        btnResume.onclick = () => resumeFlow(session);
    }
    
    // 6. Events
    setupEvents();
    bindConnectivity();
    setupInstallPrompt();
    syncJoinControls();
    registerServiceWorker();
    
    window.addEventListener('nav-back', () => {
        // Fallback or explicit navigation
        returnToLobby();
    });
    
    // 7. URL Join
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
        params.delete('join');
        const cleanQuery = params.toString();
        const cleanUrl = `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
        history.replaceState(history.state, '', cleanUrl);
        goToSlide('join');
        joinInput.value = formatJoinCode(joinCode);
        syncJoinControls();
        focusJoinInput();
    }
}

function setupEvents() {
    // Navigation
    btnHost.onclick = startHost;
    btnJoin.onclick = () => {
        goToSlide('join');
        focusJoinInput();
    };
    
    // Global Header Actions
    headerUsername.addEventListener('input', (e) => {
        localStorage.setItem('barlink_name', e.target.value.trim());
        state.workerName = e.target.value.trim();
        syncUsernameWidth();
    });
    
    btnToggleTheme.onclick = cycleTheme;
    btnToggleLang.onclick = cycleLang;
    
    btnResetApp.onclick = async () => {
        if(await confirmModal(t('settings.reset') + '?')) {
            localStorage.clear();
            window.location.reload();
        }
    };

    if (logoHome) {
        logoHome.onclick = async () => {
            if (state.sessionCode) {
                if (await confirmModal(t('confirm.leave_session'))) {
                    clearSavedSession();
                    window.location.reload();
                }
            } else {
                goToSlide('home');
            }
        };
    }

    document.querySelectorAll('.nav-back-btn').forEach(b => b.onclick = () => history.back());
    
    // Join
    joinInput.addEventListener('input', syncJoinControls);
    joinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !btnConfirmJoin.disabled) joinSession();
    });
    btnConfirmJoin.onclick = joinSession;
    btnPaste.onclick = async () => {
        try {
            const txt = await navigator.clipboard.readText();
            if (txt) {
                joinInput.value = txt.trim().toUpperCase();
                syncJoinControls();
            }
        } catch(e) { toast(t('alerts.paste_failed'), 'error'); }
    };
    btnScan.onclick = startScanner;
    btnCloseScan.onclick = stopScanner;

    // Lobby
    if (leaveLobbyBtn) {
        leaveLobbyBtn.onclick = async () => {
            if (await confirmModal(t('confirm.leave_session'))) {
                clearSavedSession();
                window.location.reload();
            }
        };
    }
    if(btnManage) {
        btnManage.onclick = () => {
             initManager(views.manager);
             goToView('manager');
        };
    }
    btnCopyLink.onclick = async () => {
        const url = `${window.location.origin}${window.location.pathname}?join=${state.sessionCode}`;
        try {
            await navigator.clipboard.writeText(url);
            if (navigator.share) {
                await navigator.share({ title: 'Kafić.hr', text: t('setup.share_title'), url });
            } else {
                // Clipboard already set; nothing else to do
            }
            toast(t('alerts.link_copied'), 'success');
        } catch (e) {
            toast(t('alerts.share_failed'), 'error');
        }
    };
    roleBtns.forEach(btn => btn.onclick = () => selectRole(btn.dataset.role));
    
    // Role Back Hooks
    if (waiterExitBtn) waiterExitBtn.onclick = () => returnToLobby();
    bartenderBackBtn.onclick = () => returnToLobby();
    // Expose global return for waiter navigation
    window.returnToLobby = returnToLobby;
}

function syncJoinControls() {
    const formatted = formatJoinCode(joinInput.value);
    if (joinInput.value !== formatted) joinInput.value = formatted;
    const isValid = formatted.length === 6;
    btnConfirmJoin.disabled = !isValid;
    setJoinStatus(isValid ? '' : t('setup.join_hint'));
}

function setJoinStatus(msg, type = '') {
    if (!joinStatus) return;
    joinStatus.textContent = msg || '';
    joinStatus.className = `status-line${type ? ' ' + type : ''}`;
}

function setLobbyStatus(msg, type = '') {
    if (!peerCountLabel) return;
    peerCountLabel.textContent = msg || '';
    const container = peerCountLabel.closest('.peers-indicator');
    if (container) {
        container.classList.remove('connected', 'error');
        if (type === 'success') container.classList.add('connected');
        if (type === 'error') container.classList.add('error');
    }
}

function setNetIndicator(text, status = '') {
    const netPill = document.getElementById('waiter-net-pill');
    if (!netPill) return;
    const label = netPill.querySelector('.label');
    if (label) label.textContent = text || '';
    netPill.classList.toggle('connected', status === 'connected');
    netPill.classList.toggle('offline', status === 'offline');
}

function focusJoinInput() {
    setTimeout(() => joinInput?.focus(), 60);
}

function bindConnectivity() {
    const refresh = () => {
        const online = navigator.onLine;
        offlinePill?.classList.toggle('hidden', online);
        if (!online) setLobbyStatus(t('alerts.offline'), 'error');
        if (!online) {
            setNetIndicator(t('alerts.offline'), 'offline');
        } else {
            setNetIndicator(t('setup.waiting_short'), '');
        }
    };
    window.addEventListener('online', () => {
        toast(t('alerts.back_online'), 'success');
        refresh();
        updatePeerUI();
    });
    window.addEventListener('offline', () => {
        toast(t('alerts.offline'), 'error');
        refresh();
    });
    refresh();
}

function setupInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredInstallPrompt = e;
        btnInstallApp?.classList.remove('hidden');
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        btnInstallApp?.classList.add('hidden');
        toast(t('alerts.install_complete'), 'success');
    });
    btnInstallApp?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        btnInstallApp.disabled = true;
        deferredInstallPrompt.prompt();
        try {
            const result = await deferredInstallPrompt.userChoice;
            if (result.outcome === 'accepted') toast(t('alerts.installing'), 'info');
        } finally {
            btnInstallApp.disabled = false;
            deferredInstallPrompt = null;
            btnInstallApp.classList.add('hidden');
        }
    });
}

// --- FLOWS ---

function goToView(viewId, push = true) {
    Object.values(views).forEach(el => el.classList.remove('active'));
    views[viewId].classList.add('active');
    setBodyView(viewId);
    if (push) history.pushState({ view: viewId }, '');
}

function goToSlide(slideId, push = true) {
    Object.values(slides).forEach(el => el.classList.remove('active'));
    slides[slideId].classList.add('active');
    setBodyView('setup');
    if (push) history.pushState({ slide: slideId }, '');
}

function startHost() {
    resetWaiterState();
    state.barOrders = [];
    setJoinStatus('');
    const code = generateJoinCode();
    initSessionState(code, true);
    setupLobbyUI();
    setLobbyStatus(t('setup.connecting'), 'info');
    goToSlide('lobby');
    connectNetwork();
}

function joinSession() {
    const code = formatJoinCode(joinInput.value);
    if (code.length !== 6) {
        setJoinStatus(t('alerts.join_invalid'), 'error');
        toast(t('alerts.join_invalid'), 'error');
        return;
    }
    resetWaiterState();
    state.barOrders = [];
    setJoinStatus(t('setup.connecting'), 'success');
    setLobbyStatus(t('setup.connecting'), 'info');
    initSessionState(code, false);
    setupLobbyUI();
    goToSlide('lobby');
    connectNetwork();
}

function resumeFlow(session) {
    syncStateToSession(session);
    state.peers = {};
    state.barOrders = [];
    resetWaiterState();
    hasNetwork = false;
    setJoinStatus('');
    setLobbyStatus(t('setup.resuming'), 'info');
    
    if (session.role) {
        connectNetwork();
        launchRole(session.role);
    } else {
        setupLobbyUI();
        goToSlide('lobby');
        connectNetwork();
    }
}

function returnToLobby() {
    // Clear role persistence so reload doesn't stick
    state.role = null;
    resetWaiterState();
    persist();
    setLobbyStatus(t('setup.no_peers'), 'info');
    
    // Go to setup/lobby
    Object.values(views).forEach(el => el.classList.remove('active'));
    views.setup.classList.add('active');
    setBodyView('setup');
    goToSlide('lobby');
}

function initSessionState(code, isHost) {
    state.peers = {};
    state.barOrders = [];
    resetWaiterState();
    hasNetwork = false;
    const safeName = (headerUsername.value || '').trim() || 'Worker';
    const session = {
        sessionCode: code,
        roomId: roomIdFromCode(code),
        isHost: isHost,
        workerName: safeName,
        role: null
    };
    headerUsername.value = safeName;
    syncUsernameWidth();
    syncStateToSession(session);
    persist();
}

function setupLobbyUI() {
    displayCode.textContent = state.sessionCode;
    renderQR(qrCanvas, state.sessionCode, 156);
    setLobbyStatus(t('setup.no_peers'), 'info');
    updatePeerUI();
}

function selectRole(role) {
    state.role = role;
    state.workerName = headerUsername.value || 'Worker';
    persist();
    launchRole(role);
}

function launchRole(role) {
    if (role === 'waiter') {
        goToView('waiter');
        if (!waiterStarted) { initWaiter(); waiterStarted = true; }
        else refreshWaiter();
    } else {
        goToView('bartender');
        if (!bartenderStarted) { initBartender(); bartenderStarted = true; }
    }
}

// --- NETWORK ---

function connectNetwork() {
    if (hasNetwork) return;
    if (!state.roomId || !state.sessionCode) {
        toast(t('alerts.no_session'), 'error');
        setLobbyStatus(t('alerts.no_session'), 'error');
        return;
    }
    hasNetwork = true;
    setLobbyStatus(t('setup.connecting'), 'info');
    
    try {
        initNetwork(state.roomId, (data, peerId) => {
            if (data.type === 'hello') {
                state.peers[peerId] = { name: data.name, role: data.role };
                updatePeerUI();
            }
            if (data.type === 'new-order') {
                onOrderReceived(data);
            }
        }, (status) => {
            if (status.type === 'leave' && status.peerId) delete state.peers[status.peerId];
            if (status.type === 'connected' || status.type === 'peers' || status.type === 'join' || status.type === 'leave') {
                updatePeerUI();
            }
            if (status.type === 'join') {
                announceSelf(status.peerId);
                toast(t('alerts.peer_joined'), 'info');
            }
            if (status.type === 'leave') toast(t('alerts.peer_left'), 'info');
            if (status.type === 'error') {
                setLobbyStatus(t('alerts.network_error'), 'error');
                toast(t('alerts.network_error'), 'error');
            }
        });
    } catch (e) {
        hasNetwork = false;
        setLobbyStatus(t('alerts.network_error'), 'error');
        toast(t('alerts.network_error'), 'error');
        return;
    }
    
    setTimeout(() => announceSelf(), 500);
}

function announceSelf(targetId) {
    broadcast({
        type: 'hello',
        name: state.workerName,
        role: state.role,
        sessionCode: state.sessionCode
    }, targetId);
}

function updatePeerUI() {
    if (!navigator.onLine) return;
    const count = Object.keys(state.peers).length; 
    const peersText = count === 0 ? t('setup.no_peers') : t('setup.peers_connected', { count });
    
    setLobbyStatus(peersText, count > 0 ? 'success' : '');

    setNetIndicator(
        count > 0 ? `${t('setup.connected_short')} • ${count}` : t('setup.waiting_short'),
        count > 0 ? 'connected' : ''
    );
}

function persist() {
    saveSession({
        sessionCode: state.sessionCode,
        roomId: state.roomId,
        isHost: state.isHost,
        workerName: state.workerName,
        role: state.role
    });
}

// --- THEME & LANG CYCLE ---
function cycleTheme() {
    const current = localStorage.getItem('barlink_theme') || 'auto';
    const next = current === 'auto' ? 'light' : (current === 'light' ? 'dark' : 'auto');
    applyTheme(next);
}

function applyTheme(theme) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = theme === 'dark' || (theme === 'auto' && prefersDark);
    if (theme === 'auto') {
        document.documentElement.removeAttribute('data-theme');
        localStorage.removeItem('barlink_theme');
        btnToggleTheme.textContent = '◐';
    } else {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('barlink_theme', theme);
        btnToggleTheme.textContent = theme === 'light' ? '☀' : '☾';
    }
    if (themeMeta) themeMeta.setAttribute('content', isDark ? '#0a0f1a' : '#f8fafc');
}

function cycleLang() {
    const current = getLanguage();
    const next = current === 'en' ? 'hr' : 'en';
    setLanguage(next);
    updateLangBtn(next);
    if (offlinePill) offlinePill.textContent = t('alerts.offline');
    syncJoinControls();
    updatePeerUI();
    syncUsernameWidth();
}

function updateLangBtn(lang) {
    btnToggleLang.innerHTML = lang.toUpperCase();
}

// --- SCANNER ---
async function startScanner() {
    if (!window.BarcodeDetector) { toast(t('alerts.scan_unsupported'), 'error'); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        scanVideo.srcObject = stream;
        scanOverlay.classList.remove('hidden');
        
        const detector = new BarcodeDetector({ formats: ['qr_code'] });
        stopScan = () => {
            stream.getTracks().forEach(t => t.stop());
            scanOverlay.classList.add('hidden');
            stopScan = null;
        };
        
        const tick = async () => {
            if (!stopScan) return;
            try {
                const codes = await detector.detect(scanVideo);
                if (codes.length > 0) {
                    const raw = codes[0].rawValue;
                    const match = raw.match(/join=([A-Z0-9]+)/i);
                    const code = match ? match[1] : raw;
                    if (code && code.length >= 4) {
                        joinInput.value = code.toUpperCase();
                        stopScanner();
                        syncJoinControls();
                        setJoinStatus(t('alerts.scan_success'), 'success');
                        toast(t('alerts.scan_success'), 'success');
                    }
                }
            } catch(e) {}
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    } catch(e) {
        toast(t('alerts.scan_unsupported'), 'error');
        setJoinStatus(t('alerts.scan_unsupported'), 'error');
    }
}

function stopScanner() {
    if (stopScan) stopScan();
}
// --- SERVICE WORKER ---
function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register(`/sw.js?v=${APP_VERSION}`).then((reg) => {
        reg.onupdatefound = () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener('statechange', () => {
                if (sw.state === 'installed' && navigator.serviceWorker.controller) {
                    toast(t('alerts.updated'), 'info');
                }
            });
        };
    }).catch(() => {
        if (navigator.onLine) toast(t('alerts.sw_failed'), 'error');
    });
}
