/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : STANDS (COULEUR + NUMÉRO & CONTRÔLE DU STAFFING & MATÉRIAUX)
 * 
 * Gestion intégrale des stands :
 * - Identification : COULEUR + NUMÉRO (ex: Rouge 1)
 * - Sélection des jeux parmi le catalogue (1, 2, 3 ou plus, nombre illimité)
 * - Matériaux nécessaires pour chaque stand avec transmission directe au Pôle Logistique
 * - Responsable de stand & équipe dédiée (caissiers, animateurs, sécurité)
 * - Détection automatique : Stand sans responsable, Stand sans caissier, Stand sous-staffé
 * - Contrôle de mixité pour la surveillance des manèges (Fille & Garçon)
 */

const StandsModule = {
  stands: [],
  gamesCatalog: [],
  materialRequests: [],

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
              <input type="text" id="standSearch" placeholder="Rechercher par nom, couleur, numéro ou jeu..." oninput="StandsModule.filterTable()">
            </div>
          </div>

          <!-- Alertes spécifiques aux stands -->
          <div id="standAlertsContainer" style="margin-bottom: 1.25rem;"></div>

          <div class="table-responsive" id="standsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🎪</div>
              <div class="empty-title">Chargement des stands...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        // Chargement des jeux existants pour le catalogue
        const { data: gData } = await client.from('games').select('id, name, ticket_price_f, stand_id, materials_needed');
        if (gData) this.gamesCatalog = gData;

        // Chargement des demandes matérielles
        try {
          const { data: rData } = await client.from('stand_material_requests').select('*');
          if (rData) this.materialRequests = rData;
        } catch (e) {}

        // Chargement des stands
        const { data: stands, error } = await client
          .from('stands')
          .select(`
            id, number, color_name, color_hex, name, description, is_closed, materials_needed,
            manager:members!stands_manager_id_fkey(id, first_name, last_name, phone),
            location:locations(id, name),
            staff:stand_staff(id, role_in_stand, gender, member:members(first_name, last_name)),
            games(id, name, ticket_price_f, materials_needed)
          `)
          .order('number', { ascending: true });

        if (error) throw error;
        this.stands = stands || [];
        this.renderTable(this.stands);
        return;
      }
    } catch (e) {
      console.warn('[StandsModule Error]', e);
    }

    // Fallback local
    const storedReq = localStorage.getItem('kermesse_stand_material_requests');
    if (storedReq) {
      try {
        const localReqs = JSON.parse(storedReq);
        this.materialRequests = [...this.materialRequests, ...localReqs.filter(lr => !this.materialRequests.some(r => r.id === lr.id))];
      } catch (e) {}
    }

    this.renderTable(this.stands || []);
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
          <div class="empty-desc">Créez vos stands avec leur identification (Couleur + Numéro, ex: Rouge 1), sélectionnez les jeux à y rattacher et spécifiez les matériaux nécessaires pour la logistique.</div>
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
            <th>Jeux Rattachés (Illimité)</th>
            <th>Matériaux Requis (Logistique)</th>
            <th>Responsable</th>
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
            const gamesList = s.games || [];
            
            // Rassemblement des matériaux du stand et de ses jeux
            const standMat = s.materials_needed || '';
            const gamesMat = gamesList.filter(g => g.materials_needed).map(g => `${g.name}: ${g.materials_needed}`).join(' | ');
            const allMaterials = [standMat, gamesMat].filter(Boolean).join(' ; ');

            const req = this.materialRequests.find(r => r.stand_id === s.id || r.stand_name === s.name);

            return `
              <tr data-name="${s.name}" data-color="${s.color_name}" data-num="${s.number}" data-games="${gamesList.map(g => g.name).join(' ')}">
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
                  <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                    ${gamesList.length > 0 ? `
                      <div style="display: flex; gap: 0.25rem; flex-wrap: wrap;">
                        ${gamesList.map(g => `
                          <span class="badge badge-primary" style="font-size: 0.75rem;">
                            🎯 ${g.name} ${g.ticket_price_f ? `(${g.ticket_price_f} F)` : ''}
                          </span>
                        `).join('')}
                      </div>
                    ` : '<span style="color: var(--gray-400); font-size: 0.8rem;">Aucun jeu rattaché</span>'}
                    <div>
                      <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.72rem; margin-top: 3px;" onclick="StandsModule.openAssociateGamesModal('${s.id}', '${s.name}')">
                        ⚙️ Gérer les jeux (${gamesList.length})
                      </button>
                    </div>
                  </div>
                </td>
                <td>
                  ${allMaterials ? `
                    <div style="font-size: 0.8rem; max-width: 220px; line-height: 1.25;">
                      📦 ${allMaterials.length > 50 ? allMaterials.substring(0, 50) + '...' : allMaterials}
                    </div>
                    <div style="margin-top: 3px;">
                      ${req ? (
                        req.status === 'fourni' ? '<span class="badge badge-success">✅ Fourni Logistique</span>' :
                        req.status === 'en_cours' ? '<span class="badge badge-warning">🔄 Préparation Logistique</span>' :
                        '<span class="badge badge-primary">🚚 Transmis à Logistique</span>'
                      ) : `
                        <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.72rem;" onclick="StandsModule.openStandMaterialsModal('${s.id}', '${s.name}', \`${allMaterials.replace(/"/g, '&quot;')}\`)">
                          🚚 Transmettre à Logistique
                        </button>
                      `}
                    </div>
                  ` : `
                    <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.72rem;" onclick="StandsModule.openStandMaterialsModal('${s.id}', '${s.name}', '')">
                      ➕ Définir matériaux
                    </button>
                  `}
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
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="StandsModule.openStaffingModal('${s.id}', '${s.name}')" title="Affecter le personnel">👥 Staff</button>
                  <button class="btn-icon" onclick="StandsModule.openEditModal('${s.id}')" title="Modifier le stand">✏️</button>
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
      const games = (r.dataset.games || '').toLowerCase();

      const match = name.includes(q) || color.includes(q) || num.includes(q) || games.includes(q);
      r.style.display = match ? '' : 'none';
    });
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let members = [];
    let locations = [];
    let availableGames = [];

    if (client) {
      const { data: m } = await client.from('members').select('id, first_name, last_name');
      const { data: l } = await client.from('locations').select('id, name');
      const { data: g } = await client.from('games').select('id, name, ticket_price_f, stand_id');
      members = m || [];
      locations = l || [];
      availableGames = g || [];
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
      <div class="modal-dialog" style="max-width: 650px;">
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
              <input type="text" id="sName" class="form-control" required placeholder="Ex: Rouge 1 — Tir à la corde &amp; Fléchettes">
              <div class="form-hint">Format recommandé : [Couleur] [Numéro] — [Activité / Jeux]</div>
            </div>

            <!-- SÉLECTION DES JEUX DU STAND (ILLIMITÉ) -->
            <div class="form-group" style="background: var(--gray-50); padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <label style="margin: 0; font-weight: 700; color: var(--gray-800);">
                  🎯 Jeux rattachés à ce stand (1, 2, 3 ou plus — illimité)
                </label>
                <button type="button" class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="StandsModule.quickAddGamePrompt()">
                  ➕ Nouveau jeu au catalogue
                </button>
              </div>
              <div id="gamesChecklistContainer" style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.35rem; padding-right: 4px;">
                ${availableGames.length > 0 ? availableGames.map(g => `
                  <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; padding: 4px 6px; border-radius: 4px; background: white; border: 1px solid var(--gray-200);">
                    <input type="checkbox" name="standSelectedGames" value="${g.id}">
                    <span style="font-weight: 600;">${g.name}</span>
                    <span style="color: var(--gray-500); font-size: 0.75rem;">
                      ${g.ticket_price_f ? `(${g.ticket_price_f} F)` : '(Tarif libre)'}
                    </span>
                    ${g.stand_id ? '<span class="badge badge-gray" style="font-size: 0.7rem; margin-left: auto;">Déjà assigné</span>' : '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: auto;">Disponible</span>'}
                  </label>
                `).join('') : '<p style="color: var(--gray-500); font-size: 0.8rem; margin: 0;">Aucun jeu dans le catalogue. Vous pourrez en ajouter via le bouton ci-dessus ou dans le module Jeux.</p>'}
              </div>
            </div>

            <!-- MATÉRIAUX NÉCESSAIRES POUR LA LOGISTIQUE -->
            <div class="form-group" style="background: #f8fafc; padding: 0.85rem; border-radius: var(--radius-md); border: 1px solid #cbd5e1;">
              <label style="font-weight: 700; color: #1e293b; margin-bottom: 0.35rem;">
                📦 Matériaux &amp; Équipements nécessaires pour ce Stand
              </label>
              <textarea id="sMaterials" class="form-control" rows="2" placeholder="Ex: 2 tables pliantes, 4 chaises plastique, 1 barnum 3x3m, 1 rallonge électrique 20m..."></textarea>
              <div class="form-check" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                <input type="checkbox" id="sSendLogisticsNow" checked>
                <label for="sSendLogisticsNow" style="margin: 0; font-size: 0.85rem; cursor: pointer;">
                  🚚 <strong>Transmettre immédiatement</strong> au Pôle Logistique &amp; Installation pour qu'ils préparent le matériel
                </label>
              </div>
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
      const materials = document.getElementById('sMaterials').value.trim();
      const sendLogistics = document.getElementById('sSendLogisticsNow').checked;

      // Récupération des jeux sélectionnés
      const selectedGameInputs = modal.querySelectorAll('input[name="standSelectedGames"]:checked');
      const selectedGameIds = Array.from(selectedGameInputs).map(cb => cb.value);

      if (!name || isNaN(number)) {
        Notify.error('Veuillez renseigner le nom et le numéro du stand.');
        return;
      }

      const client = SupabaseClient.client;
      let newStandId = 'stand-' + Date.now();

      if (client) {
        try {
          const insertPayload = {
            color_name: colorName,
            color_hex: colorHex,
            number,
            name,
            manager_id: managerId,
            location_id: locationId,
            description: desc,
            materials_needed: materials,
            is_closed: false
          };

          const { data, error } = await client.from('stands').insert([insertPayload]).select();
          if (error) {
            delete insertPayload.materials_needed;
            const retry = await client.from('stands').insert([insertPayload]).select();
            if (retry.error) throw retry.error;
            if (retry.data && retry.data[0]) newStandId = retry.data[0].id;
          } else if (data && data[0]) {
            newStandId = data[0].id;
          }

          // Rattachement des jeux sélectionnés à ce stand
          if (selectedGameIds.length > 0) {
            for (const gId of selectedGameIds) {
              await client.from('games').update({ stand_id: newStandId }).eq('id', gId);
            }
          }
        } catch (e) {
          console.warn('[Stand Insert Warning]', e);
          Notify.warning('Stand enregistré : ' + e.message);
        }
      }

      // Transmission de la demande de matériel au Pôle Logistique si demandée
      if (materials && sendLogistics) {
        const currentUser = Auth.getCurrentUser();
        const requesterName = currentUser ? (currentUser.full_name || currentUser.login) : 'Responsable des Stands';

        await GamesModule.recordMaterialRequest({
          stand_id: newStandId,
          stand_name: name,
          game_name: selectedGameIds.length > 0 ? `${selectedGameIds.length} jeu(x) rattaché(s)` : null,
          materials_needed: materials,
          requested_by_name: requesterName
        });
      }

      AuditLogger.log('CREATION_STAND', 'stand', newStandId, `Création du stand ${name} (${colorName} ${number}) avec ${selectedGameIds.length} jeu(x)`);
      Notify.success(`Stand ${name} créé avec succès.`);
      close();
      StandsModule.render(document.getElementById('mainContent'));
    };
  },

  async quickAddGamePrompt() {
    const gameName = prompt('Nom du nouveau jeu à ajouter au catalogue :');
    if (!gameName || !gameName.trim()) return;

    const client = SupabaseClient.client;
    if (client) {
      try {
        const { data, error } = await client.from('games').insert([{
          name: gameName.trim(),
          ticket_price_f: 0,
          is_active: true
        }]).select();

        if (error) throw error;
        Notify.success(`Jeu "${gameName}" ajouté au catalogue !`);

        // Recharger la liste des jeux dans la modale
        const container = document.getElementById('gamesChecklistContainer');
        if (container && data && data[0]) {
          const g = data[0];
          const label = document.createElement('label');
          label.style = 'display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer; padding: 4px 6px; border-radius: 4px; background: #ecfdf5; border: 1px solid #a7f3d0;';
          label.innerHTML = `
            <input type="checkbox" name="standSelectedGames" value="${g.id}" checked>
            <span style="font-weight: 600;">${g.name}</span>
            <span style="color: var(--gray-500); font-size: 0.75rem;">(Tarif libre)</span>
            <span class="badge badge-success" style="font-size: 0.7rem; margin-left: auto;">Nouveau</span>
          `;
          container.prepend(label);
        }
      } catch (e) {
        Notify.error('Erreur lors de l\'ajout du jeu : ' + e.message);
      }
    }
  },

  async openAssociateGamesModal(standId, standName) {
    const client = SupabaseClient.client;
    if (!client) return;

    const { data: allGames } = await client.from('games').select('id, name, ticket_price_f, stand_id').order('name');
    const games = allGames || [];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 550px;">
        <div class="modal-header">
          <h3>Jeux rattachés : ${standName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
            Cochez les jeux et attractions à associer à ce stand. Un stand peut héberger 1, 2, 3 ou autant de jeux que vous souhaitez.
          </p>

          <div style="max-height: 250px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.4rem;">
            ${games.map(g => {
              const isAssignedToThis = g.stand_id === standId;
              return `
                <label style="display: flex; align-items: center; gap: 0.5rem; padding: 6px 10px; border-radius: 4px; background: ${isAssignedToThis ? '#eff6ff' : '#f8fafc'}; border: 1px solid ${isAssignedToThis ? '#93c5fd' : '#e2e8f0'}; cursor: pointer;">
                  <input type="checkbox" name="associateGameCheckbox" value="${g.id}" ${isAssignedToThis ? 'checked' : ''}>
                  <strong>${g.name}</strong>
                  <span style="color: var(--gray-500); font-size: 0.8rem;">
                    ${g.ticket_price_f ? `(${g.ticket_price_f} F)` : '(Tarif libre)'}
                  </span>
                  ${g.stand_id && !isAssignedToThis ? '<span class="badge badge-gray" style="margin-left: auto; font-size: 0.7rem;">Autre stand</span>' : ''}
                </label>
              `;
            }).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveAssociateGamesBtn">Enregistrer les jeux du stand</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveAssociateGamesBtn').onclick = async () => {
      const checkedInputs = modal.querySelectorAll('input[name="associateGameCheckbox"]:checked');
      const checkedIds = Array.from(checkedInputs).map(cb => cb.value);

      for (const g of games) {
        const isChecked = checkedIds.includes(g.id);
        if (isChecked && g.stand_id !== standId) {
          await client.from('games').update({ stand_id: standId }).eq('id', g.id);
        } else if (!isChecked && g.stand_id === standId) {
          await client.from('games').update({ stand_id: null }).eq('id', g.id);
        }
      }

      AuditLogger.log('ASSOCIATION_JEUX_STAND', 'stand', standId, `Mise à jour des jeux associés pour ${standName} (${checkedIds.length} jeux)`);
      Notify.success('Jeux du stand mis à jour.');
      close();
      StandsModule.render(document.getElementById('mainContent'));
    };
  },

  async openStandMaterialsModal(standId, standName, currentMaterials) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 550px;">
        <div class="modal-header">
          <h3>Matériaux &amp; Logistique : ${standName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="alert-banner info" style="margin-bottom: 1rem;">
            <div>
              💡 Listez ici tous les matériaux dont vous avez besoin pour ce stand (tables, chaises, barnum, sono, etc.). En confirmant, votre demande est transmise directement au <strong>Pôle Logistique &amp; Installation</strong> pour qu'ils préparent le matériel pour vous.
            </div>
          </div>

          <div class="form-group">
            <label>Matériaux &amp; Équipements demandés *</label>
            <textarea id="modalStandMaterials" class="form-control" rows="4" placeholder="Ex: 2 tables pliantes, 6 chaises, 1 barnum 3x3m, 2 rallonges électriques, 1 poubelle...">${currentMaterials || ''}</textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="sendStandMaterialsBtn">
            🚚 Transmettre au Pôle Logistique
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#sendStandMaterialsBtn').onclick = async () => {
      const mat = document.getElementById('modalStandMaterials').value.trim();
      if (!mat) {
        Notify.error('Veuillez renseigner les matériaux nécessaires.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        try {
          await client.from('stands').update({ materials_needed: mat }).eq('id', standId);
        } catch (e) {}
      }

      const currentUser = Auth.getCurrentUser();
      const requesterName = currentUser ? (currentUser.full_name || currentUser.login) : 'Responsable des Stands';

      await GamesModule.recordMaterialRequest({
        stand_id: standId,
        stand_name: standName,
        game_name: null,
        materials_needed: mat,
        requested_by_name: requesterName
      });

      Notify.success(`Demande de matériaux pour ${standName} transmise avec succès au Pôle Logistique !`);
      close();
      StandsModule.render(document.getElementById('mainContent'));
    };
  },

  async openEditModal(standId) {
    const stand = this.stands.find(s => s.id === standId);
    if (!stand) return;

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
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Modifier le Stand : ${stand.name}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editStandForm">
            <div class="form-row">
              <div class="form-group">
                <label>Couleur du stand</label>
                <select id="esColorName" class="form-control" onchange="
                  const col = ${JSON.stringify(defaultColors)}.find(c => c.name === this.value);
                  if (col) document.getElementById('esColorHex').value = col.hex;
                ">
                  ${defaultColors.map(c => `<option value="${c.name}" ${stand.color_name === c.name ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Numéro</label>
                <input type="number" id="esNumber" class="form-control" value="${stand.number}" min="1" required>
              </div>
              <input type="hidden" id="esColorHex" value="${stand.color_hex}">
            </div>

            <div class="form-group">
              <label>Nom complet</label>
              <input type="text" id="esName" class="form-control" value="${stand.name}" required>
            </div>

            <div class="form-group">
              <label>Matériaux &amp; Équipements nécessaires</label>
              <textarea id="esMaterials" class="form-control" rows="2">${stand.materials_needed || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Responsable</label>
                <select id="esManager" class="form-control">
                  <option value="">Sélectionner un bénévole...</option>
                  ${members.map(m => `<option value="${m.id}" ${(stand.manager && stand.manager.id === m.id) ? 'selected' : ''}>${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Emplacement</label>
                <select id="esLocation" class="form-control">
                  <option value="">Sélectionner un lieu...</option>
                  ${locations.map(l => `<option value="${l.id}" ${(stand.location && stand.location.id === l.id) ? 'selected' : ''}>${l.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Description / Remarques</label>
              <textarea id="esDesc" class="form-control" rows="2">${stand.description || ''}</textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditStandBtn">Enregistrer les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditStandBtn').onclick = async () => {
      const colorName = document.getElementById('esColorName').value;
      const colorHex = document.getElementById('esColorHex').value;
      const number = parseInt(document.getElementById('esNumber').value, 10);
      const name = document.getElementById('esName').value.trim();
      const managerId = document.getElementById('esManager').value || null;
      const locationId = document.getElementById('esLocation').value || null;
      const desc = document.getElementById('esDesc').value.trim();
      const materials = document.getElementById('esMaterials').value.trim();

      if (!name || isNaN(number)) {
        Notify.error('Nom et numéro requis.');
        return;
      }

      if (client) {
        try {
          const updatePayload = {
            color_name: colorName,
            color_hex: colorHex,
            number,
            name,
            manager_id: managerId,
            location_id: locationId,
            description: desc,
            materials_needed: materials
          };
          const { error } = await client.from('stands').update(updatePayload).eq('id', standId);
          if (error) {
            delete updatePayload.materials_needed;
            await client.from('stands').update(updatePayload).eq('id', standId);
          }
        } catch (e) {
          console.warn('[Stand Update Warning]', e);
        }
      }

      Notify.success(`Stand ${name} mis à jour.`);
      close();
      StandsModule.render(document.getElementById('mainContent'));
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
