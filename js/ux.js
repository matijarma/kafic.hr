// UX & History Manager
import { t } from 'i18n';

const modals = [];
let ignoreNextPopstate = false;

// Inline SVG icon helper — references the #icon-sprite <symbol>s in index.html.
// Replaces Font Awesome. Sizing follows the element's font-size (icons are 1em).
export const icon = (name, cls = '') =>
    `<svg class="ic${cls ? ' ' + cls : ''}" aria-hidden="true"><use href="#ic-${name}"></use></svg>`;

export const initUX = (backCallback) => {
    window.addEventListener('popstate', (e) => {
        if (ignoreNextPopstate) {
            ignoreNextPopstate = false;
            return;
        }
        if (modals.length > 0) {
            // Close top modal
            const closeFn = modals.pop();
            if (closeFn) closeFn();
            return;
        }
        // Otherwise let the app handle view navigation via callback
        if (backCallback) backCallback(e.state);
    });

    // Global Shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (modals.length > 0) {
                popModal();
            }
        }
    });
};

export const registerModal = (closeFn) => {
    modals.push(closeFn);
    // Push a dummy state so Back button closes modal
    history.pushState({ modal: true }, ''); 
};

export const popModal = () => {
    // Manually removing a modal (e.g. via close button)
    // We need to pop the function AND go back in history to remove the dummy state
    if (modals.length > 0) {
        const closeFn = modals.pop();
        if (closeFn) closeFn();
        ignoreNextPopstate = true;
        history.back();
    }
};

export const toast = (msg, type = 'info') => {
    const con = document.getElementById('toast-container');
    if (!con) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${msg}</span>`;
    con.appendChild(el);
    
    // Dynamic duration: minimum 2.5s, plus time to read characters
    const duration = Math.min(Math.max(2500, msg.length * 60), 6000);
    
    // Animate
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
    }, duration);
};

// Like toast(), but with an action button (e.g. Undo). Returns a dismiss() fn.
export const toastAction = (msg, actionLabel, onAction, opts = {}) => {
    const { type = 'info', duration = 5000 } = opts;
    const con = document.getElementById('toast-container');
    if (!con) return () => {};
    const el = document.createElement('div');
    el.className = `toast ${type} toast-with-action`;
    const text = document.createElement('span');
    text.textContent = msg;
    const btn = document.createElement('button');
    btn.className = 'toast-action-btn';
    btn.textContent = actionLabel;
    el.appendChild(text);
    el.appendChild(btn);
    con.appendChild(el);

    let done = false;
    const dismiss = () => {
        if (done) return;
        done = true;
        el.classList.remove('show');
        setTimeout(() => el.remove(), 250);
    };
    btn.onclick = () => {
        try { onAction && onAction(); } finally { dismiss(); }
    };
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(dismiss, duration);
    return dismiss;
};

export const confirm = (message, title = null) => {
    return new Promise((resolve) => {
        const resolvedTitle = title || t('confirm.title');
        const dialog = document.createElement('dialog');
        dialog.className = 'custom-confirm';
        dialog.innerHTML = `
            <div class="confirm-content">
                <h3 class="confirm-title">${resolvedTitle}</h3>
                <p class="confirm-text">${message}</p>
                <div class="confirm-actions">
                    <button id="confirm-cancel" class="text-btn">${t('actions.cancel')}</button>
                    <button id="confirm-ok" class="btn-primary danger">${t('actions.confirm')}</button>
                </div>
            </div>
        `;
        document.body.appendChild(dialog);
        
        // Use showModal for backdrop
        dialog.showModal();
        dialog.classList.add('open');

        const close = (result) => {
            dialog.classList.remove('open');
            setTimeout(() => {
                dialog.close();
                dialog.remove();
                resolve(result);
            }, 200);
        };

        dialog.querySelector('#confirm-cancel').onclick = () => close(false);
        dialog.querySelector('#confirm-ok').onclick = () => close(true);
        dialog.addEventListener('close', () => resolve(false));
        
        // Close on click outside
        dialog.onclick = (e) => {
            if (e.target === dialog) close(false);
        };
    });
};
