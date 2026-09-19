/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 3 : DÉCORATION & ORGANISATION DE L'ESPACE
 * 
 * Responsable : admin_decoration
 * Missions :
 * - Transformer le lieu et créer l'ambiance festive (ballons, guirlandes, banderoles)
 * - Délimitation des 10 zones clés officielles :
 *   1. Entrée 2. Sortie 3. Billetterie 4. Restauration 5. Jeux 
 *   6. Lots 7. Repos 8. Stockage 9. Caisse 10. Organisation
 * - Installation des barnums/tentes, tables et chaises
 * - Aménagement de la circulation des visiteurs (sécurité et fluidité)
 */

const DecorationModule = {
  currentTab: 'zones', // 'zones', 'items', 'layout'

  DEFAULT_10_ZONES: [
    { code: 'entree', name: '1. Zone Entrée', description: 'Accueil des visiteurs, portique ballons, contrôle des flux et signalétique', manager: 'Équipe Accueil & Déco', status: 'en_cours', icon: '🚪' },
    { code: 'sortie', name: '2. Zone Sortie', description: 'Dégagement large et sécurisé, retour des consignes et poubelles de sortie', manager: 'Équipe Sécurité', status: 'en_attente', icon: '🚶' },
    { code: 'billetterie', name: '3. Zone Billetterie & Tickets', description: 'File d\'attente délimitée, barnum abrité, caisses vente de tickets et jetons', manager: 'Admin Billetterie', status: 'installe', icon: '🎟️' },
    { code: 'restauration', name: '4. Zone Restauration & Buvette', description: 'Stand crêpes/gaufres/boissons, tables mange-debout et espace repas', manager: 'Admin Restauration', status: 'en_cours', icon: '🍔' },
    { code: 'jeux', name: '5. Zone Jeux & Animations', description: 'Allée centrale des stands de kermesse numérotés avec repères de couleur', manager: 'Admin Stands', status: 'en_attente', icon: '🎯' },
    { code: 'lots', name: '6. Zone Remise des Lots', description: 'Comptoir d\'échange des tickets gagnants, vitrine des gros lots & tombola', manager: 'Admin Lots', status: 'en_attente', icon: '🎁' },
    { code: 'repos', name: '7. Espace Repos & Familles', description: 'Zone ombragée, chaises, bancs et espace calme pour enfants et parents', manager: 'Équipe Décoration', status: 'installe', icon: '🪑' },
    { code: 'stockage', name: '8. Espace Stockage & Réserve', description: 'Barnum fermé réservé au stock de denrées, matériel lourd et lots de secours', manager: 'Admin Logistique', status: 'installe', icon: '📦' },
    { code: 'caisse', name: '9. Espace Caisse Centrale', description: 'Bureau sécurisé pour dépôts des fonds de caisse, coffre et comptabilité', manager: 'Admin Finances', status: 'valide', icon: '🔒' },
    { code: 'organisation', name: '10. Espace Direction & Secours', description: 'QG SuperAdmin, poste de premiers secours (défibrillateur) et sonorisation', manager: 'Mounir (SuperAdmin)', status: 'valide', icon: '👑' }
  ],

  zones: [],
  items: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎨</span> Pôle 3 : Décoration & Organisation de l'Espace
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="DecorationModule.openCreateItemModal()">
              <span>➕</span> Ajouter Matériel Déco
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="decorStatsGrid">
            <div class="stat-card">
              <div class="stat-label">Zones Validées / Installées</div>
              <div class="stat-value" id="decorZonesDone" style="color: var(--success, #10b981);">0 / 10</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Éléments Déco Prévus</div>
              <div class="stat-value" id="decorItemsNeeded">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Barnums &amp; Tentes</div>
              <div class="stat-value" id="decorTentsCount" style="color: var(--primary);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Tables &amp; Chaises</div>
              <div class="stat-value" id="decorChairsCount">0</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabDecorZones" onclick="DecorationModule.switchTab('zones')">
              🗺️ Les 10 Zones du Site
            </button>
            <button class="tab-btn" id="tabDecorItems" onclick="DecorationModule.switchTab('items')">
              🎈 Matériel Déco & Mobilier
            </button>
            <button class="tab-btn" id="tabDecorLayout" onclick="DecorationModule.switchTab('layout')">
              📐 Plan d'Implantation & Circulation
            </button>
          </div>

          <!-- Tab Content Container -->
          <div id="decorTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement du pôle Décoration...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btn = document.getElementById(
      tab === 'zones' ? 'tabDecorZones' : (tab === 'items' ? 'tabDecorItems' : 'tabDecorLayout')
    );
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        const { data: zData } = await client.from('decor_zones').select('*');
        if (zData && zData.length > 0) this.zones = zData;

        const { data: iData } = await client.from('decor_items').select('*').order('created_at', { ascending: false });
        if (iData) this.items = iData;
      }
    } catch (e) {
      console.warn('[DecorationModule] Supabase error:', e);
    }

    // Fallback zones
    if (!this.zones || this.zones.length === 0) {
      const storedZones = localStorage.getItem('kermesse_decor_zones');
      this.zones = storedZones ? JSON.parse(storedZones) : this.DEFAULT_10_ZONES;
    }

    // Fallback items
    if (!this.items || this.items.length === 0) {
      const storedItems = localStorage.getItem('kermesse_decor_items');
      if (storedItems) {
        try { this.items = JSON.parse(storedItems); } catch (e) {}
      } else {
        this.items = [
          { id: 'dec-1', name: 'Arche de ballons multicolores', category: 'ballons', zone_code: 'entree', qty_needed: 2, qty_available: 2, status: 'installe', responsible_name: 'David L.' },
          { id: 'dec-2', name: 'Guirlandes fanions Love & Charity (100m)', category: 'guirlandes', zone_code: 'jeux', qty_needed: 5, qty_available: 5, status: 'en_cours', responsible_name: 'Sarah M.' },
          { id: 'dec-3', name: 'Barnum 3x3m étanche Billetterie', category: 'tentes_barnums', zone_code: 'billetterie', qty_needed: 1, qty_available: 1, status: 'installe', responsible_name: 'Équipe Logistique' },
          { id: 'dec-4', name: 'Tables pliantes de dégustation snack', category: 'tables_chaises', zone_code: 'restauration', qty_needed: 12, qty_available: 12, status: 'installe', responsible_name: 'Mamadou S.' },
          { id: 'dec-5', name: 'Chaises pliantes espace repos', category: 'tables_chaises', zone_code: 'repos', qty_needed: 40, qty_available: 35, status: 'en_cours', responsible_name: 'Bénévoles' },
          { id: 'dec-6', name: 'Banderole officielle Love & Charity 2026', category: 'banderoles', zone_code: 'organisation', qty_needed: 2, qty_available: 2, status: 'valide', responsible_name: 'Mounir' }
        ];
        localStorage.setItem('kermesse_decor_items', JSON.stringify(this.items));
      }
    }

    this.updateStats();
    this.renderCurrentTab();
  },

  updateStats() {
    const readyZones = this.zones.filter(z => z.status === 'installe' || z.status === 'valide').length;
    const totalItems = this.items.reduce((sum, i) => sum + (Number(i.qty_needed) || 1), 0);
    const tents = this.items.filter(i => i.category === 'tentes_barnums').reduce((sum, i) => sum + (Number(i.qty_available) || 1), 0);
    const chairs = this.items.filter(i => i.category === 'tables_chaises').reduce((sum, i) => sum + (Number(i.qty_available) || 0), 0);

    const elZ = document.getElementById('decorZonesDone');
    const elI = document.getElementById('decorItemsNeeded');
    const elT = document.getElementById('decorTentsCount');
    const elC = document.getElementById('decorChairsCount');

    if (elZ) elZ.textContent = `${readyZones} / 10`;
    if (elI) elI.textContent = totalItems;
    if (elT) elT.textContent = tents;
    if (elC) elC.textContent = chairs;
  },

  renderCurrentTab() {
    const container = document.getElementById('decorTabContent');
    if (!container) return;

    if (this.currentTab === 'zones') {
      this.renderZonesTab(container);
    } else if (this.currentTab === 'items') {
      this.renderItemsTab(container);
    } else if (this.currentTab === 'layout') {
      this.renderLayoutTab(container);
    }
  },

  // 1. ONGLET LES 10 ZONES
  renderZonesTab(container) {
    const statusLabels = {
      'en_attente': { label: 'En attente', badge: 'badge-gray' },
      'en_cours': { label: 'En aménagement', badge: 'badge-warning' },
      'installe': { label: 'Installé', badge: 'badge-primary' },
      'valide': { label: 'Validé & Prêt', badge: 'badge-success' }
    };

    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.5rem;">
        <div>
          📐 <strong>Les 10 Zones d'Organisation :</strong> Chaque zone dispose de son aménagement propre, de ses barnums et de sa signalétique de sécurité. Cliquez sur une zone pour modifier son statut d'installation.
        </div>
      </div>

      <div class="decor-zones-cards-grid">
        ${this.zones.map(z => {
          const st = statusLabels[z.status] || { label: z.status, badge: 'badge-gray' };
          const zoneItems = this.items.filter(i => i.zone_code === z.code);

          return `
            <div class="card" style="border: 1px solid var(--gray-200); box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
              <div class="card-body" style="padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <span style="font-size: 1.5rem;">${z.icon || '📍'}</span>
                  <span class="badge ${st.badge}">${st.label}</span>
                </div>
                <h4 style="margin: 0.25rem 0 0.5rem 0; font-size: 1.05rem; color: var(--gray-900);">${z.name}</h4>
                <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem; min-height: 2.5rem;">${z.description || '-'}</p>

                <div style="font-size: 0.78rem; color: var(--gray-500); margin-bottom: 0.75rem;">
                  <div>👤 <strong>Responsable :</strong> ${z.manager || 'Non assigné'}</div>
                  <div>📦 <strong>Matériels affectés :</strong> ${zoneItems.length} élément(s)</div>
                </div>

                <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                  <button class="btn btn-secondary btn-sm" onclick="DecorationModule.changeZoneStatus('${z.code}')">
                    ⚙️ Statut
                  </button>
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  changeZoneStatus(code) {
    const zone = this.zones.find(z => z.code === code);
    if (!zone) return;

    const nextStatuses = {
      'en_attente': 'en_cours',
      'en_cours': 'installe',
      'installe': 'valide',
      'valide': 'en_attente'
    };

    zone.status = nextStatuses[zone.status] || 'en_cours';

    const client = SupabaseClient.client;
    if (client) {
      client.from('decor_zones').update({ status: zone.status }).eq('code', code).then();
    }

    localStorage.setItem('kermesse_decor_zones', JSON.stringify(this.zones));
    Notify.success(`Statut de "${zone.name}" mis à jour.`);
    this.updateStats();
    this.renderCurrentTab();
  },

  // 2. ONGLET MATÉRIEL DÉCO & MOBILIER
  renderItemsTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box">
          <input type="text" id="decorItemSearch" class="form-control" placeholder="Rechercher ballon, tente, guirlande..." oninput="DecorationModule.filterItems()">
        </div>
        <div class="filters-group" style="display: flex; gap: 0.5rem;">
          <select id="decorCategoryFilter" class="form-control" onchange="DecorationModule.filterItems()">
            <option value="">Toutes les catégories</option>
            <option value="ballons">🎈 Ballons & Arches</option>
            <option value="guirlandes">✨ Guirlandes & Fanions</option>
            <option value="banderoles">🏷️ Banderoles</option>
            <option value="tentes_barnums">🎪 Tentes & Barnums</option>
            <option value="tables_chaises">🪑 Tables & Chaises</option>
          </select>
        </div>
      </div>

      <div class="table-responsive" id="decorItemsTableContainer">
        ${this.generateItemsTable(this.items)}
      </div>
    `;
  },

  generateItemsTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎈</div>
          <div class="empty-title">Aucun matériel de décoration répertorié</div>
          <div class="empty-desc">Enregistrez les guirlandes, ballons, barnums et tables pour le plan d'installation.</div>
          <button class="btn btn-primary" onclick="DecorationModule.openCreateItemModal()">
            <span>➕</span> Ajouter un matériel déco
          </button>
        </div>
      `;
    }

    const catIcons = {
      'ballons': '🎈 Ballons',
      'guirlandes': '✨ Guirlandes',
      'banderoles': '🏷️ Banderole',
      'tentes_barnums': '🎪 Barnum',
      'tables_chaises': '🪑 Mobilier'
    };

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Matériel Déco / Mobilier</th>
            <th>Catégorie</th>
            <th>Zone Affectée</th>
            <th>Qté Nécessaire</th>
            <th>Qté Disponible</th>
            <th>Statut</th>
            <th>Responsable</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(i => {
            const z = this.zones.find(zone => zone.code === i.zone_code);
            const isInstalled = i.status === 'installe' || i.status === 'valide';
            return `
              <tr>
                <td><strong>${i.name}</strong></td>
                <td><span class="badge badge-gray">${catIcons[i.category] || i.category}</span></td>
                <td>${z ? z.name : i.zone_code || '-'}</td>
                <td><span class="badge badge-primary">${i.qty_needed || 1}</span></td>
                <td><span class="badge ${i.qty_available >= i.qty_needed ? 'badge-success' : 'badge-warning'}">${i.qty_available || 0}</span></td>
                <td><span class="badge ${isInstalled ? 'badge-success' : 'badge-warning'}">${isInstalled ? 'Installé' : 'En attente'}</span></td>
                <td>${i.responsible_name || '-'}</td>
                <td style="text-align: right;">
                  <button class="btn-icon" onclick="DecorationModule.toggleItemStatus('${i.id}')" title="Basculer statut">
                    ${isInstalled ? '↩️' : '✅'}
                  </button>
                  <button class="btn-icon danger" onclick="DecorationModule.deleteItem('${i.id}')" title="Supprimer">
                    🗑️
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterItems() {
    const q = (document.getElementById('decorItemSearch')?.value || '').toLowerCase();
    const c = document.getElementById('decorCategoryFilter')?.value;

    const filtered = this.items.filter(i => {
      const matchText = (i.name || '').toLowerCase().includes(q) || (i.responsible_name || '').toLowerCase().includes(q);
      const matchCat = !c || i.category === c;
      return matchText && matchCat;
    });

    const container = document.getElementById('decorItemsTableContainer');
    if (container) container.innerHTML = this.generateItemsTable(filtered);
  },

  // 3. ONGLET PLAN D'IMPLANTATION & CIRCULATION
  renderLayoutTab(container) {
    container.innerHTML = `
      <div class="card" style="background: #f8fafc; border: 1px solid var(--gray-200); margin-bottom: 1.5rem;">
        <div class="card-body">
          <h3 style="font-size: 1.1rem; color: var(--gray-900); margin-bottom: 0.75rem;">
            📐 Schéma d'Implantation des 10 Zones Kermesse
          </h3>
          <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1.5rem;">
            Organisation spatiale pour assurer la fluidité des visiteurs et la sécurité générale.
          </p>

          <div class="decor-zones-schematic">
            <!-- Colonne Gauche : Accès & Billetterie -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #dbeafe; border: 2px dashed #2563eb; padding: 1rem; border-radius: 8px;">
                🚪 1. Entrée Principale
                <div style="font-size: 0.75rem; font-weight: normal; color: #1e40af;">Arche ballons & Contrôle</div>
              </div>
              <div style="background: #fef3c7; border: 2px dashed #d97706; padding: 1rem; border-radius: 8px;">
                🎟️ 3. Billetterie & Tickets
                <div style="font-size: 0.75rem; font-weight: normal; color: #92400e;">File d'attente abritée</div>
              </div>
              <div style="background: #e0e7ff; border: 2px dashed #4338ca; padding: 1rem; border-radius: 8px;">
                🔒 9. Espace Caisse Centrale
                <div style="font-size: 0.75rem; font-weight: normal; color: #3730a3;">Bureau sécurisé & Dépôts</div>
              </div>
            </div>

            <!-- Colonne Centrale : Allée Jeux & Restauration -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #dcfce7; border: 2px solid #16a34a; padding: 1.5rem; border-radius: 8px;">
                🎯 5. Grande Allée des Stands & Jeux
                <div style="font-size: 0.75rem; font-weight: normal; color: #166534; margin-top: 4px;">
                  Alignement des stands numérotés avec repères couleurs & dégagements
                </div>
              </div>
              <div class="decor-sub-grid">
                <div style="background: #fed7aa; border: 2px dashed #ea580c; padding: 1rem; border-radius: 8px;">
                  🍔 4. Restauration & Buvette
                  <div style="font-size: 0.75rem; font-weight: normal; color: #9a3412;">Snacks & Gobelets</div>
                </div>
                <div style="background: #f3e8ff; border: 2px dashed #9333ea; padding: 1rem; border-radius: 8px;">
                  🪑 7. Espace Repos Familles
                  <div style="font-size: 0.75rem; font-weight: normal; color: #6b21a8;">Tables & Chaises ombragées</div>
                </div>
              </div>
            </div>

            <!-- Colonne Droite : Lots, Secours, Sortie -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #fce7f3; border: 2px dashed #db2777; padding: 1rem; border-radius: 8px;">
                🎁 6. Comptoir Lots & Tombola
                <div style="font-size: 0.75rem; font-weight: normal; color: #9d174d;">Retrait des cadeaux</div>
              </div>
              <div style="background: #fee2e2; border: 2px dashed #dc2626; padding: 1rem; border-radius: 8px;">
                👑 10. QG Direction & Secours
                <div style="font-size: 0.75rem; font-weight: normal; color: #991b1b;">Poste premiers secours & Sono</div>
              </div>
              <div style="background: #f1f5f9; border: 2px dashed #64748b; padding: 1rem; border-radius: 8px;">
                📦 8. Stockage & Réserve
                <div style="font-size: 0.75rem; font-weight: normal; color: #334155;">Zone fermée matériel</div>
              </div>
              <div style="background: #fee2e2; border: 2px dashed #b91c1c; padding: 1rem; border-radius: 8px;">
                🚶 2. Zone Sortie Définitive
                <div style="font-size: 0.75rem; font-weight: normal; color: #7f1d1d;">Sens unique & Dégagement</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openCreateItemModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouveau Matériel Décoration / Mobilier</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createDecorItemForm">
            <div class="form-group">
              <label>Nom de l'élément *</label>
              <input type="text" id="decName" class="form-control" required placeholder="Ex: Barnum 3x3, Guirlande 20m, 10 chaises...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Catégorie *</label>
                <select id="decCat" class="form-control" required>
                  <option value="ballons">🎈 Ballons & Arches</option>
                  <option value="guirlandes">✨ Guirlandes & Fanions</option>
                  <option value="banderoles">🏷️ Banderoles</option>
                  <option value="tentes_barnums">🎪 Tentes & Barnums</option>
                  <option value="tables_chaises">🪑 Tables & Chaises</option>
                  <option value="autre">📦 Autre matériel</option>
                </select>
              </div>
              <div class="form-group">
                <label>Zone d'affectation *</label>
                <select id="decZone" class="form-control" required>
                  ${this.zones.map(z => `<option value="${z.code}">${z.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Quantité nécessaire *</label>
                <input type="number" id="decNeeded" class="form-control" min="1" value="1" required>
              </div>
              <div class="form-group">
                <label>Quantité disponible *</label>
                <input type="number" id="decAvailable" class="form-control" min="0" value="1" required>
              </div>
            </div>

            <div class="form-group">
              <label>Responsable de l'installation</label>
              <input type="text" id="decResponsible" class="form-control" placeholder="Ex: Équipe Déco, David L...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveDecorBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveDecorBtn').onclick = async () => {
      const name = document.getElementById('decName').value.trim();
      const category = document.getElementById('decCat').value;
      const zone_code = document.getElementById('decZone').value;
      const qty_needed = parseInt(document.getElementById('decNeeded').value, 10) || 1;
      const qty_available = parseInt(document.getElementById('decAvailable').value, 10) || 0;
      const responsible_name = document.getElementById('decResponsible').value.trim();

      if (!name) {
        Notify.error('Le nom est obligatoire.');
        return;
      }

      const newItem = {
        id: 'dec-' + Date.now(),
        name,
        category,
        zone_code,
        qty_needed,
        qty_available,
        status: qty_available >= qty_needed ? 'en_cours' : 'prevu',
        responsible_name: responsible_name || null,
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('decor_items').insert([{
            name: newItem.name,
            category: newItem.category,
            zone_code: newItem.zone_code,
            qty_needed: newItem.qty_needed,
            qty_available: newItem.qty_available,
            status: newItem.status,
            responsible_name: newItem.responsible_name
          }]).select();
          if (data && data[0]) newItem.id = data[0].id;
        } catch (e) {}
      }

      DecorationModule.items.unshift(newItem);
      localStorage.setItem('kermesse_decor_items', JSON.stringify(DecorationModule.items));
      Notify.success('Matériel déco enregistré.');
      close();
      DecorationModule.updateStats();
      DecorationModule.renderCurrentTab();
    };
  },

  async toggleItemStatus(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.status = (item.status === 'installe' || item.status === 'valide') ? 'prevu' : 'installe';

    const client = SupabaseClient.client;
    if (client && !id.startsWith('dec-')) {
      await client.from('decor_items').update({ status: item.status }).eq('id', id);
    }

    localStorage.setItem('kermesse_decor_items', JSON.stringify(this.items));
    Notify.success(`Statut mis à jour.`);
    this.updateStats();
    this.renderCurrentTab();
  },

  async deleteItem(id) {
    if (!confirm('Supprimer cet élément de décoration ?')) return;

    this.items = this.items.filter(i => i.id !== id);

    const client = SupabaseClient.client;
    if (client && !id.startsWith('dec-')) {
      await client.from('decor_items').delete().eq('id', id);
    }

    localStorage.setItem('kermesse_decor_items', JSON.stringify(this.items));
    Notify.info('Élément supprimé.');
    this.updateStats();
    this.renderCurrentTab();
  }
};

window.DecorationModule = DecorationModule;
