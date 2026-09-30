/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : RAPPORTS & BILANS OFFICIELS (IMPRESSION & EXPORT EXECUTIVE)
 * 
 * Génération du Rapport Général Officiel et du Bilan Consolidé de la Kermesse :
 * 1. Bilan Financier Consolidé (Recettes brutes des 4 Caisses vs Dépenses vs Bénéfice Net)
 * 2. Tableau de ventilation des 4 Caisses (Entrée, Jeux, Restauration, Jetons)
 * 3. Palmarès Financier et Performance des Stands (Ventes tickets jeux & rentabilité par stand)
 * 4. Grand Livre des Dépenses et Sorties de Caisse dédoublées avec justificatifs
 * 5. Bilan Logistique du Matériel Emprunté & Restitutions
 * 6. Registre Officiel des Incidents & Anomalies
 * 7. Attestation et Cadres de Signatures Officielles
 * 
 * RÈGLE FONDAMENTALE : ZÉRO ERREUR SUR L'ARGENT.
 * Les calculs proviennent du moteur financier centralisé CaissesCore.calculateConsolidatedFinances().
 */

const ReportsModule = {
  finances: null,
  stands: [],
  loans: [],
  incidents: [],

  async render(container) {
    const user = Auth.getCurrentUser();
    const editionDate = new Date().toLocaleDateString('fr-FR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    const editionTime = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    container.innerHTML = `
      <style>
        @media print {
          body { background: white !important; font-size: 11pt !important; color: black !important; }
          .app-sidebar, .top-header, .btn-header-action, .card-actions, .mobile-toggle, .bottom-nav, #sidebarBackdrop, .toolbar { display: none !important; }
          .main-wrapper { margin: 0 !important; padding: 0 !important; width: 100% !important; }
          .card { border: none !important; box-shadow: none !important; margin: 0 !important; padding: 0 !important; }
          .card-body { padding: 0 !important; }
          .report-official-header { border-bottom: 2px solid #000 !important; margin-bottom: 1.5rem !important; }
          .data-table { font-size: 9.5pt !important; border-collapse: collapse !important; width: 100% !important; }
          .data-table th, .data-table td { border: 1px solid #ccc !important; padding: 6px 8px !important; }
          .signature-box { page-break-inside: avoid !important; }
          .no-print { display: none !important; }
        }
      </style>

      <div class="card">
        <div class="card-header no-print">
          <div class="card-title">
            <span>📑</span> Rapports &amp; Bilans Officiels — Love and Charity (L&amp;C)
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="ReportsModule.render(document.getElementById('mainContent'))" title="Rafraîchir les calculs">
              <span>🔄</span> Actualiser
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.print()" title="Imprimer ou enregistrer au format PDF">
              <span>🖨️</span> Imprimer / Exporter PDF
            </button>
          </div>
        </div>

        <div class="card-body" style="padding: 1.5rem;" id="reportsMainContent">
          
          <!-- En-Tête Officiel Association Love and Charity -->
          <div class="report-official-header" style="text-align: center; margin-bottom: 2rem; padding-bottom: 1.25rem; border-bottom: 3px double var(--primary, #2563eb);">
            <div style="font-size: 0.85rem; letter-spacing: 2px; font-weight: 700; color: var(--gray-600); text-transform: uppercase;">
              République de Côte d'Ivoire — Union • Discipline • Travail
            </div>
            <div style="font-size: 1.6rem; font-weight: 900; color: var(--gray-900); margin: 0.4rem 0 0.15rem 0; letter-spacing: 0.5px;">
              ASSOCIATION LOVE AND CHARITY (L&amp;C)
            </div>
            <div style="font-size: 1.15rem; font-weight: 800; color: var(--primary, #2563eb); text-transform: uppercase;">
              RAPPORT GÉNÉRAL ET BILAN FINANCIER OFFICIEL DE LA KERMESSE
            </div>
            <div style="font-size: 0.82rem; color: var(--gray-500); margin-top: 0.35rem;">
              Édité le <strong>${editionDate} à ${editionTime}</strong> • Généré par <strong>${user ? (user.full_name || user.login) : 'Administration'}</strong> (${user ? (user.role_name || user.role_code) : 'SuperAdmin'})
            </div>
          </div>

          <div id="reportsAsyncContent">
            <div style="text-align: center; padding: 3rem 1rem;">
              <p style="color: var(--gray-500); font-size: 1rem;">Consolidation des 4 caisses et vérification des calculs en cours...</p>
            </div>
          </div>

        </div>
      </div>
    `;

    await this.loadData();
    this.renderFullReport();
  },

  async loadData() {
    // 1. Moteur financier centralisé (Source de vérité mathématique unique)
    if (typeof CaissesCore !== 'undefined' && CaissesCore.calculateConsolidatedFinances) {
      this.finances = await CaissesCore.calculateConsolidatedFinances();
    } else {
      this.finances = {
        sales: [],
        revEntree: 0,
        revJeux: 0,
        revResto: 0,
        totalRecettes: 0,
        ticketsEntreeCount: 0,
        ticketsJeuxCount: 0,
        restoItemsCount: 0,
        totalTickets: 0,
        standTotals: {},
        expenses: [],
        totalExpenses: 0,
        beneficeNet: 0,
        registers: []
      };
    }

    const client = SupabaseClient.client;

    // 2. Stands et responsables
    this.stands = [];
    if (client) {
      try {
        const { data: st } = await client
          .from('stands')
          .select(`
            id, name, number, color_name, color_hex, is_closed,
            manager:members!stands_manager_id_fkey(first_name, last_name)
          `)
          .order('number');
        if (st) this.stands = st;
      } catch (e) {
        console.warn('[Reports Stands Load Warning]', e);
      }
    }
    if (this.stands.length === 0) {
      const stored = localStorage.getItem('kermesse_stands');
      if (stored) {
        try { this.stands = JSON.parse(stored); } catch (e) {}
      }
    }

    // 3. Emprunts matériels
    this.loans = [];
    if (client) {
      try {
        const { data: ln } = await client
          .from('loans')
          .select(`
            id, quantity, expected_return_date, status,
            material:materials(name),
            owner:material_owners(name)
          `)
          .order('expected_return_date');
        if (ln) this.loans = ln;
      } catch (e) {}
    }

    // 4. Incidents
    this.incidents = [];
    if (client) {
      try {
        const { data: inc } = await client
          .from('incidents')
          .select('id, incident_number, title, severity, status, created_at')
          .order('created_at', { ascending: false });
        if (inc) this.incidents = inc;
      } catch (e) {}
    }
  },

  renderFullReport() {
    const container = document.getElementById('reportsAsyncContent');
    if (!container) return;

    const {
      revEntree,
      revJeux,
      revResto,
      totalRecettes,
      ticketsEntreeCount,
      ticketsJeuxCount,
      restoItemsCount,
      totalTickets,
      standTotals,
      expenses,
      totalExpenses,
      beneficeNet
    } = this.finances;

    // Préparation du tableau des stands avec calcul exact de la part de chacun
    const standRows = (this.stands || []).map(s => {
      const stPerf = standTotals[s.name] || { revenue: 0, ticketsCount: 0 };
      const pct = revJeux > 0 ? ((stPerf.revenue / revJeux) * 100).toFixed(1) : '0.0';
      return {
        id: s.id,
        name: s.name,
        color_name: s.color_name,
        color_hex: s.color_hex,
        number: s.number,
        managerName: s.manager ? `${s.manager.first_name} ${s.manager.last_name}` : 'Non assigné',
        is_closed: Boolean(s.is_closed),
        ticketsCount: stPerf.ticketsCount,
        revenue: stPerf.revenue,
        pct
      };
    });

    // Tri des stands par recettes décroissantes
    standRows.sort((a, b) => b.revenue - a.revenue);

    container.innerHTML = `
      <!-- ============================================================== -->
      <!-- 1. SYNTHÈSE GLOBALE DU BILAN FINANCIER -->
      <!-- ============================================================== -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>1.</span> Bilan Financier Consolidé de la Kermesse
        </h3>

        <!-- 3 Grands Indicateurs Clés -->
        <div class="reports-kpi-grid">
          <div style="background: #f0fdf4; border: 2px solid #16a34a; border-radius: var(--radius-md); padding: 1.1rem; text-align: center;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #166534; text-transform: uppercase;">Total Recettes Brutes Encaissées</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: #15803d; margin: 0.35rem 0;">
              ${totalRecettes.toLocaleString()} F
            </div>
            <div style="font-size: 0.78rem; color: #166534;">Entrée + Tickets Jeux + Restauration</div>
          </div>

          <div style="background: #fef2f2; border: 2px solid #dc2626; border-radius: var(--radius-md); padding: 1.1rem; text-align: center;">
            <div style="font-size: 0.85rem; font-weight: 700; color: #991b1b; text-transform: uppercase;">Total des Dépenses Réelles</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: #b91c1c; margin: 0.35rem 0;">
              -${totalExpenses.toLocaleString()} F
            </div>
            <div style="font-size: 0.78rem; color: #991b1b;">Sorties de caisse &amp; achats justifiés</div>
          </div>

          <div style="background: ${beneficeNet >= 0 ? '#eff6ff' : '#fff1f2'}; border: 2px solid ${beneficeNet >= 0 ? '#2563eb' : '#e11d48'}; border-radius: var(--radius-md); padding: 1.1rem; text-align: center;">
            <div style="font-size: 0.85rem; font-weight: 700; color: ${beneficeNet >= 0 ? '#1e40af' : '#9f1239'}; text-transform: uppercase;">Bénéfice Net Officiel Kermesse</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: ${beneficeNet >= 0 ? '#1d4ed8' : '#be123c'}; margin: 0.35rem 0;">
              ${beneficeNet >= 0 ? '+' : ''}${beneficeNet.toLocaleString()} ${KermesseConfig.currency}
            </div>
            <div style="font-size: 0.78rem; color: ${beneficeNet >= 0 ? '#1e40af' : '#9f1239'};">Fonds nets reversés aux œuvres Love &amp; Charity</div>
          </div>
        </div>

        <!-- Tableau Officiel de Ventilation des 4 Caisses -->
        <table class="data-table" style="margin-bottom: 0.75rem;">
          <thead>
            <tr style="background: var(--gray-100);">
              <th style="width: 35%;">Poste de Caisse</th>
              <th style="width: 25%;">Activité / Volume</th>
              <th style="width: 25%; text-align: right;">Recettes Encaissées</th>
              <th style="width: 15%; text-align: right;">Part (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>🎟️ Caisse 1 : Entrée &amp; Accueil Visiteurs</strong></td>
              <td>${ticketsEntreeCount.toLocaleString()} billet(s) d'entrée</td>
              <td style="text-align: right; font-weight: 700; color: #047857;">${revEntree.toLocaleString()} F</td>
              <td style="text-align: right;">${totalRecettes > 0 ? ((revEntree / totalRecettes) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td><strong>🎯 Caisse 2 : Tickets de Jeux &amp; Stands</strong></td>
              <td>${ticketsJeuxCount.toLocaleString()} ticket(s) de jeux</td>
              <td style="text-align: right; font-weight: 700; color: #1d4ed8;">${revJeux.toLocaleString()} F</td>
              <td style="text-align: right;">${totalRecettes > 0 ? ((revJeux / totalRecettes) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td><strong>🍔 Caisse 4 : Restauration &amp; Buvette</strong></td>
              <td>${restoItemsCount.toLocaleString()} commande(s) servie(s)</td>
              <td style="text-align: right; font-weight: 700; color: #be185d;">${revResto.toLocaleString()} F</td>
              <td style="text-align: right;">${totalRecettes > 0 ? ((revResto / totalRecettes) * 100).toFixed(1) : '0.0'}%</td>
            </tr>
            <tr>
              <td><strong>🪙 Caisse 3 : Monnaie &amp; Jetons</strong></td>
              <td>Bureau de change &amp; rachat jetons</td>
              <td style="text-align: right; font-weight: 700; color: #b45309;">Actif (Flux Change)</td>
              <td style="text-align: right;">-</td>
            </tr>
          </tbody>
          <tfoot>
            <tr style="background: var(--gray-50); font-weight: 800; font-size: 1rem; border-top: 2px solid var(--gray-400);">
              <td colspan="2">TOTAL DES RECETTES BRUTES CONSOLIDÉES</td>
              <td style="text-align: right; color: var(--success); font-size: 1.15rem;">${totalRecettes.toLocaleString()} F</td>
              <td style="text-align: right;">100.0%</td>
            </tr>
          </tfoot>
        </table>
        <div style="font-size: 0.78rem; color: var(--gray-500); font-style: italic;">
          * Note de contrôle : Tout billet ou ticket annulé via l'outil d'annulation de caisse (🗑️) est automatiquement déduit de ce bilan en temps réel.
        </div>
      </div>

      <!-- ============================================================== -->
      <!-- 2. PERFORMANCE ET PALMARÈS FINANCIER DES STANDS -->
      <!-- ============================================================== -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>2.</span> Performance Financière et Palmarès par Stand
        </h3>

        ${standRows.length === 0 ? `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-title">Aucun stand configuré pour le moment</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr style="background: var(--gray-100);">
                <th style="width: 8%; text-align: center;">Rang</th>
                <th style="width: 32%;">Stand (Couleur &amp; N°)</th>
                <th style="width: 25%;">Responsable</th>
                <th style="width: 15%; text-align: center;">Tickets Vendus</th>
                <th style="width: 20%; text-align: right;">Recette Générée</th>
              </tr>
            </thead>
            <tbody>
              ${standRows.map((st, idx) => `
                <tr>
                  <td style="text-align: center; font-weight: 800; color: var(--primary);">#${idx + 1}</td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span class="color-dot" style="background-color: ${st.color_hex};"></span>
                      <strong>${st.name}</strong>
                      <span style="font-size: 0.75rem; color: var(--gray-500);">(${st.color_name} ${st.number})</span>
                    </div>
                  </td>
                  <td>${st.managerName}</td>
                  <td style="text-align: center; font-weight: 600;">${st.ticketsCount.toLocaleString()}</td>
                  <td style="text-align: right; font-weight: 800; color: ${st.revenue > 0 ? 'var(--success)' : 'var(--gray-400)'};">
                    ${st.revenue.toLocaleString()} F
                    <div style="font-size: 0.72rem; color: var(--gray-500); font-weight: normal;">${st.pct}% des jeux</div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: var(--gray-50); font-weight: 800; border-top: 2px solid var(--gray-400);">
                <td colspan="3">TOTAL RECETTES TICKETS DE JEUX ENCAISSÉES</td>
                <td style="text-align: center; font-weight: 800; color: var(--primary);">${ticketsJeuxCount.toLocaleString()}</td>
                <td style="text-align: right; color: var(--success); font-size: 1.05rem;">${revJeux.toLocaleString()} F</td>
              </tr>
            </tfoot>
          </table>
        `}
      </div>

      <!-- ============================================================== -->
      <!-- 3. GRAND LIVRE DES DÉPENSES JUSTIFIÉES DE LA KERMESSE -->
      <!-- ============================================================== -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>3.</span> Grand Livre des Dépenses Réelles &amp; Sorties de Caisse
        </h3>

        ${expenses.length === 0 ? `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-title">Aucune dépense enregistrée (Dépenses : 0 F)</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr style="background: var(--gray-100);">
                <th style="width: 14%;">Date &amp; Heure</th>
                <th style="width: 18%;">Origine / Caisse</th>
                <th style="width: 38%;">Motif &amp; Justification</th>
                <th style="width: 15%;">Engagé par</th>
                <th style="width: 15%; text-align: right;">Montant Déduit</th>
              </tr>
            </thead>
            <tbody>
              ${expenses.map(e => `
                <tr>
                  <td style="font-size: 0.78rem; color: var(--gray-600); font-family: monospace;">
                    ${new Date(e.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td><span class="badge ${e.source.includes('Caisse') ? 'badge-primary' : 'badge-gray'}">${e.source}</span></td>
                  <td><strong>${e.reason}</strong></td>
                  <td><span class="badge badge-gray">${e.author}</span></td>
                  <td style="text-align: right; font-weight: 800; color: var(--danger); font-size: 0.95rem;">
                    -${Math.abs(e.amount_f).toLocaleString()} F
                  </td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr style="background: var(--gray-50); font-weight: 800; border-top: 2px solid var(--gray-400);">
                <td colspan="4">TOTAL GÉNÉRAL DES DÉPENSES ENGAGÉES</td>
                <td style="text-align: right; color: var(--danger); font-size: 1.05rem;">-${totalExpenses.toLocaleString()} F</td>
              </tr>
            </tfoot>
          </table>
        `}
      </div>

      <!-- ============================================================== -->
      <!-- 4. BILAN DU MATÉRIEL EMPRUNTÉ (LOGISTIQUE) -->
      <!-- ============================================================== -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>4.</span> État Logistique du Matériel Emprunté
        </h3>

        ${this.loans.length === 0 ? `
          <div class="empty-state" style="padding: 1.5rem;">
            <div class="empty-title">Aucun matériel lourd en prêt ou emprunt</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr style="background: var(--gray-100);">
                <th>Matériel</th>
                <th>Quantité</th>
                <th>Propriétaire / Prêteur</th>
                <th>Date Restitution Prévue</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              ${this.loans.map(l => `
                <tr>
                  <td><strong>${l.material ? l.material.name : 'Matériel'}</strong></td>
                  <td>${l.quantity} unité(s)</td>
                  <td>${l.owner ? l.owner.name : '-'}</td>
                  <td>${new Date(l.expected_return_date).toLocaleDateString('fr-FR')}</td>
                  <td><span class="badge ${l.status === 'restitue' ? 'badge-success' : 'badge-warning'}">${l.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- ============================================================== -->
      <!-- 5. REGISTRE DES INCIDENTS ET ANOMALIES -->
      <!-- ============================================================== -->
      <div style="margin-bottom: 2.5rem;">
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.5rem;">
          <span>5.</span> Registre des Incidents &amp; Anomalies Signalés
        </h3>

        ${this.incidents.length === 0 ? `
          <div class="empty-state" style="padding: 1.5rem; background: #f0fdf4; border: 1px solid #bbf7d0;">
            <div class="empty-title" style="color: #166534;">✅ Aucun incident à signaler — Kermesse sécurisée</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr style="background: var(--gray-100);">
                <th style="width: 15%;">Réf. Incident</th>
                <th>Désignation de l'Anomalie</th>
                <th style="width: 15%;">Gravité</th>
                <th style="width: 15%;">Statut</th>
              </tr>
            </thead>
            <tbody>
              ${this.incidents.map(i => `
                <tr>
                  <td><code>${i.incident_number}</code></td>
                  <td><strong>${i.title}</strong></td>
                  <td><span class="badge ${i.severity === 'faible' ? 'badge-gray' : 'badge-danger'}">${i.severity}</span></td>
                  <td><span class="badge ${i.status === 'resolu' ? 'badge-success' : 'badge-danger'}">${i.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>

      <!-- ============================================================== -->
      <!-- 6. ATTESTATION ET CADRES DE SIGNATURES OFFICIELLES -->
      <!-- ============================================================== -->
      <div class="signature-box" style="margin-top: 3rem; padding-top: 1.5rem; border-top: 2px solid var(--gray-300);">
        <p style="text-align: center; font-size: 0.85rem; color: var(--gray-600); font-style: italic; margin-bottom: 2rem;">
          « Nous soussignés, certifions que le présent rapport et bilan consolidé reflète sincèrement et fidèlement la totalité des opérations réelles, encaissements de billets et dépenses constatés au cours de la kermesse de l'Association Love and Charity. »
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; text-align: center;">
          <div style="border: 1px solid #cbd5e1; border-radius: var(--radius-md); padding: 1.25rem 1rem; min-height: 140px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--gray-800);">
              Le Responsable Billetterie &amp; Comptabilité
            </div>
            <div style="font-size: 0.78rem; color: var(--gray-400);">(Date, Nom et Signature)</div>
          </div>

          <div style="border: 1px solid #cbd5e1; border-radius: var(--radius-md); padding: 1.25rem 1rem; min-height: 140px; display: flex; flex-direction: column; justify-content: space-between;">
            <div style="font-weight: 800; font-size: 0.95rem; color: var(--gray-800);">
              La Présidence / Direction Générale L&amp;C
            </div>
            <div style="font-size: 0.78rem; color: var(--gray-400);">(Mention « Lu et Approuvé », Cachet &amp; Signature)</div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 2rem; font-size: 0.78rem; color: var(--gray-400);">
          Association Love and Charity (L&amp;C) • Document Officiel et Immuable • Année 2026
        </div>
      </div>
    `;
  }
};

window.ReportsModule = ReportsModule;
