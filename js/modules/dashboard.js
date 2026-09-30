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
    const canSeeFinance = isSuperAdmin || (user && (user.role_code === 'admin_finances' || user.role_code === 'admin_billetterie'));

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

        ${canSeeFinance ? `
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
        ` : ''}

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

      <!-- Mon Carnet de Bord & Tâches Perso -->
      <div class="card" style="background: linear-gradient(135deg, #f8fafc 0%, #eff6ff 100%); border: 1px solid #bfdbfe; margin-bottom: 1.5rem;">
        <div class="card-body" style="padding: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: #2563eb; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1.4rem;">
              📝
            </div>
            <div>
              <h4 style="margin: 0; font-size: 1.05rem; color: #1e3a8a;">Mon Carnet de Bord &amp; Tâches Perso</h4>
              <p style="margin: 2px 0 0 0; font-size: 0.82rem; color: #3b82f6;">
                Votre to-do list interactive avec progression et votre bloc-notes à sauvegarde automatique.
              </p>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="App.navigateTo('tasks')">
            <span>✏️</span> Ouvrir mon Bloc-Notes &amp; To-Do
          </button>
        </div>
      </div>

      <!-- Contenu contextuel et actions rapides vers les Pôles -->
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>⚡</span> ${isSuperAdmin ? 'Accès Direct aux 9 Pôles Opérationnels' : 'Raccourcis de Mon Pôle'}
          </div>
        </div>
        <div class="card-body">
          <div class="poles-shortcut-grid">
            ${this.renderPoleShortcuts()}
          </div>
        </div>
      </div>
    `;

    // Chargement dynamique des vraies statistiques
    this.loadRealData();
  },

  renderPoleShortcuts() {
    const shortcuts = [
      { mod: 'communication', icon: '📢', label: 'P1 : Communication & Affichage', btnClass: 'btn-secondary' },
      { mod: 'tickets', icon: '🎟️', label: 'P2 : Billetterie', btnClass: 'btn-secondary' },
      { mod: 'cash', icon: '💵', label: 'P2 : Caisses & Compta', btnClass: 'btn-secondary' },
      { mod: 'decoration', icon: '🎨', label: 'P3 : Décoration & Organisation', btnClass: 'btn-secondary' },
      { mod: 'stocks', icon: '🍔', label: 'P4 : Restauration (Stocks)', btnClass: 'btn-secondary' },
      { mod: 'inventory', icon: '📦', label: 'P4 : Inventaires & Pertes', btnClass: 'btn-secondary' },
      { mod: 'stands', icon: '🎪', label: 'P5 : Stands & Jeux', btnClass: 'btn-primary' },
      { mod: 'gifts', icon: '🎁', label: 'P6 : Lots à gagner', btnClass: 'btn-secondary' },
      { mod: 'members', icon: '👥', label: 'P7 : Planning & Bénévoles', btnClass: 'btn-secondary' },
      { mod: 'materials', icon: '📦', label: 'P8 : Logistique & Installation', btnClass: 'btn-secondary' },
      { mod: 'security', icon: '🛡️', label: 'P9 : Accueil & Sécurité', btnClass: 'btn-danger' },
      { mod: 'messages', icon: '💬', label: 'Messages & Alertes', btnClass: 'btn-secondary' }
    ];

    const allowed = shortcuts.filter(s => typeof Permissions === 'undefined' || Permissions.canAccessModule(s.mod));

    return allowed.map(s => `
      <button class="btn ${s.btnClass} btn-sm pole-shortcut-btn" onclick="App.navigateTo('${s.mod}')">
        <span class="pole-icon">${s.icon}</span> <span class="pole-label">${s.label}</span>
      </button>
    `).join('');
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
      if (document.getElementById('kpiStands')) {
        document.getElementById('kpiStands').textContent = standCount;
        document.getElementById('kpiStandsSub').textContent = standCount === 0 ? 'Aucun stand configuré' : `${standCount} stand(s) actif(s)`;
      }

      // 2. Membres
      const { data: members } = await client.from('members').select('id');
      const memberCount = members ? members.length : 0;
      if (document.getElementById('kpiMembers')) {
        document.getElementById('kpiMembers').textContent = memberCount;
        document.getElementById('kpiMembersSub').textContent = memberCount === 0 ? 'Aucun membre enregistré' : `${memberCount} bénévole(s)`;
      }

      // 3. Tickets et Ventes (Filtrage strict des annulations et synchronisation totale)
      let cancelledIds = [];
      try {
        const storedC = localStorage.getItem('kermesse_cancelled_sale_ids');
        if (storedC) cancelledIds = JSON.parse(storedC);
      } catch (e) {}

      let salesList = [];
      if (client) {
        try {
          const { data: sales } = await client.from('ticket_sales').select('id, quantity, total_amount_f, category');
          if (sales) {
            salesList = sales.filter(s => !cancelledIds.includes(s.id));
          }
        } catch (e) {
          console.warn('[Dashboard Sales Error]', e);
        }
      }

      // Fusion avec les ventes locales (Entrée, Jeux, Restauration)
      const storedEntree = localStorage.getItem('kermesse_entry_sales');
      const storedJeux = localStorage.getItem('kermesse_game_sales');
      const storedFood = localStorage.getItem('kermesse_food_sales');
      let localSales = [];
      try { if (storedEntree) localSales = [...localSales, ...JSON.parse(storedEntree)]; } catch (e) {}
      try { if (storedJeux) localSales = [...localSales, ...JSON.parse(storedJeux)]; } catch (e) {}
      try { if (storedFood) localSales = [...localSales, ...JSON.parse(storedFood)]; } catch (e) {}
      localSales = localSales.filter(l => !cancelledIds.includes(l.id));

      localSales.forEach(ls => {
        if (!salesList.some(s => s.id === ls.id)) {
          salesList.push(ls);
        }
      });

      let totalTickets = 0;
      let totalRevenue = 0;
      salesList.forEach(s => {
        totalTickets += (s.quantity || 1);
        totalRevenue += (s.total_amount_f || 0);
      });

      if (document.getElementById('kpiTickets')) {
        document.getElementById('kpiTickets').textContent = totalTickets.toLocaleString();
        document.getElementById('kpiTicketsSub').textContent = `${totalRevenue.toLocaleString()} ${KermesseConfig.currency} encaissés`;
      }

      // 4. Dépenses et Solde (Dépenses validées + Sorties enregistrées dans les Caisses)
      let totalExpenses = 0;

      if (client) {
        try {
          const { data: expenses } = await client.from('expenses').select('amount_f, status');
          if (expenses) {
            expenses.filter(e => e.status === 'approuve').forEach(e => {
              totalExpenses += Math.abs(e.amount_f || 0);
            });
          }
        } catch (e) {}

        try {
          const { data: caisseExps } = await client.from('cash_movements').select('amount_f, type').eq('type', 'depense_autorisee');
          if (caisseExps) {
            caisseExps.forEach(ce => {
              totalExpenses += Math.abs(ce.amount_f || 0);
            });
          }
        } catch (e) {}
      }

      // Dépenses locales de caisses non encore synchronisées
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('kermesse_caisse_expenses_')) {
            const locExps = JSON.parse(localStorage.getItem(key) || '[]');
            locExps.forEach(le => {
              if (!client || !le.id || (typeof CaissesCore !== 'undefined' && !CaissesCore.isUuid(le.id))) {
                totalExpenses += Math.abs(le.amount_f || 0);
              }
            });
          }
        }
      } catch (e) {}

      const balance = totalRevenue - totalExpenses;
      if (document.getElementById('kpiBalance')) {
        document.getElementById('kpiBalance').textContent = `${balance.toLocaleString()} ${KermesseConfig.currency}`;
        document.getElementById('kpiBalanceSub').textContent = `Recettes: ${totalRevenue.toLocaleString()} F | Dépenses: ${totalExpenses.toLocaleString()} F`;
      }

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

    } catch (err) {
      console.warn('[Dashboard] Erreur lors de la récupération des données réelles:', err);
    }
  },

  checkSystemAlerts(stands, loans, incidents) {
    const alertsBox = document.getElementById('alertsContainer');
    if (!alertsBox) return;

    let alertsHtml = '';

    // 1. Alerte Staffing Stands (uniquement si l'utilisateur a accès au pôle stands)
    if (stands && stands.length > 0 && typeof Permissions !== 'undefined' && Permissions.canAccessModule('stands')) {
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

    // 2. Alerte Emprunts Dépassés (uniquement si l'utilisateur a accès à la logistique)
    if (loans && loans.length > 0 && typeof Permissions !== 'undefined' && Permissions.canAccessModule('returns')) {
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

    // 3. Alerte Incidents en cours (uniquement si l'utilisateur a accès à la sécurité)
    if (incidents && incidents.length > 0 && typeof Permissions !== 'undefined' && Permissions.canAccessModule('incidents')) {
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
