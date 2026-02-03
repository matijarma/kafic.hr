// UX & History Manager
import { t } from 'i18n';

const modals = [];

export const initUX = (backCallback) => {
    window.addEventListener('popstate', (e) => {
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
                const closeFn = modals.pop();
                if (closeFn) {
                     closeFn();
                     history.back(); // Remove state
                }
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
        modals.pop();
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
    
    // Animate
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => {
        el.classList.remove('show');
        setTimeout(() => el.remove(), 200);
    }, 1100);
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
