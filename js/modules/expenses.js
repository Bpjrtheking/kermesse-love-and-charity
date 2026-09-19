/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : DÉPENSES (GESTION FINANCIÈRE & JUSTIFICATIFS)
 * 
 * Enregistrement de chaque dépense effectuée pendant l'organisation ou la kermesse :
 * Montant, Motif, Catégorie, Auteur, Justificatif, Validation.
 */

const ExpensesModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>💸</span> Gestion des Dépenses de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="ExpensesModule.openCreateModal()">
              <span>➕</span> Enregistrer une Dépense
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="expensesTableContainer">
            <div class="empty-state">
              <div class="empty-icon">💸</div>
              <div class="empty-title">Aucune dépense enregistrée</div>
              <div class="empty-desc">Enregistrez les achats d'urgence, courses alimentaires ou locations payantes avec leur justificatif.</div>
              <button class="btn btn-primary" onclick="ExpensesModule.openCreateModal()">
                <span>➕</span> Enregistrer la première dépense
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (!client) return;

    try {
      const { data: expenses, error } = await client
        .from('expenses')
        .select(`
          id, amount_f, category, motive, receipt_ref, status, created_at,
          user:app_users!expenses_user_id_fkey(login),
          stand:stands(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.renderTable(expenses || []);
    } catch (e) {
      console.error('[ExpensesModule Error]', e);
    }
  },

  renderTable(expenses) {
    const container = document.getElementById('expensesTableContainer');
    if (!container) return;

    if (!expenses || expenses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💸</div>
          <div class="empty-title">Aucune dépense enregistrée</div>
          <div class="empty-desc">Enregistrez les achats d'urgence, courses alimentaires ou locations payantes avec leur justificatif.</div>
          <button class="btn btn-primary" onclick="ExpensesModule.openCreateModal()">
            <span>➕</span> Enregistrer la première dépense
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Catégorie</th>
            <th>Motif de la Dépense</th>
            <th>Montant Sorti</th>
            <th>Stand Concerné</th>
            <th>Engagé Par</th>
            <th>Justificatif</th>
          </tr>
        </thead>
        <tbody>
          ${expenses.map(e => `
            <tr>
              <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                ${new Date(e.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td><span class="badge badge-gray">${e.category}</span></td>
              <td><strong>${e.motive}</strong></td>
              <td><strong style="color: var(--danger); font-size: 1rem;">- ${e.amount_f.toLocaleString()} ${KermesseConfig.currency}</strong></td>
              <td>${e.stand ? e.stand.name : '<span style="color: var(--gray-400);">Général</span>'}</td>
              <td>${e.user ? e.user.login : 'Inconnu'}</td>
              <td>${e.receipt_ref ? `<span class="badge badge-success">📎 ${e.receipt_ref}</span>` : '<span style="color: var(--gray-400);">Sans reçu</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let stands = [];
    if (client) {
      const { data } = await client.from('stands').select('id, name');
      stands = data || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer une Dépense</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createExpenseForm">
            <div class="form-row">
              <div class="form-group">
                <label>Montant (${KermesseConfig.currency}) *</label>
                <input type="number" id="expAmount" class="form-control" required min="1" step="100" placeholder="Ex: 15000">
              </div>
              <div class="form-group">
                <label>Catégorie *</label>
                <select id="expCategory" class="form-control">
                  <option value="nourriture">Nourriture / Boissons d'appoint</option>
                  <option value="materiel">Achat de petit matériel</option>
                  <option value="logistique">Transport / Carburant</option>
                  <option value="animation">Lots / Cadeaux imprévus</option>
                  <option value="imprevu">Dépense imprévue / Secours</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Motif précis de la dépense *</label>
              <input type="text" id="expMotive" class="form-control" required placeholder="Ex: Achat glace et serviettes au supermarché">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand associé (optionnel)</label>
                <select id="expStand" class="form-control">
                  <option value="">Dépense générale organisation</option>
                  ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Référence du Reçu / Facture</label>
                <input type="text" id="expReceipt" class="form-control" placeholder="Ex: Ticket N° 8492, Facture Boulangerie">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveExpBtn">Enregistrer la dépense</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveExpBtn').onclick = async () => {
      const amount = parseInt(document.getElementById('expAmount').value, 10);
      const cat = document.getElementById('expCategory').value;
      const motive = document.getElementById('expMotive').value.trim();
      const standId = document.getElementById('expStand').value || null;
      const receipt = document.getElementById('expReceipt').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(amount) || amount <= 0 || !motive) {
        Notify.error('Veuillez renseigner le montant et le motif de la dépense.');
        return;
      }

      if (client) {
        const { error } = await client.from('expenses').insert([{
          amount_f: amount,
          category: cat,
          motive,
          stand_id: standId,
          receipt_ref: receipt,
          user_id: user ? user.id : null,
          status: 'approuve'
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('ENREGISTREMENT_DEPENSE', 'expense', null, `Dépense de ${amount} F (${motive}) par ${user?.login}`);
        Notify.success(`Dépense de ${amount.toLocaleString()} F enregistrée.`);
        close();
        ExpensesModule.render(document.getElementById('mainContent'));
      }
    };
  }
};

window.ExpensesModule = ExpensesModule;
