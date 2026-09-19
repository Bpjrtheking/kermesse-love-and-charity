/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : RÔLES, PERMISSIONS & UTILISATEURS
 * 
 * Gestion des comptes administrateurs :
 * - Création de comptes avec Login + Mot de passe
 * - Attribution de rôles adaptés aux missions de la kermesse
 * - Protection absolue du compte SuperAdministrateur original Mounir
 */

const RolesModule = {
  async render(container) {
    const user = Auth.getCurrentUser();
    const canManage = user && (user.is_original_superadmin || user.role_code === 'superadmin');

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🛡️</span> Rôles & Comptes Utilisateurs
          </div>
          <div class="card-actions">
            ${canManage ? `
              <button class="btn btn-secondary btn-sm" onclick="RolesModule.openEditProfileModal()">
                <span>✏️</span> Modifier mes identifiants
              </button>
              <button class="btn btn-primary btn-sm" onclick="RolesModule.openCreateUserModal()">
                <span>➕</span> Nouvel Administrateur / SuperAdmin
              </button>
            ` : ''}
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner info" style="margin-bottom: 1.5rem;">
            <div>
              👑 <strong>Gestion des Accès :</strong> Vous pouvez créer des <strong>SuperAdministrateurs</strong> (accès total) ou des <strong>Administrateurs métier</strong>. Le compte original ne peut jamais être supprimé ni désactivé, mais vous pouvez modifier son login et son mot de passe librement.
            </div>
          </div>

          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--gray-800);">
            Comptes Administrateurs & Accès
          </h3>
          <div class="table-responsive" id="usersTableContainer">
            <div class="empty-state">
              <div class="empty-icon">👥</div>
              <div class="empty-title">Chargement des comptes...</div>
            </div>
          </div>

          <h3 style="font-size: 1rem; font-weight: 700; margin: 2rem 0 1rem 0; color: var(--gray-800);">
            Rôles Système Définis pour la Kermesse
          </h3>
          <div class="table-responsive" id="rolesTableContainer"></div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (!client) {
      this.renderLocalUsers();
      return;
    }

    try {
      const { data: users, error: uErr } = await client
        .from('app_users')
        .select(`
          id, login, full_name, is_active, must_change_password, is_original_superadmin, last_login, created_at,
          role:roles(id, code, name)
        `)
        .order('is_original_superadmin', { ascending: false });

      const { data: roles, error: rErr } = await client.from('roles').select('*').order('name', { ascending: true });

      if (uErr) throw uErr;
      this.renderUsersTable(users || []);
      this.renderRolesTable(roles || []);
    } catch (e) {
      console.error('[RolesModule Error]', e);
      this.renderLocalUsers();
    }
  },

  renderLocalUsers() {
    const currentUser = Auth.getCurrentUser();
    this.renderUsersTable([currentUser]);
  },

  renderUsersTable(users) {
    const container = document.getElementById('usersTableContainer');
    const currentUser = Auth.getCurrentUser();
    const isSuperAdmin = currentUser && (currentUser.is_original_superadmin || currentUser.role_code === 'superadmin');

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Login</th>
            <th>Nom Complet</th>
            <th>Rôle Kermesse</th>
            <th>Statut</th>
            <th>Sécurité</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isOrig = Boolean(u.is_original_superadmin || u.login === 'Mounir');
            const roleCode = u.role ? u.role.code : (u.role_code || '');
            const isTargetSuperAdmin = isOrig || roleCode === 'superadmin';
            const isCurrentOriginal = Boolean(currentUser?.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir');
            const isSelf = Boolean(currentUser && (currentUser.id === u.id || currentUser.login.toLowerCase() === u.login.toLowerCase()));

            // Règles strictes demandées :
            // 1. Le compte original Mounir ne peut jamais être désactivé ou supprimé
            // 2. Aucun utilisateur ne peut supprimer ou désactiver son propre compte actif
            // 3. Un SuperAdmin ne peut pas supprimer ou désactiver un autre SuperAdmin : seul le SuperAdmin Originel le peut
            // 4. Pour les admins métiers / bénévoles : TOUS les SuperAdmins peuvent les désactiver ou les supprimer
            let canDeleteOrDeactivate = false;

            if (isOrig || isSelf) {
              canDeleteOrDeactivate = false;
            } else if (isTargetSuperAdmin) {
              canDeleteOrDeactivate = isCurrentOriginal;
            } else {
              canDeleteOrDeactivate = isSuperAdmin;
            }

            return `
              <tr>
                <td>
                  <strong>${u.login}</strong>
                  ${isOrig ? '<span class="badge badge-primary" style="margin-left: 0.5rem;">👑 Original</span>' : ''}
                </td>
                <td>${u.full_name || '-'}</td>
                <td>
                  <span class="badge ${isTargetSuperAdmin ? 'badge-primary' : 'badge-gray'}">
                    ${u.role ? u.role.name : (u.role_name || (isTargetSuperAdmin ? 'SuperAdministrateur' : 'Non défini'))}
                  </span>
                </td>
                <td>
                  ${u.is_active ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-danger">Désactivé</span>'}
                </td>
                <td>
                  <span class="badge badge-success">Défini par SuperAdmin</span>
                </td>
                <td style="text-align: right;">
                  ${isSuperAdmin ? `
                    <button class="btn-icon" onclick="RolesModule.openResetUserCredentialsModal('${u.id}', '${(u.login || '').replace(/'/g, "\\'")}', '${(u.full_name || '').replace(/'/g, "\\'")}', '${roleCode}', ${Boolean(isOrig)})" title="Modifier identifiants / Mot de passe">
                      🔑
                    </button>
                  ` : ''}

                  ${canDeleteOrDeactivate ? `
                    <button class="btn-icon danger" onclick="RolesModule.toggleUserStatus('${u.id}', ${!u.is_active}, '${(u.login || '').replace(/'/g, "\\'")}', '${roleCode}')" title="${u.is_active ? 'Désactiver' : 'Activer'}">
                      ${u.is_active ? '🚫' : '✅'}
                    </button>
                    <button class="btn-icon danger" onclick="RolesModule.deleteUser('${u.id}', '${(u.login || '').replace(/'/g, "\\'")}', '${roleCode}')" title="Supprimer">🗑️</button>
                  ` : (isOrig ? `
                    <span style="font-size: 0.72rem; color: var(--primary); font-weight: 700; margin-left: 0.25rem;">👑 Intouchable</span>
                  ` : (isSelf ? `
                    <span style="font-size: 0.75rem; color: var(--gray-400); font-style: italic; margin-left: 0.25rem;">Mon compte</span>
                  ` : (isTargetSuperAdmin && !isCurrentOriginal ? `
                    <span style="font-size: 0.72rem; color: #7e22ce; font-style: italic; margin-left: 0.25rem;" title="Seul le SuperAdmin Originel peut supprimer ou désactiver un SuperAdmin">🛡️ Réservé Originel</span>
                  ` : '-')))}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  renderRolesTable(roles) {
    const container = document.getElementById('rolesTableContainer');
    if (!container) return;

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Nom du Rôle</th>
            <th>Description & Missions</th>
            <th>Périmètre de Visibilité</th>
          </tr>
        </thead>
        <tbody>
          ${roles.map(r => `
            <tr>
              <td><code>${r.code}</code></td>
              <td><strong>${r.name}</strong></td>
              <td>${r.description || '-'}</td>
              <td>
                <span class="badge ${r.code === 'superadmin' ? 'badge-primary' : 'badge-gray'}">
                  ${r.code === 'superadmin' ? 'Vision Totale' : 'Interface Métier Spécifique'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  DEFAULT_ROLES: [
    { code: 'superadmin', name: '👑 SuperAdministrateur — Coordination Générale', description: 'Accès global, supervision des 9 pôles, gestion des comptes et finances' },
    { code: 'admin_communication', name: '📢 Administrateur — Communication & Affichage (Pôle 1)', description: 'Affiches, flyers, réseaux sociaux, WhatsApp, signalétique, plan kermesse' },
    { code: 'admin_finances', name: '🎟️ Administrateur — Billetterie & Caisses (Pôle 2)', description: 'Tickets entrée/jeux/lots/préventes, séries, caisses centrale & stands, écarts' },
    { code: 'admin_decoration', name: '🎨 Administrateur — Décoration & Organisation (Pôle 3)', description: 'Ambiance festive, matériel déco, aménagement des 10 zones et plan d\'implantation' },
    { code: 'admin_restauration', name: '🍔 Administrateur — Restauration & Buvette (Pôle 4)', description: 'Stocks denrées & boissons, cuisine, emballages, hygiène, ventes buvette et pertes' },
    { code: 'admin_stands', name: '🎪 Administrateur — Stands & Jeux (Pôle 5)', description: 'Gestion des stands (Couleur+N°), catalogue jeux, règles, prix tickets, équipes stands' },
    { code: 'admin_lots', name: '🎁 Administrateur — Lots & Cadeaux (Pôle 6)', description: 'Catalogue des lots (achats & dons), 4 catégories, dotations stands et distributions' },
    { code: 'admin_benevoles', name: '👥 Administrateur — Bénévoles & Planning (Pôle 7)', description: 'Fiches bénévoles, contacts WhatsApp, planning créneaux et anti-conflits' },
    { code: 'admin_logistique', name: '📦 Administrateur — Logistique & Installation (Pôle 8)', description: 'Matériel lourd (tentes, tables, sono, électricité), chaîne de prêt et checklists' },
    { code: 'admin_securite', name: '🛡️ Administrateur — Accueil, Nettoyage & Sécurité (Pôle 9)', description: 'Accueil, objets trouvés, rondes sanitaires, urgences et registre incidents' }
  ],

  async openCreateUserModal() {
    const client = SupabaseClient.client;
    let roles = [];

    if (client) {
      const { data } = await client.from('roles').select('id, code, name, description').order('name');
      roles = data && data.length > 0 ? data : this.DEFAULT_ROLES;
    } else {
      roles = this.DEFAULT_ROLES;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Créer un Compte Administrateur</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createUserForm">
            <div class="form-row">
              <div class="form-group">
                <label>Login unique *</label>
                <input type="text" id="uLogin" class="form-control" required placeholder="Ex: Mamadou, Fatou...">
                <div class="form-hint">Sera utilisé pour la connexion (sans email)</div>
              </div>
              <div class="form-group">
                <label>Nom complet *</label>
                <input type="text" id="uFullName" class="form-control" required placeholder="Ex: Mamadou Sy">
              </div>
            </div>

            <div class="form-group">
              <label>Rôle / Niveau d'Accès *</label>
              <select id="uRole" class="form-control" required>
                <option value="superadmin">👑 SuperAdministrateur (Accès Global Total)</option>
                ${roles.filter(r => r.code !== 'superadmin').map(r => `<option value="${r.code}">${r.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Mot de passe initial *</label>
              <input type="text" id="uPassword" class="form-control" required value="Kermesse#2026!">
              <div class="form-hint">L'administrateur pourra se connecter directement avec ces identifiants sans obligation de changer son mot de passe. Seul le SuperAdministrateur peut modifier son mot de passe.</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveUserBtn">Créer l'utilisateur</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveUserBtn').onclick = async () => {
      const login = document.getElementById('uLogin').value.trim();
      const fullName = document.getElementById('uFullName').value.trim();
      const roleCode = document.getElementById('uRole').value;
      const password = document.getElementById('uPassword').value;

      if (!login || !fullName || !password) {
        Notify.error('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        // Appeler la RPC PostgreSQL sécurisée
        const { data, error } = await client.rpc('admin_create_app_user', {
          p_login: login,
          p_password: password,
          p_full_name: fullName,
          p_role_code: roleCode,
          p_creator_login: Auth.getCurrentUser()?.login || 'Mounir'
        });

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        if (data && !data.success) {
          Notify.error(data.message);
          return;
        }

        Notify.success(`Compte ${login} créé avec succès. L'administrateur peut se connecter immédiatement sans devoir changer son mot de passe.`);
        close();
        RolesModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async toggleUserStatus(id, newStatus, login, targetRoleCode) {
    const currentUser = Auth.getCurrentUser();
    const isCurrentOriginal = Boolean(currentUser?.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir');
    const isCurrentSuperAdmin = Boolean(currentUser && (currentUser.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir' || currentUser.role_code === 'superadmin'));

    if (login === 'Mounir') {
      Notify.error('Action interdite : Le compte SuperAdministrateur original Mounir ne peut pas être désactivé.');
      return;
    }

    if (currentUser && (currentUser.id === id || currentUser.login?.toLowerCase() === login?.toLowerCase())) {
      Notify.error('Action impossible : vous ne pouvez pas désactiver votre propre compte actif.');
      return;
    }

    const isTargetSuperAdmin = (targetRoleCode === 'superadmin');
    if (isTargetSuperAdmin && !isCurrentOriginal) {
      Notify.error('Action interdite : seul le SuperAdministrateur Originel est autorisé à désactiver un compte SuperAdministrateur.');
      return;
    }

    if (!isCurrentSuperAdmin) {
      Notify.error('Action non autorisée. Réservé aux SuperAdministrateurs.');
      return;
    }

    const client = SupabaseClient.client;
    if (client) {
      const { error } = await client.from('app_users').update({ is_active: newStatus }).eq('id', id);
      if (error) {
        Notify.error('Erreur: ' + error.message);
        return;
      }
      AuditLogger.log('STATUT_UTILISATEUR', 'user', id, `${newStatus ? 'Activation' : 'Désactivation'} du compte ${login}`);
      Notify.success(`Statut du compte ${login} mis à jour.`);
      RolesModule.render(document.getElementById('mainContent'));
    }
  },

  deleteUser(id, login, targetRoleCode) {
    const currentUser = Auth.getCurrentUser();
    const isCurrentOriginal = Boolean(currentUser?.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir');
    const isCurrentSuperAdmin = Boolean(currentUser && (currentUser.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir' || currentUser.role_code === 'superadmin'));

    if (login === 'Mounir') {
      Notify.error('Action interdite : Le compte SuperAdministrateur original Mounir ne peut pas être supprimé.');
      return;
    }

    if (currentUser && (currentUser.id === id || currentUser.login?.toLowerCase() === login?.toLowerCase())) {
      Notify.error('Action impossible : vous ne pouvez pas supprimer votre propre compte actif.');
      return;
    }

    const isTargetSuperAdmin = (targetRoleCode === 'superadmin');
    if (isTargetSuperAdmin && !isCurrentOriginal) {
      Notify.error('Action interdite : seul le SuperAdministrateur Originel est habilité à supprimer un compte SuperAdministrateur.');
      return;
    }

    if (!isCurrentSuperAdmin) {
      Notify.error('Action non autorisée. Réservé aux SuperAdministrateurs.');
      return;
    }

    Notify.confirm(
      'Supprimer ce compte ?',
      `Confirmez-vous la suppression définitive du compte ${login} (${targetRoleCode === 'superadmin' ? '👑 SuperAdministrateur' : 'Administrateur'}) ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { error } = await client.from('app_users').delete().eq('id', id);
          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
          AuditLogger.log('SUPPRESSION_UTILISATEUR', 'user', id, `Suppression du compte ${login}`);
          Notify.success(`Compte ${login} supprimé.`);
          RolesModule.render(document.getElementById('mainContent'));
        }
      },
      'Supprimer',
      true
    );
  },

  async openResetUserCredentialsModal(userId, userLogin, userFullName, userRoleCode, isOrig) {
    const currentUser = Auth.getCurrentUser();
    const isSuperAdmin = currentUser && (currentUser.is_original_superadmin || currentUser.role_code === 'superadmin');
    if (!isSuperAdmin) {
      Notify.error('Action réservée exclusivement aux SuperAdministrateurs.');
      return;
    }

    const client = SupabaseClient.client;
    let roles = [];
    if (client) {
      const { data } = await client.from('roles').select('id, code, name').order('name');
      roles = data || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>🔑 Modifier les Identifiants : ${userLogin}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="resetCredentialsForm">
            <div class="alert-banner info" style="margin-bottom: 1.25rem;">
              <div>
                👑 <strong>SuperAdministration :</strong> Vous pouvez redéfinir le login, le rôle et le mot de passe de cet administrateur. Il pourra se connecter directement avec ces identifiants sans obligation de changer son mot de passe.
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Identifiant (Login) *</label>
                <input type="text" id="resetLogin" class="form-control" required value="${userLogin}">
                <div class="form-hint">Sera utilisé pour la connexion</div>
              </div>
              <div class="form-group">
                <label>Nom complet *</label>
                <input type="text" id="resetFullName" class="form-control" required value="${userFullName || ''}">
              </div>
            </div>

            <div class="form-group">
              <label>Rôle Kermesse *</label>
              <select id="resetRole" class="form-control" ${isOrig ? 'disabled' : ''}>
                <option value="superadmin" ${userRoleCode === 'superadmin' ? 'selected' : ''}>👑 SuperAdministrateur (Accès Global Total)</option>
                ${roles.filter(r => r.code !== 'superadmin').map(r => `
                  <option value="${r.code}" ${r.code === userRoleCode ? 'selected' : ''}>${r.name}</option>
                `).join('')}
              </select>
              ${isOrig ? '<div class="form-hint">Le rôle du SuperAdministrateur original est immuable.</div>' : ''}
            </div>

            <div class="form-group">
              <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
              <input type="text" id="resetPassword" class="form-control" placeholder="Entrez un nouveau mot de passe">
              <div class="form-hint">L'administrateur utilisera directement ce mot de passe sans être sollicité pour le changer.</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveCredentialsBtn">Enregistrer les Identifiants</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveCredentialsBtn').onclick = async () => {
      const newLogin = document.getElementById('resetLogin').value.trim();
      const newFullName = document.getElementById('resetFullName').value.trim();
      const newRoleCode = document.getElementById('resetRole').value;
      const newPassword = document.getElementById('resetPassword').value.trim();

      if (!newLogin) {
        Notify.error('Le login est obligatoire.');
        return;
      }

      if (newPassword && newPassword.length < 6) {
        Notify.error('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }

      const saveBtn = modal.querySelector('#saveCredentialsBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement...';

      try {
        if (client) {
          const { data, error } = await client.rpc('admin_reset_user_credentials', {
            p_target_user_id: userId,
            p_new_login: newLogin,
            p_new_password: newPassword || null,
            p_new_name: newFullName,
            p_new_role_code: isOrig ? null : newRoleCode,
            p_admin_login: currentUser?.login || 'SuperAdmin'
          });

          if (error) {
            console.warn('[RolesModule] RPC error, trying direct update fallback:', error);
            const updatePayload = {
              login: newLogin,
              full_name: newFullName,
              must_change_password: false,
              updated_at: new Date().toISOString()
            };
            if (!isOrig && roles.length > 0) {
              const matchedRole = roles.find(r => r.code === newRoleCode);
              if (matchedRole) updatePayload.role_id = matchedRole.id;
            }
            const { error: directErr } = await client.from('app_users').update(updatePayload).eq('id', userId);
            if (directErr) throw directErr;
            if (newPassword) {
              Notify.warning('Identifiants mis à jour. Pensez à exécuter le script SQL dans Supabase pour le hachage sécurisé du mot de passe.');
            }
          } else if (data && !data.success) {
            Notify.error(data.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les Identifiants';
            return;
          }
        }

        // Si le compte modifié est celui actuellement connecté, mettre à jour la session
        if (currentUser && (currentUser.id === userId || currentUser.login.toLowerCase() === userLogin.toLowerCase())) {
          currentUser.login = newLogin;
          currentUser.full_name = newFullName;
          if (newPassword) localStorage.setItem('lc_mounir_pwd', newPassword);
          Auth.setCurrentUser(currentUser);
          const nameEl = document.getElementById('headerUserName');
          const avatarEl = document.getElementById('headerUserAvatar');
          if (nameEl) nameEl.textContent = newFullName || newLogin;
          if (avatarEl) avatarEl.textContent = newLogin.charAt(0).toUpperCase();
        }

        Notify.success(`Identifiants de ${newLogin} enregistrés avec succès.`);
        close();
        RolesModule.render(document.getElementById('mainContent'));
      } catch (err) {
        Notify.error('Erreur: ' + (err.message || 'Impossible de mettre à jour.'));
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer les Identifiants';
      }
    };
  },

  openEditProfileModal() {
    const user = Auth.getCurrentUser();
    if (!user) {
      Notify.error('Aucun utilisateur connecté.');
      return;
    }

    const isSuperAdmin = user.is_original_superadmin || user.role_code === 'superadmin';
    if (!isSuperAdmin) {
      Notify.info(`Compte ${user.login} (${user.role_name || 'Admin'}). Seul le SuperAdministrateur est habilité à modifier vos identifiants ou mot de passe.`);
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>👤 Modifier mon Profil &amp; Identifiants</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editProfileForm">
            <div class="alert-banner info" style="margin-bottom: 1.25rem;">
              <div>
                Rôle actuel : <strong>${user.role_name || user.role_code || 'SuperAdministrateur'}</strong>
                ${user.is_original_superadmin ? ' (👑 SuperAdmin Original)' : ''}
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Identifiant de connexion (Login) *</label>
                <input type="text" id="profLogin" class="form-control" required value="${user.login || ''}" placeholder="Votre login">
                <div class="form-hint">Vous utiliserez ce login pour vous connecter.</div>
              </div>
              <div class="form-group">
                <label>Nom complet *</label>
                <input type="text" id="profFullName" class="form-control" required value="${user.full_name || ''}" placeholder="Ex: Mounir">
              </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--gray-200); margin: 1.5rem 0;">

            <h4 style="font-size: 0.95rem; font-weight: 700; color: var(--gray-800); margin-bottom: 0.75rem;">
              🔑 Modifier le mot de passe (laisser vide pour ne pas changer)
            </h4>

            <div class="form-group">
              <label>Ancien mot de passe</label>
              <input type="password" id="profOldPassword" class="form-control" placeholder="••••••••">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nouveau mot de passe</label>
                <input type="password" id="profNewPassword" class="form-control" placeholder="Min. 8 caractères">
              </div>
              <div class="form-group">
                <label>Confirmer nouveau mot de passe</label>
                <input type="password" id="profConfirmPassword" class="form-control" placeholder="Répétez le mot de passe">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveProfileBtn">Enregistrer les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveProfileBtn').onclick = async () => {
      const newLogin = document.getElementById('profLogin').value.trim();
      const newFullName = document.getElementById('profFullName').value.trim();
      const oldPassword = document.getElementById('profOldPassword').value;
      const newPassword = document.getElementById('profNewPassword').value;
      const confirmPassword = document.getElementById('profConfirmPassword').value;

      if (!newLogin || !newFullName) {
        Notify.error('Le login et le nom complet sont obligatoires.');
        return;
      }

      const saveBtn = modal.querySelector('#saveProfileBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement...';

      try {
        // 1. Mise à jour du profil (login et nom)
        if (newLogin !== user.login || newFullName !== user.full_name) {
          const profRes = await Auth.updateProfile(newLogin, newFullName);
          if (!profRes.success) {
            Notify.error('Erreur profil : ' + profRes.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les modifications';
            return;
          }
        }

        // 2. Mise à jour du mot de passe si renseigné
        if (newPassword || oldPassword) {
          if (!oldPassword) {
            Notify.error('Veuillez renseigner votre ancien mot de passe pour le modifier.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les modifications';
            return;
          }
          if (newPassword.length < 8) {
            Notify.error('Le nouveau mot de passe doit comporter au moins 8 caractères.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les modifications';
            return;
          }
          if (newPassword !== confirmPassword) {
            Notify.error('Les nouveaux mots de passe ne correspondent pas.');
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les modifications';
            return;
          }

          const pwdRes = await Auth.changePassword(oldPassword, newPassword, confirmPassword);
          if (!pwdRes.success) {
            Notify.error('Erreur mot de passe : ' + pwdRes.message);
            saveBtn.disabled = false;
            saveBtn.textContent = 'Enregistrer les modifications';
            return;
          }
        }

        // Mise à jour de l'affichage dans le header
        const updatedUser = Auth.getCurrentUser();
        if (updatedUser) {
          const nameEl = document.getElementById('headerUserName');
          const avatarEl = document.getElementById('headerUserAvatar');
          if (nameEl) nameEl.textContent = updatedUser.full_name || updatedUser.login;
          if (avatarEl) avatarEl.textContent = (updatedUser.login || 'U').charAt(0).toUpperCase();
        }

        Notify.success('Votre profil et vos identifiants ont été mis à jour avec succès !');
        close();

        // Rafraîchir la vue des rôles si affichée
        if (typeof App !== 'undefined' && App.currentModule === 'roles') {
          RolesModule.render(document.getElementById('mainContent'));
        }
      } catch (err) {
        Notify.error('Erreur inattendue : ' + err.message);
        saveBtn.disabled = false;
        saveBtn.textContent = 'Enregistrer les modifications';
      }
    };
  }
};

window.RolesModule = RolesModule;
