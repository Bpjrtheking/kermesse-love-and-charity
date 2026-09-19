/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * SYSTÈME DE NOTIFICATIONS ET CONFIRMATIONS (NOTIFY)
 */

const Notify = {
  container: null,

  init() {
    if (!this.container) {
      let el = document.getElementById('toastContainer');
      if (!el) {
        el = document.createElement('div');
        el.id = 'toastContainer';
        el.className = 'toast-container';
        document.body.appendChild(el);
      }
      this.container = el;
    }
  },

  show(message, type = 'info', duration = 4000) {
    this.init();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <div>${message}</div>`;
    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.transition = 'opacity 0.3s, transform 0.3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error', 5000); },
  warning(msg) { this.show(msg, 'warning', 4500); },
  info(msg) { this.show(msg, 'info'); },

  // Boîte de dialogue de confirmation élégante
  confirm(title, message, onConfirm, confirmText = 'Confirmer', isDanger = false) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop open';
    backdrop.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p style="color: var(--gray-700); font-size: 0.95rem;">${message}</p>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary cancel-btn">Annuler</button>
          <button class="btn ${isDanger ? 'btn-danger' : 'btn-primary'} confirm-btn">${confirmText}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);

    const close = () => {
      backdrop.classList.remove('open');
      setTimeout(() => backdrop.remove(), 200);
    };

    backdrop.querySelector('.modal-close-btn').onclick = close;
    backdrop.querySelector('.cancel-btn').onclick = close;
    backdrop.querySelector('.confirm-btn').onclick = () => {
      close();
      if (typeof onConfirm === 'function') onConfirm();
    };
  }
};

window.Notify = Notify;
