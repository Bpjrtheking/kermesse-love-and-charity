/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : STANDS (COULEUR + NUMÉRO & CONTRÔLE DU STAFFING)
 * 
 * Gestion intégrale des stands :
 * - Identification : COULEUR + NUMÉRO (ex: Rouge 1)
 * - Responsable de stand
 * - Détection automatique : Stand sans responsable, Stand sans caissier, Stand sous-staffé
 * - Contrôle de mixité pour la surveillance des manèges (Fille & Garçon)
 */

const StandsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎪</span> Gestion des Stands de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="StandsModule.openCreateModal()">
              <span>➕</span> Nouveau Stand
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="standSearch" placeholder="Rechercher par nom, couleur ou numéro..." oninput="StandsModule.filterTable()">
            </div>
          </div>

          <!-- Alertes spécifiques aux stands -->
          <div id="standAlertsContainer" style="margin-bottom: 1.25rem;"></div>

          <div class="table-responsive" id="standsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🎪</div>
              <div class="empty-title">Aucun stand enregistré</div>
              <div class="empty-desc">Créez vos stands avec leur identification (Couleur + Numéro, ex: Rouge 1) pour leur attribuer des jeux, caisses et membres.</div>
              <button class="btn btn-primary" onclick="StandsModule.openCreateModal()">
                <span>➕</span> Créer le premier stand
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (!client) return;

    try {
      const { data: stands, error } = await client
        .from('stands')
        .select(`
          id, number, color_name, color_hex, name, description, is_closed,
          manager:members!stands_manager_id_fkey(id, first_name, last_name, phone),
          location:locations(id, name),
          staff:stand_staff(id, role_in_stand, gender, member:members(first_name, last_name)),
          games(id, name, ticket_price_f)
        `)
        .order('number', { ascending: true });

      if (error) throw error;
      this.renderTable(stands || []);
    } catch (e) {
      console.error('[StandsModule Error]', e);
    }
  },

  renderTable(stands) {
    const container = document.getElementById('standsTableContainer');
    const alertsContainer = document.getElementById('standAlertsContainer');
    if (!container) return;

    if (!stands || stands.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎪</div>
          <div class="empty-title">Aucun stand enregistré</div>
          <div class="empty-desc">Créez vos stands avec leur identification (Couleur + Numéro, ex: Rouge 1) pour leur attribuer des jeux, caisses et membres.</div>
          <button class="btn btn-primary" onclick="StandsModule.openCreateModal()">
            <span>➕</span> Créer le premier stand
          </button>
        </div>
      `;
      if (alertsContainer) alertsContainer.innerHTML = '';
      return;
    }

    // Analyse du staffing pour alertes
    let missingManagers = 0;
    let missingCashiers = 0;
    let understaffed = 0;

    stands.forEach(s => {
      if (!s.manager) missingManagers++;
      const cashiers = (s.staff || []).filter(st => st.role_in_stand === 'caissier');
      if (cashiers.length < 2) missingCashiers++;
      if ((s.staff || []).length < 3) understaffed++;
    });

    if (alertsContainer) {
      let alertsHtml = '';
      if (missingManagers > 0) {
        alertsHtml += `
          <div class="alert-banner warning">
            <div>⚠️ <strong>Alerte Responsable :</strong> ${missingManagers} stand(s) sans responsable désigné !</div>
          </div>
        `;
      }
      if (missingCashiers > 0) {
        alertsHtml += `
          <div class="alert-banner warning">
            <div>⚠️ <strong>Recommandation Caisse :</strong> ${missingCashiers} stand(s) ont moins de 2 caissiers affectés.</div>
          </div>
        `;
      }
      alertsContainer.innerHTML = alertsHtml;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Identifiant</th>
            <th>Nom du Stand</th>
            <th>Responsable</th>
            <th>Jeux Associés</th>
            <th>Staffing Actif</th>
            <th>Statut</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="standsTableBody">
          ${stands.map(s => {
            const cashiersCount = (s.staff || []).filter(st => st.role_in_stand === 'caissier').length;
            const staffTotal = (s.staff || []).length;
            const hasManager = Boolean(s.manager);

            return `
              <tr data-name="${s.name}" data-color="${s.color_name}" data-num="${s.number}">
                <td>
                  <span class="stand-tag" style="background-color: ${s.color_hex}15; color: ${s.color_hex}; border-color: ${s.color_hex};">
                    <span class="color-dot" style="background-color: ${s.color_hex};"></span>
                    ${s.color_name} ${s.number}
                  </span>
                </td>
                <td>
                  <strong>${s.name}</strong>
                  ${s.location ? `<div style="font-size: 0.78rem; color: var(--gray-500);">📍 ${s.location.name}</div>` : ''}
                </td>
                <td>
                  ${hasManager ? `
                    <div style="font-weight: 600;">${s.manager.first_name} ${s.manager.last_name}</div>
                    <div style="font-size: 0.75rem; color: var(--gray-400);">${s.manager.phone || ''}</div>
                  ` : `
                    <span class="badge badge-danger">⚠️ Sans responsable</span>
                  `}
                </td>
                <td>
                  ${(s.games || []).length > 0 ? `
                    <span class="badge badge-primary">${s.games.length} jeu(x)</span>
                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">
                      ${s.games.map(g => g.name).join(', ')}
                    </div>
                  ` : '<span style="color: var(--gray-400); font-size: 0.8rem;">Aucun jeu</span>'}
                </td>
                <td>
                  <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                    <span class="badge ${cashiersCount >= 2 ? 'badge-success' : 'badge-warning'}" title="Caissiers">
                      💵 ${cashiersCount} caissier(s)
                    </span>
                    <span class="badge badge-gray" title="Total bénévoles affectés">
                      👥 ${staffTotal} membre(s)
                    </span>
                  </div>
                </td>
                <td>
                  ${s.is_closed ? '<span class="badge badge-danger">Clôturé</span>' : '<span class="badge badge-success">Ouvert</span>'}
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="StandsModule.openStaffingModal('${s.id}', '${s.name}')" title="Affecter le personnel">👥 Staff</button>
                  <button class="btn-icon danger" onclick="StandsModule.deleteStand('${s.id}', '${s.name}')" title="Supprimer">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('standSearch').value || '').toLowerCase();
    const rows = document.querySelectorAll('#standsTableBody tr');

    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const color = (r.dataset.color || '').toLowerCase();
      const num = (r.dataset.num || '').toLowerCase();

      const match = name.includes(q) || color.includes(q) || num.includes(q);
      r.style.display = match ? '' : 'none';
    });
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let members = [];
    let locations = [];

    if (client) {
      const { data: m } = await client.from('members').select('id, first_name, last_name');
      const { data: l } = await client.from('locations').select('id, name');
      members = m || [];
      locations = l || [];
    }

    const defaultColors = [
      { name: 'Rouge', hex: '#dc2626' },
      { name: 'Bleu', hex: '#2563eb' },
      { name: 'Vert', hex: '#16a34a' },
      { name: 'Jaune', hex: '#eab308' },
      { name: 'Blanc', hex: '#ffffff' },
      { name: 'Noir', hex: '#0f172a' },
      { name: 'Orange', hex: '#ea580c' },
      { name: 'Violet', hex: '#9333ea' }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Créer un Nouveau Stand</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createStandForm">
            <div class="form-row">
              <div class="form-group">
                <label>Couleur du stand *</label>
                <select id="sColorName" class="form-control" onchange="
                  const col = ${JSON.stringify(defaultColors)}.find(c => c.name === this.value);
                  if (col) document.getElementById('sColorHex').value = col.hex;
                ">
                  ${defaultColors.map(c => `<option value="${c.name}">${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Numéro du stand *</label>
                <input type="number" id="sNumber" class="form-control" value="1" min="1" required>
              </div>
              <input type="hidden" id="sColorHex" value="#dc2626">
            </div>

            <div class="form-group">
              <label>Nom complet du Stand *</label>
              <input type="text" id="sName" class="form-control" required placeholder="Ex: Rouge 1 — Tir à la corde">
              <div class="form-hint">Format recommandé : [Couleur] [Numéro] — [Activité / Jeux]</div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Responsable du stand</label>
                <select id="sManager" class="form-control">
                  <option value="">Sélectionner un bénévole (recommandé)</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Emplacement physique</label>
                <select id="sLocation" class="form-control">
                  <option value="">Sélectionner un lieu</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Description / Remarques</label>
              <textarea id="sDesc" class="form-control" rows="2" placeholder="Détails, consignes particulières pour ce stand..."></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveStandBtn">Créer le stand</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveStandBtn').onclick = async () => {
      const colorName = document.getElementById('sColorName').value;
      const colorHex = document.getElementById('sColorHex').value;
      const number = parseInt(document.getElementById('sNumber').value, 10);
      const name = document.getElementById('sName').value.trim();
      const managerId = document.getElementById('sManager').value || null;
      const locationId = document.getElementById('sLocation').value || null;
      const desc = document.getElementById('sDesc').value.trim();

      if (!name || isNaN(number)) {
        Notify.error('Veuillez renseigner le nom et le numéro du stand.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('stands').insert([{
          color_name: colorName,
          color_hex: colorHex,
          number,
          name,
          manager_id: managerId,
          location_id: locationId,
          description: desc,
          is_closed: false
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_STAND', 'stand', null, `Création du stand ${name} (${colorName} ${number})`);
        Notify.success(`Stand ${name} créé avec succès.`);
        close();
        StandsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async openStaffingModal(standId, standName) {
    const client = SupabaseClient.client;
    if (!client) return;

    const { data: members } = await client.from('members').select('id, first_name, last_name');
    const { data: currentStaff } = await client
      .from('stand_staff')
      .select('id, role_in_stand, gender, member:members(id, first_name, last_name)')
      .eq('stand_id', standId);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>Personnel affecté : ${standName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1.5rem; background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
            <h4 style="font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--gray-800);">Affecter un nouveau membre</h4>
            <div class="form-row">
              <div class="form-group">
                <label>Membre *</label>
                <select id="staffMemberSelect" class="form-control">
                  <option value="">Choisir un membre...</option>
                  ${(members || []).map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Rôle sur le stand *</label>
                <select id="staffRoleSelect" class="form-control">
                  <option value="caissier">Caissier (Min. 2 recommandé)</option>
                  <option value="lots">Responsable des lots / cadeaux</option>
                  <option value="arbitre_jeu">Arbitre / Animation de jeu</option>
                  <option value="surveillance_enfants">Surveillance des enfants</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Genre (utile pour mixité de surveillance)</label>
                <select id="staffGenderSelect" class="form-control">
                  <option value="">Non spécifié</option>
                  <option value="F">Fille</option>
                  <option value="M">Garçon</option>
                </select>
              </div>
              <div class="form-group" style="display: flex; align-items: flex-end;">
                <button class="btn btn-primary" id="addStaffBtn" style="width: 100%;">Affecter au stand</button>
              </div>
            </div>
          </div>

          <h4 style="font-size: 0.9rem; margin-bottom: 0.75rem; color: var(--gray-800);">Équipe actuelle sur le stand</h4>
          <div id="currentStaffList">
            ${(currentStaff && currentStaff.length > 0) ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Membre</th>
                    <th>Rôle</th>
                    <th>Mixité</th>
                    <th style="text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${currentStaff.map(s => `
                    <tr>
                      <td><strong>${s.member ? `${s.member.first_name} ${s.member.last_name}` : 'Inconnu'}</strong></td>
                      <td><span class="badge badge-primary">${s.role_in_stand}</span></td>
                      <td>${s.gender ? (s.gender === 'F' ? '👧 Fille' : '👦 Garçon') : '-'}</td>
                      <td style="text-align: right;">
                        <button class="btn-icon danger" onclick="StandsModule.removeStaff('${s.id}', '${standId}', '${standName}')">🗑️</button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            ` : '<p style="color: var(--gray-500); font-size: 0.85rem;">Aucun membre affecté pour l\'instant.</p>'}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#addStaffBtn').onclick = async () => {
      const memberId = document.getElementById('staffMemberSelect').value;
      const roleInStand = document.getElementById('staffRoleSelect').value;
      const gender = document.getElementById('staffGenderSelect').value || null;

      if (!memberId) {
        Notify.error('Veuillez choisir un membre.');
        return;
      }

      const { error } = await client.from('stand_staff').insert([{
        stand_id: standId,
        member_id: memberId,
        role_in_stand: roleInStand,
        gender
      }]);

      if (error) {
        Notify.error('Erreur: ' + error.message);
        return;
      }

      AuditLogger.log('AFFECTATION_STAFF_STAND', 'stand', standId, `Affectation de personnel sur ${standName} (${roleInStand})`);
      Notify.success('Personnel affecté.');
      close();
      StandsModule.openStaffingModal(standId, standName);
    };
  },

  async removeStaff(staffId, standId, standName) {
    const client = SupabaseClient.client;
    if (client) {
      await client.from('stand_staff').delete().eq('id', staffId);
      AuditLogger.log('RETRAIT_STAFF_STAND', 'stand', standId, `Retrait d'un membre sur ${standName}`);
      Notify.success('Membre retiré du stand.');
      document.querySelector('.modal-backdrop.open')?.remove();
      StandsModule.openStaffingModal(standId, standName);
    }
  },

  deleteStand(id, name) {
    Notify.confirm(
      'Supprimer ce stand ?',
      `Confirmez-vous la suppression du stand ${name} ? Cette action sera tracée.`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { error } = await client.from('stands').delete().eq('id', id);
          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
          AuditLogger.log('SUPPRESSION_STAND', 'stand', id, `Suppression du stand ${name}`);
          Notify.success(`Stand ${name} supprimé.`);
          StandsModule.render(document.getElementById('mainContent'));
        }
      },
      'Supprimer',
      true
    );
  }
};

window.StandsModule = StandsModule;
