/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MOTEUR UNIVERSEL DE SYNCHRONISATION EN DIRECT & TEMPS RÉEL (LiveSync)
 * 
 * Assure une interconnexion absolue et continue entre tous les écrans, tous les
 * administrateurs et la supervision générale :
 * 1. Canal Supabase Realtime WebSocket (0ms de latence dès qu'une action est exécutée)
 * 2. Battement de cœur automatique (Auto-actualisation silencieuse chaque 2 secondes)
 * 3. Protection UX : Ne perturbe JAMAIS la saisie en cours (modale ouverte, champ texte avec focus, panier en cours)
 * 4. Couverture intégrale : Les 9 Pôles + Supervision + Messagerie + Tâches + Hub
 */

const LiveSync = {
  POLL_INTERVAL_MS: 1500, // Auto-actualisation automatique toutes les 1.5 secondes (bouton invisible universel)
  channel: null,
  pollTimer: null,
  isRefreshing: false,
  lastRefreshTime: 0,
  lastRefreshStartTime: 0,
  spinAngle: 0,
  permissionSyncCounter: 0,

  init() {
    console.log('[LiveSync] Initialisation du moteur de synchronisation en direct...');
    
    // 1. Initialiser le canal Supabase Realtime multi-tables
    this.initRealtimeChannel();

    // 2. Démarrer le battement de cœur auto-actualisation (chaque 2 secondes)
    this.startHeartbeat();

    // 3. Injecter l'indicateur visuel "En direct 🟢" dans l'en-tête de la page
    this.injectLiveBadge();

    // 4. Détecter le retour de veille et déverrouillage écran (iPhone, iPad, Android, Mac, PC)
    const handleWakeUp = (eventReason) => {
      if (document.visibilityState === 'visible') {
        this.verifyAndReconnect();
        this.triggerRefresh(eventReason);
      }
    };

    document.addEventListener('visibilitychange', () => handleWakeUp('visibility_change'));
    window.addEventListener('focus', () => handleWakeUp('window_focus'));
    window.addEventListener('pageshow', () => handleWakeUp('page_show'));
    window.addEventListener('online', () => {
      this.verifyAndReconnect();
      this.triggerRefresh('network_online');
    });

    // 5. Bus local multi-onglets / multi-fenêtres (BroadcastChannel pour Mac, iPad, PC)
    if (typeof window.BroadcastChannel !== 'undefined') {
      try {
        this.localBus = new BroadcastChannel('lc_livesync_bus');
        this.localBus.onmessage = (e) => {
          if (e.data && e.data.action === 'REFRESH_NOW') {
            this.triggerRefresh('local_bus_' + (e.data.cause || 'event'));
          }
        };
      } catch (err) {}
    }
  },

  /**
   * Vérifie et relance la connexion WebSocket si l'appareil sort de veille.
   */
  verifyAndReconnect() {
    const client = SupabaseClient.client;
    if (!client) return;
    try {
      if (!this.channel || this.channel.state === 'closed' || this.channel.state === 'errored') {
        this.initRealtimeChannel();
      }
    } catch (e) {}
  },

  /**
   * Diffuse un signal instantané aux autres onglets ouverts sur le même appareil (Mac, PC, iPad).
   */
  broadcastLocalEvent(cause = 'event') {
    if (this.localBus) {
      try {
        this.localBus.postMessage({ action: 'REFRESH_NOW', cause });
      } catch (e) {}
    }
  },

  /**
   * Vérifie si le re-rendu de l'interface peut se faire en toute sécurité
   * sans déranger l'utilisateur (ex: formulaire en cours, modale ouverte).
   */
  /**
   * Vérifie si le rafraîchissement peut s'exécuter sans gêner l'utilisateur.
   */
  isSafeToRefresh() {
    // 1. Si une modale est activement ouverte à l'écran, on ne touche à rien
    const openModal = document.querySelector('.modal-backdrop, .modal.open');
    if (openModal) return false;

    // 2. Si l'utilisateur est activement en train de taper dans un champ de formulaire
    const el = document.activeElement;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA')) {
      const isSearch = el.id && el.id.toLowerCase().includes('search');
      if (!isSearch && el.value && el.value.trim().length > 0) {
        return false; // Ne pas couper la saisie en cours
      }
    }

    return true;
  },

  /**
   * Écoute en WebSocket Supabase Realtime toutes les tables clés du système.
   */
  initRealtimeChannel() {
    const client = SupabaseClient.client;
    if (!client) {
      setTimeout(() => this.initRealtimeChannel(), 1500);
      return;
    }

    try {
      if (this.channel) {
        client.removeChannel(this.channel);
      }

      const channelName = 'livesync_universal_' + Math.random().toString(36).substr(2, 6);
      this.channel = client.channel(channelName);

      const tablesToWatch = [
        'ticket_sales',
        'cash_movements',
        'token_debts',
        'tickets_catalog',
        'food_products',
        'stands',
        'games',
        'stand_material_requests',
        'stand_staff',
        'locations',
        'gifts_catalog',
        'gift_stand_allocations',
        'members',
        'teams',
        'volunteer_schedules',
        'materials',
        'loans',
        'material_movements',
        'incidents',
        'inventories',
        'inventory_items',
        'communication_items',
        'pole_tasks',
        'admin_notes',
        'kermesse_messages',
        'transaction_cancellations',
        'activity_logs',
        'app_users'
      ];

      tablesToWatch.forEach(tbl => {
        this.channel.on('postgres_changes', { event: '*', schema: 'public', table: tbl }, (payload) => {
          this.triggerRefresh(`realtime_${tbl}`);
        });
      });

      this.channel.subscribe((status) => {
        const badgeDot = document.getElementById('liveSyncStatusDot');
        const badgeText = document.getElementById('liveSyncStatusText');
        if (status === 'SUBSCRIBED') {
          if (badgeDot) badgeDot.style.background = '#22c55e';
          if (badgeText) badgeText.textContent = 'En direct';
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (badgeDot) badgeDot.style.background = '#f59e0b';
          if (badgeText) badgeText.textContent = 'Auto-sync 2s';
        }
      });
    } catch (e) {
      console.warn('[LiveSync] Avertissement initialisation Realtime:', e);
    }
  },

  /**
   * Battement de cœur continu toutes les 2 secondes.
   */
  startHeartbeat() {
    if (this.pollTimer) clearInterval(this.pollTimer);

    this.pollTimer = setInterval(async () => {
      // Toutes les 6 secondes (3 cycles de 2s), resynchroniser les permissions du cloud
      this.permissionSyncCounter++;
      if (this.permissionSyncCounter >= 3) {
        this.permissionSyncCounter = 0;
        if (typeof Permissions !== 'undefined' && Permissions.syncPolesFromCloud) {
          Permissions.syncPolesFromCloud().catch(() => {});
        }
      }

      await this.refreshActiveModule();
    }, this.POLL_INTERVAL_MS);
  },

  /**
   * Déclenche un rafraîchissement immédiat (appelé lors d'un événement Realtime ou manuel)
   */
  async triggerRefresh(cause = 'manual') {
    const now = Date.now();
    // Anti-rebond : max 1 rafraîchissement toutes les 350ms
    if (this.isRefreshing || (now - this.lastRefreshTime < 350)) return;
    this.lastRefreshTime = now;
    await this.refreshActiveModule();
  },

  /**
   * Rafraîchit directement et automatiquement les données affichées à l'écran.
   * Cible immédiatement le tableau présent dans le DOM (Jeux, Stands, Caisses, etc.).
   */
  async refreshActiveModule() {
    if (!this.isSafeToRefresh()) return;

    const now = Date.now();
    if (this.isRefreshing) {
      // Sécurité anti-blocage : si un rafraîchissement est suspendu depuis plus de 3.5s, on force la libération
      if (now - this.lastRefreshStartTime > 3500) {
        this.isRefreshing = false;
      } else {
        return;
      }
    }

    this.isRefreshing = true;
    this.lastRefreshStartTime = now;

    // Animation discrète de rotation de l'icône actualiser 🔄
    const spin = document.getElementById('liveSyncSpinIcon');
    if (spin) {
      this.spinAngle = (this.spinAngle || 0) + 180;
      spin.style.transition = 'transform 0.4s ease';
      spin.style.transform = `rotate(${this.spinAngle}deg)`;
    }

    try {
      // 1. Pôle 5 (Stands & Jeux)
      if (typeof GamesModule !== 'undefined' && document.getElementById('gamesTableContainer')) {
        await GamesModule.loadData();
      }
      if (typeof StandsModule !== 'undefined' && document.getElementById('standsTableContainer')) {
        await StandsModule.loadData();
      }

      // 2. Pôle 2 (Billetterie & Caisses)
      if (typeof CaisseEntreeModule !== 'undefined' && document.getElementById('entryCatalogGrid')) {
        await CaisseEntreeModule.loadData();
        if (!CaisseEntreeModule.cart || CaisseEntreeModule.cart.length === 0) CaisseEntreeModule.renderCurrentTab();
      }
      if (typeof CaisseJeuxModule !== 'undefined' && document.getElementById('caisseJeuxProductsGrid')) {
        await CaisseJeuxModule.loadData();
        if (!CaisseJeuxModule.cart || CaisseJeuxModule.cart.length === 0) CaisseJeuxModule.renderCurrentTab();
      }
      if (typeof CaisseJetonsModule !== 'undefined' && document.getElementById('caisseJetonsSummaryCard')) {
        await CaisseJetonsModule.loadData();
        CaisseJetonsModule.renderCurrentTab();
      }
      if (typeof CaisseBilanModule !== 'undefined' && document.getElementById('totalGlobalRevenue')) {
        await CaisseBilanModule.loadData();
        CaisseBilanModule.renderSummary();
      }
      if (typeof CaisseAnnulationsModule !== 'undefined' && document.getElementById('caisseAnnulationsCount')) {
        await CaisseAnnulationsModule.loadData();
        CaisseAnnulationsModule.renderContent();
      }

      // 3. Pôle 4 (Restauration & Buvette)
      if (typeof CaisseRestaurationModule !== 'undefined' && document.getElementById('foodMenuGrid')) {
        await CaisseRestaurationModule.loadData();
        if (!CaisseRestaurationModule.cart || CaisseRestaurationModule.cart.length === 0) CaisseRestaurationModule.renderCurrentTab();
      }
      if (typeof StocksModule !== 'undefined' && document.getElementById('foodProductsTableContainer')) {
        await StocksModule.loadData();
        StocksModule.renderProducts();
      }
      if (typeof InventoryModule !== 'undefined' && document.getElementById('inventoryTableContainer')) {
        await InventoryModule.loadData();
      }

      // 4. Pôle 6 (Lots & Cadeaux)
      if (typeof GiftsModule !== 'undefined' && (document.getElementById('giftsCatalogContainer') || document.getElementById('giftsAllocationsContainer'))) {
        await GiftsModule.loadData();
      }

      // 5. Pôle 7 (Bénévoles & Planning)
      if (typeof MembersModule !== 'undefined' && (document.getElementById('membersTableContainer') || document.getElementById('planningTableContainer'))) {
        await MembersModule.loadData();
        MembersModule.renderCurrentTab();
      }
      if (typeof TeamsModule !== 'undefined' && document.getElementById('teamsGridContainer')) {
        await TeamsModule.loadData();
      }

      // 6. Pôle 8 (Logistique & Matériel)
      if (typeof MaterialsModule !== 'undefined' && (document.getElementById('materialsTabContent') || document.getElementById('materialsTableContainer'))) {
        await MaterialsModule.loadData();
        MaterialsModule.renderCurrentTab();
      }
      if (typeof LoansModule !== 'undefined' && (document.getElementById('loansTableContainer') || document.getElementById('loansAlertsContainer'))) {
        await LoansModule.loadData();
      }
      if (typeof MovementsModule !== 'undefined' && document.getElementById('movementsTableContainer')) {
        await MovementsModule.loadData();
      }
      if (typeof ReturnsModule !== 'undefined' && (document.getElementById('returnsItineraryContainer') || document.getElementById('returnsTableContainer'))) {
        await ReturnsModule.loadData();
      }

      // 7. Pôle 9 (Sécurité & Incidents)
      if (typeof SecurityModule !== 'undefined' && (document.getElementById('incidentsTableContainer') || document.getElementById('securityStatsGrid'))) {
        await SecurityModule.loadData();
        SecurityModule.renderCurrentTab();
      }
      if (typeof IncidentsModule !== 'undefined' && document.getElementById('incidentsTableBody')) {
        await IncidentsModule.loadData();
      }

      // 8. Pôle 1 (Communication)
      if (typeof CommunicationModule !== 'undefined' && document.getElementById('commStatsGrid')) {
        await CommunicationModule.loadData();
        CommunicationModule.renderCurrentTab();
      }

      // 9. Pôle 3 (Décoration & Stade 3D)
      if (typeof DecorationModule !== 'undefined' && document.getElementById('decorStatsGrid')) {
        await DecorationModule.loadData();
        DecorationModule.renderCurrentTab();
      }

      // 10. Supervision (SuperAdmin)
      if (typeof DashboardModule !== 'undefined' && document.getElementById('kpiTotalRevenue')) {
        await DashboardModule.loadRealData();
      }
      if (typeof RolesModule !== 'undefined' && document.getElementById('rolesUsersTableContainer')) {
        await RolesModule.loadData();
        RolesModule.renderUsersTable();
      }
      if (typeof HistoryModule !== 'undefined' && document.getElementById('auditLogTableBody')) {
        await HistoryModule.loadData();
      }

      // 11. Messages & Tâches
      if (typeof MessagesModule !== 'undefined' && document.getElementById('whatsappContainer')) {
        await MessagesModule.checkNewMessages();
      }
      if (typeof TasksModule !== 'undefined' && document.getElementById('tasksWorkspace')) {
        await TasksModule.loadData(true);
      }
    } catch (err) {
      console.warn('[LiveSync Refresh Warning]', err);
    } finally {
      this.isRefreshing = false;
    }
  },

  /**
   * Injecte le bouton d'actualisation interactif "En direct 🟢 🔄" dans l'en-tête de chaque page.
   * Sert à la fois de témoin visuel du minuteur automatique 1.5s et de bouton manuel cliquable.
   */
  injectLiveBadge() {
    if (document.getElementById('liveSyncBadgeContainer')) return;

    const navRight = document.querySelector('.pole-nav-right') || document.querySelector('.portal-user-actions');
    if (!navRight) return;

    const badge = document.createElement('button');
    badge.id = 'liveSyncBadgeContainer';
    badge.className = 'live-sync-indicator live-sync-btn';
    badge.type = 'button';
    badge.title = 'Actualisation automatique active toutes les 1.5s (Cliquez pour forcer l\'actualisation immédiate)';
    badge.onclick = (e) => {
      e.preventDefault();
      LiveSync.triggerRefresh('user_manual_click');
    };
    badge.innerHTML = `
      <span class="live-sync-dot" id="liveSyncStatusDot"></span>
      <span class="live-sync-text" id="liveSyncStatusText">En direct</span>
      <span class="live-sync-spin" id="liveSyncSpinIcon" style="margin-left: 5px; font-size: 0.85rem; display: inline-block;">🔄</span>
    `;

    // Insérer juste avant les badges utilisateurs
    navRight.insertBefore(badge, navRight.firstChild);
  }
};

window.LiveSync = LiveSync;

// Initialisation automatique au chargement du DOM
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => LiveSync.init());
} else {
  LiveSync.init();
}
