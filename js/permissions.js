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

    const perms = user.permissions || {};
    if (perms.all === true) return true;

    return Boolean(perms[permissionKey]);
  },

  // Vérifie l'accès à un module spécifique
  canAccessModule(moduleName) {
    const user = Auth.getCurrentUser();
    if (!user) return false;

    // SuperAdmin a accès à tous les modules
    if (user.is_original_superadmin || user.role_code === this.ROLES.SUPERADMIN) {
      return true;
    }

    // Modules universels accessibles à tous les administrateurs
    if (['dashboard', 'messages', 'tasks'].includes(moduleName)) {
      return true;
    }

    const role = user.role_code;

    switch (moduleName) {
      // Pôle 1 : Communication & Affichage
      case 'communication':
        return role === this.ROLES.ADMIN_COMMUNICATION || this.can(this.LIST.COMMUNICATION_MANAGE);

      // Pôle 2 : Billetterie, Tickets, Caisse & Comptabilité
      case 'tickets':
      case 'cash':
      case 'expenses':
      case 'closures':
        return role === this.ROLES.ADMIN_FINANCES || role === 'admin_billetterie' || this.can(this.LIST.CASH_MANAGE) || this.can(this.LIST.TICKETS_MANAGE);

      // Pôle 3 : Organisation & Décoration
      case 'decoration':
      case 'locations':
        return role === this.ROLES.ADMIN_DECORATION || role === 'admin_organisation' || this.can(this.LIST.DECORATION_MANAGE);

      // Pôle 4 : Restauration
      case 'stocks':
      case 'inventory':
        return role === this.ROLES.ADMIN_RESTAURATION || this.can(this.LIST.FOOD_MANAGE) || this.can(this.LIST.STOCKS_MANAGE);

      // Pôle 5 : Stands & Jeux
      case 'stands':
      case 'games':
        return role === this.ROLES.ADMIN_STANDS || role === this.ROLES.ADMIN_COMMUNICATION || this.can(this.LIST.STANDS_MANAGE);

      // Pôle 6 : Lots à gagner
      case 'gifts':
        return role === this.ROLES.ADMIN_LOTS || this.can(this.LIST.GIFTS_MANAGE);

      // Pôle 7 : Planning & Bénévoles
      case 'members':
      case 'teams':
      case 'planning':
        return role === this.ROLES.ADMIN_BENEVOLES || this.can(this.LIST.PLANNING_MANAGE) || this.can(this.LIST.USERS_MANAGE);

      // Pôle 8 : Logistique & Installation
      case 'materials':
      case 'loans':
      case 'movements':
      case 'returns':
        return role === this.ROLES.ADMIN_LOGISTIQUE || this.can(this.LIST.MATERIALS_MANAGE);

      // Pôle 9 : Accueil & Sécurité
      case 'security':
      case 'incidents':
        return role === this.ROLES.ADMIN_SECURITE || this.can(this.LIST.SECURITY_MANAGE) || this.can(this.LIST.INCIDENTS_MANAGE);

      // Supervision réservée au SuperAdmin
      case 'roles':
      case 'history':
      case 'reports':
      case 'settings':
        return user.is_original_superadmin || role === this.ROLES.SUPERADMIN;

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
          { module: 'stands', icon: '🎪', label: 'Stands' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
          { module: 'messages', icon: '💬', label: 'Chat', isChat: true }
        ];

      case 'admin_finances':
      case 'admin_billetterie':
        return [
          { module: 'dashboard', icon: '📊', label: 'Accueil' },
          { module: 'tickets', icon: '🎟️', label: 'Tickets' },
          { module: 'cash', icon: '💵', label: 'Caisses' },
          { module: 'closures', icon: '🔒', label: 'Clôtures' },
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
          { module: 'stocks', icon: '🍔', label: 'Stocks' },
          { module: 'inventory', icon: '📦', label: 'Inventaire' },
          { module: 'tasks', icon: '📋', label: 'Tâches' },
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
          { module: 'stands', icon: '🎪', label: 'Stands' },
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
          { module: 'stands', icon: '🎪', label: 'Stands' },
          { module: 'tickets', icon: '🎟️', label: 'Tickets' },
          { module: 'cash', icon: '💵', label: 'Caisses' },
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
