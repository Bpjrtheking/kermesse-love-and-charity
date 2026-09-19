/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : TABLEAU DE BORD (DASHBOARD)
 * 
 * Vision globale pour le SuperAdministrateur et ciblée pour les autres rôles.
 * RÈGLE ABSOLUE : ZÉRO FAUX CHIFFRE. Statistiques calculées exclusivement sur
 * les données réelles saisies. États vides propres si aucune donnée.
 */

const DashboardModule = {
  async render(container) {
    const user = Auth.getCurrentUser();
    const isSuperAdmin = user && (user.is_original_superadmin || user.role_code === 'superadmin');

    container.innerHTML = `
      <div class="dashboard-header" style="margin-bottom: 2rem;">
        <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.25rem;">
          ${isSuperAdmin ? 'Tableau de bord — Love and Charity (L&C)' : `Tableau de bord — ${user.role_name || 'Espace Membre'}`}
        </h2>
        <p style="color: var(--gray-500); font-size: 0.9rem;">
          Bienvenue, <strong>${user.full_name || user.login}</strong>. Suivi et contrôle en temps réel de la kermesse.
        </p>
      </div>

      <!-- Zone d'alertes intelligentes -->
      <div id="alertsContainer" class="alerts-section"></div>

      <!-- Grille des statistiques principales (Calculées en direct sur les vraies données) -->
      <div id="kpiGrid" class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon red">🎪</div>
          <div class="stat-details">
            <h3>Stands Actifs</h3>
            <div class="stat-value" id="kpiStands">0</div>
            <div class="stat-sub" id="kpiStandsSub">Aucun stand configuré</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon blue">👥</div>
          <div class="stat-details">
            <h3>Bénévoles & Membres</h3>
            <div class="stat-value" id="kpiMembers">0</div>
            <div class="stat-sub" id="kpiMembersSub">Aucun membre enregistré</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon green">🎟️</div>
          <div class="stat-details">
            <h3>Tickets Vendus</h3>
            <div class="stat-value" id="kpiTickets">0</div>
            <div class="stat-sub" id="kpiTicketsSub">0 F encaissés</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon amber">💰</div>
          <div class="stat-details">
            <h3>Solde Kermesse</h3>
            <div class="stat-value" id="kpiBalance">0 F</div>
            <div class="stat-sub" id="kpiBalanceSub">Recettes: 0 F | Dépenses: 0 F</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon blue">📦</div>
          <div class="stat-details">
            <h3>Matériel & Emprunts</h3>
            <div class="stat-value" id="kpiLoans">0</div>
            <div class="stat-sub" id="kpiLoansSub">0 emprunts en cours</div>
          </div>
        </div>

        <div class="stat-card">
          <div class="stat-icon red">⚠️</div>
          <div class="stat-details">
            <h3>Incidents Ouverts</h3>
            <div class="stat-value" id="kpiIncidents">0</div>
            <div class="stat-sub" id="kpiIncidentsSub">Aucun incident à signaler</div>
          </div>
        </div>
      </div>

      <!-- Contenu contextuel et actions rapides vers les 9 Pôles -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>⚡</span> Accès Direct aux 9 Pôles Opérationnels
          </div>
        </div>
        <div class="card-body">
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('communication')">
              <span>📢</span> P1 : Communication
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('tickets')">
              <span>🎟️</span> P2 : Billetterie
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('cash')">
              <span>💵</span> P2 : Caisses
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('decoration')">
              <span>🎨</span> P3 : Décoration (10 Zones)
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('stocks')">
              <span>🍔</span> P4 : Restauration
            </button>
            <button class="btn btn-primary btn-sm" onclick="App.navigateTo('stands')">
              <span>🎪</span> P5 : Stands &amp; Jeux
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('gifts')">
              <span>🎁</span> P6 : Lots à gagner
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('members')">
              <span>👥</span> P7 : Bénévoles &amp; Planning
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('materials')">
              <span>📦</span> P8 : Logistique
            </button>
            <button class="btn btn-danger btn-sm" onclick="App.navigateTo('security')">
              <span>🛡️</span> P9 : Accueil &amp; Sécurité
            </button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('messages')">
              <span>💬</span> Messages &amp; Alertes
            </button>
          </div>
        </div>
      </div>

      <!-- Tableau des Dernières Opérations -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📜</span> Dernières Opérations Récentes (Traçabilité)
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('history')">
            Voir tout l'historique
          </button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div id="recentActivityTable">
            <div class="empty-state">
              <div class="empty-icon">📜</div>
              <div class="empty-title">Aucune opération enregistrée</div>
              <div class="empty-desc">Toutes les actions (ventes, mouvements de stocks, sorties d'argent, incidents) seront répertoriées ici automatiquement.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Chargement dynamique des vraies statistiques
    this.loadRealData();
  },

  async loadRealData() {
    const client = SupabaseClient.client;
    if (!client) {
      this.renderEmptyStateNotice();
      return;
    }

    try {
      // 1. Stands
      const { data: stands } = await client.from('stands').select('id, name, manager_id, is_closed');
      const standCount = stands ? stands.length : 0;
      document.getElementById('kpiStands').textContent = standCount;
      document.getElementById('kpiStandsSub').textContent = standCount === 0 ? 'Aucun stand configuré' : `${standCount} stand(s) actif(s)`;

      // 2. Membres
      const { data: members } = await client.from('members').select('id');
      const memberCount = members ? members.length : 0;
      document.getElementById('kpiMembers').textContent = memberCount;
      document.getElementById('kpiMembersSub').textContent = memberCount === 0 ? 'Aucun membre enregistré' : `${memberCount} bénévole(s)`;

      // 3. Tickets et Ventes
      const { data: sales } = await client.from('ticket_sales').select('quantity, total_amount_f');
      let totalTickets = 0;
      let totalRevenue = 0;
      if (sales) {
        sales.forEach(s => {
          totalTickets += s.quantity || 0;
          totalRevenue += s.total_amount_f || 0;
        });
      }
      document.getElementById('kpiTickets').textContent = totalTickets;
      document.getElementById('kpiTicketsSub').textContent = `${totalRevenue.toLocaleString()} ${KermesseConfig.currency} encaissés`;

      // 4. Dépenses et Solde
      const { data: expenses } = await client.from('expenses').select('amount_f, status');
      let totalExpenses = 0;
      if (expenses) {
        expenses.filter(e => e.status === 'approuve').forEach(e => {
          totalExpenses += e.amount_f || 0;
        });
      }
      const balance = totalRevenue - totalExpenses;
      document.getElementById('kpiBalance').textContent = `${balance.toLocaleString()} ${KermesseConfig.currency}`;
      document.getElementById('kpiBalanceSub').textContent = `Recettes: ${totalRevenue.toLocaleString()} F | Dépenses: ${totalExpenses.toLocaleString()} F`;

      // 5. Emprunts
      const { data: loans } = await client.from('loans').select('id, status, expected_return_date');
      const activeLoans = loans ? loans.filter(l => l.status === 'en_cours' || l.status === 'partiel').length : 0;
      document.getElementById('kpiLoans').textContent = activeLoans;
      document.getElementById('kpiLoansSub').textContent = activeLoans === 0 ? 'Aucun emprunt en cours' : `${activeLoans} matériel(s) emprunté(s)`;

      // 6. Incidents
      const { data: incidents } = await client.from('incidents').select('id, status');
      const openIncidents = incidents ? incidents.filter(i => i.status !== 'resolu').length : 0;
      document.getElementById('kpiIncidents').textContent = openIncidents;
      document.getElementById('kpiIncidentsSub').textContent = openIncidents === 0 ? 'Aucun incident à signaler' : `${openIncidents} incident(s) non résolu(s)`;

      // Alertes Proactives
      this.checkSystemAlerts(stands, loans, incidents);

      // Dernières activités
      this.loadRecentActivity(client);

    } catch (err) {
      console.warn('[Dashboard] Erreur lors de la récupération des données réelles:', err);
    }
  },

  checkSystemAlerts(stands, loans, incidents) {
    const alertsBox = document.getElementById('alertsContainer');
    if (!alertsBox) return;

    let alertsHtml = '';

    // Alerte: Stands sans responsable
    if (stands && stands.length > 0) {
      const unmanaged = stands.filter(s => !s.manager_id && !s.is_closed);
      if (unmanaged.length > 0) {
        alertsHtml += `
          <div class="alert-banner warning">
            <div>⚠️ <strong>Alerte Staffing :</strong> ${unmanaged.length} stand(s) n'ont aucun responsable désigné.</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('stands')">Affecter</button>
          </div>
        `;
      }
    }

    // Alerte: Emprunts dépassés
    if (loans && loans.length > 0) {
      const today = new Date().toISOString().split('T')[0];
      const overdue = loans.filter(l => l.status === 'en_cours' && l.expected_return_date < today);
      if (overdue.length > 0) {
        alertsHtml += `
          <div class="alert-banner danger">
            <div>🚨 <strong>Matériel non restitué :</strong> ${overdue.length} emprunt(s) ont dépassé la date de retour prévue !</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('returns')">Voir le plan</button>
          </div>
        `;
      }
    }

    // Alerte: Incidents non résolus
    if (incidents && incidents.length > 0) {
      const critical = incidents.filter(i => i.status !== 'resolu');
      if (critical.length > 0) {
        alertsHtml += `
          <div class="alert-banner danger">
            <div>⚠️ <strong>Incidents en cours :</strong> ${critical.length} incident(s) nécessitent une attention immédiate.</div>
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('incidents')">Traiter</button>
          </div>
        `;
      }
    }

    alertsBox.innerHTML = alertsHtml;
  },

  async loadRecentActivity(client) {
    const tableDiv = document.getElementById('recentActivityTable');
    if (!tableDiv) return;

    try {
      const { data: logs } = await client.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(6);
      if (logs && logs.length > 0) {
        tableDiv.innerHTML = `
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Utilisateur</th>
                  <th>Action</th>
                  <th>Détails</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(log => `
                  <tr>
                    <td style="color: var(--gray-500); font-family: monospace; font-size: 0.8rem;">
                      ${new Date(log.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td><strong>${log.login}</strong></td>
                    <td><span class="badge badge-primary">${log.action}</span></td>
                    <td>${log.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }
    } catch (e) {
      console.error(e);
    }
  },

  renderEmptyStateNotice() {
    const alertsBox = document.getElementById('alertsContainer');
    if (alertsBox && !KermesseConfig.isSupabaseConfigured()) {
      alertsBox.innerHTML = `
        <div class="alert-banner info">
          <div>💡 <strong>Base de données Supabase :</strong> Connexion en attente de validation ou réseau hors-ligne.</div>
        </div>
      `;
    }
  }
};

window.DashboardModule = DashboardModule;
