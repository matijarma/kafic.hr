import { initNetwork, broadcast } from 'network';
import { state, resetWaiterState } from 'state';
import { generateJoinCode, roomIdFromCode, saveSession, loadSession, clearSavedSession, syncStateToSession } from 'session';
import { initWaiter, refreshWaiter, onOrderCompleted, canNavigateBack as canWaiterNavigateBack, navigateBack as navigateWaiterBack } from 'waiter';
import { initBartender, onOrderReceived, setOrderCompletionHandler } from 'bartender';
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

// Connection Indicator (Header)
const headerConn = document.getElementById('header-conn');
const arrowLeft = document.getElementById('arrow-left');
const arrowRight = document.getElementById('arrow-right');

const APP_VERSION = document.documentElement.dataset.version || window.__APP_VERSION__ || 'dev';
let stopScan = null;
let hasNetwork = false;
let waiterStarted = false;
let bartenderStarted = false;
let deferredInstallPrompt = null;
let exitBackArmedUntil = 0;
let passThroughSystemPopstate = false;

const BACK_EXIT_WINDOW_MS = 1600;
const APP_BACK_GUARD_STATE = { appBackGuard: true };

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const setBodyView = (viewId = 'setup') => {
    document.body.dataset.view = viewId;
};
const applyHandedness = (hand) => {
    const normalized = hand === 'left' ? 'left' : 'right';
    document.body.dataset.hand = normalized;
    return normalized;
};
const syncUsernameWidth = () => {
    if (!headerUsername) return;
    const base = headerUsername.value?.trim() || headerUsername.placeholder || '';
    const size = clamp(base.length + 1, 8, 20);
    headerUsername.setAttribute('size', size);
};

function formatJoinCode(val = '') {
    return val.replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase();
}

const extractJoinTokens = (raw = '') => {
    const trimmed = raw.trim();
    if (!trimmed) return { raw: '' };
    try {
        const maybeUrl = new URL(trimmed);
        const joinParam = maybeUrl.searchParams.get('n') || maybeUrl.searchParams.get('join');
        if (joinParam) return { raw: trimmed, join: joinParam };
        const shortPath = maybeUrl.pathname.match(/\/n\/([A-Za-z0-9]{6})/i);
        if (shortPath) return { raw: trimmed, join: shortPath[1] };
    } catch (e) {}

    const joinMatch = trimmed.match(/(?:[?&]|^)n=([A-Za-z0-9]+)/i) || trimmed.match(/join=([A-Za-z0-9]+)/i);
    if (joinMatch) return { raw: trimmed, join: joinMatch[1] };

    const shortPathMatch = trimmed.match(/(?:^|\/)n\/([A-Za-z0-9]{6})/i);
    if (shortPathMatch) return { raw: trimmed, join: shortPathMatch[1] };

    if (/^[A-Za-z0-9]{1,6}$/.test(trimmed)) return { raw: trimmed, join: trimmed };
    return { raw: trimmed };
};

const QR_HOST = 'https://kafić.hr';
const buildQrUrl = () => `${QR_HOST}/?n=${state.sessionCode}`;

const buildShareUrl = async () => {
    const origin = window.location.origin;
    const path = window.location.pathname;
    return `${origin}${path}?n=${state.sessionCode}`;
};

const getActiveSetupSlideId = () => {
    if (slides.join.classList.contains('active')) return 'join';
    if (slides.lobby.classList.contains('active')) return 'lobby';
    return 'home';
};

const armSystemBackGuard = () => {
    try {
        history.replaceState(APP_BACK_GUARD_STATE, '');
        history.pushState(APP_BACK_GUARD_STATE, '');
    } catch (e) {}
};

const handleBackPress = (source = 'ui') => {
    if (stopScan) {
        exitBackArmedUntil = 0;
        stopScanner();
        return true;
    }

    const currentView = document.body.dataset.view || 'setup';

    if (currentView === 'waiter') {
        exitBackArmedUntil = 0;
        if (canWaiterNavigateBack()) {
            navigateWaiterBack();
            return true;
        }
        returnToLobby();
        return true;
    }

    if (currentView === 'bartender' || currentView === 'manager') {
        exitBackArmedUntil = 0;
        returnToLobby();
        return true;
    }

    const activeSlide = getActiveSetupSlideId();
    if (activeSlide === 'join' || activeSlide === 'lobby') {
        exitBackArmedUntil = 0;
        goToSlide('home');
        return true;
    }

    if (source !== 'system') return true;

    const now = Date.now();
    if (now <= exitBackArmedUntil) {
        exitBackArmedUntil = 0;
        return false;
    }

    exitBackArmedUntil = now + BACK_EXIT_WINDOW_MS;
    toast(t('alerts.back_exit'), 'info');
    return true;
};

const handleSystemBackPress = () => {
    if (passThroughSystemPopstate) {
        passThroughSystemPopstate = false;
        return;
    }

    const consumed = handleBackPress('system');
    if (consumed) {
        history.pushState(APP_BACK_GUARD_STATE, '');
        return;
    }

    passThroughSystemPopstate = true;
    history.back();
    setTimeout(() => {
        passThroughSystemPopstate = false;
    }, 400);
};

// --- BOOTSTRAP ---
bootstrap();

function bootstrap() {
    setBodyView('setup');
    
    // Bind Bartender Completion to Logic (Local + Network)
    setOrderCompletionHandler((tableId) => {
        // 1. Local update (clears indicator immediately on this device)
        onOrderCompleted({ tableId });
        
        // 2. Network update (informs other peers)
        broadcast({ type: 'order-completed', tableId });
    });

    // 1. I18n
    const savedLang = localStorage.getItem('barlink_lang') || 'hr';
    initI18n(savedLang);
    updateLangBtn(savedLang);
    if (versionPill) versionPill.textContent = `v${APP_VERSION}`;
    if (offlinePill) offlinePill.textContent = t('alerts.offline');
    applyHandedness(localStorage.getItem('barlink_hand') || 'right');

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
    initUX(() => {
        handleSystemBackPress();
    });

    // 4. User Name Load
    const savedName = localStorage.getItem('barlink_name');
    if (savedName) {
        headerUsername.value = savedName;
        state.workerName = savedName;
    }
    syncUsernameWidth();
    
    // Solo Mode Load
    state.soloMode = localStorage.getItem('barlink_solo') === '1';

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
        handleBackPress('ui');
    });
    
    // 7. URL Join
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('n') || params.get('join');
    const pathMatch = window.location.pathname.match(/\/n\/([A-Za-z0-9]{6})/i);
    const shortCode = pathMatch ? pathMatch[1] : '';
    if (joinCode || shortCode) {
        if (joinCode) {
            params.delete('n');
            params.delete('join');
        }
        const cleanQuery = params.toString();
        const cleanPath = shortCode ? '/' : window.location.pathname;
        const cleanUrl = `${cleanPath}${cleanQuery ? `?${cleanQuery}` : ''}${window.location.hash || ''}`;
        history.replaceState(history.state, '', cleanUrl);
        goToSlide('join');
        if (shortCode) {
            joinInput.value = formatJoinCode(shortCode);
        } else {
            joinInput.value = formatJoinCode(joinCode);
        }
        syncJoinControls();
        focusJoinInput();
    }

    armSystemBackGuard();
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

    document.querySelectorAll('.nav-back-btn').forEach(b => b.onclick = () => handleBackPress('ui'));
    
    // Join
    if (joinInput) joinInput.removeAttribute('maxlength');
    joinInput.addEventListener('input', syncJoinControls);
    joinInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !btnConfirmJoin.disabled) joinSession();
    });
    joinInput.addEventListener('paste', (e) => {
        const text = e.clipboardData?.getData('text');
        if (text) {
            e.preventDefault();
            joinInput.value = text.trim();
            syncJoinControls();
        }
    });
    btnConfirmJoin.onclick = joinSession;
    btnPaste.onclick = async () => {
        try {
            const txt = await navigator.clipboard.readText();
            if (txt) {
                joinInput.value = txt.trim();
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
        if (!state.sessionCode) {
            toast(t('alerts.no_session'), 'error');
            return;
        }
        const url = await buildShareUrl();
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

    setupSwipe();
}

async function syncJoinControls() {
    const raw = joinInput.value.trim();
    const { join } = extractJoinTokens(raw);

    if (!join) {
        btnConfirmJoin.disabled = true;
        setJoinStatus(t('setup.join_hint'));
        return;
    }

    const formatted = formatJoinCode(join);
    if ((join || '').length > 6) joinInput.classList.add('is-long');
    else joinInput.classList.remove('is-long');
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

// Redirect old helpers to new UI
function setLobbyStatus(msg, type) { /* No-op or log */ }
function setNetIndicator(text, status) { /* No-op */ }

function focusJoinInput() {
    setTimeout(() => joinInput?.focus(), 60);
}

function bindConnectivity() {
    const refresh = () => {
        const online = navigator.onLine;
        offlinePill?.classList.toggle('hidden', online);
        // headerConn will be updated via updatePeerUI
    };
    window.addEventListener('online', () => {
        toast(t('alerts.back_online'), 'success');
        refresh();
        updatePeerUI();
    });
    window.addEventListener('offline', () => {
        toast(t('alerts.offline'), 'error');
        refresh();
        updatePeerUI();
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

function goToView(viewId) {
    // Standard switch (no animation)
    Object.values(views).forEach(el => {
        el.classList.remove('active', 'slide-out-left', 'slide-in-right', 'slide-out-right', 'slide-in-left');
    });
    views[viewId].classList.add('active');
    setBodyView(viewId);
    exitBackArmedUntil = 0;
    checkArrows();
}

function goToSlide(slideId) {
    if (slideId === 'lobby' && (!state.sessionCode || !state.roomId)) {
        slideId = 'home';
    }
    Object.values(slides).forEach(el => el.classList.remove('active'));
    slides[slideId].classList.add('active');
    setBodyView('setup');
    if (slideId !== 'home') exitBackArmedUntil = 0;
    checkArrows();
}

async function startHost() {
    resetWaiterState();
    state.barOrders = [];
    setJoinStatus('');
    const code = generateJoinCode();
    initSessionState(code, true);
    await setupLobbyUI();
    // setLobbyStatus(t('setup.connecting'), 'info');
    goToSlide('lobby');
    connectNetwork();
}

async function joinSession() {
    let { join } = extractJoinTokens(joinInput.value);
    
    let code = '';
    if (join) {
        code = formatJoinCode(join);
    }

    if (!code || code.length !== 6) {
        setJoinStatus(t('alerts.join_invalid'), 'error');
        toast(t('alerts.join_invalid'), 'error');
        return;
    }

    resetWaiterState();
    state.barOrders = [];
    setJoinStatus(t('setup.connecting'), 'success');
    // setLobbyStatus(t('setup.connecting'), 'info');
    initSessionState(code, false);
    await setupLobbyUI();
    goToSlide('lobby');
    connectNetwork();
}

async function resumeFlow(session) {
    syncStateToSession(session);
    state.peers = {};
    state.barOrders = [];
    resetWaiterState();
    hasNetwork = false;
    setJoinStatus('');
    // setLobbyStatus(t('setup.resuming'), 'info');

    let sessionData = session;
    
    if (session.role) {
        connectNetwork(sessionData);
        launchRole(session.role);
    } else {
        await setupLobbyUI();
        goToSlide('lobby');
        connectNetwork(sessionData);
    }
}

function returnToLobby() {
    // Clear role persistence so reload doesn't stick
    state.role = null;
    resetWaiterState();
    persist();
    // setLobbyStatus(t('setup.no_peers'), 'info');
    
    // Go to setup/lobby
    Object.values(views).forEach(el => el.classList.remove('active'));
    views.setup.classList.add('active');
    setBodyView('setup');
    goToSlide('lobby');
    
    // Remove arrows if returning to lobby
    if (arrowLeft) arrowLeft.classList.remove('visible');
    if (arrowRight) arrowRight.classList.remove('visible');
}

function initSessionState(code, isHost) {
    state.peers = {};
    state.barOrders = [];
    resetWaiterState();
    hasNetwork = false;
    const safeName = (headerUsername.value || '').trim() || 'Worker';
    const roomId = roomIdFromCode(code);
    const session = {
        sessionCode: code,
        roomId: roomId,
        isHost: isHost,
        workerName: safeName,
        role: null
    };
    headerUsername.value = safeName;
    syncUsernameWidth();
    syncStateToSession(session);
    persist();
}

async function setupLobbyUI() {
    displayCode.textContent = state.sessionCode;
    const qrUrl = buildQrUrl();
    const rendered = renderQR(qrCanvas, qrUrl, 180);
    if (!rendered) {
        renderQR(qrCanvas, qrUrl, 180);
    }
    // setLobbyStatus(t('setup.no_peers'), 'info');
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

function connectNetwork(restoredSession = null) {
    if (hasNetwork) return;
    if (!state.roomId || !state.sessionCode) {
        toast(t('alerts.no_session'), 'error');
        // setLobbyStatus(t('alerts.no_session'), 'error');
        return;
    }
    hasNetwork = true;
    // setLobbyStatus(t('setup.connecting'), 'info');
    
    try {
        const sessionData = restoredSession || loadSession();
        initNetwork(state.roomId, (data, peerId) => {
            if (data.type === 'hello') {
                state.peers[peerId] = { name: data.name, role: data.role };
                updatePeerUI();
            }
            if (data.type === 'new-order') {
                onOrderReceived(data);
            }
            if (data.type === 'order-completed') {
                onOrderCompleted(data);
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
            if (status.type === 'network-update' && status.peerId) {
                announceSelf(status.peerId);
            }
            if (status.type === 'error') {
                // setLobbyStatus(t('alerts.network_error'), 'error');
                toast(t('alerts.network_error'), 'error');
            }
        }, sessionData);
    } catch (e) {
        hasNetwork = false;
        // setLobbyStatus(t('alerts.network_error'), 'error');
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
    const count = Object.keys(state.peers).length;
    const online = navigator.onLine;
    
    if (headerConn) {
        const dot = headerConn.querySelector('.dot');
        const countLabel = headerConn.querySelector('.count');
        
        if (!online) {
            headerConn.classList.add('error');
            headerConn.classList.remove('active');
            if(countLabel) countLabel.textContent = 'Offline';
        } else if (count > 0) {
            headerConn.classList.add('active');
            headerConn.classList.remove('error');
            if(countLabel) countLabel.textContent = `${count} Peer${count > 1 ? 's' : ''}`;
        } else {
            headerConn.classList.remove('active', 'error');
            if(countLabel) countLabel.textContent = 'Waiting...';
        }
        
        // Click handler for details (simple toast for now)
        headerConn.onclick = () => {
            if (!online) toast(t('alerts.offline'), 'error');
            else if (count === 0) toast(t('setup.no_peers'), 'info');
            else {
                const names = Object.values(state.peers).map(p => p.name || 'Unknown').join(', ');
                toast(`${t('setup.connected_short')}: ${names}`, 'success');
            }
        };
    }
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

// --- SWIPE LOGIC ---
let touchStartX = 0;
let touchStartY = 0;

function setupSwipe() {
    window.addEventListener('touchstart', e => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    window.addEventListener('touchend', e => {
        if (!state.soloMode) return;
        
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        
        const xDiff = touchEndX - touchStartX;
        const yDiff = touchEndY - touchStartY;
        
        // Ignore vertical scrolls
        if (Math.abs(yDiff) > Math.abs(xDiff)) return;
        
        // Threshold
        if (Math.abs(xDiff) > 80) {
            handleSwipe(xDiff > 0 ? 'right' : 'left');
        }
    }, { passive: true });
}

function handleSwipe(direction) {
    const currentView = document.body.dataset.view;
    if (currentView !== 'waiter' && currentView !== 'bartender') return;

    // Hide arrows if visible
    if (arrowLeft) arrowLeft.classList.remove('visible');
    if (arrowRight) arrowRight.classList.remove('visible');
    localStorage.setItem('barlink_saw_arrows', '1');

    // Logic: Infinite Scroll
    let target = '';
    let animClassOut = '';
    let animClassIn = '';

    if (currentView === 'waiter') {
        if (direction === 'left') {
            // Dragging left, go to right (Bartender)
            target = 'bartender';
            animClassOut = 'slide-out-left';
            animClassIn = 'slide-in-right';
        } else {
            // Dragging right, wrap around to Bartender? Or stay?
            // "Infinite" suggests wrapping.
            target = 'bartender';
            animClassOut = 'slide-out-right';
            animClassIn = 'slide-in-left';
        }
    } else if (currentView === 'bartender') {
        if (direction === 'right') {
            // Dragging right, go to left (Waiter)
            target = 'waiter';
            animClassOut = 'slide-out-right';
            animClassIn = 'slide-in-left';
        } else {
            // Dragging left, wrap around to Waiter
            target = 'waiter';
            animClassOut = 'slide-out-left';
            animClassIn = 'slide-in-right';
        }
    }

    if (target) {
        animateViewSwitch(currentView, target, animClassOut, animClassIn);
    }
}

function animateViewSwitch(fromId, toId, outClass, inClass) {
    const fromEl = views[fromId];
    const toEl = views[toId];
    
    fromEl.classList.add(outClass);
    toEl.classList.add(inClass);
    toEl.classList.add('active'); // Make visible immediately for transition
    setBodyView(toId);

    // Init Logic
    if (toId === 'waiter') {
        if (!waiterStarted) { initWaiter(); waiterStarted = true; }
        else refreshWaiter();
    } else if (toId === 'bartender') {
        if (!bartenderStarted) { initBartender(); bartenderStarted = true; }
    }

    // Cleanup after animation
    setTimeout(() => {
        fromEl.classList.remove('active', outClass);
        toEl.classList.remove(inClass);
    }, 250); // Match CSS duration
}

function checkArrows() {
    if (state.soloMode && localStorage.getItem('barlink_saw_arrows') !== '1') {
        const currentView = document.body.dataset.view;
        if (currentView === 'waiter' || currentView === 'bartender') {
            if (arrowLeft) arrowLeft.classList.add('visible');
            if (arrowRight) arrowRight.classList.add('visible');
        }
    } else {
        if (arrowLeft) arrowLeft.classList.remove('visible');
        if (arrowRight) arrowRight.classList.remove('visible');
    }
}

// Hook into navigation
window.addEventListener('nav-view', () => checkArrows()); // Custom event if needed, or check in goToView

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
                    if (raw && raw.length >= 4) {
                        joinInput.value = raw.trim();
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
