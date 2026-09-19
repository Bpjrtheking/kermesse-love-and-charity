/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : MESSAGERIE STYLE WHATSAPP & CONSIGNES EN DIRECT
 * 
 * Expérience WhatsApp / Telegram :
 * - Volet gauche : Liste des discussions (Général, Urgences, Stands, Messages Directs)
 * - Volet droit : Fil de discussion avec bulles (sortantes à droite avec ✓✓, entrantes à gauche)
 * - Ergonomie 100% Mobile Responsive : navigation fluide liste ↔ conversation avec bouton Retour
 * - Envoi instantané avec touche Entrée
 * - Support Hors-ligne avec icône horloge 🕒 et synchronisation automatique
 */

const MessagesModule = {
  activeChat: {
    type: 'broadcast',
    id: 'broadcast',
    title: '📢 Canal Général L&C',
    subtitle: 'Tous les membres de la kermesse',
    avatar: '📢',
    avatarClass: 'broadcast'
  },
  filterCategory: 'all', // 'all', 'broadcast', 'urgent', 'stand', 'direct'
  searchQuery: '',
  mobileView: 'list', // 'list' ou 'chat' (pour les écrans mobiles)
  isUrgentActive: false,
  cachedMessages: [],
  stands: [],
  users: [],
  pollingInterval: null,
  lastSeenId: null,

  async render(container) {
    const currentUser = Auth.getCurrentUser();
    const isSuperAdmin = currentUser && (currentUser.is_original_superadmin || currentUser.role_code === 'superadmin');

    // Sur mobile (<= 992px), on commence TOUJOURS par la liste des discussions (comme WhatsApp)
    if (window.innerWidth <= 992) {
      this.mobileView = 'list';
      document.body.classList.remove('in-chat-view');
    } else {
      this.mobileView = 'chat';
    }

    container.innerHTML = `
      <div class="whatsapp-container ${this.mobileView === 'chat' ? 'mobile-show-chat' : 'mobile-show-list'}" id="whatsappContainer">
        <!-- 1. VOLET GAUCHE : LISTE DES CONVERSATIONS -->
        <aside class="whatsapp-sidebar" id="whatsappSidebar">
          <div class="whatsapp-sidebar-header">
            <div class="whatsapp-sidebar-top">
              <h3>💬 Discussions</h3>
              <div style="display: flex; gap: 0.25rem; align-items: center;">
                <button class="btn-icon" onclick="MessagesModule.markAllAsRead()" title="Tout marquer comme lu (effacer les pastilles non lues)" style="font-size: 0.82rem; font-weight: 700; color: #0284c7;">
                  ✓✓ Tout lu
                </button>
                <button class="btn-icon" onclick="MessagesModule.refreshAll()" title="Actualiser les messages">
                  🔄
                </button>
              </div>
            </div>

            <div class="whatsapp-search-box">
              <span class="whatsapp-search-icon">🔍</span>
              <input type="text" class="whatsapp-search-input" placeholder="Rechercher une discussion..." oninput="MessagesModule.handleSearch(this.value)">
            </div>

            <div class="whatsapp-filter-chips">
              <button class="whatsapp-chip ${this.filterCategory === 'all' ? 'active' : ''}" onclick="MessagesModule.setFilter('all')">
                <span>Tous</span>
                <span class="chip-unread-badge" id="chipBadge_all" style="display: none;">0</span>
              </button>
              <button class="whatsapp-chip ${this.filterCategory === 'broadcast' ? 'active' : ''}" onclick="MessagesModule.setFilter('broadcast')">
                <span>📢 Général</span>
                <span class="chip-unread-badge" id="chipBadge_broadcast" style="display: none;">0</span>
              </button>
              <button class="whatsapp-chip ${this.filterCategory === 'urgent' ? 'active' : ''}" onclick="MessagesModule.setFilter('urgent')">
                <span>🚨 Urgences</span>
                <span class="chip-unread-badge urgent" id="chipBadge_urgent" style="display: none;">0</span>
              </button>
              <button class="whatsapp-chip ${this.filterCategory === 'stand' ? 'active' : ''}" onclick="MessagesModule.setFilter('stand')">
                <span>🎪 Stands</span>
                <span class="chip-unread-badge" id="chipBadge_stand" style="display: none;">0</span>
              </button>
              <button class="whatsapp-chip ${this.filterCategory === 'direct' ? 'active' : ''}" onclick="MessagesModule.setFilter('direct')">
                <span>👤 Directs</span>
                <span class="chip-unread-badge" id="chipBadge_direct" style="display: none;">0</span>
              </button>
              ${isSuperAdmin ? `
                <button class="whatsapp-chip ${this.filterCategory === 'supervision' ? 'active' : ''}" onclick="MessagesModule.setFilter('supervision')" title="Superviser les messages privés entre administrateurs">
                  <span>👁️ Supervision</span>
                  <span class="chip-unread-badge" id="chipBadge_supervision" style="display: none;">0</span>
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Liste scrollable des conversations -->
          <div class="whatsapp-chat-list" id="whatsappChatList">
            <div style="text-align: center; padding: 2rem; color: var(--gray-400);">Chargement...</div>
          </div>
        </aside>

        <!-- 2. VOLET DROIT : FENÊTRE DE CHAT ACTIVE -->
        <main class="whatsapp-main" id="whatsappMain">
          <!-- En-tête de la discussion -->
          <div class="whatsapp-chat-header" id="whatsappChatHeader">
            <div class="chat-header-info">
              <button class="chat-back-btn" onclick="MessagesModule.showMobileList()" title="Retour aux discussions">
                ←
              </button>
              <div class="chat-item-avatar ${this.activeChat.avatarClass}" id="activeChatAvatar" style="width: 38px; height: 38px; font-size: 1.1rem;">
                ${this.activeChat.avatar}
              </div>
              <div>
                <div class="chat-header-title" id="activeChatTitle">${this.activeChat.title}</div>
                <div class="chat-header-subtitle" id="activeChatSub">${this.activeChat.subtitle}</div>
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <span id="activeChatBadge" class="badge badge-gray" style="font-size: 0.75rem;">Canal Actif</span>
            </div>
          </div>

          <!-- Zone des bulles de messages -->
          <div class="whatsapp-messages-body" id="whatsappMessagesBody">
            <div style="text-align: center; padding: 2rem; color: var(--gray-400);">Chargement de la discussion...</div>
          </div>

          <!-- Barre de saisie style WhatsApp en bas -->
          <div class="whatsapp-input-bar" id="whatsappInputBar">
            <button type="button" class="btn-urgent-toggle ${this.isUrgentActive ? 'active' : ''}" id="urgentToggleBtn" onclick="MessagesModule.toggleUrgent()" title="Marquer ce message comme alerte urgente">
              🚨 Urgent
            </button>

            <input type="text" class="whatsapp-input-field" id="chatInputField" placeholder="Tapez votre message... (Entrée pour envoyer)" autocomplete="off" onkeydown="MessagesModule.handleInputKeyDown(event)">

            <button type="button" class="btn-whatsapp-send" id="chatSendBtn" onclick="MessagesModule.sendMessage()" title="Envoyer le message">
              ➤
            </button>
          </div>
        </main>
      </div>
    `;

    // Charger les métadonnées (stands & utilisateurs) et les messages
    await this.loadMetadata();
    await this.loadMessages();

    const isViewingChat = (window.innerWidth > 768) || (this.mobileView === 'chat');
    if (this.activeChat && isViewingChat) {
      this.markConversationAsRead(this.getConversationKey(this.activeChat), false);
      this.renderChatList();
    }

    // Démarrer le polling automatique
    this.startPolling();
  },

  async loadMetadata() {
    const client = SupabaseClient.client;
    if (!client) return;

    try {
      // 1. Charger les stands
      const { data: stands } = await client.from('stands').select('id, name, color_name, number').order('name');
      this.stands = stands || [];

      // 2. Charger les utilisateurs pour les messages directs et la supervision
      const { data: users } = await client.from('app_users').select('id, login, full_name, is_original_superadmin, role:roles(id, code, name)').eq('is_active', true);
      this.allUsers = users || [];
      this.usersMap = new Map();
      (users || []).forEach(u => {
        if (u.id) this.usersMap.set(u.id, u);
        if (u.login) this.usersMap.set(u.login.toLowerCase(), u);
      });

      const currentUser = Auth.getCurrentUser();
      this.users = (users || []).filter(u => u.id !== currentUser?.id && u.login !== currentUser?.login);
    } catch (e) {
      console.warn('[MessagesModule] Erreur chargement metadata:', e);
    }
  },

  /**
   * Vérifie si un utilisateur ou login donné a le statut de SuperAdministrateur.
   * Utilisé pour la règle d'or d'anti-espionnage (aucun espionnage entre SuperAdmins).
   */
  isUserSuperAdmin(userOrLogin) {
    if (!userOrLogin) return false;
    let u = userOrLogin;
    if (typeof userOrLogin === 'string') {
      const login = userOrLogin.toLowerCase().trim();
      if (login === 'mounir') return true;
      if (this.usersMap && this.usersMap.has(login)) {
        u = this.usersMap.get(login);
      } else {
        const cur = Auth.getCurrentUser();
        if (cur && cur.login && cur.login.toLowerCase().trim() === login) {
          u = cur;
        } else {
          return false;
        }
      }
    }
    if (!u) return false;
    if (u.is_original_superadmin === true) return true;
    const login = (u.login || '').toLowerCase().trim();
    if (login === 'mounir') return true;
    const roleCode = (u.role?.code || u.role_code || '').toLowerCase().trim();
    if (roleCode === 'superadmin') return true;
    const roleName = (u.role?.name || u.role_name || '').toLowerCase().trim();
    if (roleName.includes('superadmin') || roleName.includes('superadministrateur')) return true;
    return false;
  },

  async loadMessages(silent = false) {
    const client = SupabaseClient.client;
    let messages = [];

    if (navigator.onLine && client) {
      try {
        const { data, error } = await client
          .from('kermesse_messages')
          .select('*')
          .order('created_at', { ascending: true })
          .limit(150);

        if (error) {
          console.error('[MessagesModule] Erreur Supabase:', error);
        } else if (data) {
          messages = data;
          this.cachedMessages = data;
          try {
            localStorage.setItem('lc_cached_messages', JSON.stringify(data));
          } catch {}
        }
      } catch (err) {
        console.warn('[MessagesModule] Erreur chargement messages Supabase:', err);
      }
    }

    // Si hors-ligne ou erreur, charger le cache local
    if (messages.length === 0) {
      try {
        messages = JSON.parse(localStorage.getItem('lc_cached_messages') || '[]');
      } catch {
        messages = [];
      }
    }

    // Fusionner la file d'attente hors-ligne
    const offlineQueue = OfflineManager.getQueue().filter(q => q.table === 'kermesse_messages');
    offlineQueue.forEach(q => {
      messages.push({
        ...q.payload,
        id: q.id,
        created_at: q.timestamp,
        is_pending_offline: true
      });
    });

    this.cachedMessages = messages;

    // Rendre la liste des conversations et le fil actif
    this.renderChatList();
    this.renderActiveMessages();
    this.updateUnreadBadges();

    if (!silent) {
      this.scrollToBottom();
    }
  },

  // --- GESTION DES NOTIFICATIONS ET PASTILLES DE MESSAGES NON LUS (STYLE WHATSAPP / TELEGRAM) ---
  getReadStorageKey() {
    const user = Auth.getCurrentUser();
    const login = user?.login?.toLowerCase() || 'default';
    return `lc_kermesse_read_timestamps_${login}`;
  },

  getReadMap() {
    try {
      const raw = localStorage.getItem(this.getReadStorageKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  },

  isMine(m) {
    const user = Auth.getCurrentUser();
    if (!user) return false;
    if (m.sender_id && user.id && m.sender_id === user.id) return true;
    if (m.sender_login && user.login && m.sender_login.toLowerCase() === user.login.toLowerCase()) return true;
    return false;
  },

  getRecipientLogin(m) {
    if (m.recipient_login) return m.recipient_login;
    if (m.recipient_id && this.usersMap) {
      const u = this.usersMap.get(m.recipient_id);
      if (u && u.login) return u.login;
    }
    return '';
  },

  getMessageConversationKey(m) {
    if (m.is_urgent || m.channel_type === 'urgent') return 'urgent_urgent';
    if (m.stand_id) return `stand_${m.stand_id}`;
    if (m.channel_type === 'direct') {
      const currentUser = Auth.getCurrentUser();
      const sLogin = (m.sender_login || '').toLowerCase().trim();
      const rLogin = (this.getRecipientLogin(m) || '').toLowerCase().trim();
      const myLogin = (currentUser?.login || '').toLowerCase().trim();

      // Cas 1 : La discussion implique directement l'utilisateur connecté
      if (sLogin === myLogin || rLogin === myLogin) {
        const otherId = (m.sender_id === currentUser?.id) ? m.recipient_id : m.sender_id;
        const otherLogin = (sLogin === myLogin) ? rLogin : sLogin;
        return `direct_${otherId || otherLogin}`;
      }

      // Règle de protection absolue : AUCUN espionnage impliquant un SuperAdmin
      if (this.isUserSuperAdmin(sLogin) || this.isUserSuperAdmin(rLogin)) {
        return 'protected_superadmin_direct';
      }

      // Cas 2 : Discussion privée entre deux autres administrateurs (surveillée par SuperAdmin)
      if (sLogin && rLogin) {
        const pairKey = [sLogin, rLogin].sort().join('___');
        return `supervision_${pairKey}`;
      }
    }
    return 'broadcast_broadcast';
  },

  getConversationKey(c) {
    if (!c) return 'broadcast_broadcast';
    if (c.type === 'supervision') {
      return `supervision_${c.pairKey || c.id}`;
    }
    return `${c.type}_${c.id}`;
  },

  isMessageUnread(m, readMap, convKey) {
    if (this.isMine(m)) return false;

    const targetKey = convKey || this.getMessageConversationKey(m);
    const lastRead = readMap ? readMap[targetKey] : null;
    if (!lastRead) return true; // Jamais lu

    return new Date(m.created_at).getTime() > new Date(lastRead).getTime();
  },

  markConversationAsRead(convKey, triggerRender = true) {
    if (!convKey) return;
    const map = this.getReadMap();

    // Déterminer le timestamp le plus élevé parmi tous les messages existants
    // pour garantir que tout message présent est STRICTEMENT antérieur à la date de lecture
    let latestTime = Date.now();
    (this.cachedMessages || []).forEach(m => {
      if (m.created_at) {
        const t = new Date(m.created_at).getTime();
        if (t > latestTime) latestTime = t;
      }
    });

    map[convKey] = new Date(latestTime + 5000).toISOString();
    try {
      localStorage.setItem(this.getReadStorageKey(), JSON.stringify(map));
    } catch (e) {}

    this.updateUnreadBadges();
    if (triggerRender) {
      this.renderChatList();
    }
  },

  markAllAsRead() {
    const map = this.getReadMap();
    let latestTime = Date.now();
    const msgs = this.cachedMessages || [];
    msgs.forEach(m => {
      if (m.created_at) {
        const t = new Date(m.created_at).getTime();
        if (t > latestTime) latestTime = t;
      }
    });

    const nowIso = new Date(latestTime + 5000).toISOString();
    msgs.forEach(m => {
      const key = this.getMessageConversationKey(m);
      map[key] = nowIso;
    });
    map['broadcast_broadcast'] = nowIso;
    map['urgent_urgent'] = nowIso;
    this.stands.forEach(s => map[`stand_${s.id}`] = nowIso);
    this.users.forEach(u => map[`direct_${u.id}`] = nowIso);

    // Si SuperAdmin, marquer aussi toutes les conversations de supervision
    const chats = this.getConversationsList();
    chats.forEach(c => {
      map[this.getConversationKey(c)] = nowIso;
    });

    try {
      localStorage.setItem(this.getReadStorageKey(), JSON.stringify(map));
    } catch (e) {}

    this.updateUnreadBadges();
    this.renderChatList();
    Notify.success('Toutes les discussions ont été marquées comme lues.');
  },

  updateUnreadBadges() {
    const chats = this.getConversationsList();
    const currentUser = Auth.getCurrentUser();
    if (!currentUser) return;

    let totalUnread = 0;
    let urgentUnread = 0;
    let broadcastUnread = 0;
    let standUnread = 0;
    let directUnread = 0;
    let supervisionUnread = 0;

    chats.forEach(c => {
      const u = c.unreadCount || 0;
      totalUnread += u;
      if (c.type === 'broadcast') broadcastUnread += u;
      else if (c.type === 'urgent') urgentUnread += u;
      else if (c.type === 'stand') standUnread += u;
      else if (c.type === 'direct') directUnread += u;
      else if (c.type === 'supervision') supervisionUnread += u;
    });

    const formatBadgeText = (n) => (n > 99 ? '99+' : String(n));

    // 1. Badge sur l'icône Chat de la barre basse mobile (WhatsApp Style)
    const bottomNavBadge = document.getElementById('bottomNavMessagesBadge');
    if (bottomNavBadge) {
      if (totalUnread > 0) {
        bottomNavBadge.style.display = 'inline-flex';
        bottomNavBadge.textContent = formatBadgeText(totalUnread);
        if (urgentUnread > 0) bottomNavBadge.classList.add('urgent');
        else bottomNavBadge.classList.remove('urgent');
      } else {
        bottomNavBadge.style.display = 'none';
      }
    }

    // 2. Badge sur le bouton Messages du Header
    const headerBadge = document.getElementById('headerMessagesBadge');
    if (headerBadge) {
      if (totalUnread > 0) {
        headerBadge.style.display = 'inline-flex';
        headerBadge.textContent = formatBadgeText(totalUnread);
        if (urgentUnread > 0) headerBadge.classList.add('urgent');
        else headerBadge.classList.remove('urgent');
      } else {
        headerBadge.style.display = 'none';
      }
    }

    // 3. Badges dans la sidebar (icône et pilule de droite)
    const sidebarIconBadge = document.getElementById('sidebarMessagesIconBadge');
    const sidebarPillBadge = document.getElementById('messagesUnreadBadge');
    if (sidebarIconBadge) {
      if (totalUnread > 0) {
        sidebarIconBadge.style.display = 'inline-flex';
        sidebarIconBadge.textContent = formatBadgeText(totalUnread);
        if (urgentUnread > 0) sidebarIconBadge.classList.add('urgent');
        else sidebarIconBadge.classList.remove('urgent');
      } else {
        sidebarIconBadge.style.display = 'none';
      }
    }
    if (sidebarPillBadge) {
      if (totalUnread > 0) {
        sidebarPillBadge.style.display = 'inline-flex';
        sidebarPillBadge.textContent = formatBadgeText(totalUnread);
        sidebarPillBadge.className = urgentUnread > 0 ? 'chip-unread-badge urgent' : 'chip-unread-badge';
      } else {
        sidebarPillBadge.style.display = 'none';
      }
    }

    // 4. Pastilles sur les onglets de filtres (WhatsApp chips - comme dans la capture utilisateur)
    this.updateChipBadge('chipBadge_all', totalUnread);
    this.updateChipBadge('chipBadge_broadcast', broadcastUnread);
    this.updateChipBadge('chipBadge_urgent', urgentUnread, true);
    this.updateChipBadge('chipBadge_stand', standUnread);
    this.updateChipBadge('chipBadge_direct', directUnread);
    this.updateChipBadge('chipBadge_supervision', supervisionUnread);
  },

  updateChipBadge(id, count, isUrgent = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) {
      el.style.display = 'inline-flex';
      el.textContent = count > 99 ? '99+' : String(count);
      if (isUrgent) el.classList.add('urgent');
      else el.classList.remove('urgent');
    } else {
      el.style.display = 'none';
    }
  },

  renderChatList() {
    const container = document.getElementById('whatsappChatList');
    if (!container) return;

    const chats = this.getConversationsList();
    const q = this.searchQuery.toLowerCase().trim();

    const filtered = chats.filter(c => {
      const matchSearch = !q || c.title.toLowerCase().includes(q) || (c.lastSnippet && c.lastSnippet.toLowerCase().includes(q));
      let matchCat = true;
      if (this.filterCategory !== 'all') {
        matchCat = c.type === this.filterCategory;
      }
      return matchSearch && matchCat;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--gray-400); font-size: 0.88rem;">
          Aucune discussion trouvée.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(c => {
      const isActive = this.activeChat && this.activeChat.type === c.type && this.activeChat.id === c.id;

      return `
        <div class="whatsapp-chat-item ${isActive ? 'active' : ''}" onclick="MessagesModule.selectChat('${c.type}', '${c.id}')">
          <div class="chat-item-avatar ${c.avatarClass}" style="position: relative;">
            ${c.avatar}
            ${c.unreadCount > 0 ? `<span class="avatar-unread-dot"></span>` : ''}
          </div>
          <div class="chat-item-content">
            <div class="chat-item-header">
              <span class="chat-item-title">${c.title}</span>
              <span class="chat-item-time">${c.lastTime || ''}</span>
            </div>
            <div class="chat-item-sub">
              <span class="chat-item-snippet">${c.lastSnippet || 'Aucun message'}</span>
              ${c.unreadCount > 0 ? `
                <span class="chat-unread-badge ${c.urgentCount > 0 ? 'urgent' : ''}">
                  ${c.unreadCount > 99 ? '99+' : c.unreadCount}
                </span>
              ` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  getConversationsList() {
    const list = [];
    const msgs = this.cachedMessages || [];
    const readMap = this.getReadMap();

    // 1. 📢 Canal Général
    const broadcastMsgs = msgs.filter(m => !m.stand_id && !m.recipient_id);
    const lastBroadcast = broadcastMsgs[broadcastMsgs.length - 1];
    const unreadBroadcast = broadcastMsgs.filter(m => this.isMessageUnread(m, readMap, 'broadcast_broadcast')).length;
    list.push({
      type: 'broadcast',
      id: 'broadcast',
      title: '📢 Canal Général L&C',
      subtitle: 'Tous les membres et stands',
      avatar: '📢',
      avatarClass: 'broadcast',
      lastSnippet: lastBroadcast ? `${lastBroadcast.sender_login}: ${lastBroadcast.content}` : 'Discussion d\'équipe',
      lastTime: lastBroadcast ? this.formatTime(lastBroadcast.created_at) : '',
      urgentCount: 0,
      unreadCount: unreadBroadcast
    });

    // 2. 🚨 Canal Alertes & Urgences
    const urgentMsgs = msgs.filter(m => m.is_urgent || m.channel_type === 'urgent');
    const lastUrgent = urgentMsgs[urgentMsgs.length - 1];
    const unreadUrgent = urgentMsgs.filter(m => this.isMessageUnread(m, readMap, 'urgent_urgent')).length;
    list.push({
      type: 'urgent',
      id: 'urgent',
      title: '🚨 Alertes & Urgences',
      subtitle: 'Consignes prioritaires critiques',
      avatar: '🚨',
      avatarClass: 'urgent',
      lastSnippet: lastUrgent ? lastUrgent.content : 'Aucune alerte urgente en cours',
      lastTime: lastUrgent ? this.formatTime(lastUrgent.created_at) : '',
      urgentCount: urgentMsgs.length,
      unreadCount: unreadUrgent
    });

    // 3. 🎪 Stands
    this.stands.forEach(s => {
      const standMsgs = msgs.filter(m => m.stand_id === s.id);
      const lastStand = standMsgs[standMsgs.length - 1];
      const unreadStand = standMsgs.filter(m => this.isMessageUnread(m, readMap, 'stand_' + s.id)).length;
      list.push({
        type: 'stand',
        id: s.id,
        title: `🎪 ${s.name}`,
        subtitle: `Stand ${s.color_name || ''}`,
        avatar: '🎪',
        avatarClass: 'stand',
        lastSnippet: lastStand ? `${lastStand.sender_login}: ${lastStand.content}` : 'Équipe de stand',
        lastTime: lastStand ? this.formatTime(lastStand.created_at) : '',
        urgentCount: standMsgs.filter(m => m.is_urgent).length,
        unreadCount: unreadStand
      });
    });

    // 4. 👤 Directs (1-à-1)
    const currentUser = Auth.getCurrentUser();
    this.users.forEach(u => {
      const directMsgs = msgs.filter(m => 
        (m.channel_type === 'direct') &&
        ((m.sender_id === currentUser?.id && m.recipient_id === u.id) ||
         (m.sender_id === u.id && m.recipient_id === currentUser?.id) ||
         (m.sender_login?.toLowerCase() === u.login?.toLowerCase() && (m.recipient_id === currentUser?.id || m.recipient_login?.toLowerCase() === currentUser?.login?.toLowerCase())))
      );
      const lastDirect = directMsgs[directMsgs.length - 1];
      const unreadDirect = directMsgs.filter(m => this.isMessageUnread(m, readMap, 'direct_' + u.id)).length;
      list.push({
        type: 'direct',
        id: u.id,
        title: `👤 ${u.full_name || u.login}`,
        subtitle: u.role?.name || 'Administrateur',
        avatar: (u.login || 'U').charAt(0).toUpperCase(),
        avatarClass: 'direct',
        lastSnippet: lastDirect ? lastDirect.content : 'Démarrer une conversation...',
        lastTime: lastDirect ? this.formatTime(lastDirect.created_at) : '',
        urgentCount: 0,
        unreadCount: unreadDirect
      });
    });

    // 5. 👁️ Supervision Privés (Réservé exclusivement aux SuperAdministrateurs)
    const isSuperAdmin = currentUser && (currentUser.is_original_superadmin || currentUser.role_code === 'superadmin' || this.isUserSuperAdmin(currentUser));
    if (isSuperAdmin) {
      const pairMap = new Map();

      msgs.filter(m => m.channel_type === 'direct').forEach(m => {
        const sLogin = (m.sender_login || '').trim();
        let rLogin = '';
        if (m.recipient_id && this.usersMap) {
          const u = this.usersMap.get(m.recipient_id);
          if (u) rLogin = u.login;
        }
        if (!rLogin && m.recipient_login) rLogin = m.recipient_login;

        if (sLogin && rLogin && sLogin.toLowerCase() !== rLogin.toLowerCase()) {
          // RÈGLE ANTI-ESPIONNAGE STRICTE :
          // Aucun SuperAdministrateur ne peut espionner un autre SuperAdministrateur.
          // Si l'un des participants est SuperAdmin, la conversation est inviolable et exclue de la supervision.
          if (this.isUserSuperAdmin(sLogin) || this.isUserSuperAdmin(rLogin)) {
            return;
          }

          const isBetweenOthers = (sLogin.toLowerCase() !== currentUser?.login?.toLowerCase() && rLogin.toLowerCase() !== currentUser?.login?.toLowerCase());
          
          if (isBetweenOthers) {
            const pairKey = [sLogin.toLowerCase(), rLogin.toLowerCase()].sort().join('___');
            if (!pairMap.has(pairKey)) {
              const u1 = this.usersMap ? this.usersMap.get(sLogin.toLowerCase()) : null;
              const u2 = this.usersMap ? this.usersMap.get(rLogin.toLowerCase()) : null;
              pairMap.set(pairKey, {
                key: pairKey,
                user1Login: sLogin,
                user2Login: rLogin,
                user1Name: u1?.full_name || sLogin,
                user2Name: u2?.full_name || rLogin,
                messages: []
              });
            }
            pairMap.get(pairKey).messages.push(m);
          }
        }
      });

      pairMap.forEach((pair, key) => {
        const lastMsg = pair.messages[pair.messages.length - 1];
        const unreadSupervision = pair.messages.filter(m => this.isMessageUnread(m, readMap, 'supervision_' + key)).length;
        list.push({
          type: 'supervision',
          id: key,
          pairKey: key,
          user1Login: pair.user1Login,
          user2Login: pair.user2Login,
          user1Name: pair.user1Name,
          user2Name: pair.user2Name,
          title: `👁️ ${pair.user1Login} ↔ ${pair.user2Login}`,
          subtitle: `Supervision SuperAdmin • ${pair.messages.length} échange(s)`,
          avatar: '👁️',
          avatarClass: 'supervision',
          lastSnippet: lastMsg ? `${lastMsg.sender_login}: ${lastMsg.content}` : 'Échanges surveillés',
          lastTime: lastMsg ? this.formatTime(lastMsg.created_at) : '',
          urgentCount: 0,
          unreadCount: unreadSupervision
        });
      });

      list.push({
        type: 'supervision_selector',
        id: 'supervision_selector',
        title: '🔍 Inspecter un binôme d\'admins',
        subtitle: 'Choisir 2 administrateurs à surveiller',
        avatar: '🔍',
        avatarClass: 'supervision',
        lastSnippet: 'Surveillance proactive entre 2 admins',
        lastTime: '',
        urgentCount: 0,
        unreadCount: 0
      });
    }

    return list;
  },

  selectChat(type, id) {
    const chats = this.getConversationsList();
    const found = chats.find(c => c.type === type && c.id === id);
    if (found) {
      this.activeChat = found;
    }

    // Marquer immédiatement la discussion sélectionnée comme lue
    this.markConversationAsRead(this.getConversationKey(this.activeChat), false);

    // Sur mobile : basculer en vue conversation pleine largeur (comme WhatsApp)
    this.mobileView = 'chat';
    const container = document.getElementById('whatsappContainer');
    if (container) {
      container.classList.remove('mobile-show-list');
      container.classList.add('mobile-show-chat');
    }
    if (window.innerWidth <= 992) {
      document.body.classList.add('in-chat-view');
    }

    // Mettre à jour l'en-tête de chat
    const headerTitle = document.getElementById('activeChatTitle');
    const headerSub = document.getElementById('activeChatSub');
    const headerAvatar = document.getElementById('activeChatAvatar');
    const headerBadge = document.getElementById('activeChatBadge');

    if (headerTitle) headerTitle.textContent = this.activeChat.title;
    if (headerSub) headerSub.textContent = this.activeChat.subtitle;
    if (headerAvatar) {
      headerAvatar.textContent = this.activeChat.avatar;
      headerAvatar.className = `chat-item-avatar ${this.activeChat.avatarClass}`;
    }
    if (headerBadge) {
      if (this.activeChat.type === 'urgent') {
        headerBadge.className = 'badge badge-danger';
        headerBadge.textContent = 'Canal Urgence';
      } else if (this.activeChat.type === 'stand') {
        headerBadge.className = 'badge badge-primary';
        headerBadge.textContent = 'Canal Stand';
      } else if (this.activeChat.type === 'direct') {
        headerBadge.className = 'badge badge-success';
        headerBadge.textContent = 'Message Privé';
      } else if (this.activeChat.type === 'supervision') {
        headerBadge.className = 'badge badge-warning';
        headerBadge.textContent = '👁️ Surveillance SuperAdmin';
      } else if (this.activeChat.type === 'supervision_selector') {
        headerBadge.className = 'badge badge-warning';
        headerBadge.textContent = '🔎 Sélecteur de Surveillance';
      } else {
        headerBadge.className = 'badge badge-gray';
        headerBadge.textContent = 'Canal Général';
      }
    }

    this.renderChatList();
    this.renderActiveMessages();
    this.updateInputBar();
    this.scrollToBottom();
    this.updateUnreadBadges();

    // Focus sur le champ de texte
    if (this.activeChat.type !== 'supervision' && this.activeChat.type !== 'supervision_selector') {
      setTimeout(() => {
        const input = document.getElementById('chatInputField');
        if (input && window.innerWidth > 768) input.focus();
      }, 150);
    }
  },

  updateInputBar() {
    const inputBar = document.getElementById('whatsappInputBar');
    if (!inputBar) return;

    if (this.activeChat.type === 'supervision') {
      inputBar.innerHTML = `
        <div class="supervision-input-notice">
          👁️ <strong>Mode Surveillance SuperAdmin</strong> (Lecture transparente des échanges privés). Pour transmettre une directive officielle, utilisez le Canal Général ou une Alerte Urgente.
        </div>
      `;
    } else if (this.activeChat.type === 'supervision_selector') {
      inputBar.innerHTML = `
        <div class="supervision-input-notice">
          🔎 Sélectionnez deux administrateurs ci-dessus pour lancer la surveillance.
        </div>
      `;
    } else {
      inputBar.innerHTML = `
        <button type="button" class="btn-urgent-toggle ${this.isUrgentActive ? 'active' : ''}" id="urgentToggleBtn" onclick="MessagesModule.toggleUrgent()" title="Marquer ce message comme alerte urgente">
          🚨 Urgent
        </button>

        <input type="text" class="whatsapp-input-field" id="chatInputField" placeholder="Tapez votre message... (Entrée pour envoyer)" autocomplete="off" onkeydown="MessagesModule.handleInputKeyDown(event)">

        <button type="button" class="btn-whatsapp-send" id="chatSendBtn" onclick="MessagesModule.sendMessage()" title="Envoyer le message">
          ➤
        </button>
      `;
    }
  },

  launchCustomSupervision() {
    const u1 = document.getElementById('supervisionUser1')?.value;
    const u2 = document.getElementById('supervisionUser2')?.value;

    if (!u1 || !u2) {
      Notify.warning('Veuillez sélectionner les deux administrateurs à surveiller.');
      return;
    }

    if (u1.toLowerCase() === u2.toLowerCase()) {
      Notify.warning('Veuillez sélectionner deux administrateurs distincts.');
      return;
    }

    // Règle d'or : Aucun espionnage impliquant un SuperAdministrateur
    if (this.isUserSuperAdmin(u1) || this.isUserSuperAdmin(u2)) {
      Notify.error('Action interdite : Les conversations impliquant un SuperAdministrateur sont protégées et confidentielles.');
      return;
    }

    const key = [u1.toLowerCase(), u2.toLowerCase()].sort().join('___');
    const u1Obj = this.usersMap ? this.usersMap.get(u1.toLowerCase()) : null;
    const u2Obj = this.usersMap ? this.usersMap.get(u2.toLowerCase()) : null;

    this.activeChat = {
      type: 'supervision',
      id: key,
      pairKey: key,
      user1Login: u1,
      user2Login: u2,
      user1Name: u1Obj?.full_name || u1,
      user2Name: u2Obj?.full_name || u2,
      title: `👁️ ${u1} ↔ ${u2}`,
      subtitle: `Supervision SuperAdmin`,
      avatar: '👁️',
      avatarClass: 'supervision'
    };

    this.selectChat('supervision', key);
  },

  showMobileList() {
    this.mobileView = 'list';
    const container = document.getElementById('whatsappContainer');
    if (container) {
      container.classList.remove('mobile-show-chat');
      container.classList.add('mobile-show-list');
    }
    document.body.classList.remove('in-chat-view');
    this.renderChatList();
    this.updateUnreadBadges();
  },

  renderActiveMessages() {
    const container = document.getElementById('whatsappMessagesBody');
    if (!container) return;

    const currentUser = Auth.getCurrentUser();
    const chat = this.activeChat;

    // 1. Vue Spéciale : Sélecteur d'inspection SuperAdmin
    if (chat.type === 'supervision_selector') {
      // Exclure tous les SuperAdmins de la sélection (aucun espionnage de SuperAdmin)
      const allAdmins = (this.allUsers || []).filter(u => u.login && !this.isUserSuperAdmin(u));
      container.innerHTML = `
        <div style="max-width: 540px; margin: 2rem auto; background: var(--white); border-radius: var(--radius-lg); padding: 2rem; box-shadow: var(--shadow-md); border: 1px solid #d8b4fe;">
          <div style="text-align: center; margin-bottom: 1.25rem;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔎</div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #581c87; margin-bottom: 0.35rem;">
              Surveillance Proactive des Échanges Privés
            </h3>
            <p style="font-size: 0.85rem; color: var(--gray-600);">
              En tant que SuperAdministrateur, sélectionnez deux administrateurs pour inspecter l'intégralité de leurs messages privés passés et en direct.
            </p>
          </div>

          <div style="background: #fdf2f8; border: 1px solid #fbcfe8; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.82rem; color: #9d174d; display: flex; align-items: center; gap: 0.65rem;">
            <span style="font-size: 1.3rem;">🛡️</span>
            <div>
              <strong>Protection de la Direction :</strong> Conformément aux règles de confidentialité, les comptes SuperAdministrateurs sont protégés et ne peuvent faire l'objet d'aucune surveillance ni espionnage entre SuperAdmins.
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="font-weight: 700; font-size: 0.85rem; color: var(--gray-700);">Premier Administrateur *</label>
            <select id="supervisionUser1" class="form-control" style="font-size: 0.92rem;">
              <option value="">-- Choisir un administrateur --</option>
              ${allAdmins.map(u => `<option value="${u.login}">${u.full_name || u.login} (@${u.login})</option>`).join('')}
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="font-weight: 700; font-size: 0.85rem; color: var(--gray-700);">Second Administrateur à surveiller *</label>
            <select id="supervisionUser2" class="form-control" style="font-size: 0.92rem;">
              <option value="">-- Choisir un administrateur --</option>
              ${allAdmins.map(u => `<option value="${u.login}">${u.full_name || u.login} (@${u.login})</option>`).join('')}
            </select>
          </div>

          <button class="btn btn-primary" style="width: 100%; padding: 0.8rem; font-weight: 700; background: #9333ea; border-color: #9333ea;" onclick="MessagesModule.launchCustomSupervision()">
            👁️ Inspecter leurs Échanges Privés
          </button>
        </div>
      `;
      return;
    }

    // 2. Vue Spéciale : Mode Supervision Active entre deux admins
    if (chat.type === 'supervision') {
      const u1 = (chat.user1Login || '').toLowerCase();
      const u2 = (chat.user2Login || '').toLowerCase();

      // Sécurité absolue : Blocage si l'un des deux participants est SuperAdmin
      if (this.isUserSuperAdmin(u1) || this.isUserSuperAdmin(u2)) {
        container.innerHTML = `
          <div style="max-width: 500px; margin: 3rem auto; text-align: center; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 2rem; color: #9f1239;">
            <div style="font-size: 2.5rem; margin-bottom: 0.75rem;">🛡️</div>
            <h3 style="font-size: 1.15rem; font-weight: 800; margin-bottom: 0.5rem; color: #881337;">Échanges Confidentiels Protégés</h3>
            <p style="font-size: 0.88rem; line-height: 1.5; color: #4c0519;">
              Cette conversation implique un <strong>SuperAdministrateur</strong>. Conformément aux directives de sécurité et de confidentialité, les conversations impliquant la Direction ne peuvent faire l'objet d'aucun espionnage ni d'aucune surveillance.
            </p>
          </div>
        `;
        return;
      }

      const filtered = (this.cachedMessages || []).filter(m => {
        if (m.channel_type !== 'direct') return false;
        const sender = (m.sender_login || '').toLowerCase();
        let recip = '';
        if (m.recipient_id && this.usersMap) {
          const u = this.usersMap.get(m.recipient_id);
          if (u) recip = (u.login || '').toLowerCase();
        }
        if (!recip && m.recipient_login) recip = m.recipient_login.toLowerCase();

        return (sender === u1 && recip === u2) || (sender === u2 && recip === u1);
      });

      if (filtered.length === 0) {
        container.innerHTML = `
          <div class="supervision-banner">
            <div style="font-size: 1.4rem;">👁️</div>
            <div>
              <strong>Supervision SuperAdmin Active :</strong> Surveillance des messages privés entre <strong>${chat.user1Login}</strong> et <strong>${chat.user2Login}</strong>.<br>
              <span style="font-size: 0.76rem; color: #7e22ce;">Aucun échange secret n'a été détecté entre ces deux administrateurs pour le moment. Tout nouveau message apparaîtra ici instantanément.</span>
            </div>
          </div>
          <div style="margin: auto; text-align: center; padding: 2.5rem 1rem; color: var(--gray-400);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👁️</div>
            <div style="font-weight: 700; color: var(--gray-700);">Fil privé vierge</div>
            <div style="font-size: 0.85rem; margin-top: 0.25rem;">Aucune conversation privée n'a encore eu lieu entre ${chat.user1Login} et ${chat.user2Login}.</div>
          </div>
        `;
        return;
      }

      let html = `
        <div class="supervision-banner">
          <div style="font-size: 1.4rem;">👁️</div>
          <div>
            <strong>Supervision SuperAdmin Active :</strong> Vous observez l'historique complet et transparent des messages privés entre <strong>${chat.user1Login}</strong> et <strong>${chat.user2Login}</strong>.<br>
            <span style="font-size: 0.76rem; color: #7e22ce;">Transparence totale garantie pour éviter tout accord occulte ou coup bas durant la kermesse.</span>
          </div>
        </div>
      `;

      let lastDate = '';
      filtered.forEach(m => {
        const dateStr = new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
        if (dateStr !== lastDate) {
          html += `<div class="date-divider">${dateStr}</div>`;
          lastDate = dateStr;
        }

        const senderLogin = (m.sender_login || '').toLowerCase();
        const isUser1 = senderLogin === u1;
        const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        html += `
          <div class="chat-bubble ${isUser1 ? 'bubble-supervision-1' : 'bubble-supervision-2'} ${m.is_urgent ? 'bubble-urgent' : ''}">
            <div class="bubble-sender" style="color: ${isUser1 ? '#15803d' : '#1d4ed8'};">
              <span>👤 ${m.sender_login}</span>
              <span style="font-size: 0.68rem; color: var(--gray-500); font-weight: normal;">(${m.sender_role || 'Admin'})</span>
            </div>
            ${m.title ? `<div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.2rem;">${m.title}</div>` : ''}
            <div class="bubble-text">${this.escapeHtml(m.content)}</div>
            <div class="bubble-meta">
              <span>${timeStr}</span>
              <span style="font-size: 0.72rem; color: #7e22ce;">👁️ Vu SuperAdmin</span>
            </div>
          </div>
        `;
      });

      container.innerHTML = html;
      return;
    }

    // 3. Cas classique : Broadcast, Stand, Urgent, Direct standard
    const filtered = (this.cachedMessages || []).filter(m => {
      if (chat.type === 'broadcast') {
        return !m.stand_id && !m.recipient_id;
      }
      if (chat.type === 'urgent') {
        return m.is_urgent || m.channel_type === 'urgent';
      }
      if (chat.type === 'stand') {
        return m.stand_id === chat.id;
      }
      if (chat.type === 'direct') {
        return m.channel_type === 'direct' && 
          ((m.sender_id === currentUser?.id && m.recipient_id === chat.id) ||
           (m.sender_id === chat.id && m.recipient_id === currentUser?.id) ||
           (m.sender_login === currentUser?.login && m.recipient_id === chat.id));
      }
      return false;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="margin: auto; text-align: center; padding: 2rem; color: var(--gray-400);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">${chat.avatar}</div>
          <div style="font-weight: 700; color: var(--gray-700);">${chat.title}</div>
          <div style="font-size: 0.85rem; margin-top: 0.25rem;">Aucun message pour l'instant. Envoyez la première consigne !</div>
        </div>
      `;
      return;
    }

    let html = '';
    let lastDate = '';

    filtered.forEach(m => {
      const dateStr = new Date(m.created_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      if (dateStr !== lastDate) {
        html += `<div class="date-divider">${dateStr}</div>`;
        lastDate = dateStr;
      }

      const isMe = (currentUser && (
        (m.sender_id && currentUser.id && m.sender_id === currentUser.id) ||
        (m.sender_login && currentUser.login && m.sender_login.toLowerCase() === currentUser.login.toLowerCase())
      ));
      const isUrgent = m.is_urgent || m.channel_type === 'urgent';
      const isPending = m.is_pending_offline;
      const timeStr = new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

      html += `
        <div class="chat-bubble ${isMe ? 'bubble-out' : 'bubble-in'} ${isUrgent ? 'bubble-urgent' : ''}">
          ${!isMe ? `
            <div class="bubble-sender">
              <span>${m.sender_login}</span>
              <span style="font-size: 0.68rem; color: var(--gray-400); font-weight: normal;">(${m.sender_role || 'Membre'})</span>
            </div>
          ` : ''}

          ${isUrgent ? `
            <div class="bubble-title">🚨 ALERTE URGENTE ${m.title ? '— ' + m.title : ''}</div>
          ` : (m.title ? `<div style="font-weight: 700; font-size: 0.88rem; margin-bottom: 0.2rem;">${m.title}</div>` : '')}

          <div class="bubble-text">${this.escapeHtml(m.content)}</div>

          <div class="bubble-meta">
            <span>${timeStr}</span>
            ${isMe ? `
              <span class="bubble-check ${isPending ? 'pending' : ''}">
                ${isPending ? '🕒' : '✓✓'}
              </span>
            ` : ''}
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  async sendMessage() {
    if (this.activeChat.type === 'supervision' || this.activeChat.type === 'supervision_selector') {
      Notify.warning('Mode Surveillance SuperAdmin : cette discussion est en lecture seule pour surveillance. Pour diffuser une directive officielle, utilisez le Canal Général ou une Alerte Urgente.');
      return;
    }

    const input = document.getElementById('chatInputField');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const user = Auth.getCurrentUser();
    if (!user) {
      Notify.error('Session expirée, veuillez vous reconnecter.');
      return;
    }

    const isUrgent = this.isUrgentActive || this.activeChat.type === 'urgent';
    let channelType = this.activeChat.type;
    let standId = null;
    let recipientId = null;

    if (this.activeChat.type === 'stand') {
      standId = this.activeChat.id;
    } else if (this.activeChat.type === 'direct') {
      recipientId = this.activeChat.id;
    }

    // Résolution sécurisée du sender_id pour éviter tout conflit de clé étrangère
    let senderId = user.id;
    if (senderId === '00000000-0000-0000-0000-000000000001' || !senderId) {
      const client = SupabaseClient.client;
      if (client && navigator.onLine) {
        try {
          const { data: realUser } = await client
            .from('app_users')
            .select('id')
            .eq('login', user.login)
            .maybeSingle();
          if (realUser && realUser.id) {
            senderId = realUser.id;
            user.id = realUser.id;
            Auth.setCurrentUser(user);
          } else {
            senderId = null;
          }
        } catch {
          senderId = null;
        }
      } else {
        senderId = null;
      }
    }

    const payload = {
      sender_id: senderId,
      sender_login: user.login || 'Mounir',
      sender_role: user.role_name || user.role_code || 'SuperAdmin',
      channel_type: isUrgent ? 'urgent' : channelType,
      stand_id: standId,
      recipient_id: recipientId,
      title: isUrgent ? 'Alerte Urgente' : null,
      content,
      is_urgent: isUrgent
    };

    // Vider le champ de saisie immédiatement (UX réactive WhatsApp)
    input.value = '';
    this.isUrgentActive = false;
    const toggleBtn = document.getElementById('urgentToggleBtn');
    if (toggleBtn) toggleBtn.classList.remove('active');

    // 1. Ajout optimiste immédiat dans le fil pour affichage instantané
    const tempMsg = {
      ...payload,
      id: 'local_' + Date.now(),
      created_at: new Date().toISOString(),
      is_pending_offline: !navigator.onLine
    };
    this.cachedMessages.push(tempMsg);
    this.markConversationAsRead(this.getConversationKey(this.activeChat), false);
    this.renderChatList();
    this.renderActiveMessages();
    this.scrollToBottom();

    // 2. Sauvegarde avec fallback hors-ligne automatique
    const res = await OfflineManager.safeInsert('kermesse_messages', payload);

    if (res.success) {
      if (res.offline) {
        Notify.warning('📡 Message enregistré hors-ligne (sera transmis au retour du réseau).');
      }
      // Recharger silencieusement depuis Supabase
      await this.loadMessages(true);
      this.scrollToBottom();
    } else {
      Notify.error('Erreur d\'envoi: ' + (res.error?.message || 'Erreur réseau'));
      input.value = content; // Restituer le texte en cas d'erreur
    }
  },

  handleInputKeyDown(e) {
    // Touche Entrée (sans Shift) pour envoyer directement comme sur WhatsApp
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  },

  toggleUrgent() {
    this.isUrgentActive = !this.isUrgentActive;
    const btn = document.getElementById('urgentToggleBtn');
    if (btn) {
      btn.classList.toggle('active', this.isUrgentActive);
    }
  },

  handleSearch(query) {
    this.searchQuery = query;
    this.renderChatList();
  },

  setFilter(category) {
    this.filterCategory = category;
    document.querySelectorAll('.whatsapp-chip').forEach(c => {
      if (c.getAttribute('onclick')?.includes(`'${category}'`)) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
    this.renderChatList();
  },

  scrollToBottom() {
    setTimeout(() => {
      const container = document.getElementById('whatsappMessagesBody');
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }, 50);
  },

  formatTime(isoDate) {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  },

  escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  },

  async refreshAll() {
    await this.loadMetadata();
    await this.loadMessages();
    Notify.success('Discussions actualisées.');
  },

  async checkNewMessages() {
    if (!navigator.onLine) return;
    const client = SupabaseClient.client;
    if (!client) return;

    if (!this.stands || this.stands.length === 0 || !this.usersMap) {
      await this.loadMetadata();
    }

    try {
      const { data, error } = await client
        .from('kermesse_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(200);

      if (!error && data) {
        const prevCount = (this.cachedMessages || []).length;
        const hasNew = data.length > prevCount;
        this.cachedMessages = data;
        try {
          localStorage.setItem('lc_cached_messages', JSON.stringify(data));
        } catch {}

        // Si l'utilisateur consulte actuellement les messages :
        if (typeof App !== 'undefined' && App.currentModule === 'messages' && this.activeChat) {
          const isViewingChat = (window.innerWidth > 768) || (this.mobileView === 'chat');
          if (isViewingChat) {
            const currentKey = this.getConversationKey(this.activeChat);
            this.markConversationAsRead(currentKey, false);
          }
          this.renderChatList();
          this.renderActiveMessages();
          if (hasNew && isViewingChat) {
            this.scrollToBottom();
          }
        }

        // Mettre à jour toutes les pastilles/badges (Header, Bottom Nav, Sidebar, Chips)
        this.updateUnreadBadges();
      }
    } catch (e) {
      // Ignorer les micro-coupures réseau en tâche de fond
    }
  },

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    // Synchronisation immédiate des pastilles
    this.checkNewMessages();

    // Surveillance discrète continue toutes les 5 secondes (pastilles comme sur WhatsApp/Telegram)
    this.pollingInterval = setInterval(() => {
      this.checkNewMessages();
    }, 5000);
  }
};

window.MessagesModule = MessagesModule;
