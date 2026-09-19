/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MATRICE DE RÔLES ET PERMISSIONS DYNAMIQUES SELON LES 9 PÔLES
 */

const Permissions = {
  // Codes rôles système officiels
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
    if (['dashboard', 'messages'].includes(moduleName)) {
      return true;
    }

    const role = user.role_code;

    switch (moduleName) {
      // Pôle 1 : Communication & Affichage
      case 'communication':
        return role === this.ROLES.ADMIN_COMMUNICATION || this.can(this.LIST.COMMUNICATION_MANAGE);

      // Pôle 2 : Billetterie & Caisses
      case 'tickets':
      case 'cash':
      case 'expenses':
      case 'closures':
        return role === this.ROLES.ADMIN_FINANCES || this.can(this.LIST.CASH_MANAGE) || this.can(this.LIST.TICKETS_MANAGE);

      // Pôle 3 : Décoration & Organisation
      case 'decoration':
      case 'locations':
        return role === this.ROLES.ADMIN_DECORATION || this.can(this.LIST.DECORATION_MANAGE);

      // Pôle 4 : Restauration & Buvette
      case 'stocks':
        return role === this.ROLES.ADMIN_RESTAURATION || this.can(this.LIST.FOOD_MANAGE) || this.can(this.LIST.STOCKS_MANAGE);

      // Pôle 5 : Stands & Jeux
      case 'stands':
      case 'games':
        return role === this.ROLES.ADMIN_STANDS || role === this.ROLES.ADMIN_COMMUNICATION || this.can(this.LIST.STANDS_MANAGE);

      // Pôle 6 : Lots à gagner
      case 'gifts':
        return role === this.ROLES.ADMIN_LOTS || this.can(this.LIST.GIFTS_MANAGE);

      // Pôle 7 : Bénévoles & Planning
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

      // Pôle 9 : Accueil, Nettoyage & Sécurité
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
  }
};

window.Permissions = Permissions;
