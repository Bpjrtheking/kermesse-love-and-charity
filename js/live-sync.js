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
  isSafeToRefresh() {
    // 1. Si une modale est ouverte, ne JAMAIS toucher au DOM
    const openModal = document.querySelector('.modal-backdrop.open, .modal.open, .modal-dialog, [role="dialog"]');
    if (openModal) return false;

    // 2. Si l'utilisateur est activement en train de taper dans un champ de texte
    const activeEl = document.activeElement;
    if (activeEl) {
      const tag = activeEl.tagName;
      const isTextInput = (tag === 'INPUT' && !['checkbox', 'radio', 'button', 'submit'].includes(activeEl.type)) || tag === 'TEXTAREA';
      if (isTextInput) {
        // Si c'est un champ de recherche sans texte, autoriser le rafraîchissement
        if (activeEl.id && activeEl.id.toLowerCase().includes('search') && !activeEl.value.trim()) {
          // OK pour rafraîchir
        } else if (activeEl.value && activeEl.value.trim().length > 0) {
          // Saisie utilisateur active dans un formulaire ou recherche non vide
          return false;
        }
      }
    }

    // 3. Si l'utilisateur a des articles dans un panier de caisse actif
    if (typeof CaisseEntreeModule !== 'undefined' && CaisseEntreeModule.cart && CaisseEntreeModule.cart.length > 0) {
      return 'cart_active'; // Indique qu'on doit seulement rafraîchir les données sans réinitialiser le panier
    }
    if (typeof CaisseJeuxModule !== 'undefined' && CaisseJeuxModule.cart && CaisseJeuxModule.cart.length > 0) {
      return 'cart_active';
    }
    if (typeof CaisseRestaurationModule !== 'undefined' && CaisseRestaurationModule.cart && CaisseRestaurationModule.cart.length > 0) {
      return 'cart_active';
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
   * Rafraîchit intelligemment le module actuellement affiché à l'écran.
   */
  async refreshActiveModule() {
    const now = Date.now();
    if (this.isRefreshing) {
      // Sécurité anti-blocage : si un rafraîchissement est suspendu depuis plus de 3.5s, on force la libération
      if (now - this.lastRefreshStartTime > 3500) {
        this.isRefreshing = false;
      } else {
        return;
      }
    }
    const safety = this.isSafeToRefresh();
    if (safety === false) return; // Modale ouverte ou saisie active en cours

    this.isRefreshing = true;
    this.lastRefreshStartTime = now;

    // Animation discrète de rotation de l'icône actualiser
    const spin = document.getElementById('liveSyncSpinIcon');
    if (spin) {
      this.spinAngle = (this.spinAngle || 0) + 180;
      spin.style.transition = 'transform 0.4s ease';
      spin.style.transform = `rotate(${this.spinAngle}deg)`;
    }

    try {
      // 1. Pages gérées par PoleApp (pôles 1 à 9 et supervision)
      if (typeof PoleApp !== 'undefined' && PoleApp.tabs && PoleApp.currentTab) {
        const currentTab = PoleApp.currentTab;
        const handler = PoleApp.tabs[currentTab]?.handler;

        // Pôle 2 : Caisse Entrée
        if (handler === CaisseEntreeModule || currentTab === 'caisse_entree') {
          if (typeof CaisseEntreeModule !== 'undefined') {
            await CaisseEntreeModule.loadData();
            if (safety !== 'cart_active' && CaisseEntreeModule.cart.length === 0) {
              CaisseEntreeModule.renderCurrentTab();
            } else {
              CaisseEntreeModule.updateBadgeCounts();
            }
          }
        }
        // Pôle 2 : Caisse Jeux
        else if (handler === CaisseJeuxModule || currentTab === 'caisse_jeux') {
          if (typeof CaisseJeuxModule !== 'undefined') {
            await CaisseJeuxModule.loadData();
            if (safety !== 'cart_active' && CaisseJeuxModule.cart.length === 0) {
              CaisseJeuxModule.renderCurrentTab();
            } else {
              CaisseJeuxModule.updateBadgeCounts();
            }
          }
        }
        // Pôle 2 : Caisse Jetons & Avoirs
        else if (handler === CaisseJetonsModule || currentTab === 'caisse_jetons') {
          if (typeof CaisseJetonsModule !== 'undefined') {
            await CaisseJetonsModule.loadData();
            if (safety !== 'cart_active') {
              CaisseJetonsModule.renderCurrentTab();
            } else {
              CaisseJetonsModule.updateBadgeCounts();
            }
          }
        }
        // Pôle 2 & Supervision : Bilan Financier Consolidé
        else if (handler === CaisseBilanModule || currentTab === 'caisse_bilan') {
          if (typeof CaisseBilanModule !== 'undefined') {
            await CaisseBilanModule.loadData();
            CaisseBilanModule.renderSummary();
          }
        }
        // Pôle 2 & Supervision : Registre des Annulations
        else if (handler === CaisseAnnulationsModule || currentTab === 'caisse_annulations') {
          if (typeof CaisseAnnulationsModule !== 'undefined') {
            await CaisseAnnulationsModule.loadData();
            CaisseAnnulationsModule.renderContent();
          }
        }
        // Pôle 4 : Caisse Restauration
        else if (handler === CaisseRestaurationModule || currentTab === 'caisse_restauration') {
          if (typeof CaisseRestaurationModule !== 'undefined') {
            await CaisseRestaurationModule.loadData();
            if (safety !== 'cart_active' && CaisseRestaurationModule.cart.length === 0) {
              CaisseRestaurationModule.renderCurrentTab();
            } else {
              CaisseRestaurationModule.updateBadgeCounts();
            }
          }
        }
        // Pôle 4 : Stocks & Carte
        else if (handler === StocksModule || currentTab === 'stocks') {
          if (typeof StocksModule !== 'undefined') {
            await StocksModule.loadData();
          }
        }
        // Pôle 4 : Inventaires
        else if (handler === InventoryModule || currentTab === 'inventory') {
          if (typeof InventoryModule !== 'undefined') {
            await InventoryModule.loadData();
          }
        }
        // Pôle 5 : Stands
        else if (handler === StandsModule || currentTab === 'stands') {
          if (typeof StandsModule !== 'undefined') {
            await StandsModule.loadData();
          }
        }
        // Pôle 5 : Jeux
        else if (handler === GamesModule || currentTab === 'games') {
          if (typeof GamesModule !== 'undefined') {
            await GamesModule.loadData();
          }
        }
        // Pôle 1 : Communication
        else if (typeof CommunicationModule !== 'undefined' && (handler === CommunicationModule || currentTab === 'communication')) {
          await CommunicationModule.loadData();
          CommunicationModule.renderCurrentTab();
        }
        // Pôle 3 : Décoration
        else if (handler === DecorationModule || currentTab === 'decoration') {
          if (typeof DecorationModule !== 'undefined') {
            await DecorationModule.loadData();
            DecorationModule.renderCurrentTab();
          }
        }
        // Pôle 3 : Stade 3D
        else if (handler === LocationsModule || currentTab === 'locations') {
          if (typeof LocationsModule !== 'undefined') {
            await LocationsModule.loadData();
          }
        }
        // Pôle 6 : Lots
        else if (handler === GiftsModule || currentTab === 'gifts') {
          if (typeof GiftsModule !== 'undefined') {
            await GiftsModule.loadData();
          }
        }
        // Pôle 7 : Bénévoles
        else if (handler === MembersModule || currentTab === 'members') {
          if (typeof MembersModule !== 'undefined') {
            await MembersModule.loadData();
            MembersModule.renderCurrentTab();
          }
        }
        // Pôle 7 : Équipes
        else if (handler === TeamsModule || currentTab === 'teams') {
          if (typeof TeamsModule !== 'undefined') {
            await TeamsModule.loadData();
          }
        }
        // Pôle 8 : Matériel
        else if (handler === MaterialsModule || currentTab === 'materials') {
          if (typeof MaterialsModule !== 'undefined') {
            await MaterialsModule.loadData();
            MaterialsModule.renderCurrentTab();
          }
        }
        // Pôle 8 : Emprunts
        else if (handler === LoansModule || currentTab === 'loans') {
          if (typeof LoansModule !== 'undefined') {
            await LoansModule.loadData();
          }
        }
        // Pôle 8 : Mouvements
        else if (handler === MovementsModule || currentTab === 'movements') {
          if (typeof MovementsModule !== 'undefined') {
            await MovementsModule.loadData();
          }
        }
        // Pôle 8 : Retours
        else if (handler === ReturnsModule || currentTab === 'returns') {
          if (typeof ReturnsModule !== 'undefined') {
            await ReturnsModule.loadData();
          }
        }
        // Pôle 9 : Sécurité
        else if (handler === SecurityModule || currentTab === 'security') {
          if (typeof SecurityModule !== 'undefined') {
            await SecurityModule.loadData();
            SecurityModule.renderCurrentTab();
          }
        }
        // Pôle 9 : Incidents
        else if (handler === IncidentsModule || currentTab === 'incidents') {
          if (typeof IncidentsModule !== 'undefined') {
            await IncidentsModule.loadData();
          }
        }
        // Supervision : Dashboard
        else if (handler === DashboardModule || currentTab === 'dashboard') {
          if (typeof DashboardModule !== 'undefined') {
            await DashboardModule.loadRealData();
          }
        }
        // Supervision : Rôles & Comptes
        else if (handler === RolesModule || currentTab === 'roles') {
          if (typeof RolesModule !== 'undefined') {
            await RolesModule.loadData();
            RolesModule.renderUsersTable();
            RolesModule.renderPolesMatrix();
          }
        }
        // Supervision : Journal d'Activité
        else if (handler === HistoryModule || currentTab === 'history') {
          if (typeof HistoryModule !== 'undefined') {
            await HistoryModule.loadData();
          }
        }
      }

      // 2. Pôle 1 Communication si affiché directement sur poleContainer
      if (typeof CommunicationModule !== 'undefined' && document.getElementById('commStatsGrid')) {
        await CommunicationModule.loadData();
        CommunicationModule.renderCurrentTab();
      }

      // 3. Messagerie instantanée WhatsApp
      if (typeof MessagesModule !== 'undefined' && document.getElementById('whatsappContainer')) {
        await MessagesModule.checkNewMessages();
      }

      // 4. Carnet de bord & Tâches
      if (typeof TasksModule !== 'undefined' && document.getElementById('tasksWorkspace')) {
        await TasksModule.loadData(true);
      }

      // 5. Hub général
      if (typeof App !== 'undefined' && document.querySelector('.portal-wrapper')) {
        if (typeof applyPolePermissionsUI === 'function') {
          applyPolePermissionsUI().catch(() => {});
        }
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
