/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : JOURNAL D'ACTIVITÉ & AUDIT (TRAÇABILITÉ ABSOLUE)
 * 
 * Enregistre QUI, A FAIT QUOI, QUAND, SUR QUOI.
 * Immuable : Aucun utilisateur ne peut effacer son propre historique.
 */

const HistoryModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📜</span> Journal d'Activité & Audit (Traçabilité Immuable)
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="HistoryModule.loadData()">
              <span>🔄</span> Actualiser
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="histSearch" placeholder="Rechercher par utilisateur, action ou détail..." oninput="HistoryModule.filterTable()">
            </div>
            <div class="filters-group">
              <select id="histActionFilter" class="filter-select" onchange="HistoryModule.filterTable()">
                <option value="">Toutes les actions</option>
                <option value="CONNEXION">Connexion</option>
                <option value="VENTE_TICKET">Vente de Ticket</option>
                <option value="MOUVEMENT_STOCK">Mouvement de Stock</option>
                <option value="OUVERTURE_CAISSE">Ouverture de Caisse</option>
                <option value="CLOTURE_CAISSE">Clôture de Caisse</option>
                <option value="CLOTURE_STAND">Clôture de Stand</option>
                <option value="CREATION_EMPRUNT">Emprunt de Matériel</option>
                <option value="RESTITUTION_MATERIEL">Restitution de Matériel</option>
                <option value="DECLARATION_INCIDENT">Déclaration Incident</option>
                <option value="ENREGISTREMENT_DEPENSE">Dépense</option>
              </select>
            </div>
          </div>

          <div class="table-responsive" id="historyTableContainer">
            <div class="empty-state">
              <div class="empty-icon">📜</div>
              <div class="empty-title">Aucune activité enregistrée</div>
              <div class="empty-desc">Toutes les opérations sensibles réalisées dans l'application sont consignées ici automatiquement pour un contrôle absolu.</div>
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
      const { data: logs, error } = await client
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      this.renderTable(logs || []);
    } catch (e) {
      console.error('[HistoryModule Error]', e);
    }
  },

  renderTable(logs) {
    const container = document.getElementById('historyTableContainer');
    if (!container) return;

    if (!logs || logs.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📜</div>
          <div class="empty-title">Aucune activité enregistrée</div>
          <div class="empty-desc">Toutes les opérations sensibles réalisées dans l'application sont consignées ici automatiquement pour un contrôle absolu.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Utilisateur</th>
            <th>Action</th>
            <th>Entité Concernée</th>
            <th>Description Complète</th>
          </tr>
        </thead>
        <tbody id="historyTableBody">
          ${logs.map(l => {
            let actionBadge = 'badge-primary';
            if (l.action.includes('SUPPRESSION') || l.action.includes('INCIDENT')) actionBadge = 'badge-danger';
            if (l.action.includes('CLOTURE') || l.action.includes('VERROU')) actionBadge = 'badge-warning';
            if (l.action.includes('VENTE') || l.action.includes('RESTITUTION')) actionBadge = 'badge-success';

            return `
              <tr data-user="${l.login}" data-action="${l.action}" data-detail="${l.details}">
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500); white-space: nowrap;">
                  ${new Date(l.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })}
                </td>
                <td><strong>${l.login}</strong></td>
                <td><span class="badge ${actionBadge}">${l.action}</span></td>
                <td><code>${l.entity_type}</code></td>
                <td>${l.details}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('histSearch').value || '').toLowerCase();
    const act = document.getElementById('histActionFilter').value;
    const rows = document.querySelectorAll('#historyTableBody tr');

    rows.forEach(r => {
      const user = (r.dataset.user || '').toLowerCase();
      const action = r.dataset.action || '';
      const detail = (r.dataset.detail || '').toLowerCase();

      const matchText = user.includes(q) || detail.includes(q) || action.toLowerCase().includes(q);
      const matchAction = !act || action === act;

      r.style.display = matchText && matchAction ? '' : 'none';
    });
  }
};

window.HistoryModule = HistoryModule;
