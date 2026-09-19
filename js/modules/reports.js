/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : RAPPORTS & BILANS OFFICIELS (IMPRESSION & EXPORT)
 * 
 * Génération de rapports consolidés :
 * - Bilan Financier Kermesse (Recettes vs Dépenses vs Solde net)
 * - Bilan Logistique Matériel & Emprunts
 * - Synthèse des Incidents & Anomalies
 */

const ReportsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📑</span> Rapports & Bilans Officiels — Love and Charity (L&C)
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="window.print()">
              <span>🖨️</span> Imprimer le Rapport
            </button>
          </div>
        </div>
        <div class="card-body">
          <div style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 2px solid var(--primary);">
            <div style="font-size: 1.4rem; font-weight: 900; color: var(--gray-900);">ASSOCIATION LOVE AND CHARITY (L&C)</div>
            <div style="font-size: 1.1rem; font-weight: 700; color: var(--primary);">RAPPORT GÉNÉRAL ET DE CONTRÔLE DE LA KERMESSE</div>
            <div style="font-size: 0.85rem; color: var(--gray-500); margin-top: 0.25rem;">
              Édité le ${new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          </div>

          <!-- Synthèse Financière -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-800); margin-bottom: 1rem;">
            1. Bilan Financier Consolidé
          </h3>
          <div class="stats-grid" style="margin-bottom: 2rem;">
            <div class="stat-card">
              <div class="stat-icon green">💰</div>
              <div class="stat-details">
                <h3>Recettes Brutes (Tickets)</h3>
                <div class="stat-value" id="repRev">0 F</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon red">💸</div>
              <div class="stat-details">
                <h3>Total des Dépenses</h3>
                <div class="stat-value" id="repExp">0 F</div>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-icon amber">⚖️</div>
              <div class="stat-details">
                <h3>Bénéfice Net Kermesse</h3>
                <div class="stat-value" id="repNet">0 F</div>
              </div>
            </div>
          </div>

          <!-- Synthèse par Stand -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-800); margin-bottom: 1rem;">
            2. Performance et Activité par Stand
          </h3>
          <div class="table-responsive" id="repStandsContainer" style="margin-bottom: 2.5rem;">
            <div class="empty-state">
              <div class="empty-title">Aucune donnée de stand disponible</div>
            </div>
          </div>

          <!-- Synthèse Logistique & Emprunts -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-800); margin-bottom: 1rem;">
            3. État Logistique du Matériel Emprunté
          </h3>
          <div class="table-responsive" id="repLoansContainer" style="margin-bottom: 2.5rem;">
            <div class="empty-state">
              <div class="empty-title">Aucun emprunt enregistré</div>
            </div>
          </div>

          <!-- Registre des Incidents -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-800); margin-bottom: 1rem;">
            4. Rapport des Incidents & Anomalies
          </h3>
          <div class="table-responsive" id="repIncidentsContainer">
            <div class="empty-state">
              <div class="empty-title">Aucun incident à signaler</div>
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
      // 1. Finances
      const { data: sales } = await client.from('ticket_sales').select('total_amount_f');
      const { data: expenses } = await client.from('expenses').select('amount_f, status');

      let rev = 0;
      let exp = 0;
      if (sales) sales.forEach(s => rev += s.total_amount_f);
      if (expenses) expenses.filter(e => e.status === 'approuve').forEach(e => exp += e.amount_f);

      const net = rev - exp;
      document.getElementById('repRev').textContent = `${rev.toLocaleString()} ${KermesseConfig.currency}`;
      document.getElementById('repExp').textContent = `${exp.toLocaleString()} ${KermesseConfig.currency}`;
      document.getElementById('repNet').textContent = `${net.toLocaleString()} ${KermesseConfig.currency}`;

      // 2. Stands
      const { data: stands } = await client
        .from('stands')
        .select(`
          name, number, color_name, is_closed,
          manager:members!stands_manager_id_fkey(first_name, last_name)
        `);

      const standsBox = document.getElementById('repStandsContainer');
      if (stands && stands.length > 0 && standsBox) {
        standsBox.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Stand</th>
                <th>Responsable</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${stands.map(s => `
                <tr>
                  <td><strong>${s.name}</strong> (${s.color_name} ${s.number})</td>
                  <td>${s.manager ? `${s.manager.first_name} ${s.manager.last_name}` : 'Non assigné'}</td>
                  <td>${s.is_closed ? '<span class="badge badge-danger">Clôturé</span>' : '<span class="badge badge-success">Actif</span>'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // 3. Emprunts
      const { data: loans } = await client
        .from('loans')
        .select(`
          quantity, expected_return_date, status,
          material:materials(name),
          owner:material_owners(name)
        `);

      const loansBox = document.getElementById('repLoansContainer');
      if (loans && loans.length > 0 && loansBox) {
        loansBox.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Matériel</th>
                <th>Quantité</th>
                <th>Propriétaire</th>
                <th>Date Limite</th>
                <th>Statut Restitution</th>
              </tr>
            </thead>
            <tbody>
              ${loans.map(l => `
                <tr>
                  <td><strong>${l.material?.name || 'Matériel'}</strong></td>
                  <td>${l.quantity} unité(s)</td>
                  <td>${l.owner?.name || '-'}</td>
                  <td>${new Date(l.expected_return_date).toLocaleDateString('fr-FR')}</td>
                  <td><span class="badge ${l.status === 'restitue' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

      // 4. Incidents
      const { data: incidents } = await client.from('incidents').select('incident_number, title, severity, status, created_at');
      const incBox = document.getElementById('repIncidentsContainer');
      if (incidents && incidents.length > 0 && incBox) {
        incBox.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Numéro</th>
                <th>Titre</th>
                <th>Gravité</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${incidents.map(i => `
                <tr>
                  <td><code>${i.incident_number}</code></td>
                  <td>${i.title}</td>
                  <td><span class="badge ${i.severity === 'faible' ? 'badge-gray' : 'badge-danger'}">${i.severity}</span></td>
                  <td><span class="badge ${i.status === 'resolu' ? 'badge-success' : 'badge-danger'}">${i.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }

    } catch (e) {
      console.error(e);
    }
  }
};

window.ReportsModule = ReportsModule;
