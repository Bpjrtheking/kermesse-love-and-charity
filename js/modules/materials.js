/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : MATÉRIEL (INVENTAIRE, PROPRIÉTAIRES & RESPONSABILITÉ)
 * 
 * Traçabilité du matériel :
 * - Statut : À nous / Emprunté / Loué / À identifier
 * - Propriétaire (École, Association, Stade, Tiers...)
 * - Emplacement physique actuel
 * - Responsable actuel
 */

const MaterialsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📦</span> Inventaire du Matériel de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="MaterialsModule.openCreateOwnerModal()">
              <span>🏢</span> Nouveau Propriétaire
            </button>
            <button class="btn btn-primary btn-sm" onclick="MaterialsModule.openCreateMaterialModal()">
              <span>➕</span> Ajouter du Matériel
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="matSearch" placeholder="Rechercher par nom, catégorie, lieu..." oninput="MaterialsModule.filterTable()">
            </div>
            <div class="filters-group">
              <select id="matStatusFilter" class="filter-select" onchange="MaterialsModule.filterTable()">
                <option value="">Tous statuts de propriété</option>
                <option value="a_nous">À nous (Association L&C)</option>
                <option value="emprunte">Emprunté</option>
                <option value="loue">Loué</option>
                <option value="a_identifier">À identifier</option>
              </select>
            </div>
          </div>

          <div class="table-responsive" id="materialsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">📦</div>
              <div class="empty-title">Aucun matériel enregistré</div>
              <div class="empty-desc">Enregistrez les chaises, tentes, sonos, rallonges ou tables utilisées lors de la kermesse avec leur propriétaire d'origine.</div>
              <button class="btn btn-primary" onclick="MaterialsModule.openCreateMaterialModal()">
                <span>➕</span> Enregistrer le premier équipement
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
      const { data: materials, error } = await client
        .from('materials')
        .select(`
          id, name, category, ownership_status, condition, quantity_total, status, notes,
          owner:material_owners(id, name, type),
          location:locations(id, name),
          responsible:members(id, first_name, last_name)
        `)
        .order('name');

      if (error) throw error;
      this.renderTable(materials || []);
    } catch (e) {
      console.error('[MaterialsModule Error]', e);
    }
  },

  renderTable(materials) {
    const container = document.getElementById('materialsTableContainer');
    if (!container) return;

    if (!materials || materials.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Aucun matériel enregistré</div>
          <div class="empty-desc">Enregistrez les chaises, tentes, sonos, rallonges ou tables utilisées lors de la kermesse avec leur propriétaire d'origine.</div>
          <button class="btn btn-primary" onclick="MaterialsModule.openCreateMaterialModal()">
            <span>➕</span> Enregistrer le premier équipement
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
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

  filterTable() {
    const q = (document.getElementById('matSearch').value || '').toLowerCase();
    const status = document.getElementById('matStatusFilter').value;
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
                  <option value="sonorisation">Sonorisation & Micros</option>
                  <option value="electricite">Électricité & Rallonges</option>
                  <option value="structure_tente">Tentes & Barnums</option>
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
                <label>Statut de propriété *</label>
                <select id="matOwnership" class="form-control">
                  <option value="emprunte">Emprunté (à restituer après)</option>
                  <option value="a_nous">À nous (Love and Charity)</option>
                  <option value="loue">Loué avec contrat</option>
                  <option value="a_identifier">À identifier</option>
                </select>
              </div>
              <div class="form-group">
                <label>Propriétaire du matériel</label>
                <select id="matOwner" class="form-control">
                  <option value="">Sélectionner un propriétaire...</option>
                  ${owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Emplacement Actuel</label>
                <select id="matLocation" class="form-control">
                  <option value="">Sélectionner un lieu...</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Bénévole Responsable</label>
                <select id="matResponsible" class="form-control">
                  <option value="">Sélectionner un bénévole...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>État de départ</label>
              <select id="matCondition" class="form-control">
                <option value="bon_etat">Bon état général</option>
                <option value="neuf">Neuf / Parfait état</option>
                <option value="use">Usé mais fonctionnel</option>
                <option value="endommage">Endommagé / Fragile</option>
              </select>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveMatBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveMatBtn').onclick = async () => {
      const name = document.getElementById('matName').value.trim();
      const cat = document.getElementById('matCategory').value;
      const qty = parseInt(document.getElementById('matQty').value, 10);
      const ownership = document.getElementById('matOwnership').value;
      const ownerId = document.getElementById('matOwner').value || null;
      const locationId = document.getElementById('matLocation').value || null;
      const responsibleId = document.getElementById('matResponsible').value || null;
      const condition = document.getElementById('matCondition').value;

      if (!name || isNaN(qty)) {
        Notify.error('Veuillez renseigner le nom et la quantité.');
        return;
      }

      if (client) {
        const { error } = await client.from('materials').insert([{
          name,
          category: cat,
          quantity_total: qty,
          ownership_status: ownership,
          owner_id: ownerId,
          current_location_id: locationId,
          current_responsible_id: responsibleId,
          condition,
          status: 'disponible'
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_MATERIEL', 'material', null, `Création du matériel ${name} (${qty} unités, ${ownership})`);
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
          <h3>Nouveau Propriétaire / Partenaire Matériel</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createOwnerForm">
            <div class="form-group">
              <label>Nom ou Organisme *</label>
              <input type="text" id="owName" class="form-control" required placeholder="Ex: École ABC, M. Diallo, Stade Municipal, Association Partenaire...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Type d'entité *</label>
                <select id="owType" class="form-control">
                  <option value="ecole">École / Établissement</option>
                  <option value="externe">Personne externe</option>
                  <option value="stade">Stade / Complexe sportif</option>
                  <option value="association">Autre association</option>
                  <option value="autre">Autre organisme</option>
                </select>
              </div>
              <div class="form-group">
                <label>Personne contact</label>
                <input type="text" id="owContact" class="form-control" placeholder="Ex: M. le Directeur, Gardien...">
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
