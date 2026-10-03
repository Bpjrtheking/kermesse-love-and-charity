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
      <div class="dashboard-header" style="margin-bottom: 2rem; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.25rem;">
            ${isSuperAdmin ? 'Tableau de bord — Love and Charity (L&C)' : `Tableau de bord — ${user.role_name || 'Espace Membre'}`}
          </h2>
          <p style="color: var(--gray-500); font-size: 0.9rem; margin: 0;">
            Bienvenue, <strong>${user.full_name || user.login}</strong>. Suivi et contrôle en temps réel de la kermesse.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" onclick="DashboardModule.loadRealData()" title="Rafraîchir les indicateurs en direct">
            <span>🔄</span> Actualiser
          </button>
          ${isSuperAdmin ? `
          <button class="btn btn-danger btn-sm" onclick="DashboardModule.confirmResetAllData()" style="background: #dc2626; border: 1px solid #b91c1c; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;" title="Zone SuperAdmin : Remettre à zéro toutes les données de test">
            <span>⚠️</span> Remise à Zéro Complète
          </button>
          ` : ''}
        </div>
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

        <!-- ZONE DE SÉCURITÉ & MAINTENANCE SUPERADMIN (FIN DES TESTS) -->
        ${isSuperAdmin ? `
        <div class="card" style="margin-top: 1.5rem; border: 2px solid #ef4444; background: #fff5f5; box-shadow: var(--shadow-md);">
          <div class="card-header" style="background: #fee2e2; border-bottom: 1px solid #fecaca; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.4rem;">⚠️</span>
              <div>
                <h4 style="margin: 0; color: #991b1b; font-size: 1rem; font-weight: 800;">Zone Critique SuperAdmin — Remise à Zéro Totale (Fin des Tests)</h4>
                <div style="font-size: 0.78rem; color: #b91c1c;">Vidage intégral de toutes les transactions et caisses après vos essais</div>
              </div>
            </div>
            <button class="btn btn-danger btn-sm" style="background: #dc2626; border: 1px solid #b91c1c; font-weight: 800; padding: 0.5rem 1.1rem;" onclick="DashboardModule.confirmResetAllData()">
              <span>🗑️</span> Tout Remettre à Zéro
            </button>
          </div>
          <div class="card-body" style="padding: 1rem 1.25rem;">
            <p style="font-size: 0.85rem; color: #7f1d1d; margin: 0; line-height: 1.5;">
              Cette action est <strong>exclusivement réservée au SuperAdministrateur</strong>. Elle vide toutes les ventes de billets (Entrée, Jeux, Restauration), les dettes/avoirs de jetons, les mouvements de caisse, les dépenses et le registre des annulations pour remettre les compteurs à 0 F.
              <br><strong>Une confirmation de sécurité avec le mot de passe « CONFIRMER » est obligatoirement exigée.</strong>
            </p>
          </div>
        </div>
        ` : ''}

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
      { mod: 'stocks', icon: '🍔', label: 'P4 : Restauration (Carte & Vente)', btnClass: 'btn-secondary' },
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

      // 3. Finances consolidées (Synchronisation absolue avec les Caisses, le Bilan et les Rapports)
      let finances = { totalTickets: 0, totalRecettes: 0, totalExpenses: 0, beneficeNet: 0 };
      if (typeof CaissesCore !== 'undefined' && CaissesCore.calculateConsolidatedFinances) {
        finances = await CaissesCore.calculateConsolidatedFinances();
      }

      if (document.getElementById('kpiTickets')) {
        document.getElementById('kpiTickets').textContent = finances.totalTickets.toLocaleString();
        document.getElementById('kpiTicketsSub').textContent = `${finances.totalRecettes.toLocaleString()} ${KermesseConfig.currency} encaissés`;
      }

      if (document.getElementById('kpiBalance')) {
        document.getElementById('kpiBalance').textContent = `${finances.beneficeNet.toLocaleString()} ${KermesseConfig.currency}`;
        document.getElementById('kpiBalanceSub').textContent = `Recettes: ${finances.totalRecettes.toLocaleString()} F | Dépenses: ${finances.totalExpenses.toLocaleString()} F`;
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
  },

  async confirmResetAllData() {
    const user = Auth.getCurrentUser();
    if (!user || (!user.is_original_superadmin && user.role_code !== 'superadmin')) {
      Notify.warning("🔒 Action strictement réservée au SuperAdministrateur.");
      return;
    }

    const promptResponse = prompt(
      "⚠️ AVERTISSEMENT DE SÉCURITÉ ABSOLUE ⚠️\n\n" +
      "Vous êtes sur le point de TOUT REMETTRE À ZÉRO dans l'application :\n" +
      "- Toutes les ventes de billets (Entrée, Jeux, Restauration)\n" +
      "- Tous les mouvements et avoirs de jetons\n" +
      "- Toutes les dépenses de caisse\n" +
      "- Tout le registre des annulations\n" +
      "- Tous les soldes de caisse\n\n" +
      "Cette action est IRRÉVERSIBLE et sert à vider les données de test.\n\n" +
      "Pour exécuter la purge intégrale, tapez exactement 'CONFIRMER' en majuscules :"
    );

    if (promptResponse === null) return;
    if (promptResponse.trim() !== 'CONFIRMER') {
      Notify.warning("Action annulée : vous devez saisir exactement 'CONFIRMER' en majuscules pour autoriser la purge.");
      return;
    }

    Notify.info("Purge intégrale des données de test en cours...");
    const client = SupabaseClient.client;

    // 1. Purge via Supabase RPC si disponible
    if (client) {
      try {
        await client.rpc('purge_test_data');
      } catch (e) {}

      // 2. Purge directe sécurisée table par table dans Supabase
      try {
        await client.from('ticket_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('cash_movements').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('token_debts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('transaction_cancellations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('tickets_catalog').delete().eq('type', 'cancelled_sale');
        await client.from('tickets_catalog').delete().eq('type', 'cancelled_ticket_name');
        await client.from('cash_registers').update({
          initial_amount_f: 0,
          current_balance_f: 0,
          expected_amount_f: 0,
          counted_amount_f: 0,
          variance_f: 0,
          status: 'open',
          closed_at: null,
          closed_by: null,
          closing_notes: null
        }).neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('[Supabase Reset Warning]', err);
      }
    }

    // 3. Purge intégrale de tous les caches locaux (localStorage)
    const keysToPurge = [
      'kermesse_ticket_sales',
      'kermesse_entry_sales',
      'kermesse_game_sales',
      'kermesse_food_sales',
      'kermesse_jetons_movements',
      'kermesse_jetons_debts',
      'kermesse_cancelled_sale_ids',
      'kermesse_cancelled_ticket_names',
      'kermesse_cancellations_registry',
      'kermesse_cash_registers'
    ];
    keysToPurge.forEach(k => localStorage.removeItem(k));

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith('kermesse_expenses_') || k.startsWith('kermesse_sales_'))) {
        localStorage.removeItem(k);
      }
    }

    // 4. Consignation dans le journal d'audit
    AuditLogger.log(
      'REMISE_A_ZERO_COMPLETE',
      'system',
      user.id,
      `Purge intégrale des données de test exécutée avec succès par le SuperAdmin ${user.full_name || user.login} (@${user.login})`
    );

    Notify.success("🎉 Remise à zéro complète réussie ! Toutes les caisses et transactions sont revenues à 0 F.");
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  }
};

window.DashboardModule = DashboardModule;
window.confirmResetAllData = () => DashboardModule.confirmResetAllData();
