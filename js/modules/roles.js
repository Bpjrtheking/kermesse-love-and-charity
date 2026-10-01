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
          <div class="alert-banner warning" style="margin-bottom: 1.5rem; border-left: 4px solid #ea580c; background: #fff7ed; color: #9a3412;">
            <div>
              <strong>⚠️ Règle Fondamentale de Traçabilité &amp; Responsabilité Personnelle :</strong>
              <div style="font-size: 0.88rem; margin-top: 0.35rem; line-height: 1.5;">
                Chaque administrateur est <strong>nominativement et personnellement responsable</strong> de toutes les opérations (encaissements, dépenses, saisies, validations) enregistrées sous son compte.
                <br><strong>Aucun compte ne doit être partagé ou prêté</strong> à un collègue. Chaque intervenant sur le terrain doit disposer de son propre identifiant individuel.
              </div>
            </div>
          </div>

          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 1rem; color: var(--gray-800);">
            Comptes Administrateurs &amp; Accès
          </h3>
          <div class="table-responsive" id="usersTableContainer">
            <div class="empty-state">
              <div class="empty-icon">👥</div>
              <div class="empty-title">Chargement des comptes...</div>
            </div>
          </div>

          <h3 style="font-size: 1rem; font-weight: 700; margin: 2rem 0 0.5rem 0; color: var(--gray-800);">
            Matrice des 9 Pôles d'Activité de la Kermesse (Permissions d'Accès)
          </h3>
          <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 1rem;">
            Il n'y a plus de rôles rigides imposés par liste déroulante : vous cochez librement les pôles autorisés pour chaque compte (1 ou plusieurs pôles), et vous lui donnez un intitulé descriptif personnalisé en guise de fonction.
          </p>
          <div class="table-responsive" id="polesMatrixContainer"></div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  usersList: [],

  async loadData() {
    // 1. Synchroniser les permissions et intitulés descriptifs personnalisés depuis le Cloud
    await Permissions.syncPolesFromCloud();

    const client = SupabaseClient.client;
    if (!client) {
      this.renderLocalUsers();
      this.renderPolesMatrix();
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

      if (uErr) throw uErr;
      this.usersList = users || [];
      this.renderUsersTable(this.usersList);
      this.renderPolesMatrix();
    } catch (e) {
      console.error('[RolesModule Error]', e);
      this.renderLocalUsers();
      this.renderPolesMatrix();
    }
  },

  renderLocalUsers() {
    const currentUser = Auth.getCurrentUser();
    this.usersList = [currentUser];
    this.renderUsersTable(this.usersList);
  },

  renderUsersTable(users) {
    const container = document.getElementById('usersTableContainer');
    const currentUser = Auth.getCurrentUser();
    const isSuperAdmin = Permissions.isSuperAdmin(currentUser);

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Login</th>
            <th>Nom Complet</th>
            <th>Fonction / Titre Descriptif</th>
            <th>Pôles d'Activité Autorisés</th>
            <th>Statut</th>
            <th>Traçabilité</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isOrig = Boolean(u.is_original_superadmin || u.login === 'Mounir');
            const roleCode = u.role ? u.role.code : (u.role_code || '');
            const isTargetSuperAdmin = isOrig || roleCode === 'superadmin' || Permissions.isSuperAdmin(u);
            const isCurrentOriginal = Boolean(currentUser?.is_original_superadmin || currentUser?.login?.toLowerCase() === 'mounir');
            const isSelf = Boolean(currentUser && (currentUser.id === u.id || currentUser.login.toLowerCase() === u.login.toLowerCase()));

            // Règles strictes :
            let canDeleteOrDeactivate = false;
            if (isOrig || isSelf) {
              canDeleteOrDeactivate = false;
            } else if (isTargetSuperAdmin) {
              canDeleteOrDeactivate = isCurrentOriginal;
            } else {
              canDeleteOrDeactivate = isSuperAdmin;
            }

            const allowedPoles = Permissions.getAllowedPoles(u);
            const userTitle = Permissions.getUserTitle(u);

            return `
              <tr>
                <td>
                  <strong>${u.login}</strong>
                  ${isOrig ? '<span class="badge badge-primary" style="margin-left: 0.5rem;">👑 Original</span>' : ''}
                </td>
                <td>${u.full_name || '-'}</td>
                <td>
                  <span class="badge ${isTargetSuperAdmin ? 'badge-primary' : 'badge-gray'}" style="font-size: 0.82rem; font-weight: 600;">
                    ${userTitle}
                  </span>
                </td>
                <td>
                  ${isTargetSuperAdmin ? `
                    <span class="badge badge-primary" style="font-size: 0.72rem;">👑 Tous les Pôles (1 à 9)</span>
                  ` : allowedPoles.length === 0 ? `
                    <span class="badge badge-danger" style="font-size: 0.72rem;">🔒 Aucun pôle</span>
                  ` : `
                    <div style="display: flex; flex-wrap: wrap; gap: 3px;">
                      ${allowedPoles.map(p => {
                        const cfg = Permissions.POLES_CONFIG.find(c => c.num === p);
                        return cfg ? `
                          <span class="pole-pill-badge" style="background: ${cfg.color}15; color: ${cfg.color}; border: 1px solid ${cfg.color}40;" title="${cfg.name}">
                            ${cfg.icon} P${p}
                          </span>
                        ` : '';
                      }).join('')}
                    </div>
                  `}
                </td>
                <td>
                  ${u.is_active ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-danger">Désactivé</span>'}
                </td>
                <td>
                  <span class="badge badge-success" title="Compte individuel : chaque action est signée nominativement" style="font-size: 0.72rem;">
                    👤 Personnel &amp; Traçable
                  </span>
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  ${isSuperAdmin && !isTargetSuperAdmin ? `
                    <button class="btn-icon" onclick="RolesModule.openEditUserPolesModal('${u.id}', '${(u.login || '').replace(/'/g, "\\'")}', '${(u.full_name || '').replace(/'/g, "\\'")}')" title="Modifier les Pôles et la Fonction" style="color: #2563eb; background: #eff6ff;">
                      🎯
                    </button>
                  ` : ''}

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

  renderPolesMatrix() {
    const container = document.getElementById('polesMatrixContainer');
    if (!container) return;

    const users = this.usersList || [];

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 250px;">Pôle d'Activité</th>
            <th>Missions &amp; Périmètre Opérationnel</th>
            <th>Administrateurs Assignés (Multi-Admins)</th>
            <th style="width: 120px; text-align: center;">Accès Direct</th>
          </tr>
        </thead>
        <tbody>
          ${Permissions.POLES_CONFIG.map(p => {
            // Identifier tous les administrateurs ayant accès à ce pôle
            const assignedUsers = users.filter(u => {
              if (Permissions.isSuperAdmin(u)) return true;
              const allowed = Permissions.getAllowedPoles(u);
              return allowed.includes(p.num);
            });

            return `
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 0.6rem;">
                    <span style="font-size: 1.5rem; background: ${p.color}15; padding: 0.35rem 0.5rem; border-radius: 8px;">${p.icon}</span>
                    <div>
                      <strong style="color: ${p.color};">Pôle ${p.num}</strong>
                      <div style="font-size: 0.85rem; font-weight: 600; color: var(--gray-800);">${p.name}</div>
                    </div>
                  </div>
                </td>
                <td style="font-size: 0.85rem; color: var(--gray-600); line-height: 1.45;">
                  ${this.getPoleDescription(p.num)}
                </td>
                <td>
                  ${assignedUsers.length === 0 ? `
                    <span class="badge badge-gray" style="font-size: 0.75rem;">Aucun admin spécifique</span>
                  ` : `
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                      ${assignedUsers.map(u => {
                        const isSuper = Permissions.isSuperAdmin(u);
                        const title = Permissions.getUserTitle(u);
                        return `
                          <span class="badge ${isSuper ? 'badge-primary' : 'badge-gray'}" style="font-size: 0.72rem; padding: 3px 6px;" title="${u.full_name || u.login} : ${title}">
                            👤 ${u.login} ${isSuper ? '👑' : ''}
                          </span>
                        `;
                      }).join('')}
                    </div>
                  `}
                </td>
                <td style="text-align: center;">
                  <a href="${p.page}" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.3rem 0.6rem; text-decoration: none;">
                    Ouvrir ↗
                  </a>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  getPoleDescription(num) {
    const descriptions = {
      1: "Affiches, flyers, réseaux sociaux, WhatsApp, signalétique, plan d'accès et communication extérieure.",
      2: "Billetterie, tickets d'entrée/jeux/lots, gestion des caisses centrale & stands, journal des encaissements et clôture comptable.",
      3: "Ambiance festive, matériel de décoration, implantation spatiale, plan du stade en 3D interactive.",
      4: "Cuisine, boissons, snacks, sandwicherie, stocks de denrées, hygiène et traçabilité des ventes restauration.",
      5: "Gestion des stands de jeux (Couleur + N°), catalogue des règles, fixation des tickets et équipes d'animation.",
      6: "Catalogue des dotations et lots à gagner (achats & dons), suivi des remises de lots et gestion des stocks restants.",
      7: "Fiches bénévoles, contacts WhatsApp, planning des créneaux horaires, prévention des conflits et suivi de présence.",
      8: "Matériel lourd (tentes, tables, sono, électricité, barnums), chaîne de prêt/retour et checklists techniques.",
      9: "Accueil du public, gestion des objets trouvés, rondes sanitaires, poste de secours et registre des incidents."
    };
    return descriptions[num] || "Gestion et opérations du pôle.";
  },

  async openCreateUserModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 620px;">
        <div class="modal-header">
          <h3>➕ Créer un Compte Administrateur</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createUserForm" onsubmit="return false;">
            <div class="alert-banner warning" style="margin-bottom: 1.25rem; font-size: 0.85rem; border-left: 4px solid #ea580c; background: #fff7ed; color: #9a3412;">
              <div>
                <strong>⚠️ Règle de Traçabilité &amp; Responsabilité Personnelle :</strong>
                <div>Ce compte est strictement réservé à la personne désignée ci-dessous. <strong>Le prêt ou le partage de compte est interdit</strong> : chaque opération (vente, annulation, dépense) sera signée avec son identifiant.</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Login unique (Identifiant de connexion) *</label>
                <input type="text" id="uLogin" class="form-control" required placeholder="Ex: Mamadou, Fatou, Cheikh...">
                <div class="form-hint">Sera utilisé pour la connexion</div>
              </div>
              <div class="form-group">
                <label>Nom et Prénom *</label>
                <input type="text" id="uFullName" class="form-control" required placeholder="Ex: Mamadou Sy">
              </div>
            </div>

            <div class="form-group">
              <label>Fonction / Rôle Descriptif *</label>
              <input type="text" id="uRoleTitle" class="form-control" required placeholder="Ex: Co-responsable Buvette, Trésorier Adjoint, Responsable Jeux..." value="">
              <div class="form-hint">Intitulé libre affiché sur le badge et les journaux (aucun rôle rigide imposé).</div>
            </div>

            <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem; border-radius: 8px;">
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: #1e293b; cursor: pointer;">
                <input type="checkbox" id="uIsSuperAdmin" onchange="RolesModule.handleSuperAdminToggle(this.checked, 'create')">
                <span>👑 Accès SuperAdministrateur (Tous les 9 Pôles + Supervision globale)</span>
              </label>
              <div class="form-hint" style="margin-left: 1.7rem;">Donne un accès complet sans restriction à l'ensemble des 9 pôles et à l'administration des comptes.</div>
            </div>

            <div class="form-group" id="createPolesGroup">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="margin-bottom: 0; font-weight: 600;">🎯 Pôles d'Activité Autorisés (Multi-Pôles) *</label>
                <div style="display: flex; gap: 0.35rem;">
                  <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('create', true)">Tout cocher</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('create', false)">Tout décocher</button>
                </div>
              </div>
              <div class="form-hint" style="margin-bottom: 0.5rem;">Cochez 1 ou plusieurs pôles autorisés pour cet administrateur.</div>

              <div class="pole-checkbox-grid" id="createPolesGrid">
                ${Permissions.POLES_CONFIG.map(p => `
                  <label class="pole-checkbox-item" id="cbCreateItem_${p.num}">
                    <input type="checkbox" name="createPoleAccess" value="${p.num}" onchange="this.parentElement.classList.toggle('checked', this.checked)">
                    <span style="font-size: 1.15rem;">${p.icon}</span>
                    <span class="pole-name">Pôle ${p.num} : ${p.name.split('&')[0].trim()}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>Mot de passe initial *</label>
              <input type="text" id="uPassword" class="form-control" required value="Kermesse#2026!">
              <div class="form-hint">L'administrateur pourra se connecter immédiatement sans obligation de changer son mot de passe.</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveUserBtn">💾 Créer l'administrateur</button>
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
      const roleTitle = document.getElementById('uRoleTitle').value.trim();
      const isSuper = document.getElementById('uIsSuperAdmin').checked;
      const password = document.getElementById('uPassword').value;

      if (!login || !fullName || !password) {
        Notify.error('Veuillez renseigner le login, le nom complet et le mot de passe.');
        return;
      }

      const selectedPoles = isSuper 
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9] 
        : Array.from(modal.querySelectorAll('input[name="createPoleAccess"]:checked')).map(cb => Number(cb.value));

      if (!isSuper && selectedPoles.length === 0) {
        Notify.error('Veuillez cocher au moins un pôle d\'activité autorisé (ou activer SuperAdmin).');
        return;
      }

      const client = SupabaseClient.client;
      const roleCode = isSuper ? 'superadmin' : 'admin_stands';
      const finalTitle = roleTitle || (isSuper ? 'SuperAdministrateur' : `Admin Pôle(s) ${selectedPoles.join(', ')}`);

      const saveBtn = modal.querySelector('#saveUserBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Création en cours...';

      try {
        if (client) {
          const { data, error } = await client.rpc('admin_create_app_user', {
            p_login: login,
            p_password: password,
            p_full_name: fullName,
            p_role_code: roleCode,
            p_creator_login: Auth.getCurrentUser()?.login || 'Mounir'
          });

          if (error) throw error;
          if (data && !data.success) {
            Notify.error(data.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Créer l\'administrateur';
            return;
          }

          const userId = data?.user_id || login;
          await Permissions.setCustomTitle(userId, login, finalTitle);
          await Permissions.setAllowedPoles(userId, login, selectedPoles);
        } else {
          await Permissions.setCustomTitle(login, login, finalTitle);
          await Permissions.setAllowedPoles(login, login, selectedPoles);
        }

        Notify.success(`Compte « ${login} » créé avec succès (${finalTitle}) !`);
        close();
        const container = document.getElementById('poleContainer') || document.getElementById('mainContent');
        if (container) RolesModule.render(container);
      } catch (e) {
        Notify.error('Erreur: ' + (e.message || 'Impossible de créer le compte.'));
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Créer l\'administrateur';
      }
    };
  },

  handleSuperAdminToggle(isSuper, context) {
    const gridId = context === 'create' ? 'createPolesGrid' : (context === 'reset' ? 'resetPolesGrid' : 'editPolesGrid');
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (isSuper) {
        cb.checked = true;
        cb.disabled = true;
        cb.parentElement.classList.add('checked');
      } else {
        cb.disabled = false;
      }
    });
  },

  toggleAllPoles(context, state) {
    const gridId = context === 'create' ? 'createPolesGrid' : (context === 'reset' ? 'resetPolesGrid' : 'editPolesGrid');
    const grid = document.getElementById(gridId);
    if (!grid) return;

    grid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (!cb.disabled) {
        cb.checked = state;
        cb.parentElement.classList.toggle('checked', state);
      }
    });
  },

  openEditUserPolesModal(userId, login, fullName) {
    const currentPoles = Permissions.getAllowedPoles({ id: userId, login: login });
    const currentTitle = Permissions.getUserTitle({ id: userId, login: login });

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 580px;">
        <div class="modal-header">
          <h3>🎯 Permissions &amp; Fonction : ${login}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label>Fonction / Rôle Descriptif *</label>
            <input type="text" id="editRoleTitle" class="form-control" value="${currentTitle.replace(/"/g, '&quot;')}" placeholder="Ex: Co-responsable Buvette & Caisses, Trésorier...">
            <div class="form-hint">Intitulé libre définissant la mission de cet administrateur.</div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <label style="margin-bottom: 0; font-weight: 600;">Pôles d'Activité Autorisés (Multi-Pôles) *</label>
            <div style="display: flex; gap: 0.35rem;">
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('edit', true)">Tout cocher</button>
              <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('edit', false)">Tout décocher</button>
            </div>
          </div>
          <p style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 0.75rem;">
            Sélectionnez les pôles auxquels <strong>${fullName || login}</strong> a accès. Les autres pôles lui apparaîtront verrouillés 🔒 sur son menu.
          </p>

          <div class="pole-checkbox-grid" id="editPolesGrid">
            ${Permissions.POLES_CONFIG.map(p => {
              const isChecked = currentPoles.includes(p.num);
              return `
                <label class="pole-checkbox-item ${isChecked ? 'checked' : ''}">
                  <input type="checkbox" name="editPoleAccess" value="${p.num}" ${isChecked ? 'checked' : ''} onchange="this.parentElement.classList.toggle('checked', this.checked)">
                  <span style="font-size: 1.15rem;">${p.icon}</span>
                  <span class="pole-name">Pôle ${p.num} : ${p.name.split('&')[0].trim()}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveUserPolesBtn" style="background: #2563eb; border-color: #1d4ed8;">
            💾 Enregistrer les Modifications
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveUserPolesBtn').onclick = async () => {
      const selected = Array.from(modal.querySelectorAll('input[name="editPoleAccess"]:checked')).map(cb => Number(cb.value));
      const newTitle = document.getElementById('editRoleTitle').value.trim();

      if (newTitle) {
        await Permissions.setCustomTitle(userId, login, newTitle);
      }
      await Permissions.setAllowedPoles(userId, login, selected);
      Notify.success(`Permissions et titre enregistrés pour ${login} : [${selected.join(', ')}]`);
      close();
      const container = document.getElementById('poleContainer') || document.getElementById('mainContent');
      if (container) RolesModule.render(container);
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
          let deleted = false;

          // 1. Tenter la fonction RPC sécurisée admin_delete_app_user (contourne RLS via SECURITY DEFINER)
          try {
            const { data: rpcRes, error: rpcErr } = await client.rpc('admin_delete_app_user', {
              p_target_user_id: id,
              p_admin_login: currentUser?.login || 'SuperAdmin'
            });

            if (rpcErr) {
              console.warn('[RolesModule] RPC admin_delete_app_user non disponible ou erreur:', rpcErr);
            } else if (rpcRes) {
              if (!rpcRes.success) {
                Notify.error(rpcRes.message || 'Impossible de supprimer ce compte.');
                return;
              }
              deleted = true;
            }
          } catch (rpcEx) {
            console.warn('[RolesModule] Exception RPC admin_delete_app_user:', rpcEx);
          }

          // 2. Si la RPC n'a pas pu être exécutée, tenter la suppression directe
          if (!deleted) {
            try {
              // Détacher le compte de la table members
              await client.from('members').update({ user_id: null }).eq('user_id', id);
            } catch (e) {
              console.warn('[RolesModule] Détachement membre ignoré:', e);
            }

            const { error: delErr } = await client.from('app_users').delete().eq('id', id);
            if (delErr) {
              console.error('[RolesModule] Erreur suppression directe:', delErr);
              Notify.error('Erreur lors de la suppression : ' + (delErr.message || 'Action non autorisée.'));
              return;
            }

            // Vérifier si la base de données a réellement supprimé la ligne
            const { data: stillExists } = await client.from('app_users').select('id').eq('id', id).maybeSingle();
            if (stillExists) {
              console.error('[RolesModule] Le compte existe toujours après DELETE.');
              Notify.error("Échec de la suppression du compte. Le script SQL 08_fix_user_deletion.sql doit être exécuté dans la console de base de données.");
              return;
            }
          }

          AuditLogger.log('SUPPRESSION_UTILISATEUR', 'user', id, `Suppression du compte ${login}`);
          Notify.success(`Compte ${login} supprimé avec succès.`);
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

    const currentTitle = Permissions.getUserTitle({ id: userId, login: userLogin, role_name: userRoleCode });
    const currentPoles = Permissions.getAllowedPoles({ id: userId, login: userLogin });
    const isTargetSuper = Boolean(isOrig || userRoleCode === 'superadmin' || Permissions.isSuperAdmin({ id: userId, login: userLogin }));

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 620px;">
        <div class="modal-header">
          <h3>🔑 Modifier les Identifiants &amp; Accès : ${userLogin}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="resetCredentialsForm" onsubmit="return false;">
            <div class="alert-banner warning" style="margin-bottom: 1.25rem; font-size: 0.85rem; border-left: 4px solid #ea580c; background: #fff7ed; color: #9a3412;">
              <div>
                <strong>⚠️ Rappel de Sécurité &amp; Responsabilité Nominative :</strong>
                <div>Chaque compte est personnel à cet administrateur. Le prêt ou le partage de compte est interdit afin de préserver la traçabilité de chaque encaissement et dépense.</div>
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
              <label>Fonction / Rôle Descriptif *</label>
              <input type="text" id="resetRoleTitle" class="form-control" required value="${currentTitle.replace(/"/g, '&quot;')}" placeholder="Ex: Co-responsable Buvette & Caisses, Trésorier...">
              <div class="form-hint">Intitulé personnalisé affiché sur le badge et les journaux de traçabilité.</div>
            </div>

            <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.85rem; border-radius: 8px;">
              <label class="checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700; color: #1e293b; cursor: pointer;">
                <input type="checkbox" id="resetIsSuperAdmin" ${isTargetSuper ? 'checked' : ''} ${isOrig ? 'disabled' : ''} onchange="RolesModule.handleSuperAdminToggle(this.checked, 'reset')">
                <span>👑 Accès SuperAdministrateur (Tous les 9 Pôles + Supervision globale)</span>
              </label>
              ${isOrig ? '<div class="form-hint" style="margin-left: 1.7rem; color: #b45309;">Le statut du SuperAdministrateur original est immuable.</div>' : '<div class="form-hint" style="margin-left: 1.7rem;">Cochez pour donner accès complet à l\'ensemble des 9 pôles et caisses.</div>'}
            </div>

            <div class="form-group" id="resetPolesGroup">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="margin-bottom: 0; font-weight: 600;">🎯 Pôles d'Activité Autorisés (Multi-Pôles) *</label>
                <div style="display: flex; gap: 0.35rem;">
                  <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('reset', true)">Tout cocher</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 2px 6px;" onclick="RolesModule.toggleAllPoles('reset', false)">Tout décocher</button>
                </div>
              </div>
              <div class="form-hint" style="margin-bottom: 0.5rem;">Cochez le ou les pôles auxquels cet administrateur est affecté.</div>

              <div class="pole-checkbox-grid" id="resetPolesGrid">
                ${Permissions.POLES_CONFIG.map(p => {
                  const isChecked = isTargetSuper || currentPoles.includes(p.num);
                  return `
                    <label class="pole-checkbox-item ${isChecked ? 'checked' : ''}">
                      <input type="checkbox" name="resetPoleAccess" value="${p.num}" ${isChecked ? 'checked' : ''} ${isTargetSuper ? 'disabled' : ''} onchange="this.parentElement.classList.toggle('checked', this.checked)">
                      <span style="font-size: 1.15rem;">${p.icon}</span>
                      <span class="pole-name">Pôle ${p.num} : ${p.name.split('&')[0].trim()}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
              <input type="text" id="resetPassword" class="form-control" placeholder="Entrez un nouveau mot de passe (min. 6 caractères)">
              <div class="form-hint">L'administrateur utilisera directement ce mot de passe sans obligation de le changer.</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveCredentialsBtn">💾 Enregistrer les Modifications</button>
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
      const newTitle = document.getElementById('resetRoleTitle').value.trim();
      const isSuper = document.getElementById('resetIsSuperAdmin').checked;
      const newPassword = document.getElementById('resetPassword').value.trim();

      if (!newLogin) {
        Notify.error('Le login est obligatoire.');
        return;
      }

      if (newPassword && newPassword.length < 6) {
        Notify.error('Le mot de passe doit comporter au moins 6 caractères.');
        return;
      }

      const selectedPoles = isSuper
        ? [1, 2, 3, 4, 5, 6, 7, 8, 9]
        : Array.from(modal.querySelectorAll('input[name="resetPoleAccess"]:checked')).map(cb => Number(cb.value));

      if (!isSuper && selectedPoles.length === 0) {
        Notify.error('Veuillez cocher au moins un pôle autorisé (ou activer SuperAdmin).');
        return;
      }

      const saveBtn = modal.querySelector('#saveCredentialsBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Enregistrement...';

      const finalTitle = newTitle || (isSuper ? 'SuperAdministrateur' : `Admin Pôle(s) ${selectedPoles.join(', ')}`);
      const client = SupabaseClient.client;
      const targetRoleCode = isSuper ? 'superadmin' : 'admin_stands';

      try {
        if (client) {
          const { data, error } = await client.rpc('admin_reset_user_credentials', {
            p_target_user_id: userId,
            p_new_login: newLogin,
            p_new_password: newPassword || null,
            p_new_name: newFullName,
            p_new_role_code: isOrig ? null : targetRoleCode,
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
            const { error: directErr } = await client.from('app_users').update(updatePayload).eq('id', userId);
            if (directErr) throw directErr;
          } else if (data && !data.success) {
            Notify.error(data.message);
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Enregistrer les Modifications';
            return;
          }
        }

        // Sauvegarder l'intitulé descriptif et les pôles
        await Permissions.setCustomTitle(userId, newLogin, finalTitle);
        await Permissions.setAllowedPoles(userId, newLogin, selectedPoles);

        // Si le compte modifié est celui actuellement connecté, mettre à jour la session
        if (currentUser && (currentUser.id === userId || currentUser.login.toLowerCase() === userLogin.toLowerCase())) {
          currentUser.login = newLogin;
          currentUser.full_name = newFullName;
          currentUser.custom_title = finalTitle;
          currentUser.role_name = finalTitle;
          if (newPassword) localStorage.setItem('lc_mounir_pwd', newPassword);
          Auth.setCurrentUser(currentUser);
          const nameEl = document.getElementById('headerUserName');
          const avatarEl = document.getElementById('headerUserAvatar');
          if (nameEl) nameEl.textContent = newFullName || newLogin;
          if (avatarEl) avatarEl.textContent = newLogin.charAt(0).toUpperCase();
        }

        Notify.success(`Identifiants et permissions de ${newLogin} enregistrés avec succès (${finalTitle}).`);
        close();
        const container = document.getElementById('poleContainer') || document.getElementById('mainContent');
        if (container) RolesModule.render(container);
      } catch (err) {
        Notify.error('Erreur: ' + (err.message || 'Impossible de mettre à jour.'));
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Enregistrer les Modifications';
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
