/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 3 : DÉCORATION & ORGANISATION DE L'ESPACE
 * 
 * Responsable : admin_decoration
 * Missions :
 * - Délimitation et suivi d'installation des 10 zones clés officielles
 * - Catalogue des structures et espaces (Stands de jeux, Restauration, Manèges gonflables, Scène, Caisses)
 * - Inventaire du matériel décoratif (ballons, guirlandes, mobilier, tentes)
 * - Synchronisation directe avec le module Stade 3D de Mbao (Plan d'implantation)
 */

const DecorationModule = {
  currentTab: 'structures', // 'structures', 'zones', 'items', 'layout'

  DEFAULT_10_ZONES: [
    { code: 'entree', name: '1. Zone Entrée', description: 'Accueil des visiteurs, portique ballons, contrôle des flux et billetterie accueil', manager: 'Équipe Accueil & Déco', status: 'en_cours', icon: '🚪' },
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
  customStructures: [],
  aggregatedPlacements: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
          <div class="card-title">
            <span>🎨</span> Pôle 3 : Décoration &amp; Organisation de l'Espace
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('locations')">
              <span>🏟️</span> Ouvrir le Stade 3D de Mbao
            </button>
            <button class="btn btn-primary btn-sm" onclick="DecorationModule.openCreateStructureModal()">
              <span>➕</span> Ajouter une Structure / Manège
            </button>
            <button class="btn btn-secondary btn-sm" onclick="DecorationModule.openCreateItemModal()">
              <span>🎈</span> Ajouter Matériel Déco
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="decorStatsGrid">
            <div class="stat-card">
              <div class="stat-label">Structures &amp; Stands Répertoriés</div>
              <div class="stat-value" id="decorTotalStructures" style="color: var(--primary);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Placés dans le Stade 3D</div>
              <div class="stat-value" id="decorPlacedCount" style="color: var(--success, #10b981);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Zones Aménagées / 10</div>
              <div class="stat-value" id="decorZonesDone">0 / 10</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Matériel Déco &amp; Mobilier</div>
              <div class="stat-value" id="decorItemsNeeded">0</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabDecorStructures" onclick="DecorationModule.switchTab('structures')">
              🎪 Structures, Manèges &amp; Stands
            </button>
            <button class="tab-btn" id="tabDecorZones" onclick="DecorationModule.switchTab('zones')">
              🗺️ Les 10 Zones du Site
            </button>
            <button class="tab-btn" id="tabDecorItems" onclick="DecorationModule.switchTab('items')">
              🎈 Matériel Déco &amp; Mobilier
            </button>
            <button class="tab-btn" id="tabDecorLayout" onclick="DecorationModule.switchTab('layout')">
              📐 Guide d'Implantation &amp; Flux
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
      tab === 'structures' ? 'tabDecorStructures' : (tab === 'zones' ? 'tabDecorZones' : (tab === 'items' ? 'tabDecorItems' : 'tabDecorLayout'))
    );
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        // 1. Zones
        const { data: zData } = await client.from('decor_zones').select('*');
        if (zData && zData.length > 0) this.zones = zData;

        // 2. Déco items
        const { data: iData } = await client.from('decor_items').select('*').order('created_at', { ascending: false });
        if (iData) this.items = iData;

        // 3. Custom Structures & Placements 3D
        try {
          const { data: sData } = await client.from('stadium_placements').select('*').order('created_at', { ascending: true });
          if (sData) this.customStructures = sData;
        } catch (e) {
          console.warn('[DecorationModule] stadium_placements non initialisé:', e.message);
        }
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
          { id: 'dec-1', name: 'Arche de ballons multicolores d\'accueil', category: 'ballons', zone_code: 'entree', qty_needed: 2, qty_available: 2, status: 'installe', responsible_name: 'David L.' },
          { id: 'dec-2', name: 'Guirlandes fanions Love & Charity (100m)', category: 'guirlandes', zone_code: 'jeux', qty_needed: 5, qty_available: 5, status: 'en_cours', responsible_name: 'Sarah M.' },
          { id: 'dec-3', name: 'Barnum 3x3m étanche Billetterie', category: 'tentes_barnums', zone_code: 'billetterie', qty_needed: 1, qty_available: 1, status: 'installe', responsible_name: 'Équipe Logistique' },
          { id: 'dec-4', name: 'Tables pliantes de dégustation snack', category: 'tables_chaises', zone_code: 'restauration', qty_needed: 12, qty_available: 12, status: 'installe', responsible_name: 'Mamadou S.' },
          { id: 'dec-5', name: 'Chaises pliantes espace repos familles', category: 'tables_chaises', zone_code: 'repos', qty_needed: 40, qty_available: 35, status: 'en_cours', responsible_name: 'Bénévoles' },
          { id: 'dec-6', name: 'Banderole officielle Love & Charity 2026', category: 'banderoles', zone_code: 'organisation', qty_needed: 2, qty_available: 2, status: 'valide', responsible_name: 'Mounir' }
        ];
        localStorage.setItem('kermesse_decor_items', JSON.stringify(this.items));
      }
    }

    // Fallback custom structures
    if (!this.customStructures || this.customStructures.length === 0) {
      const storedStructs = localStorage.getItem('kermesse_stadium_placements');
      if (storedStructs) {
        try { this.customStructures = JSON.parse(storedStructs); } catch (e) {}
      } else {
        // Pré-remplissage standard avec structures festives typiques pour le Stade de Mbao
        this.customStructures = [
          {
            id: 'struct-1',
            item_type: 'manege',
            name: '🏰 Château Gonflable Géant "Jungle"',
            category: 'maneges',
            icon: '🏰',
            color: '#3b82f6',
            pos_x: -25,
            pos_y: 0,
            pos_z: 32,
            rotation_y: 0,
            scale_x: 6,
            scale_z: 6,
            is_placed: true,
            zone_code: 'jeux',
            custom_details: { manager: 'Prestataire Attractions Dakar', dimensions: '6m x 6m' }
          },
          {
            id: 'struct-2',
            item_type: 'manege',
            name: '🤸 Trampoline 4 Pistes',
            category: 'maneges',
            icon: '🤸',
            color: '#eab308',
            pos_x: -12,
            pos_y: 0,
            pos_z: 32,
            rotation_y: 0,
            scale_x: 5,
            scale_z: 5,
            is_placed: true,
            zone_code: 'jeux',
            custom_details: { manager: 'Équipe Animation', dimensions: '5m x 5m' }
          },
          {
            id: 'struct-3',
            item_type: 'scene',
            name: '🎤 Grande Scène & Sono Podium',
            category: 'scene',
            icon: '🎤',
            color: '#8b5cf6',
            pos_x: 0,
            pos_y: 0,
            pos_z: -35,
            rotation_y: 180,
            scale_x: 10,
            scale_z: 6,
            is_placed: true,
            zone_code: 'organisation',
            custom_details: { manager: 'DJ & Régie Son Mbao', dimensions: '10m x 6m' }
          },
          {
            id: 'struct-4',
            item_type: 'logistique',
            name: '🚑 Poste de Secours & Croix-Rouge',
            category: 'secours',
            icon: '🚑',
            color: '#ef4444',
            pos_x: 35,
            pos_y: 0,
            pos_z: -28,
            rotation_y: 90,
            scale_x: 4,
            scale_z: 3,
            is_placed: true,
            zone_code: 'organisation',
            custom_details: { manager: 'Équipe Médicale & Secours', dimensions: '4m x 3m' }
          }
        ];
        localStorage.setItem('kermesse_stadium_placements', JSON.stringify(this.customStructures));
      }
    }

    await this.aggregateAllStructures();
    this.updateStats();
    this.renderCurrentTab();
  },

  /**
   * Agrège TOUTES les entités réelles pour le Stade 3D :
   * 1. Les Stands officiels du Pôle 5
   * 2. La Caisse Restauration / Buvette du Pôle 4
   * 3. Les Caisses Billetterie du Pôle 2
   * 4. Les Structures personnalisées créées dans ce module (Manèges, Scènes, Barnums, etc.)
   */
  async aggregateAllStructures() {
    const list = [];
    const client = SupabaseClient.client;

    // 1. Stands réels de jeux (Pôle 5)
    let standsList = [];
    try {
      if (client) {
        const { data: stands } = await client.from('stands').select('id, number, color_name, color_hex, name, description').order('number');
        if (stands && stands.length > 0) standsList = stands;
      }
    } catch (e) {}

    if (standsList.length === 0) {
      const storedStands = localStorage.getItem('kermesse_stands');
      if (storedStands) {
        try { standsList = JSON.parse(storedStands); } catch (e) {}
      }
    }

    if (standsList.length === 0) {
      // 10 stands officiels par défaut
      standsList = [
        { id: 'std-1', number: 1, name: 'Chamboule-Tout', color_name: 'Rouge', color_hex: '#dc2626' },
        { id: 'std-2', number: 2, name: 'Tir aux Ballons', color_name: 'Bleu', color_hex: '#2563eb' },
        { id: 'std-3', number: 3, name: 'Pêche aux Canards', color_name: 'Jaune', color_hex: '#ca8a04' },
        { id: 'std-4', number: 4, name: 'Course en Sacs', color_name: 'Vert', color_hex: '#16a34a' },
        { id: 'std-5', number: 5, name: 'Maquillage Enfants', color_name: 'Rose', color_hex: '#db2777' },
        { id: 'std-6', number: 6, name: 'Lancer d\'Anneaux', color_name: 'Orange', color_hex: '#ea580c' },
        { id: 'std-7', number: 7, name: 'Mini-Bowling Forain', color_name: 'Violet', color_hex: '#7c3aed' },
        { id: 'std-8', number: 8, name: 'Roulette des Lots', color_name: 'Cyan', color_hex: '#0891b2' },
        { id: 'std-9', number: 9, name: 'Jeu du Palet', color_name: 'Gris', color_hex: '#475569' },
        { id: 'std-10', number: 10, name: 'Tombola Géante', color_name: 'Or', color_hex: '#d97706' }
      ];
    }

    // Récupération des positions déjà enregistrées
    const savedLayout = this.getSavedPlacementsMap();

    // Insertion des Stands
    standsList.forEach((st, idx) => {
      const key = `stand_${st.id || st.number}`;
      const saved = savedLayout[key];
      // Par défaut, répartis en allée de kermesse le long de la ligne de touche si non placé
      const defaultX = -35 + (idx % 5) * 16;
      const defaultZ = idx < 5 ? 16 : -16;

      list.push({
        id: key,
        source_id: String(st.id || st.number),
        item_type: 'stand',
        name: `Stand ${st.number} : ${st.name}`,
        subtitle: `Couleur : ${st.color_name || 'Standard'}`,
        category: 'stands',
        icon: '🎪',
        color: st.color_hex || '#dc2626',
        pos_x: saved ? saved.pos_x : defaultX,
        pos_y: 0,
        pos_z: saved ? saved.pos_z : defaultZ,
        rotation_y: saved ? saved.rotation_y : (idx < 5 ? 180 : 0),
        scale_x: 3.5,
        scale_z: 3,
        is_placed: saved ? (saved.is_placed !== false) : true,
        zone_code: 'jeux',
        custom_details: { number: st.number, stand_name: st.name, color_name: st.color_name }
      });
    });

    // 2. Restauration & Buvette (Pôle 4)
    const restoKey = 'resto_central';
    const savedResto = savedLayout[restoKey];
    list.push({
      id: restoKey,
      source_id: 'p4_resto',
      item_type: 'food',
      name: '🍔 Grande Buvette & Restauration',
      subtitle: 'Grillades, Pastels, Boissons fraîches',
      category: 'restauration',
      icon: '🍔',
      color: '#ea580c',
      pos_x: savedResto ? savedResto.pos_x : 32,
      pos_y: 0,
      pos_z: savedResto ? savedResto.pos_z : 12,
      rotation_y: savedResto ? savedResto.rotation_y : -90,
      scale_x: 8,
      scale_z: 4,
      is_placed: savedResto ? (savedResto.is_placed !== false) : true,
      zone_code: 'restauration',
      custom_details: { manager: 'Admin Restauration' }
    });

    // 3. Billetterie & Caisses (Pôle 2)
    const caisseKey = 'caisse_entree';
    const savedCaisse = savedLayout[caisseKey];
    list.push({
      id: caisseKey,
      source_id: 'p2_caisse',
      item_type: 'caisse',
      name: '🎟️ Guichet Billetterie & Caisse Entrée',
      subtitle: 'Vente des billets, bracelets & jetons',
      category: 'billetterie',
      icon: '🎟️',
      color: '#10b981',
      pos_x: savedCaisse ? savedCaisse.pos_x : 0,
      pos_y: 0,
      pos_z: savedCaisse ? savedCaisse.pos_z : 48,
      rotation_y: savedCaisse ? savedCaisse.rotation_y : 0,
      scale_x: 4.5,
      scale_z: 2.5,
      is_placed: savedCaisse ? (savedCaisse.is_placed !== false) : true,
      zone_code: 'billetterie',
      custom_details: { manager: 'Admin Billetterie' }
    });

    // 4. Structures Personnalisées (Manèges, Scène, Tentes...)
    (this.customStructures || []).forEach(cs => {
      const key = cs.id;
      const saved = savedLayout[key];
      list.push({
        id: key,
        source_id: cs.id,
        item_type: cs.item_type || 'custom',
        name: cs.name,
        subtitle: cs.custom_details?.dimensions ? `Dim: ${cs.custom_details.dimensions}` : 'Structure festive',
        category: cs.category || 'maneges',
        icon: cs.icon || '🎪',
        color: cs.color || '#3b82f6',
        pos_x: saved ? saved.pos_x : (cs.pos_x || 0),
        pos_y: 0,
        pos_z: saved ? saved.pos_z : (cs.pos_z || 0),
        rotation_y: saved ? saved.rotation_y : (cs.rotation_y || 0),
        scale_x: cs.scale_x || 4,
        scale_z: cs.scale_z || 4,
        is_placed: saved ? (saved.is_placed !== false) : (cs.is_placed !== false),
        zone_code: cs.zone_code || 'jeux',
        custom_details: cs.custom_details || {}
      });
    });

    this.aggregatedPlacements = list;
    return list;
  },

  getSavedPlacementsMap() {
    try {
      const stored = localStorage.getItem('kermesse_stadium_layout_coords');
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      return {};
    }
  },

  savePlacementsMap(map) {
    try {
      localStorage.setItem('kermesse_stadium_layout_coords', JSON.stringify(map));
    } catch (e) {}
  },

  updateStats() {
    const readyZones = this.zones.filter(z => z.status === 'installe' || z.status === 'valide').length;
    const totalStructs = this.aggregatedPlacements.length;
    const placedStructs = this.aggregatedPlacements.filter(p => p.is_placed).length;
    const totalItems = this.items.reduce((sum, i) => sum + (Number(i.qty_needed) || 1), 0);

    const elZ = document.getElementById('decorZonesDone');
    const elTot = document.getElementById('decorTotalStructures');
    const elPl = document.getElementById('decorPlacedCount');
    const elI = document.getElementById('decorItemsNeeded');

    if (elZ) elZ.textContent = `${readyZones} / 10`;
    if (elTot) elTot.textContent = totalStructs;
    if (elPl) elPl.textContent = `${placedStructs} / ${totalStructs}`;
    if (elI) elI.textContent = totalItems;
  },

  renderCurrentTab() {
    const container = document.getElementById('decorTabContent');
    if (!container) return;

    if (this.currentTab === 'structures') {
      this.renderStructuresTab(container);
    } else if (this.currentTab === 'zones') {
      this.renderZonesTab(container);
    } else if (this.currentTab === 'items') {
      this.renderItemsTab(container);
    } else if (this.currentTab === 'layout') {
      this.renderLayoutTab(container);
    }
  },

  // =========================================================================
  // 1. ONGLET STRUCTURES & MANÈGES
  // =========================================================================
  renderStructuresTab(container) {
    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          🏟️ <strong>Catalogue Général des Structures pour le Stade de Mbao :</strong> Vos stands de jeux, buvettes et caisses sont synchronisés automatiquement. Vous pouvez ajouter ici tous vos manèges géants, châteaux gonflables, scènes et barnums avant de les agencer dans la maquette 3D !
        </div>
        <button class="btn btn-primary btn-sm" onclick="App.navigateTo('locations')">
          🚀 Voir sur le Stade 3D
        </button>
      </div>

      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box">
          <input type="text" id="decorStructSearch" class="form-control" placeholder="Rechercher stand, château, scène..." oninput="DecorationModule.filterStructures()">
        </div>
        <div class="filters-group" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
          <select id="decorStructCatFilter" class="form-control" onchange="DecorationModule.filterStructures()">
            <option value="">Toutes les catégories</option>
            <option value="stands">🎪 Stands de Jeux</option>
            <option value="restauration">🍔 Restauration &amp; Buvettes</option>
            <option value="maneges">🏰 Manèges &amp; Gonflables</option>
            <option value="scene">🎤 Scène &amp; Sono</option>
            <option value="billetterie">🎟️ Caisses &amp; Entrée</option>
            <option value="secours">🚑 Secours &amp; Logistique</option>
          </select>
          <select id="decorStructStatusFilter" class="form-control" onchange="DecorationModule.filterStructures()">
            <option value="">Tous les statuts</option>
            <option value="placed">🟢 Placé sur le terrain</option>
            <option value="unplaced">🟠 En attente de placement</option>
          </select>
        </div>
      </div>

      <div class="table-responsive" id="decorStructuresTableContainer">
        ${this.generateStructuresTable(this.aggregatedPlacements)}
      </div>
    `;
  },

  generateStructuresTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎪</div>
          <div class="empty-title">Aucune structure répertoriée</div>
          <div class="empty-desc">Ajoutez vos manèges ou stands pour les visualiser sur le Stade de Mbao.</div>
          <button class="btn btn-primary" onclick="DecorationModule.openCreateStructureModal()">
            <span>➕</span> Ajouter une structure
          </button>
        </div>
      `;
    }

    const catLabels = {
      stands: '🎪 Stand de Jeux',
      restauration: '🍔 Restauration',
      maneges: '🏰 Manège / Gonflable',
      scene: '🎤 Scène & Sono',
      billetterie: '🎟️ Billetterie',
      mobilier: '🪑 Mobilier',
      secours: '🚑 Secours'
    };

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Élément / Structure</th>
            <th>Catégorie</th>
            <th>Couleur</th>
            <th>Dimensions</th>
            <th>Zone</th>
            <th>Position Stade (X, Z)</th>
            <th>Statut Stade 3D</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => {
            const isCustom = s.id.startsWith('struct-');
            return `
              <tr>
                <td>
                  <strong>${s.name}</strong>
                  ${s.subtitle ? `<div style="font-size: 0.75rem; color: var(--gray-500);">${s.subtitle}</div>` : ''}
                </td>
                <td><span class="badge badge-gray">${catLabels[s.category] || s.category}</span></td>
                <td>
                  <span style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    <span style="width: 14px; height: 14px; border-radius: 4px; background: ${s.color}; border: 1px solid rgba(0,0,0,0.15);"></span>
                    <span style="font-size: 0.75rem; color: var(--gray-600);">${s.color}</span>
                  </span>
                </td>
                <td><span class="badge badge-primary">${s.scale_x}m × ${s.scale_z}m</span></td>
                <td><span class="badge badge-gray">${s.zone_code || 'Général'}</span></td>
                <td>
                  <span style="font-family: monospace; font-size: 0.8rem;">
                    X: ${Math.round(s.pos_x)}m | Z: ${Math.round(s.pos_z)}m
                  </span>
                </td>
                <td>
                  ${s.is_placed 
                    ? `<span class="badge badge-success">🟢 Placé (${Math.round(s.pos_x)}m, ${Math.round(s.pos_z)}m)</span>` 
                    : `<span class="badge badge-warning">🟠 En attente</span>`}
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('locations')" title="Voir et déplacer dans le stade 3D">
                    📍 Positionner
                  </button>
                  ${isCustom ? `
                    <button class="btn-icon danger" onclick="DecorationModule.deleteCustomStructure('${s.id}')" title="Supprimer">
                      🗑️
                    </button>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterStructures() {
    const q = (document.getElementById('decorStructSearch')?.value || '').toLowerCase();
    const c = document.getElementById('decorStructCatFilter')?.value;
    const st = document.getElementById('decorStructStatusFilter')?.value;

    const filtered = this.aggregatedPlacements.filter(s => {
      const matchText = (s.name || '').toLowerCase().includes(q) || (s.subtitle || '').toLowerCase().includes(q);
      const matchCat = !c || s.category === c;
      const matchStatus = !st || (st === 'placed' ? s.is_placed : !s.is_placed);
      return matchText && matchCat && matchStatus;
    });

    const container = document.getElementById('decorStructuresTableContainer');
    if (container) container.innerHTML = this.generateStructuresTable(filtered);
  },

  openCreateStructureModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>➕ Ajouter une Structure / Manège (Stade de Mbao)</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createStructForm">
            <div class="form-group">
              <label>Nom de la structure *</label>
              <input type="text" id="strName" class="form-control" required placeholder="Ex: Château Gonflable Pirate, Grande Scène Concert, Stand Barbe à papa...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Type / Gabarit 3D *</label>
                <select id="strType" class="form-control" required onchange="DecorationModule.onStructTypeChange(this.value)">
                  <option value="manege">🏰 Manège / Château gonflable</option>
                  <option value="scene">🎤 Scène / Podium sono</option>
                  <option value="tente">🎪 Grand Barnum / Tente</option>
                  <option value="food">🍔 Point Restauration / Barbecue</option>
                  <option value="mobilier">🪑 Îlot Tables Pique-Nique</option>
                  <option value="logistique">🚑 Poste de Secours / Logistique</option>
                </select>
              </div>
              <div class="form-group">
                <label>Couleur principale *</label>
                <input type="color" id="strColor" class="form-control" value="#3b82f6" style="height: 42px; padding: 2px;">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Largeur (en mètres) *</label>
                <input type="number" id="strWidth" class="form-control" min="1" max="50" value="6" required>
              </div>
              <div class="form-group">
                <label>Longueur (en mètres) *</label>
                <input type="number" id="strLength" class="form-control" min="1" max="50" value="6" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Zone d'affectation</label>
                <select id="strZone" class="form-control">
                  ${this.zones.map(z => `<option value="${z.code}">${z.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Responsable / Prestataire</label>
                <input type="text" id="strManager" class="form-control" placeholder="Ex: Prestataire Sénégal Attractions, DJ Mbao...">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveStructBtn">Créer la structure</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveStructBtn').onclick = async () => {
      const name = document.getElementById('strName').value.trim();
      const item_type = document.getElementById('strType').value;
      const color = document.getElementById('strColor').value;
      const scale_x = parseFloat(document.getElementById('strWidth').value) || 6;
      const scale_z = parseFloat(document.getElementById('strLength').value) || 6;
      const zone_code = document.getElementById('strZone').value;
      const manager = document.getElementById('strManager').value.trim();

      if (!name) {
        Notify.error('Veuillez saisir un nom pour cette structure.');
        return;
      }

      const icons = {
        manege: '🏰',
        scene: '🎤',
        tente: '🎪',
        food: '🍔',
        mobilier: '🪑',
        logistique: '🚑'
      };

      const newStruct = {
        id: 'struct-' + Date.now(),
        item_type,
        name,
        category: item_type === 'food' ? 'restauration' : (item_type === 'logistique' ? 'secours' : item_type),
        icon: icons[item_type] || '🎪',
        color,
        pos_x: 0,
        pos_y: 0,
        pos_z: 0,
        rotation_y: 0,
        scale_x,
        scale_z,
        is_placed: false,
        zone_code,
        custom_details: { manager: manager || null, dimensions: `${scale_x}m x ${scale_z}m` },
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('stadium_placements').insert([{
            item_type: newStruct.item_type,
            name: newStruct.name,
            category: newStruct.category,
            icon: newStruct.icon,
            color: newStruct.color,
            pos_x: 0,
            pos_y: 0,
            pos_z: 0,
            rotation_y: 0,
            scale_x: newStruct.scale_x,
            scale_z: newStruct.scale_z,
            is_placed: false,
            zone_code: newStruct.zone_code,
            custom_details: newStruct.custom_details
          }]).select();
          if (data && data[0]) newStruct.id = data[0].id;
        } catch (e) {
          console.warn('[DecorationModule] Save Supabase error:', e);
        }
      }

      this.customStructures.push(newStruct);
      localStorage.setItem('kermesse_stadium_placements', JSON.stringify(this.customStructures));

      Notify.success(`Structure "${name}" créée avec succès.`);
      close();
      await this.aggregateAllStructures();
      this.updateStats();
      this.renderCurrentTab();
    };
  },

  onStructTypeChange(type) {
    const w = document.getElementById('strWidth');
    const l = document.getElementById('strLength');
    const c = document.getElementById('strColor');
    if (!w || !l || !c) return;

    if (type === 'manege') {
      w.value = 8; l.value = 8; c.value = '#3b82f6';
    } else if (type === 'scene') {
      w.value = 12; l.value = 7; c.value = '#8b5cf6';
    } else if (type === 'tente') {
      w.value = 4; l.value = 4; c.value = '#ffffff';
    } else if (type === 'food') {
      w.value = 6; l.value = 3; c.value = '#ea580c';
    } else if (type === 'mobilier') {
      w.value = 5; l.value = 5; c.value = '#10b981';
    } else if (type === 'logistique') {
      w.value = 4; l.value = 3; c.value = '#ef4444';
    }
  },

  async deleteCustomStructure(id) {
    if (!confirm('Supprimer cette structure personnalisée ?')) return;

    this.customStructures = this.customStructures.filter(s => s.id !== id);
    const client = SupabaseClient.client;
    if (client && !id.startsWith('struct-')) {
      try {
        await client.from('stadium_placements').delete().eq('id', id);
      } catch (e) {}
    }

    localStorage.setItem('kermesse_stadium_placements', JSON.stringify(this.customStructures));
    Notify.info('Structure supprimée.');
    await this.aggregateAllStructures();
    this.updateStats();
    this.renderCurrentTab();
  },

  // =========================================================================
  // 2. ONGLET LES 10 ZONES
  // =========================================================================
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
          📐 <strong>Les 10 Zones Officielles du Stade de Mbao :</strong> Définition des espaces pour la circulation, les accès et la sécurité. Cliquez sur "⚙️ Statut" pour mettre à jour l'avancement de chaque zone.
        </div>
      </div>

      <div class="decor-zones-cards-grid">
        ${this.zones.map(z => {
          const st = statusLabels[z.status] || { label: z.status, badge: 'badge-gray' };
          const zoneStructures = this.aggregatedPlacements.filter(s => s.zone_code === z.code);
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

                <div style="font-size: 0.78rem; color: var(--gray-500); margin-bottom: 0.75rem; line-height: 1.6;">
                  <div>👤 <strong>Responsable :</strong> ${z.manager || 'Non assigné'}</div>
                  <div>🎪 <strong>Structures rattachées :</strong> ${zoneStructures.length}</div>
                  <div>🎈 <strong>Matériel déco :</strong> ${zoneItems.length} lot(s)</div>
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

  // =========================================================================
  // 3. ONGLET MATÉRIEL DÉCO & MOBILIER
  // =========================================================================
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
          <div class="empty-desc">Enregistrez les guirlandes, ballons, barnums et chaises pour la kermesse.</div>
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
  },

  // =========================================================================
  // 4. ONGLET GUIDE D'IMPLANTATION & FLUX
  // =========================================================================
  renderLayoutTab(container) {
    container.innerHTML = `
      <div class="card" style="background: #f8fafc; border: 1px solid var(--gray-200); margin-bottom: 1.5rem;">
        <div class="card-body">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-size: 1.1rem; color: var(--gray-900); margin-bottom: 0.25rem;">
                📐 Guide &amp; Schéma d'Organisation (Stade de Mbao)
              </h3>
              <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 0;">
                Organisation générale recommandée pour la kermesse de Mbao : accès billetterie au portail principal, allées de jeux et manèges.
              </p>
            </div>
            <button class="btn btn-primary" onclick="App.navigateTo('locations')">
              🏟️ Lancer la Maquette 3D Interactive
            </button>
          </div>

          <div class="decor-zones-schematic">
            <!-- Colonne Gauche : Accès & Billetterie -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #dbeafe; border: 2px dashed #2563eb; padding: 1rem; border-radius: 8px;">
                🚪 1. Entrée Principale (Portail Mbao)
                <div style="font-size: 0.75rem; font-weight: normal; color: #1e40af;">Portique d'accueil & Contrôle vigiles</div>
              </div>
              <div style="background: #fef3c7; border: 2px dashed #d97706; padding: 1rem; border-radius: 8px;">
                🎟️ 3. Billetterie & Caisses
                <div style="font-size: 0.75rem; font-weight: normal; color: #92400e;">File d'attente abritée & distribution tickets</div>
              </div>
              <div style="background: #e0e7ff; border: 2px dashed #4338ca; padding: 1rem; border-radius: 8px;">
                🔒 9. Espace Caisse Centrale
                <div style="font-size: 0.75rem; font-weight: normal; color: #3730a3;">Bureau sécurisé & Dépôts réguliers</div>
              </div>
            </div>

            <!-- Colonne Centrale : Allée Jeux & Restauration -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #dcfce7; border: 2px solid #16a34a; padding: 1.25rem; border-radius: 8px;">
                🎯 5. Grande Allée des 10 Stands & Jeux
                <div style="font-size: 0.75rem; font-weight: normal; color: #166534; margin-top: 4px;">
                  Alignement des 10 stands de jeux numérotés avec repères couleurs le long de la pelouse
                </div>
              </div>
              <div style="background: #e0f2fe; border: 2px dashed #0284c7; padding: 1rem; border-radius: 8px;">
                🏰 Zone Manèges & Jeux Gonflables
                <div style="font-size: 0.75rem; font-weight: normal; color: #0369a1;">Châteaux gonflables, trampolines et manèges géants</div>
              </div>
              <div class="decor-sub-grid">
                <div style="background: #fed7aa; border: 2px dashed #ea580c; padding: 1rem; border-radius: 8px;">
                  🍔 4. Restauration & Buvette
                  <div style="font-size: 0.75rem; font-weight: normal; color: #9a3412;">Grillades & Pastels</div>
                </div>
                <div style="background: #f3e8ff; border: 2px dashed #9333ea; padding: 1rem; border-radius: 8px;">
                  🪑 7. Espace Repos Familles
                  <div style="font-size: 0.75rem; font-weight: normal; color: #6b21a8;">Tables & Chaises ombragées</div>
                </div>
              </div>
            </div>

            <!-- Colonne Droite : Scène, Lots, Secours -->
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="background: #f3e8ff; border: 2px solid #7c3aed; padding: 1rem; border-radius: 8px;">
                🎤 Grande Scène & Podium Kermesse
                <div style="font-size: 0.75rem; font-weight: normal; color: #5b21b6;">Concerts, régie sono et tirage tombola</div>
              </div>
              <div style="background: #fce7f3; border: 2px dashed #db2777; padding: 1rem; border-radius: 8px;">
                🎁 6. Comptoir Lots & Tombola
                <div style="font-size: 0.75rem; font-weight: normal; color: #9d174d;">Retrait des cadeaux gagnants</div>
              </div>
              <div style="background: #fee2e2; border: 2px dashed #dc2626; padding: 1rem; border-radius: 8px;">
                🚑 10. QG Direction & Poste Médical
                <div style="font-size: 0.75rem; font-weight: normal; color: #991b1b;">Croix-Rouge, secours et sécurité générale</div>
              </div>
              <div style="background: #fee2e2; border: 2px dashed #b91c1c; padding: 1rem; border-radius: 8px;">
                🚶 2. Zone Sortie Définitive
                <div style="font-size: 0.75rem; font-weight: normal; color: #7f1d1d;">Sens unique & restitution gobelets</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};

window.DecorationModule = DecorationModule;
