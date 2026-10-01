/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MATRICE DE RÔLES ET PERMISSIONS DYNAMIQUES SELON LES 9 PÔLES
 */

const Permissions = {
  // Codes rôles système officiels pour les 9 pôles + SuperAdmin
  ROLES: {
    SUPERADMIN: 'superadmin',
    ADMIN_COMMUNICATION: 'admin_communication',
    ADMIN_FINANCES: 'admin_finances',
    ADMIN_DECORATION: 'admin_decoration',
    ADMIN_RESTAURATION: 'admin_restauration',
    ADMIN_STANDS: 'admin_stands',
    ADMIN_LOTS: 'admin_lots',
    ADMIN_BENEVOLES: 'admin_benevoles',
    ADMIN_LOGISTIQUE: 'admin_logistique',
    ADMIN_SECURITE: 'admin_securite'
  },

  // Liste des permissions
  LIST: {
    USERS_MANAGE: 'users_manage',
    COMMUNICATION_MANAGE: 'communication_manage',
    STANDS_MANAGE: 'stands_manage',
    CASH_MANAGE: 'cash_manage',
    TICKETS_MANAGE: 'tickets_manage',
    TICKETS_SELL: 'tickets_sell',
    DECORATION_MANAGE: 'decoration_manage',
    FOOD_MANAGE: 'food_manage',
    STOCKS_MANAGE: 'stocks_manage',
    GIFTS_MANAGE: 'gifts_manage',
    PLANNING_MANAGE: 'planning_manage',
    MATERIALS_MANAGE: 'materials_manage',
    LOANS_MANAGE: 'loans_manage',
    RETURNS_MANAGE: 'returns_manage',
    SECURITY_MANAGE: 'security_manage',
    INCIDENTS_MANAGE: 'incidents_manage',
    CLEANING_MANAGE: 'cleaning_manage',
    FINANCES_VIEW: 'finances_view',
    CLOSURES_MANAGE: 'closures_manage',
    HISTORY_VIEW: 'history_view',
    REPORTS_VIEW: 'reports_view',
    SETTINGS_MANAGE: 'settings_manage'
  },

  // Vérifie si l'utilisateur actuellement connecté a une permission spécifique
  can(permissionKey) {
    const user = Auth.getCurrentUser();
    if (!user) return false;

    // Le SuperAdministrateur original ou tout compte superadmin a tous les droits
    if (user.is_original_superadmin || user.role_code === this.ROLES.SUPERADMIN) {
      return true;
    }

    const role = user.role_code;

    // Permissions strictes par pôle métier (aucune fuite entre pôles)
    switch (permissionKey) {
      case this.LIST.COMMUNICATION_MANAGE:
        return role === this.ROLES.ADMIN_COMMUNICATION;

      case this.LIST.TICKETS_MANAGE:
      case this.LIST.TICKETS_SELL:
      case this.LIST.CASH_MANAGE:
      case this.LIST.CLOSURES_MANAGE:
      case this.LIST.FINANCES_VIEW:
        return role === this.ROLES.ADMIN_FINANCES || role === 'admin_billetterie';

      case this.LIST.DECORATION_MANAGE:
        return role === this.ROLES.ADMIN_DECORATION || role === 'admin_organisation';

      case this.LIST.FOOD_MANAGE:
      case this.LIST.STOCKS_MANAGE:
        return role === this.ROLES.ADMIN_RESTAURATION;

      case this.LIST.STANDS_MANAGE:
        return role === this.ROLES.ADMIN_STANDS;

      case this.LIST.GIFTS_MANAGE:
        return role === this.ROLES.ADMIN_LOTS;

      case this.LIST.PLANNING_MANAGE:
      case this.LIST.USERS_MANAGE:
        return role === this.ROLES.ADMIN_BENEVOLES;

      case this.LIST.MATERIALS_MANAGE:
      case this.LIST.LOANS_MANAGE:
      case this.LIST.RETURNS_MANAGE:
        return role === this.ROLES.ADMIN_LOGISTIQUE;

      case this.LIST.SECURITY_MANAGE:
      case this.LIST.INCIDENTS_MANAGE:
      case this.LIST.CLEANING_MANAGE:
        return role === this.ROLES.ADMIN_SECURITE;

      default:
        const perms = user.permissions || {};
        if (perms.all === true) return true;
        return Boolean(perms[permissionKey]);
    }
  },

  // Métadonnées officielles des 9 Pôles
  POLES_CONFIG: [
    { num: 1, name: 'Communication & Affichage', icon: '📢', color: '#f97316', page: 'pole1-communication.html', role_default: 'admin_communication' },
    { num: 2, name: 'Billetterie & Caisses', icon: '🎟️', color: '#2563eb', page: 'pole2-caisses.html', role_default: 'admin_finances' },
    { num: 3, name: 'Organisation, Déco & Stade 3D', icon: '🎨', color: '#10b981', page: 'pole3-organisation.html', role_default: 'admin_decoration' },
    { num: 4, name: 'Restauration & Buvette', icon: '🍔', color: '#ea580c', page: 'pole4-restauration.html', role_default: 'admin_restauration' },
    { num: 5, name: 'Stands & Jeux', icon: '🎪', color: '#8b5cf6', page: 'pole5-stands.html', role_default: 'admin_stands' },
    { num: 6, name: 'Lots à gagner & Cadeaux', icon: '🎁', color: '#f59e0b', page: 'pole6-lots.html', role_default: 'admin_lots' },
    { num: 7, name: 'Bénévoles & Planning', icon: '👥', color: '#06b6d4', page: 'pole7-benevoles.html', role_default: 'admin_benevoles' },
    { num: 8, name: 'Logistique & Matériel', icon: '📦', color: '#4f46e5', page: 'pole8-materiel.html', role_default: 'admin_logistique' },
    { num: 9, name: 'Accueil, Secours & Sécurité', icon: '🛡️', color: '#e11d48', page: 'pole9-securite.html', role_default: 'admin_securite' }
  ],

  isSuperAdmin(user = Auth.getCurrentUser()) {
    if (!user) return false;
    return Boolean(user.is_original_superadmin || user.login?.toLowerCase() === 'mounir' || user.role_code === this.ROLES.SUPERADMIN || user.is_superadmin === true);
  },

  getCustomPolesMap() {
    try {
      const data = localStorage.getItem('lc_user_poles_map');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  getCustomTitlesMap() {
    try {
      const data = localStorage.getItem('lc_user_titles_map');
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  },

  // Obtient le titre ou rôle descriptif d'un utilisateur
  getUserTitle(user = Auth.getCurrentUser()) {
    if (!user) return 'Invité';
    if (this.isSuperAdmin(user)) return '👑 SuperAdministrateur';
    const titlesMap = this.getCustomTitlesMap();
    const custom = (user.id && titlesMap[user.id]) || (user.login && titlesMap[user.login.toLowerCase()]);
    if (custom) return custom;
    if (user.custom_title) return user.custom_title;
    if (user.role_name && user.role_name !== 'Non défini') return user.role_name;

    // Déduction selon les pôles autorisés si aucun titre personnalisé n'a été saisi
    const poles = this.getAllowedPoles(user);
    if (poles.length > 0) {
      const names = poles.filter(p => typeof p === 'number').map(p => `Pôle ${p}`);
      return `Admin ${names.join(', ')}`;
    }
    return user.role_code || 'Administrateur';
  },

  // Enregistre l'intitulé ou rôle descriptif personnalisé
  async setCustomTitle(userId, login, title) {
    if (!title && title !== '') return;
    const cleanTitle = (title || '').trim();
    const map = this.getCustomTitlesMap();
    if (userId) map[userId] = cleanTitle;
    if (login) map[login.toLowerCase()] = cleanTitle;
    localStorage.setItem('lc_user_titles_map', JSON.stringify(map));

    const currentUser = Auth.getCurrentUser();
    if (currentUser && (currentUser.id === userId || currentUser.login?.toLowerCase() === login?.toLowerCase())) {
      currentUser.custom_title = cleanTitle;
      currentUser.role_name = cleanTitle;
      Auth.setCurrentUser(currentUser);
    }

    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('activity_logs').insert([{
          action: 'UPDATE_USER_TITLE',
          entity_type: 'user',
          login: currentUser?.login || 'SuperAdmin',
          details: `Attribution de l'intitulé « ${cleanTitle} » à ${login}`,
          new_values: { userId, login, title: cleanTitle }
        }]);
      } catch (e) {}
    }
  },

  // Synchronisation des permissions de pôles et des intitulés descriptifs depuis Supabase (audit logs)
  async syncPolesFromCloud() {
    const client = SupabaseClient.client;
    if (!client) return;

    try {
      const { data, error } = await client
        .from('activity_logs')
        .select('action, new_values, created_at')
        .in('action', ['UPDATE_POLE_PERMISSIONS', 'UPDATE_USER_TITLE'])
        .order('created_at', { ascending: true });

      if (!error && data && data.length > 0) {
        const polesMap = this.getCustomPolesMap();
        const titlesMap = this.getCustomTitlesMap();

        data.forEach(log => {
          if (log.action === 'UPDATE_POLE_PERMISSIONS' && log.new_values && log.new_values.poles) {
            const { userId, login, poles } = log.new_values;
            if (userId) polesMap[userId] = poles;
            if (login) polesMap[login.toLowerCase()] = poles;
          } else if (log.action === 'UPDATE_USER_TITLE' && log.new_values && typeof log.new_values.title === 'string') {
            const { userId, login, title } = log.new_values;
            if (userId) titlesMap[userId] = title;
            if (login) titlesMap[login.toLowerCase()] = title;
          }
        });

        localStorage.setItem('lc_user_poles_map', JSON.stringify(polesMap));
        localStorage.setItem('lc_user_titles_map', JSON.stringify(titlesMap));
      }
    } catch (e) {
      console.warn('[Permissions Cloud Sync Warning]', e);
    }
  },

  // Renvoie la liste des numéros de pôles autorisés pour un utilisateur
  getAllowedPoles(user = Auth.getCurrentUser()) {
    if (!user) return [];

    // SuperAdmin a accès à tous les 9 pôles + supervision
    if (this.isSuperAdmin(user)) {
      return [1, 2, 3, 4, 5, 6, 7, 8, 9, 'supervision'];
    }

    // 1. Vérifier si des permissions personnalisées multi-pôles ont été enregistrées
    const map = this.getCustomPolesMap();
    const custom = (user.id && map[user.id]) || (user.login && map[user.login.toLowerCase()]);
    if (Array.isArray(custom) && custom.length > 0) {
      return custom.map(n => Number(n));
    }

    // 2. Si l'utilisateur a allowed_poles en session
    if (Array.isArray(user.allowed_poles) && user.allowed_poles.length > 0) {
      return user.allowed_poles.map(n => Number(n));
    }

    // 3. Rétro-compatibilité : Déduction automatique selon le rôle de création
    switch (user.role_code) {
      case this.ROLES.ADMIN_COMMUNICATION: return [1];
      case this.ROLES.ADMIN_FINANCES:
      case 'admin_billetterie': return [2];
      case this.ROLES.ADMIN_DECORATION:
      case 'admin_organisation': return [3];
      case this.ROLES.ADMIN_RESTAURATION: return [4];
      case this.ROLES.ADMIN_STANDS: return [5];
      case this.ROLES.ADMIN_LOTS: return [6];
      case this.ROLES.ADMIN_BENEVOLES: return [7];
      case this.ROLES.ADMIN_LOGISTIQUE: return [8];
      case this.ROLES.ADMIN_SECURITE: return [9];
      default: return [];
    }
  },

  // Vérifie si un utilisateur a le droit d'entrer dans un pôle spécifique (1 à 9)
  canAccessPole(poleNum, user = Auth.getCurrentUser()) {
    if (!user) return false;
    if (this.isSuperAdmin(user)) return true;
    if (poleNum === 'supervision') return false;

    const allowed = this.getAllowedPoles(user);
    const target = Number(poleNum);
    return allowed.includes(target);
  },

  // Enregistre les pôles autorisés pour un utilisateur (local + cloud Supabase)
  async setAllowedPoles(userId, login, polesArray) {
    const cleanPoles = polesArray.map(n => Number(n)).filter(n => n >= 1 && n <= 9);
    const map = this.getCustomPolesMap();
    if (userId) map[userId] = cleanPoles;
    if (login) map[login.toLowerCase()] = cleanPoles;
    localStorage.setItem('lc_user_poles_map', JSON.stringify(map));

    const currentUser = Auth.getCurrentUser();
    if (currentUser && (currentUser.id === userId || currentUser.login?.toLowerCase() === login?.toLowerCase())) {
      currentUser.allowed_poles = cleanPoles;
      Auth.setCurrentUser(currentUser);
    }

    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('activity_logs').insert([{
          action: 'UPDATE_POLE_PERMISSIONS',
          entity_type: 'user',
          entity_id: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || '')) ? userId : null,
          login: currentUser?.login || 'SuperAdmin',
          details: `Attribution des pôles [${cleanPoles.join(', ')}] à ${login}`,
          new_values: { userId, login, poles: cleanPoles }
        }]);
      } catch (e) {
        console.warn('[Set Allowed Poles DB Warning]', e);
      }
    }
    AuditLogger.log('ATTRIBUTION_POLES', 'user', userId, `Permissions de pôles modifiées pour ${login} : [${cleanPoles.join(', ')}]`);
  },

  // Vérifie l'accès à un module spécifique selon les pôles autorisés
  canAccessModule(moduleName) {
    const user = Auth.getCurrentUser();
    if (!user) return false;

    if (this.isSuperAdmin(user)) return true;

    // Modules universels (accessibles à tous les administrateurs)
    if (['messages', 'tasks'].includes(moduleName)) {
      return true;
    }

    switch (moduleName) {
      // Pôle 1 : Communication & Affichage
      case 'communication':
        return this.canAccessPole(1, user);

      // Pôle 2 : Billetterie, Tickets, Caisse & Comptabilité
      case 'caisse_entree':
      case 'caisse_jeux':
      case 'caisse_jetons':
      case 'caisse_bilan':
      case 'tickets':
      case 'cash':
      case 'expenses':
      case 'closures':
        return this.canAccessPole(2, user);

      // Pôle 3 : Organisation & Décoration
      case 'decoration':
      case 'locations':
        return this.canAccessPole(3, user);

      // Pôle 4 : Restauration
      case 'caisse_restauration':
      case 'stocks':
      case 'inventory':
        return this.canAccessPole(4, user);

      // Pôle 5 : Stands & Jeux
      case 'stands':
      case 'games':
        return this.canAccessPole(5, user);

      // Pôle 6 : Lots à gagner
      case 'gifts':
        return this.canAccessPole(6, user);

      // Pôle 7 : Planning & Bénévoles
      case 'members':
      case 'teams':
      case 'planning':
        return this.canAccessPole(7, user);

      // Pôle 8 : Logistique & Installation
      case 'materials':
      case 'loans':
      case 'movements':
      case 'returns':
        return this.canAccessPole(8, user);

      // Pôle 9 : Accueil & Sécurité
      case 'security':
      case 'incidents':
        return this.canAccessPole(9, user);

      // Supervision réservée au SuperAdmin
      case 'supervision':
      case 'dashboard':
      case 'roles':
      case 'history':
      case 'reports':
      case 'settings':
        return this.isSuperAdmin(user);

      default:
        return false;
    }
  },

  // Configuration de la barre de navigation basse (mobile) selon le rôle de l'utilisateur
  getBottomNavConfig(roleCode) {
    switch (roleCode) {
      case 'superadmin':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'cash', icon: '💵', label: 'Caisses' },
          { module: 'stands', icon: '🎪', label: 'Stands' },
          { module: 'roles', icon: '👑', label: 'Rôles' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_communication':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'communication', icon: '📢', label: 'Affichage' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_finances':
      case 'admin_billetterie':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'caisse_entree', icon: '🎟️', label: 'Entrée' },
          { module: 'caisse_jeux', icon: '🎯', label: 'Jeux' },
          { module: 'caisse_jetons', icon: '🪙', label: 'Jetons' },
          { module: 'caisse_bilan', icon: '📊', label: 'Bilan' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_decoration':
      case 'admin_organisation':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'decoration', icon: '🎨', label: 'Déco' },
          { module: 'locations', icon: '📍', label: 'Espaces' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_restauration':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'caisse_restauration', icon: '💰', label: 'Caisse' },
          { module: 'stocks', icon: '🍔', label: 'Stocks' },
          { module: 'inventory', icon: '📦', label: 'Pertes' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_stands':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'stands', icon: '🎪', label: 'Stands' },
          { module: 'games', icon: '🎯', label: 'Jeux' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_lots':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'gifts', icon: '🎁', label: 'Lots' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_benevoles':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'members', icon: '👥', label: 'Bénévoles' },
          { module: 'teams', icon: '🏷️', label: 'Équipes' },
          { module: 'tasks', icon: '📋', label: 'Planning' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_logistique':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'materials', icon: '📦', label: 'Matériel' },
          { module: 'loans', icon: '🤝', label: 'Prêts' },
          { module: 'movements', icon: '🔄', label: 'Flux' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_securite':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'security', icon: '🛡️', label: 'Sécurité' },
          { module: 'incidents', icon: '🚨', label: 'Incidents' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      default:
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];
    }
  },

  // Génère dynamiquement les boutons de la barre basse mobile adaptée au pôle de l'utilisateur
  renderBottomNav() {
    const nav = document.getElementById('mobileBottomNav');
    if (!nav) return;

    const user = Auth.getCurrentUser();
    const roleCode = user ? (user.is_original_superadmin ? 'superadmin' : (user.role_code || '')) : '';
    const items = this.getBottomNavConfig(roleCode);
    const currentMod = (window.App && window.App.currentModule) ? window.App.currentModule : (window.location.hash.replace('#', '') || 'dashboard');

    let html = '';
    items.forEach(it => {
      const isActive = it.module === currentMod ? ' active' : '';
      if (it.isChat) {
        html += `
        <button class="bottom-nav-item${isActive}" data-bottom-module="${it.module}" onclick="App.navigateTo('${it.module}')">
          <span class="bottom-nav-icon-wrapper">
            <span class="bottom-nav-icon">${it.icon}</span>
            <span id="bottomNavMessagesBadge" class="nav-unread-badge" style="display: none;">0</span>
          </span>
          <span class="bottom-nav-label">${it.label}</span>
        </button>`;
      } else {
        html += `
        <button class="bottom-nav-item${isActive}" data-bottom-module="${it.module}" onclick="App.navigateTo('${it.module}')">
          <span class="bottom-nav-icon">${it.icon}</span>
          <span class="bottom-nav-label">${it.label}</span>
        </button>`;
      }
    });

    // Le bouton Menu est toujours présent à droite pour ouvrir la sidebar complète
    html += `
      <button class="bottom-nav-item" onclick="App.toggleSidebar()">
        <span class="bottom-nav-icon">☰</span>
        <span class="bottom-nav-label">Menu</span>
      </button>
    `;

    nav.innerHTML = html;

    // Actualiser le badge chat s'il y a des messages non lus
    if (typeof MessagesModule !== 'undefined' && MessagesModule.updateUnreadCount) {
      try {
        MessagesModule.updateUnreadCount();
      } catch (e) {
        // Ignorer si en cours de chargement
      }
    }
  },

  // Filtre dynamiquement les éléments du menu selon le rôle de l'utilisateur connecté
  applyNavFiltering() {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const navItems = document.querySelectorAll('.nav-item[data-module]');
    const navGroups = document.querySelectorAll('.nav-group');

    navItems.forEach(item => {
      const mod = item.dataset.module;
      const allowed = this.canAccessModule(mod);
      item.style.display = allowed ? 'flex' : 'none';
    });

    // Masquer les groupes de navigation qui n'ont aucun enfant visible
    navGroups.forEach(group => {
      const visibleLinks = group.querySelectorAll('.nav-item:not([style*="display: none"])');
      group.style.display = visibleLinks.length > 0 ? 'block' : 'none';
    });

    // Adapter également la barre basse mobile au rôle de l'utilisateur
    this.renderBottomNav();
  }
};

window.Permissions = Permissions;
