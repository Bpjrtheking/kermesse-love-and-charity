/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : MATÉRIEL (INVENTAIRE, PROPRIÉTAIRES, LOGISTIQUE & DEMANDES DES STANDS)
 * 
 * Traçabilité du matériel :
 * - Statut : À nous / Emprunté / Loué / À identifier
 * - Propriétaire (École, Association, Stade, Tiers...)
 * - Emplacement physique actuel & Responsable
 * - RÉCEPTION ET TRAITEMENT DES DEMANDES DE MATÉRIEL ÉMISES PAR LES STANDS & JEUX
 */

const MaterialsModule = {
  currentTab: 'inventory', // 'inventory', 'stand_requests'
  materials: [],
  standRequests: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📦</span> Pôle 8 : Logistique &amp; Matériel
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="MaterialsModule.openCreateOwnerModal()">
              <span>🏢</span> Nouveau Propriétaire
            </button>
            <button class="btn btn-primary btn-sm" onclick="MaterialsModule.openCreateMaterialModal()">
              <span>➕</span> Ajouter du Matériel
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- Onglets de navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem;">
            <button class="tab-btn active" id="tabMatInventory" onclick="MaterialsModule.switchTab('inventory')">
              📦 Inventaire du Matériel Lourd
            </button>
            <button class="tab-btn" id="tabMatRequests" onclick="MaterialsModule.switchTab('stand_requests')">
              🎪 Demandes des Stands &amp; Jeux <span class="badge badge-warning" id="pendingMatReqBadge" style="display: none; margin-left: 4px;">0</span>
            </button>
          </div>

          <!-- Dynamic Container -->
          <div id="materialsTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement du matériel et des demandes...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(tab === 'inventory' ? 'tabMatInventory' : 'tabMatRequests');
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        // Matériel lourd
        const { data: materials, error } = await client
          .from('materials')
          .select(`
            id, name, category, ownership_status, condition, quantity_total, status, notes,
            owner:material_owners(id, name, type),
            location:locations(id, name),
            responsible:members(id, first_name, last_name)
          `)
          .order('name');

        if (!error && materials) {
          this.materials = materials;
        }

        // Demandes transmises par les stands
        try {
          const { data: reqs } = await client
            .from('stand_material_requests')
            .select('*')
            .order('created_at', { ascending: false });
          if (reqs) this.standRequests = reqs;
        } catch (e) {}
      }
    } catch (e) {
      console.warn('[MaterialsModule Error]', e);
    }

    // Récupération locale de secours
    const localReqs = JSON.parse(localStorage.getItem('kermesse_stand_material_requests') || '[]');
    if (localReqs.length > 0) {
      this.standRequests = [...this.standRequests, ...localReqs.filter(lr => !this.standRequests.some(r => r.id === lr.id))];
    }

    this.updateBadges();
    this.renderCurrentTab();
  },

  updateBadges() {
    const pendingCount = this.standRequests.filter(r => r.status === 'a_preparer' || r.status === 'en_cours').length;
    const badge = document.getElementById('pendingMatReqBadge');
    if (badge) {
      badge.textContent = pendingCount;
      badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('materialsTabContent');
    if (!container) return;

    if (this.currentTab === 'inventory') {
      this.renderInventoryTab(container);
    } else {
      this.renderRequestsTab(container);
    }
  },

  renderInventoryTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem;">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input type="text" id="matSearch" placeholder="Rechercher par nom, catégorie, lieu..." oninput="MaterialsModule.filterTable()">
        </div>
        <div class="filters-group">
          <select id="matStatusFilter" class="filter-select" onchange="MaterialsModule.filterTable()">
            <option value="">Tous statuts de propriété</option>
            <option value="a_nous">À nous (Association L&amp;C)</option>
            <option value="emprunte">Emprunté</option>
            <option value="loue">Loué</option>
            <option value="a_identifier">À identifier</option>
          </select>
        </div>
      </div>

      <div class="table-responsive" id="materialsTableContainer">
        ${this.generateMaterialsTable(this.materials)}
      </div>
    `;
  },

  generateMaterialsTable(materials) {
    if (!materials || materials.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Aucun matériel enregistré</div>
          <div class="empty-desc">Enregistrez les chaises, tentes, sonos, rallonges ou tables utilisées lors de la kermesse avec leur propriétaire d'origine.</div>
          <button class="btn btn-primary" onclick="MaterialsModule.openCreateMaterialModal()">
            <span>➕</span> Enregistrer le premier équipement
          </button>
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Équipement</th>
            <th>Catégorie</th>
            <th>Propriété</th>
            <th>Quantité</th>
            <th>Emplacement Actuel</th>
            <th>Responsable Actuel</th>
            <th>État</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="materialsTableBody">
          ${materials.map(m => {
            let statusBadge = '<span class="badge badge-success">À nous</span>';
            if (m.ownership_status === 'emprunte') statusBadge = '<span class="badge badge-warning">Emprunté</span>';
            if (m.ownership_status === 'loue') statusBadge = '<span class="badge badge-primary">Loué</span>';
            if (m.ownership_status === 'a_identifier') statusBadge = '<span class="badge badge-danger">À identifier</span>';

            return `
              <tr data-name="${m.name}" data-cat="${m.category}" data-status="${m.ownership_status}" data-loc="${m.location ? m.location.name : ''}">
                <td>
                  <strong>${m.name}</strong>
                  <div style="font-size: 0.78rem; color: var(--gray-500);">
                    Propriétaire : ${m.owner ? m.owner.name : 'Inconnu'}
                  </div>
                </td>
                <td><span class="badge badge-gray">${m.category}</span></td>
                <td>${statusBadge}</td>
                <td><strong>${m.quantity_total} unité(s)</strong></td>
                <td>
                  ${m.location ? `📍 <strong>${m.location.name}</strong>` : '<span style="color: var(--gray-400);">Non défini</span>'}
                </td>
                <td>
                  ${m.responsible ? `👤 ${m.responsible.first_name} ${m.responsible.last_name}` : '<span style="color: var(--gray-400);">Non assigné</span>'}
                </td>
                <td><span class="badge badge-gray">${m.condition}</span></td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('movements')">Déplacer</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  renderRequestsTab(container) {
    const list = this.standRequests;

    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.25rem;">
        <div>
          🚚 <strong>Besoins exprimés par les Stands &amp; Jeux :</strong> Retrouvez ici tous les matériels (tables, chaises, rallonges, barnums, accessoires de jeu) demandés par les responsables de stands. L'équipe logistique doit préparer et livrer ces équipements aux stands concernés.
        </div>
      </div>

      ${(!list || list.length === 0) ? `
        <div class="empty-state">
          <div class="empty-icon">🎪</div>
          <div class="empty-title">Aucune demande de stand reçue</div>
          <div class="empty-desc">Lorsque le responsable des stands ou de jeux créera ses activités et confirmera ses besoins de matériel, les demandes apparaîtront ici pour que vous prépariez les équipements.</div>
        </div>
      ` : `
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Stand / Jeu concerné</th>
                <th>Demandeur Officiel</th>
                <th>Matériaux &amp; Équipements Requis</th>
                <th>Date de la Demande</th>
                <th>Statut Logistique</th>
                <th style="text-align: right;">Action Logistique</th>
              </tr>
            </thead>
            <tbody>
              ${list.map(r => {
                const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';
                
                let badge = '<span class="badge badge-warning">⏳ À préparer / chercher</span>';
                if (r.status === 'en_cours') badge = '<span class="badge badge-primary">🔄 En cours de préparation</span>';
                if (r.status === 'fourni') badge = '<span class="badge badge-success">✅ Fourni &amp; Livré au stand</span>';

                return `
                  <tr>
                    <td>
                      <strong>🎪 ${r.stand_name}</strong>
                      ${r.game_name ? `<div style="font-size: 0.8rem; color: var(--gray-600); margin-top: 2px;">🎯 ${r.game_name}</div>` : ''}
                    </td>
                    <td>
                      <span class="badge badge-gray" style="font-size: 0.85rem;">
                        👤 ${r.requested_by_name || 'Admin Stands'}
                      </span>
                    </td>
                    <td>
                      <div style="font-weight: 600; font-size: 0.9rem; line-height: 1.35; color: var(--gray-900);">
                        📦 ${r.materials_needed}
                      </div>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--gray-500);">${dateStr}</td>
                    <td>${badge}</td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button class="btn btn-secondary btn-sm" onclick="MaterialsModule.cycleRequestStatus('${r.id}')" title="Changer le statut logistique">
                        🔄 Mettre à jour
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `}
    `;
  },

  async cycleRequestStatus(id) {
    const req = this.standRequests.find(r => r.id === id);
    if (!req) return;

    const cycle = {
      'a_preparer': 'en_cours',
      'en_cours': 'fourni',
      'fourni': 'a_preparer'
    };

    req.status = cycle[req.status] || 'en_cours';

    const client = SupabaseClient.client;
    if (client && !id.startsWith('req-')) {
      try {
        await client.from('stand_material_requests').update({ status: req.status }).eq('id', id);
      } catch (e) {}
    }

    // Persistance locale
    const stored = JSON.parse(localStorage.getItem('kermesse_stand_material_requests') || '[]');
    const idx = stored.findIndex(r => r.id === id);
    if (idx >= 0) {
      stored[idx].status = req.status;
      localStorage.setItem('kermesse_stand_material_requests', JSON.stringify(stored));
    }

    AuditLogger.log(
      'STATUT_MATERIEL_STAND',
      'logistics',
      id,
      `Mise à jour du statut matériel pour ${req.stand_name} : ${req.status}`
    );

    Notify.success(`Statut de la demande pour ${req.stand_name} mis à jour : ${req.status.replace('_', ' ')}.`);
    this.updateBadges();
    this.renderCurrentTab();
  },

  filterTable() {
    const q = (document.getElementById('matSearch')?.value || '').toLowerCase();
    const status = document.getElementById('matStatusFilter')?.value;
    const rows = document.querySelectorAll('#materialsTableBody tr');

    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const cat = (r.dataset.cat || '').toLowerCase();
      const loc = (r.dataset.loc || '').toLowerCase();
      const st = r.dataset.status || '';

      const matchText = name.includes(q) || cat.includes(q) || loc.includes(q);
      const matchStatus = !status || st === status;

      r.style.display = matchText && matchStatus ? '' : 'none';
    });
  },

  async openCreateMaterialModal() {
    const client = SupabaseClient.client;
    let owners = [];
    let locations = [];
    let members = [];

    if (client) {
      const { data: o } = await client.from('material_owners').select('id, name');
      const { data: l } = await client.from('locations').select('id, name');
      const { data: m } = await client.from('members').select('id, first_name, last_name');
      owners = o || [];
      locations = l || [];
      members = m || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Matériel</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createMatForm">
            <div class="form-group">
              <label>Désignation du Matériel *</label>
              <input type="text" id="matName" class="form-control" required placeholder="Ex: 50 Chaises plastique, Tente 3x3m, Enceinte sono...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Catégorie *</label>
                <select id="matCategory" class="form-control">
                  <option value="mobilier">Mobilier (Chaises, Tables)</option>
                  <option value="sonorisation">Sonorisation &amp; Micros</option>
                  <option value="electricite">Électricité &amp; Rallonges</option>
                  <option value="structure_tente">Tentes &amp; Barnums</option>
                  <option value="jeux_bois">Jeux en bois / Équipements</option>
                  <option value="autre">Autre matériel</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantité totale *</label>
                <input type="number" id="matQty" class="form-control" value="1" min="1" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Statut de Propriété *</label>
                <select id="matOwnership" class="form-control">
                  <option value="a_nous">À nous (Association L&amp;C)</option>
                  <option value="emprunte">Emprunté</option>
                  <option value="loue">Loué</option>
                  <option value="a_identifier">À identifier</option>
                </select>
              </div>
              <div class="form-group">
                <label>Propriétaire d'origine</label>
                <select id="matOwner" class="form-control">
                  <option value="">Sélectionner un propriétaire...</option>
                  ${owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Emplacement Actuel</label>
                <select id="matLoc" class="form-control">
                  <option value="">Sélectionner un lieu...</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Responsable Actuel</label>
                <select id="matResp" class="form-control">
                  <option value="">Sélectionner un membre...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>État du matériel</label>
              <select id="matCondition" class="form-control">
                <option value="bon">Bon état</option>
                <option value="neuf">Neuf</option>
                <option value="moyen">État moyen / Utilisable</option>
                <option value="abime">Abîmé / À réparer</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveMatBtn">Enregistrer le matériel</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveMatBtn').onclick = async () => {
      const name = document.getElementById('matName').value.trim();
      const category = document.getElementById('matCategory').value;
      const qty = parseInt(document.getElementById('matQty').value, 10);
      const ownership = document.getElementById('matOwnership').value;
      const ownerId = document.getElementById('matOwner').value || null;
      const locationId = document.getElementById('matLoc').value || null;
      const responsibleId = document.getElementById('matResp').value || null;
      const condition = document.getElementById('matCondition').value;

      if (!name || isNaN(qty)) {
        Notify.error('Veuillez renseigner le nom et la quantité.');
        return;
      }

      if (client) {
        const { error } = await client.from('materials').insert([{
          name,
          category,
          quantity_total: qty,
          ownership_status: ownership,
          owner_id: ownerId,
          location_id: locationId,
          responsible_id: responsibleId,
          condition,
          status: 'disponible'
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_MATERIEL', 'material', null, `Création du matériel ${name} (${qty} unités)`);
        Notify.success(`Matériel ${name} enregistré.`);
        close();
        MaterialsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  openCreateOwnerModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouveau Propriétaire de Matériel</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createOwnerForm">
            <div class="form-group">
              <label>Nom ou Organisme *</label>
              <input type="text" id="owName" class="form-control" required placeholder="Ex: École Privée Sacré Cœur, Paroisse, Mairie...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Type de propriétaire</label>
                <select id="owType" class="form-control">
                  <option value="ecole">École / Établissement scolaire</option>
                  <option value="association">Association / ONG</option>
                  <option value="particulier">Particulier / Parent d'élève</option>
                  <option value="prestataire">Prestataire / Loueur pro</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div class="form-group">
                <label>Personne contact</label>
                <input type="text" id="owContact" class="form-control" placeholder="Nom du responsable">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Téléphone de contact</label>
                <input type="tel" id="owPhone" class="form-control" placeholder="Ex: +221 77 000 00 00">
              </div>
              <div class="form-group">
                <label>Adresse physique</label>
                <input type="text" id="owAddress" class="form-control" placeholder="Pour le plan de restitution">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveOwnerBtn">Créer le propriétaire</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveOwnerBtn').onclick = async () => {
      const name = document.getElementById('owName').value.trim();
      const type = document.getElementById('owType').value;
      const contact = document.getElementById('owContact').value.trim();
      const phone = document.getElementById('owPhone').value.trim();
      const address = document.getElementById('owAddress').value.trim();

      if (!name) {
        Notify.error('Veuillez renseigner le nom du propriétaire.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('material_owners').insert([{
          name,
          type,
          contact_person: contact,
          phone,
          address
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_PROPRIETAIRE_MATERIEL', 'material_owner', null, `Création du propriétaire matériel ${name}`);
        Notify.success(`Propriétaire ${name} enregistré.`);
        close();
        MaterialsModule.render(document.getElementById('mainContent'));
      }
    };
  }
};

window.MaterialsModule = MaterialsModule;
