/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 3 : MODULE EMPLACEMENTS & PLAN DU SITE
 * 
 * MAQUETTE 3D INTERACTIVE DU STADE DE MBAO (DAKAR)
 * - Modélisation proportionnelle du terrain central, piste d'athlétisme, tribune couverte et portail
 * - Éléments spécifiques Mbao : Abris de touche, main courante de sécurité, tableau d'affichage des scores
 * - Placement interactif des stands de jeux, restauration, manèges gonflables, scène et caisses
 * - Mode Plein Écran Immersif (100% plein écran avec tiroir rétractable et touches de raccourci)
 * - Gestion des ambiances (Plein Jour, Coucher de soleil doré, Nocturne avec projecteurs de stade allumés)
 */

const LocationsModule = {
  // Instances Three.js
  scene: null,
  camera: null,
  renderer: null,
  controls: null,
  animationFrameId: null,

  // Données de placement
  items: [],
  selectedItemId: null,
  itemMeshes: new Map(), // id -> THREE.Group
  showLabels: true,
  isFullscreen: false,
  isDrawerCollapsed: false,
  currentAtmosphere: 'day', // 'day', 'sunset', 'night'

  // Éléments de scène spécifiques
  ambientLight: null,
  sunLight: null,
  hemiLight: null,
  stadiumSpotlights: [],

  // Gestion du Drag au sol
  raycaster: null,
  mouse: null,
  plane: null, // Plan de sol virtuel Y=0
  isDragging: false,
  draggedMesh: null,
  dragOffset: null,

  async render(container) {
    // Nettoyage préalable d'éventuelle instance 3D active
    this.cleanup();

    container.innerHTML = `
      <div class="stadium-workspace" id="stadiumWorkspaceRoot">
        <!-- Barre supérieure de KPI -->
        <div class="stadium-kpi-bar">
          <div class="stat-card">
            <div class="stat-label">Site Officiel</div>
            <div class="stat-value" style="font-size: 1.15rem; color: var(--primary);">🏟️ Stade de Mbao (Dakar)</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Dimensions Aire de Jeu</div>
            <div class="stat-value" style="font-size: 1.15rem; color: #16a34a;">105m × 68m (Pelouse Mbao)</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Structures Implantées</div>
            <div class="stat-value" id="stadiumPlacedCount" style="color: var(--success, #16a34a);">0 / 0</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Mode d'Aménagement</div>
            <div class="stat-value" style="font-size: 1.15rem; color: #2563eb;">3D Tactile &amp; Plein Écran</div>
          </div>
        </div>

        <!-- Layout principal : Catalogue à gauche + Maquette 3D à droite -->
        <div class="stadium-main-layout">
          
          <!-- Tiroir / Catalogue des Éléments -->
          <div class="stadium-catalog-card" id="stadiumCatalogCard">
            <div class="stadium-catalog-header">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <h4 style="margin: 0; font-size: 1rem; color: var(--gray-900);">📦 Éléments à Implanter</h4>
                <div style="display: flex; gap: 0.35rem;">
                  <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('decoration')" title="Ajouter d'autres structures ou manèges">
                    ➕ Créer
                  </button>
                  <button class="btn-icon" id="btnCloseDrawer" style="display: none;" onclick="LocationsModule.toggleCatalogDrawer()" title="Replier le tiroir">
                    ◀️
                  </button>
                </div>
              </div>
              <input type="text" id="stadiumSearchInput" class="form-control" style="font-size: 0.82rem; padding: 0.4rem 0.6rem;" placeholder="Filtrer stand, manège, resto..." oninput="LocationsModule.filterCatalog()">
            </div>

            <div class="stadium-catalog-list" id="stadiumCatalogList">
              <div style="text-align: center; padding: 1.5rem; color: var(--gray-500); font-size: 0.85rem;">
                Chargement des éléments...
              </div>
            </div>

            <div style="padding: 0.75rem; border-top: 1px solid var(--gray-200); background: var(--gray-50); display: flex; gap: 0.5rem;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="LocationsModule.saveLayoutToServer()">
                💾 Enregistrer
              </button>
              <button class="btn btn-secondary btn-sm" onclick="LocationsModule.openPrintModal()" title="Imprimer le plan de masse officiel">
                🖨️ Imprimer
              </button>
              <button class="btn btn-secondary btn-sm danger" onclick="LocationsModule.resetLayoutPrompt()" title="Réinitialiser l'alignement">
                🔄
              </button>
            </div>
          </div>

          <!-- Fenêtre de Rendu 3D du Stade -->
          <div class="stadium-viewport-card" id="stadiumViewportCard">
            <!-- Barre d'outils supérieure du viewer -->
            <div class="stadium-viewport-header">
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <span style="font-weight: 600; font-size: 0.92rem;">🏟️ Maquette 3D — Stade Municipal de Mbao</span>
                <span class="badge badge-success" style="font-size: 0.72rem;">Pelouse + Piste + Tribune</span>
                
                <!-- Sélecteur d'Ambiance Mbao -->
                <div style="display: inline-flex; align-items: center; gap: 0.35rem; margin-left: 0.5rem;">
                  <button class="stadium-tool-btn" id="btnAtmoDay" onclick="LocationsModule.setAtmosphere('day')" title="Plein Soleil de Dakar">
                    ☀️ Jour
                  </button>
                  <button class="stadium-tool-btn" id="btnAtmoSunset" onclick="LocationsModule.setAtmosphere('sunset')" title="Coucher de soleil sur Mbao">
                    🌅 Couchant
                  </button>
                  <button class="stadium-tool-btn" id="btnAtmoNight" onclick="LocationsModule.setAtmosphere('night')" title="Nocturne kermesse avec projecteurs allumés">
                    🌙 Nuit (Projecteurs)
                  </button>
                </div>
              </div>

              <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
                <button class="stadium-tool-btn" id="btnToggleLabels" onclick="LocationsModule.toggleLabels()">
                  🏷️ Étiquettes : ON
                </button>
                <button class="stadium-tool-btn" onclick="LocationsModule.centerView()">
                  🎯 Recadrer
                </button>
                <button class="stadium-tool-btn btn-fullscreen-toggle" id="btnToggleFullscreen" onclick="LocationsModule.toggleFullscreen()">
                  ⛶ Plein Écran
                </button>
              </div>
            </div>

            <!-- Conteneur WebGL Three.js -->
            <div class="stadium-canvas-container" id="stadiumCanvasContainer">
              <!-- Bouton Tiroir pour mode plein écran -->
              <button class="stadium-drawer-toggle-btn has-drawer-open" id="btnDrawerToggle" onclick="LocationsModule.toggleCatalogDrawer()">
                📦 Éléments du Stade
              </button>

              <!-- Caméras Préréglées Flottantes -->
              <div class="stadium-camera-tools">
                <button class="stadium-tool-btn active" id="camView3D" onclick="LocationsModule.setCameraView('perspective')">
                  🏟️ Vue Tribune (3D)
                </button>
                <button class="stadium-tool-btn" id="camViewTop" onclick="LocationsModule.setCameraView('top')">
                  🛰️ Vue Ciel (Plan 2D)
                </button>
                <button class="stadium-tool-btn" id="camViewGate" onclick="LocationsModule.setCameraView('entrance')">
                  🚶 Vue Entrée Mbao
                </button>
                <button class="stadium-tool-btn" id="camViewBenches" onclick="LocationsModule.setCameraView('benches')">
                  🪑 Vue Bancs de Touche
                </button>
              </div>

              <!-- Boussole / Indicateur d'orientation -->
              <div class="stadium-compass-badge">
                Nord ⬆️ | Tribune Mbao ⬅️ | Entrée Sud ⬇️
              </div>

              <!-- Dock flottant de l'élément sélectionné -->
              <div class="stadium-selection-dock" id="stadiumSelectionDock" style="display: none;">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span id="dockItemIcon" style="font-size: 1.4rem;">🎪</span>
                  <div>
                    <div id="dockItemTitle" style="font-weight: 600; font-size: 0.95rem;">Stand 1</div>
                    <div id="dockItemCoords" style="font-size: 0.75rem; color: #94a3b8; font-family: monospace;">X: 0m | Z: 0m</div>
                  </div>
                </div>

                <!-- Outils de déplacement précis -->
                <div style="display: flex; gap: 0.25rem;">
                  <button class="stadium-tool-btn" onclick="LocationsModule.nudgeActiveItem(-1, 0)" title="Déplacer vers la gauche">⬅️</button>
                  <button class="stadium-tool-btn" onclick="LocationsModule.nudgeActiveItem(1, 0)" title="Déplacer vers la droite">➡️</button>
                  <button class="stadium-tool-btn" onclick="LocationsModule.nudgeActiveItem(0, -1)" title="Avancer vers le haut">⬆️</button>
                  <button class="stadium-tool-btn" onclick="LocationsModule.nudgeActiveItem(0, 1)" title="Reculer vers le bas">⬇️</button>
                </div>

                <!-- Rotation 360 -->
                <div style="display: flex; gap: 0.3rem; align-items: center;">
                  <span style="font-size: 0.75rem; color: #94a3b8;">Angle :</span>
                  <button class="stadium-tool-btn" onclick="LocationsModule.rotateActiveItem(-45)" title="Pivoter de -45°">↺ 45°</button>
                  <button class="stadium-tool-btn" onclick="LocationsModule.rotateActiveItem(45)" title="Pivoter de +45°">↻ 45°</button>
                  <button class="stadium-tool-btn" onclick="LocationsModule.rotateActiveItem(90)" title="Pivoter de +90°">↻ 90°</button>
                </div>

                <!-- Action Retirer -->
                <button class="btn btn-secondary btn-sm danger" onclick="LocationsModule.unplaceActiveItem()" title="Remettre dans l'inventaire">
                  🗑️ Retirer du terrain
                </button>
                <button class="btn-icon" style="color: #cbd5e1;" onclick="LocationsModule.deselectItem()" title="Fermer">
                  ✕
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Chargement des données puis initialisation 3D
    await this.loadItems();
    this.initThreeJS();
  },

  async loadItems() {
    if (typeof DecorationModule !== 'undefined' && DecorationModule.aggregateAllStructures) {
      this.items = await DecorationModule.aggregateAllStructures();
    } else {
      this.items = [];
    }

    this.renderCatalog();
    this.updateStats();
  },

  updateStats() {
    const total = this.items.length;
    const placed = this.items.filter(i => i.is_placed).length;
    const el = document.getElementById('stadiumPlacedCount');
    if (el) el.textContent = `${placed} / ${total}`;
  },

  renderCatalog(filterText = '') {
    const container = document.getElementById('stadiumCatalogList');
    if (!container) return;

    const q = (filterText || '').toLowerCase();
    const filtered = this.items.filter(i => (i.name || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--gray-500); font-size: 0.85rem;">
          Aucun élément trouvé.
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(item => {
      const isPlaced = item.is_placed;
      const isSelected = this.selectedItemId === item.id;

      return `
        <div class="stadium-item-row ${isPlaced ? 'placed' : 'unplaced'} ${isSelected ? 'active' : ''}" 
             onclick="LocationsModule.onItemRowClick('${item.id}')">
          <span style="font-size: 1.25rem;">${item.icon || '🎪'}</span>
          <div style="flex: 1; min-width: 0;">
            <div style="font-weight: 600; font-size: 0.85rem; color: var(--gray-900); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${item.name}
            </div>
            <div style="font-size: 0.72rem; color: var(--gray-500); display: flex; gap: 0.5rem; align-items: center;">
              <span>${item.category || 'Général'}</span>
              <span>•</span>
              <span style="font-family: monospace;">
                ${isPlaced ? `X:${Math.round(item.pos_x)} Z:${Math.round(item.pos_z)}` : 'Non placé'}
              </span>
            </div>
          </div>
          <div>
            ${isPlaced 
              ? `<button class="btn btn-secondary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="event.stopPropagation(); LocationsModule.focusItemMesh('${item.id}')" title="Zoomer sur cet élément">📍 Zoom</button>` 
              : `<button class="btn btn-primary btn-sm" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;" onclick="event.stopPropagation(); LocationsModule.placeItemOnPitch('${item.id}')">➕ Placer</button>`}
          </div>
        </div>
      `;
    }).join('');
  },

  filterCatalog() {
    const q = document.getElementById('stadiumSearchInput')?.value || '';
    this.renderCatalog(q);
  },

  onItemRowClick(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    if (!item.is_placed) {
      this.placeItemOnPitch(id);
    } else {
      this.selectItem(id);
      this.focusItemMesh(id);
    }
  },

  // =========================================================================
  // GESTION DU PLEIN ÉCRAN (FULLSCREEN) & TIROIR RÉTRACTABLE
  // =========================================================================
  toggleFullscreen() {
    const root = document.getElementById('stadiumWorkspaceRoot');
    const btn = document.getElementById('btnToggleFullscreen');
    const closeBtn = document.getElementById('btnCloseDrawer');

    this.isFullscreen = !this.isFullscreen;

    if (this.isFullscreen) {
      root?.classList.add('is-fullscreen');
      if (btn) btn.innerHTML = '⛶ Quitter (Échap)';
      if (closeBtn) closeBtn.style.display = 'inline-flex';

      // Tenter le vrai plein écran navigateur si permis
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      } catch (e) {}
    } else {
      root?.classList.remove('is-fullscreen');
      if (btn) btn.innerHTML = '⛶ Plein Écran';
      if (closeBtn) closeBtn.style.display = 'none';

      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}
    }

    // Réajuster immédiatement la caméra Three.js
    setTimeout(() => {
      if (this.resizeHandler) this.resizeHandler();
    }, 100);
  },

  toggleCatalogDrawer() {
    const card = document.getElementById('stadiumCatalogCard');
    const toggleBtn = document.getElementById('btnDrawerToggle');
    if (!card) return;

    this.isDrawerCollapsed = !this.isDrawerCollapsed;
    if (this.isDrawerCollapsed) {
      card.classList.add('drawer-collapsed');
      toggleBtn?.classList.remove('has-drawer-open');
    } else {
      card.classList.remove('drawer-collapsed');
      toggleBtn?.classList.add('has-drawer-open');
    }
  },

  // =========================================================================
  // INITIALISATION DU MOTEUR 3D THREE.JS
  // =========================================================================
  initThreeJS() {
    const container = document.getElementById('stadiumCanvasContainer');
    if (!container || typeof THREE === 'undefined') {
      console.error('[LocationsModule] Three.js non chargé ou conteneur introuvable.');
      return;
    }

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // 1. Scène
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x93c5fd); // Ciel bleu Dakar
    this.scene.fog = new THREE.FogExp2(0x93c5fd, 0.0035);

    // 2. Caméra Perspective
    this.camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    this.camera.position.set(0, 75, 110);

    // 3. Renderer WebGL optimisé
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // 4. Contrôles OrbitControls
    if (typeof THREE.OrbitControls !== 'undefined') {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.maxPolarAngle = Math.PI / 2 - 0.04;
      this.controls.minDistance = 8;
      this.controls.maxDistance = 280;
      this.controls.target.set(0, 0, 0);
    }

    // 5. Éclairage
    this.setupLighting();

    // 6. Construction géométrique adaptée au Stade de Mbao
    this.buildMbaoStadium();

    // 7. Raycaster et plan virtuel Y=0 pour glisser-déposer au sol
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.dragOffset = new THREE.Vector3();

    // 8. Génération des structures 3D placées
    this.spawnAllPlacedMeshes();

    // 9. Événements souris, clavier et redimensionnement
    this.bindEvents(container);

    // 10. Boucle d'animation
    this.animate();
  },

  setupLighting() {
    this.stadiumSpotlights = [];

    // Lumière d'ambiance chaude
    this.ambientLight = new THREE.AmbientLight(0xfff7ed, 0.65);
    this.scene.add(this.ambientLight);

    // Lumière solaire zénithale avec ombres
    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.sunLight.position.set(60, 100, 50);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 300;
    const d = 90;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // Lumière d'appoint douce
    this.hemiLight = new THREE.HemisphereLight(0xbfdbfe, 0xd97706, 0.35);
    this.scene.add(this.hemiLight);
  },

  setAtmosphere(mode) {
    this.currentAtmosphere = mode;
    document.querySelectorAll('#btnAtmoDay, #btnAtmoSunset, #btnAtmoNight').forEach(b => b.classList.remove('active'));

    if (mode === 'day') {
      document.getElementById('btnAtmoDay')?.classList.add('active');
      this.scene.background = new THREE.Color(0x93c5fd);
      this.scene.fog.color.set(0x93c5fd);
      if (this.ambientLight) this.ambientLight.color.set(0xfff7ed), this.ambientLight.intensity = 0.65;
      if (this.sunLight) this.sunLight.color.set(0xffffff), this.sunLight.intensity = 0.9, this.sunLight.position.set(60, 100, 50);
      this.stadiumSpotlights.forEach(spot => spot.intensity = 0);
    } else if (mode === 'sunset') {
      document.getElementById('btnAtmoSunset')?.classList.add('active');
      this.scene.background = new THREE.Color(0xfb923c);
      this.scene.fog.color.set(0xfb923c);
      if (this.ambientLight) this.ambientLight.color.set(0xfed7aa), this.ambientLight.intensity = 0.55;
      if (this.sunLight) this.sunLight.color.set(0xea580c), this.sunLight.intensity = 0.85, this.sunLight.position.set(100, 30, 20);
      this.stadiumSpotlights.forEach(spot => spot.intensity = 0.8);
    } else if (mode === 'night') {
      document.getElementById('btnAtmoNight')?.classList.add('active');
      this.scene.background = new THREE.Color(0x090d16);
      this.scene.fog.color.set(0x090d16);
      if (this.ambientLight) this.ambientLight.color.set(0x1e293b), this.ambientLight.intensity = 0.3;
      if (this.sunLight) this.sunLight.color.set(0x38bdf8), this.sunLight.intensity = 0.2, this.sunLight.position.set(-40, 60, -40);
      this.stadiumSpotlights.forEach(spot => spot.intensity = 2.5); // Pleine puissance des projecteurs !
    }
  },

  // =========================================================================
  // MODÉLISATION GÉOMÉTRIQUE : STADE DE MBAO ADAPTÉ
  // =========================================================================
  buildMbaoStadium() {
    const stadiumGroup = new THREE.Group();

    // A. Sol d'enceinte / Sable Dakarois & Esplanade (240m x 180m)
    const groundGeo = new THREE.PlaneGeometry(240, 180);
    const groundMat = new THREE.MeshLambertMaterial({ color: 0xdec8a9 }); // Sol sable / stabilisé Mbao
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.08;
    groundMesh.receiveShadow = true;
    stadiumGroup.add(groundMesh);

    // B. Piste d'athlétisme ocre / bordeaux (125m x 86m)
    const trackGeo = new THREE.PlaneGeometry(125, 86);
    const trackMat = new THREE.MeshLambertMaterial({ color: 0x9f1239 }); // Rouge bordeaux piste
    const trackMesh = new THREE.Mesh(trackGeo, trackMat);
    trackMesh.rotation.x = -Math.PI / 2;
    trackMesh.position.y = -0.04;
    trackMesh.receiveShadow = true;
    stadiumGroup.add(trackMesh);

    // Lignes de couloirs de piste (cadre blanc fin)
    const trackLinesGeo = new THREE.BufferGeometry();
    const tL = 124 / 2; const tW = 85 / 2;
    const trackPts = [
      new THREE.Vector3(-tL, 0.01, -tW), new THREE.Vector3(tL, 0.01, -tW),
      new THREE.Vector3(tL, 0.01, tW), new THREE.Vector3(-tL, 0.01, tW),
      new THREE.Vector3(-tL, 0.01, -tW)
    ];
    trackLinesGeo.setFromPoints(trackPts);
    const trackLines = new THREE.Line(trackLinesGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
    stadiumGroup.add(trackLines);

    // C. Pelouse Centrale synthétique officielle de football (105m x 68m)
    const pitchWidth = 105;
    const pitchHeight = 68;
    const pitchTexture = this.createGrassTexture();
    const pitchMat = new THREE.MeshStandardMaterial({ 
      map: pitchTexture,
      roughness: 0.85,
      metalness: 0.05
    });
    const pitchGeo = new THREE.PlaneGeometry(pitchWidth, pitchHeight);
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.rotation.x = -Math.PI / 2;
    pitchMesh.position.y = 0;
    pitchMesh.receiveShadow = true;
    stadiumGroup.add(pitchMesh);

    // D. Traçage officiel blanc des lignes de football
    this.addPitchMarkings(stadiumGroup, pitchWidth, pitchHeight);

    // E. Cages de but (But Ouest et But Est)
    this.addGoalPost(stadiumGroup, -pitchWidth / 2, 0, Math.PI / 2);
    this.addGoalPost(stadiumGroup, pitchWidth / 2, 0, -Math.PI / 2);

    // F. Spécifique Mbao : Bancs de Touche Officiels (Abris Remplaçants)
    this.addTeamBenches(stadiumGroup, -14, -36);
    this.addTeamBenches(stadiumGroup, 14, -36);

    // G. Spécifique Mbao : Main courante tubulaire de protection autour de la pelouse
    this.addPitchFencing(stadiumGroup, 110, 72);

    // H. Spécifique Mbao : Panneau d'Affichage Électronique des Scores
    this.addScoreBoard(stadiumGroup, -59, 0);

    // I. Grande Tribune Couverte Officielle du Stade de Mbao (Côté Nord Z = -48)
    this.buildGrandstand(stadiumGroup, 0, -48, 85, 12);

    // J. Murs d'enceinte, Grand Portail d'Entrée Sud (Z = +60) et Accès Logistique Nord-Est
    this.buildPerimeterWalls(stadiumGroup, 180, 130);

    // K. 4 Pylônes d'éclairage de stade aux 4 angles
    this.addLightPylon(stadiumGroup, -68, -48);
    this.addLightPylon(stadiumGroup, 68, -48);
    this.addLightPylon(stadiumGroup, -68, 48);
    this.addLightPylon(stadiumGroup, 68, 48);

    this.scene.add(stadiumGroup);
  },

  createGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Bandes de tonte alternées vertes
    const stripes = 12;
    const stripeH = 512 / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#15803d' : '#16a34a';
      ctx.fillRect(0, i * stripeH, 512, stripeH);
    }

    // Bruit subtil de fibres synthétiques
    ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let j = 0; j < 3000; j++) {
      const rx = Math.random() * 512;
      const ry = Math.random() * 512;
      ctx.fillRect(rx, ry, 2, 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    return texture;
  },

  addPitchMarkings(group, w, h) {
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2 });
    const y = 0.02;

    const hw = w / 2;
    const hh = h / 2;

    // 1. Cadre extérieur
    const outerGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-hw, y, -hh), new THREE.Vector3(hw, y, -hh),
      new THREE.Vector3(hw, y, hh), new THREE.Vector3(-hw, y, hh),
      new THREE.Vector3(-hw, y, -hh)
    ]);
    group.add(new THREE.Line(outerGeo, lineMat));

    // 2. Ligne médiane
    const midGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, y, -hh), new THREE.Vector3(0, y, hh)
    ]);
    group.add(new THREE.Line(midGeo, lineMat));

    // 3. Rond central (r = 9.15m)
    const circlePoints = [];
    const r = 9.15;
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      circlePoints.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
    }
    const circleGeo = new THREE.BufferGeometry().setFromPoints(circlePoints);
    group.add(new THREE.Line(circleGeo, lineMat));

    // 4. Point d'engagement central
    const spotGeo = new THREE.CircleGeometry(0.35, 16);
    const spotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const spotMesh = new THREE.Mesh(spotGeo, spotMat);
    spotMesh.rotation.x = -Math.PI / 2;
    spotMesh.position.set(0, y + 0.005, 0);
    group.add(spotMesh);

    // 5. Surfaces de réparation (16.5m x 40.3m)
    [-1, 1].forEach(side => {
      const xBase = side * hw;
      const xBox = side * (hw - 16.5);
      const bH = 20.15;

      const boxGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xBase, y, -bH),
        new THREE.Vector3(xBox, y, -bH),
        new THREE.Vector3(xBox, y, bH),
        new THREE.Vector3(xBase, y, bH)
      ]);
      group.add(new THREE.Line(boxGeo, lineMat));

      // Petite surface des 5.5m
      const sBox = side * (hw - 5.5);
      const sbH = 9.15;
      const smallGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xBase, y, -sbH),
        new THREE.Vector3(sBox, y, -sbH),
        new THREE.Vector3(sBox, y, sbH),
        new THREE.Vector3(xBase, y, sbH)
      ]);
      group.add(new THREE.Line(smallGeo, lineMat));
    });

    // 6. Drapeaux de corner
    [[-hw, -hh], [hw, -hh], [-hw, hh], [hw, hh]].forEach(([cx, cz]) => {
      const poleGeo = new THREE.CylinderGeometry(0.04, 0.04, 1.6, 6);
      const poleMat = new THREE.MeshLambertMaterial({ color: 0xfacc15 });
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(cx, 0.8, cz);

      // Fanion rouge
      const flagGeo = new THREE.PlaneGeometry(0.4, 0.25);
      const flagMat = new THREE.MeshBasicMaterial({ color: 0xef4444, side: THREE.DoubleSide });
      const flag = new THREE.Mesh(flagGeo, flagMat);
      flag.position.set(cx + 0.2, 1.45, cz);
      group.add(pole);
      group.add(flag);
    });
  },

  addGoalPost(group, x, z, rotY) {
    const goal = new THREE.Group();
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });

    const postRadius = 0.08;
    const goalHeight = 2.44;
    const goalWidth = 7.32;
    const goalDepth = 2.0;

    // 2 Poteaux verticaux
    const p1 = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 12), postMat);
    p1.position.set(-goalWidth / 2, goalHeight / 2, 0);
    const p2 = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalHeight, 12), postMat);
    p2.position.set(goalWidth / 2, goalHeight / 2, 0);

    // Barre transversale
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(postRadius, postRadius, goalWidth, 12), postMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, goalHeight, 0);

    // Filet arrière
    const netGeo = new THREE.BoxGeometry(goalWidth, goalHeight, goalDepth);
    const netMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: true, transparent: true, opacity: 0.25 });
    const net = new THREE.Mesh(netGeo, netMat);
    net.position.set(0, goalHeight / 2, goalDepth / 2);

    goal.add(p1, p2, bar, net);
    goal.position.set(x, 0, z);
    goal.rotation.y = rotY;
    group.add(goal);
  },

  // Spécifique Mbao : Abris de touche remplaçants
  addTeamBenches(group, x, z) {
    const benchGroup = new THREE.Group();
    const w = 6.5; const d = 1.6; const h = 2.1;

    // Structure métallique
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.6 });
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, transparent: true, opacity: 0.65, side: THREE.DoubleSide });

    // Coque courbée en polycarbonate bleu
    const shellGeo = new THREE.CylinderGeometry(w / 2, w / 2, d, 16, 1, false, 0, Math.PI);
    const shell = new THREE.Mesh(shellGeo, shellMat);
    shell.rotation.z = Math.PI / 2;
    shell.position.set(0, h * 0.75, 0);

    // Banc avec 8 sièges
    const benchSeatMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const benchFloor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.45, 0.5), benchSeatMat);
    benchFloor.position.set(0, 0.25, 0);

    benchGroup.add(shell, benchFloor);
    benchGroup.position.set(x, 0, z);
    benchGroup.rotation.y = Math.PI; // Face au terrain
    group.add(benchGroup);
  },

  // Spécifique Mbao : Main courante blanche de sécurité autour de la pelouse
  addPitchFencing(group, w, d) {
    const fenceMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.4 });
    const fenceH = 1.05;
    const r = 0.04;

    const hw = w / 2; const hd = d / 2;

    // 4 sections tubulaires avec espacements pour portillons
    const addRail = (x1, z1, x2, z2) => {
      const length = Math.hypot(x2 - x1, z2 - z1);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(r, r, length, 8), fenceMat);
      rail.position.set((x1 + x2) / 2, fenceH, (z1 + z2) / 2);
      rail.rotation.z = Math.PI / 2;
      rail.rotation.y = Math.atan2(x2 - x1, z2 - z1) - Math.PI / 2;
      group.add(rail);

      // Piliers verticaux réguliers
      const steps = Math.floor(length / 5);
      for (let s = 0; s <= steps; s++) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(r, r, fenceH, 8), fenceMat);
        const px = x1 + (x2 - x1) * (s / steps);
        const pz = z1 + (z2 - z1) * (s / steps);
        post.position.set(px, fenceH / 2, pz);
        group.add(post);
      }
    };

    // Lignes avec ouvertures de passage pour kermesse
    addRail(-hw, -hd, -15, -hd);
    addRail(15, -hd, hw, -hd);
    addRail(-hw, hd, -12, hd);
    addRail(12, hd, hw, hd);
    addRail(-hw, -hd, -hw, hd);
    addRail(hw, -hd, hw, hd);
  },

  // Spécifique Mbao : Tableau d'affichage du score
  addScoreBoard(group, x, z) {
    const sb = new THREE.Group();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.8 });

    // 2 Piliers treillis hauts
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), frameMat);
    p1.position.set(0, 4.5, -3);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 9, 0.5), frameMat);
    p2.position.set(0, 4.5, 3);

    // Grand panneau LED
    const boardMat = new THREE.MeshLambertMaterial({ color: 0x020617 });
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3.8, 6.5), boardMat);
    board.position.set(0, 8, 0);

    // Texture d'affichage Kermesse Mbao
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#22c55e'; ctx.font = 'bold 32px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('STADE DE MBAO', 256, 50);
    ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 42px monospace';
    ctx.fillText('KERMESSE L&C 2026', 256, 115);
    ctx.fillStyle = '#ef4444'; ctx.font = 'bold 26px sans-serif';
    ctx.fillText('BIENVENUE À TOUS !', 256, 175);

    const txtMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas) });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 3.5), txtMat);
    screen.rotation.y = Math.PI / 2;
    screen.position.set(0.32, 8, 0);

    sb.add(p1, p2, board, screen);
    sb.position.set(x, 0, z);
    group.add(sb);
  },

  buildGrandstand(group, x, z, length, depth) {
    const tribune = new THREE.Group();

    // Gradins étagés en béton
    const steps = 6;
    const stepH = 0.9;
    const stepD = depth / steps;

    for (let i = 0; i < steps; i++) {
      const h = (i + 1) * stepH;
      const bGeo = new THREE.BoxGeometry(length, h, stepD);
      const bMat = new THREE.MeshLambertMaterial({ color: 0x94a3b8 }); // Béton
      const stepMesh = new THREE.Mesh(bGeo, bMat);
      stepMesh.position.set(0, h / 2, -i * stepD);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      tribune.add(stepMesh);

      // Sièges aux couleurs festives Sénégal (Vert, Jaune, Rouge)
      const seatCount = 20;
      const seatSpacing = length / (seatCount + 1);
      const seatColors = [0x16a34a, 0xeab308, 0xdc2626];
      const seatMat = new THREE.MeshLambertMaterial({ color: seatColors[i % 3] });
      const sGeo = new THREE.BoxGeometry(2, 0.2, stepD * 0.7);

      for (let s = 1; s <= seatCount; s++) {
        const sm = new THREE.Mesh(sGeo, seatMat);
        sm.position.set(-length / 2 + s * seatSpacing, h + 0.1, -i * stepD);
        tribune.add(sm);
      }
    }

    // Toiture de tribune en auvent métallique
    const roofH = steps * stepH + 4.5;
    const roofGeo = new THREE.BoxGeometry(length + 4, 0.35, depth + 6);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, roofH, -depth / 2 + 1);
    roof.rotation.x = 0.08;
    roof.castShadow = true;
    tribune.add(roof);

    // Piliers métalliques soutenant la toiture
    [-length / 2 + 3, 0, length / 2 - 3].forEach(px => {
      const pGeo = new THREE.CylinderGeometry(0.18, 0.18, roofH, 12);
      const pMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.7 });
      const pillar = new THREE.Mesh(pGeo, pMat);
      pillar.position.set(px, roofH / 2, -depth + 0.5);
      pillar.castShadow = true;
      tribune.add(pillar);
    });

    tribune.position.set(x, 0, z);
    group.add(tribune);
  },

  buildPerimeterWalls(group, length, width) {
    const wallGroup = new THREE.Group();
    const wallH = 3.2;
    const wallThick = 0.6;
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xd6d3d1 }); // Mur crépi clair Mbao

    const hw = length / 2;
    const hh = width / 2;

    // Mur Nord (derrière la tribune)
    const nWall = new THREE.Mesh(new THREE.BoxGeometry(length, wallH, wallThick), wallMat);
    nWall.position.set(0, wallH / 2, -hh);
    wallGroup.add(nWall);

    // Murs Ouest & Est
    const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, width), wallMat);
    wWall.position.set(-hw, wallH / 2, 0);
    const eWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, width), wallMat);
    eWall.position.set(hw, wallH / 2, 0);
    wallGroup.add(wWall, eWall);

    // Mur Sud avec Grand Portail d'Entrée au centre
    const gateW = 16;
    const sWallL1 = new THREE.Mesh(new THREE.BoxGeometry((length - gateW) / 2, wallH, wallThick), wallMat);
    sWallL1.position.set(-hw + (length - gateW) / 4, wallH / 2, hh);

    const sWallL2 = new THREE.Mesh(new THREE.BoxGeometry((length - gateW) / 2, wallH, wallThick), wallMat);
    sWallL2.position.set(hw - (length - gateW) / 4, wallH / 2, hh);
    wallGroup.add(sWallL1, sWallL2);

    // Grand Portail d'Entrée du Stade de Mbao (Arche festive Love & Charity)
    const archPillarGeo = new THREE.BoxGeometry(1.2, 5.5, 1.2);
    const archPillarMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const pLeft = new THREE.Mesh(archPillarGeo, archPillarMat);
    pLeft.position.set(-gateW / 2 + 0.6, 5.5 / 2, hh);
    const pRight = new THREE.Mesh(archPillarGeo, archPillarMat);
    pRight.position.set(gateW / 2 - 0.6, 5.5 / 2, hh);

    const archBeamGeo = new THREE.BoxGeometry(gateW, 1.2, 1.4);
    const archBeamMat = new THREE.MeshLambertMaterial({ color: 0xdc2626 });
    const beam = new THREE.Mesh(archBeamGeo, archBeamMat);
    beam.position.set(0, 5, hh);

    // Banderole de bienvenue sur le portail
    const bannerCanvas = document.createElement('canvas');
    bannerCanvas.width = 512; bannerCanvas.height = 64;
    const bctx = bannerCanvas.getContext('2d');
    bctx.fillStyle = '#dc2626'; bctx.fillRect(0, 0, 512, 64);
    bctx.fillStyle = '#ffffff'; bctx.font = 'bold 24px sans-serif';
    bctx.textAlign = 'center'; bctx.textBaseline = 'middle';
    bctx.fillText('⭐ STADE DE MBAO — KERMESSE LOVE & CHARITY 2026 ⭐', 256, 32);

    const bannerMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(bannerCanvas) });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(gateW - 1, 1), bannerMat);
    banner.position.set(0, 5, hh + 0.75);

    wallGroup.add(pLeft, pRight, beam, banner);

    // Portail secondaire Nord-Est (Accès Logistique & Pompiers)
    const techGate = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 0.2), new THREE.MeshStandardMaterial({ color: 0x475569, wireframe: true }));
    techGate.position.set(hw - 10, 1.25, -hh + 0.1);
    wallGroup.add(techGate);

    group.add(wallGroup);
  },

  addLightPylon(group, x, z) {
    const pylon = new THREE.Group();
    const h = 26;
    // Mât treillis
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.6, h, 8), new THREE.MeshLambertMaterial({ color: 0x475569 }));
    pole.position.y = h / 2;

    // Panneau de projecteurs
    const head = new THREE.Mesh(new THREE.BoxGeometry(4.5, 2.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x1e293b }));
    head.position.set(0, h, 0);

    // Lampes lumineuses
    const lights = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 1.9), new THREE.MeshBasicMaterial({ color: 0xfef08a }));
    lights.position.set(0, h, 0.22);

    // Projecteur SpotLight dynamique pour le mode nocturne
    const spot = new THREE.SpotLight(0xfef9c3, 0, 120, Math.PI / 4, 0.5, 1);
    spot.position.set(0, h, 0.5);
    spot.target.position.set(-x * 0.4, 0, -z * 0.4);
    pylon.add(spot.target);
    pylon.add(spot);
    this.stadiumSpotlights.push(spot);

    pylon.add(pole, head, lights);
    pylon.position.set(x, 0, z);
    pylon.lookAt(0, 0, 0); // Orienté vers le centre du terrain
    group.add(pylon);
  },

  // =========================================================================
  // CRÉATION DES OBJETS 3D FESTIFS POUR CHAQUE STRUCTURE
  // =========================================================================
  spawnAllPlacedMeshes() {
    this.itemMeshes.forEach(mesh => this.scene.remove(mesh));
    this.itemMeshes.clear();

    this.items.forEach(item => {
      if (item.is_placed) {
        this.createMeshForItem(item);
      }
    });
  },

  createMeshForItem(item) {
    const group = new THREE.Group();
    group.userData = { id: item.id, itemData: item };

    const type = item.item_type || 'stand';
    const colorHex = parseInt((item.color || '#dc2626').replace('#', '0x'), 16);

    if (type === 'stand') {
      this.buildStandGeometry(group, item, colorHex);
    } else if (type === 'manege') {
      this.buildInflatableCastleGeometry(group, item, colorHex);
    } else if (type === 'scene') {
      this.buildConcertStageGeometry(group, item, colorHex);
    } else if (type === 'food') {
      this.buildFoodTruckGeometry(group, item, colorHex);
    } else if (type === 'caisse') {
      this.buildTicketBoothGeometry(group, item, colorHex);
    } else if (type === 'logistique' || item.category === 'secours') {
      this.buildFirstAidTentGeometry(group, item);
    } else {
      this.buildGenericTentGeometry(group, item, colorHex);
    }

    // Ajout de l'étiquette 3D au-dessus du stand
    if (this.showLabels) {
      const label = this.createFloatingLabel(item);
      label.name = 'floatingLabel';
      label.position.y = (type === 'scene' ? 7.5 : (type === 'manege' ? 6 : 4.2));
      group.add(label);
    }

    // Positionnement et rotation
    group.position.set(Number(item.pos_x) || 0, 0, Number(item.pos_z) || 0);
    group.rotation.y = ((Number(item.rotation_y) || 0) * Math.PI) / 180;

    this.scene.add(group);
    this.itemMeshes.set(item.id, group);
    return group;
  },

  // 1. Stand forain classique (tente rayée + comptoir en bois)
  buildStandGeometry(group, item, colorHex) {
    const w = 3.6; const d = 3.0; const h = 2.4;
    const woodMat = new THREE.MeshLambertMaterial({ color: 0xb45309 }); // Bois

    // 4 Poteaux d'angle
    [[-w/2, -d/2], [w/2, -d/2], [-w/2, d/2], [w/2, d/2]].forEach(([px, pz]) => {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, h, 8), woodMat);
      p.position.set(px, h / 2, pz);
      p.castShadow = true;
      group.add(p);
    });

    // Toiture rayée triangulaire / pyramidale
    const roofGeo = new THREE.ConeGeometry(w * 0.75, 1.2, 4);
    const roofMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.set(0, h + 0.6, 0);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    group.add(roof);

    // Comptoir en bois avant
    const counterGeo = new THREE.BoxGeometry(w, 0.9, 0.5);
    const counter = new THREE.Mesh(counterGeo, woodMat);
    counter.position.set(0, 0.45, d / 2 - 0.25);
    counter.castShadow = true;
    group.add(counter);

    // Bâche de fond aux couleurs du stand
    const backGeo = new THREE.PlaneGeometry(w - 0.2, h - 0.2);
    const backMat = new THREE.MeshLambertMaterial({ color: colorHex, side: THREE.DoubleSide });
    const back = new THREE.Mesh(backGeo, backMat);
    back.position.set(0, h / 2, -d / 2);
    group.add(back);
  },

  // 2. Château gonflable géant avec tourelles colorées
  buildInflatableCastleGeometry(group, item, colorHex) {
    const size = Math.max(item.scale_x || 6, 5);
    const w = size; const d = size;
    const baseH = 0.8;
    const wallH = 2.4;
    const matMain = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.3 });
    const matYellow = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3 });

    // Matelas gonflable épais
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w, baseH, d), matYellow);
    floor.position.set(0, baseH / 2, 0);
    floor.castShadow = true;
    group.add(floor);

    // 4 Tourelles gonflables aux 4 coins
    const tr = 0.6;
    [[-w/2 + tr, -d/2 + tr], [w/2 - tr, -d/2 + tr], [-w/2 + tr, d/2 - tr], [w/2 - tr, d/2 - tr]].forEach(([tx, tz]) => {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(tr, tr, wallH + 1, 12), matMain);
      tower.position.set(tx, (wallH + 1) / 2 + baseH, tz);
      tower.castShadow = true;

      // Toit conique rouge
      const cone = new THREE.Mesh(new THREE.ConeGeometry(tr * 1.3, 1.2, 12), matRed);
      cone.position.set(tx, wallH + baseH + 1.6, tz);
      cone.castShadow = true;
      group.add(tower, cone);
    });

    // Murs d'enceinte gonflables
    const wallMat = new THREE.MeshLambertMaterial({ color: colorHex });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(w - tr*2, wallH, 0.4), wallMat);
    backWall.position.set(0, wallH / 2 + baseH, -d/2 + 0.3);
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, d - tr*2), wallMat);
    leftWall.position.set(-w/2 + 0.3, wallH / 2 + baseH, 0);
    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.4, wallH, d - tr*2), wallMat);
    rightWall.position.set(w/2 - 0.3, wallH / 2 + baseH, 0);

    // Arche d'entrée avant
    const arch = new THREE.Mesh(new THREE.TorusGeometry(w * 0.35, 0.35, 8, 16, Math.PI), matRed);
    arch.position.set(0, baseH + 1.2, d/2 - 0.3);
    group.add(backWall, leftWall, rightWall, arch);
  },

  // 3. Grande Scène de Concert & Régie Sono
  buildConcertStageGeometry(group, item, colorHex) {
    const w = 12; const d = 7; const stageH = 1.4;

    // Estrade podium surélevée noire
    const stage = new THREE.Mesh(new THREE.BoxGeometry(w, stageH, d), new THREE.MeshLambertMaterial({ color: 0x0f172a }));
    stage.position.set(0, stageH / 2, 0);
    stage.castShadow = true;
    group.add(stage);

    // Arche de pont lumière noire
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8 });
    const trussH = 5.5;

    // Piliers treillis gauche et droite
    const p1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, trussH, 0.4), trussMat);
    p1.position.set(-w/2 + 0.3, stageH + trussH/2, 0);
    const p2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, trussH, 0.4), trussMat);
    p2.position.set(w/2 - 0.3, stageH + trussH/2, 0);

    // Traverse supérieure
    const topBar = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.4), trussMat);
    topBar.position.set(0, stageH + trussH, 0);

    // Fond de scène / Bâche acoustique violette / noire
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.8, trussH), new THREE.MeshLambertMaterial({ color: colorHex, side: THREE.DoubleSide }));
    backdrop.position.set(0, stageH + trussH/2, -d/2 + 0.2);

    // Enceintes Line-Array suspendues gauche/droite
    const spkMat = new THREE.MeshLambertMaterial({ color: 0x000000 });
    const spk1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), spkMat);
    spk1.position.set(-w/2 + 1, stageH + trussH - 1.2, 0);
    const spk2 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.8, 0.6), spkMat);
    spk2.position.set(w/2 - 1, stageH + trussH - 1.2, 0);

    group.add(p1, p2, topBar, backdrop, spk1, spk2);
  },

  // 4. Point Restauration / Food Truck / Buvette
  buildFoodTruckGeometry(group, item, colorHex) {
    const w = 7.5; const d = 3.5; const h = 2.6;
    const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });
    const whiteMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Comptoir buffet
    const buffet = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bodyMat);
    buffet.position.set(0, h / 2, 0);
    buffet.castShadow = true;
    group.add(buffet);

    // Auvent de dégustation blanc/orange
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.15, d + 1.2), whiteMat);
    awning.position.set(0, h + 0.1, 0.4);
    awning.rotation.x = 0.08;
    group.add(awning);

    // Barbecue / Grillade stylisé sur le côté
    const bbq = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.0, 12), new THREE.MeshStandardMaterial({ color: 0x111827 }));
    bbq.position.set(w / 2 + 1.2, 0.5, 0);
    group.add(bbq);
  },

  // 5. Guichet Billetterie / Caisses
  buildTicketBoothGeometry(group, item, colorHex) {
    const w = 4.5; const d = 2.4; const h = 2.6;
    const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.4 });

    const booth = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    booth.position.set(0, h / 2, 0);
    booth.castShadow = true;

    // Toiture casquette
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.25, d + 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    roof.position.set(0, h + 0.12, 0);

    // Fenêtres guichet
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: 0x1e293b }));
    win.position.set(-1.2, 1.4, d / 2 + 0.01);
    const win2 = win.clone();
    win2.position.x = 1.2;

    group.add(booth, roof, win, win2);
  },

  // 6. Poste de Secours Médical & Croix-Rouge
  buildFirstAidTentGeometry(group, item) {
    const w = 4.2; const d = 3.2; const h = 2.4;
    const tent = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    tent.position.set(0, h / 2, 0);
    tent.castShadow = true;

    // Toit 4 pans
    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, 1.2, 4), new THREE.MeshLambertMaterial({ color: 0xf8fafc }));
    roof.position.set(0, h + 0.6, 0);
    roof.rotation.y = Math.PI / 4;

    // Croix rouge médicale
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xdc2626 });
    const c1 = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 1.1), crossMat);
    c1.position.set(0, 1.4, d / 2 + 0.01);
    const c2 = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.3), crossMat);
    c2.position.set(0, 1.4, d / 2 + 0.02);

    group.add(tent, roof, c1, c2);
  },

  // 7. Tente générique / Barnum
  buildGenericTentGeometry(group, item, colorHex) {
    const w = 4; const d = 4; const h = 2.2;
    const tent = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: colorHex }));
    tent.position.set(0, h / 2, 0);
    tent.castShadow = true;

    const roof = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, 1.1, 4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    roof.position.set(0, h + 0.55, 0);
    roof.rotation.y = Math.PI / 4;
    group.add(tent, roof);
  },

  createFloatingLabel(item) {
    const canvas = document.createElement('canvas');
    canvas.width = 384;
    canvas.height = 96;
    const ctx = canvas.getContext('2d');

    // Fond arrondi semi-transparent avec bordure
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.roundRect ? ctx.roundRect(8, 8, 368, 80, 16) : ctx.fillRect(8, 8, 368, 80);
    ctx.fill();

    ctx.lineWidth = 4;
    ctx.strokeStyle = item.color || '#3b82f6';
    ctx.stroke();

    // Texte
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${item.icon || '🎪'} ${item.name}`, 192, 48);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(7, 1.8, 1);
    return sprite;
  },

  // =========================================================================
  // GESTION DES INTERACTIONS : SÉLECTION, DÉPLACEMENT & GLISSER-DÉPOSER
  // =========================================================================
  bindEvents(container) {
    const canvas = this.renderer.domElement;

    // Détection clic / début de drag
    canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e, canvas));
    canvas.addEventListener('pointermove', (e) => this.onPointerMove(e, canvas));
    canvas.addEventListener('pointerup', () => this.onPointerUp());

    // Raccourci clavier Échap pour quitter le plein écran
    this.keyHandler = (e) => {
      if (e.key === 'Escape' && this.isFullscreen) {
        this.toggleFullscreen();
      }
    };
    window.addEventListener('keydown', this.keyHandler);

    // Redimensionnement fluide
    this.resizeHandler = () => {
      if (!container || !this.camera || !this.renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };
    window.addEventListener('resize', this.resizeHandler);
  },

  getCanvasCoords(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((e.clientY - rect.top) / rect.height) * 2 + 1
    };
  },

  onPointerDown(e, canvas) {
    if (e.button !== 0) return;

    const coords = this.getCanvasCoords(e, canvas);
    this.mouse.set(coords.x, coords.y);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const interactiveMeshes = Array.from(this.itemMeshes.values());
    const intersects = this.raycaster.intersectObjects(interactiveMeshes, true);

    if (intersects.length > 0) {
      let hitObj = intersects[0].object;
      while (hitObj.parent && !hitObj.userData.id) {
        hitObj = hitObj.parent;
      }

      if (hitObj.userData && hitObj.userData.id) {
        const id = hitObj.userData.id;
        this.selectItem(id);

        this.isDragging = true;
        this.draggedMesh = hitObj;
        if (this.controls) this.controls.enabled = false;

        const intersectPoint = new THREE.Vector3();
        this.raycaster.ray.intersectPlane(this.plane, intersectPoint);
        this.dragOffset.copy(intersectPoint).sub(this.draggedMesh.position);
      }
    }
  },

  onPointerMove(e, canvas) {
    if (!this.isDragging || !this.draggedMesh) return;

    const coords = this.getCanvasCoords(e, canvas);
    this.mouse.set(coords.x, coords.y);
    this.raycaster.setFromCamera(this.mouse, this.camera);

    const intersectPoint = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, intersectPoint)) {
      const newPos = intersectPoint.sub(this.dragOffset);

      // Limites du stade de Mbao
      newPos.x = Math.max(-110, Math.min(110, newPos.x));
      newPos.z = Math.max(-75, Math.min(75, newPos.z));

      this.draggedMesh.position.x = newPos.x;
      this.draggedMesh.position.z = newPos.z;

      const item = this.items.find(i => i.id === this.selectedItemId);
      if (item) {
        item.pos_x = Math.round(newPos.x * 10) / 10;
        item.pos_z = Math.round(newPos.z * 10) / 10;
        this.updateDockInfo(item);
      }
    }
  },

  onPointerUp() {
    if (this.isDragging) {
      this.isDragging = false;
      this.draggedMesh = null;
      if (this.controls) this.controls.enabled = true;

      this.persistCoordinatesLocally();
      this.renderCatalog(document.getElementById('stadiumSearchInput')?.value || '');
    }
  },

  selectItem(id) {
    this.selectedItemId = id;
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    const dock = document.getElementById('stadiumSelectionDock');
    if (dock) {
      dock.style.display = 'flex';
      document.getElementById('dockItemIcon').textContent = item.icon || '🎪';
      document.getElementById('dockItemTitle').textContent = item.name;
      this.updateDockInfo(item);
    }

    document.querySelectorAll('.stadium-item-row').forEach(row => row.classList.remove('active'));
    this.renderCatalog(document.getElementById('stadiumSearchInput')?.value || '');
  },

  deselectItem() {
    this.selectedItemId = null;
    const dock = document.getElementById('stadiumSelectionDock');
    if (dock) dock.style.display = 'none';
    this.renderCatalog(document.getElementById('stadiumSearchInput')?.value || '');
  },

  updateDockInfo(item) {
    const el = document.getElementById('dockItemCoords');
    if (el) {
      el.textContent = `X: ${Math.round(item.pos_x)}m | Z: ${Math.round(item.pos_z)}m | Rot: ${Math.round(item.rotation_y || 0)}°`;
    }
  },

  nudgeActiveItem(deltaX, deltaZ) {
    if (!this.selectedItemId) return;
    const item = this.items.find(i => i.id === this.selectedItemId);
    const mesh = this.itemMeshes.get(this.selectedItemId);
    if (!item || !mesh) return;

    item.pos_x = Math.round((Number(item.pos_x || 0) + deltaX) * 10) / 10;
    item.pos_z = Math.round((Number(item.pos_z || 0) + deltaZ) * 10) / 10;

    mesh.position.x = item.pos_x;
    mesh.position.z = item.pos_z;

    this.updateDockInfo(item);
    this.persistCoordinatesLocally();
  },

  rotateActiveItem(deltaAngle) {
    if (!this.selectedItemId) return;
    const item = this.items.find(i => i.id === this.selectedItemId);
    const mesh = this.itemMeshes.get(this.selectedItemId);
    if (!item || !mesh) return;

    item.rotation_y = ((Number(item.rotation_y || 0) + deltaAngle) % 360 + 360) % 360;
    mesh.rotation.y = (item.rotation_y * Math.PI) / 180;

    this.updateDockInfo(item);
    this.persistCoordinatesLocally();
  },

  placeItemOnPitch(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.is_placed = true;
    if (item.pos_x === undefined || item.pos_x === 0) {
      item.pos_x = Math.round((Math.random() * 20 - 10));
      item.pos_z = Math.round((Math.random() * 14 - 7));
    }

    this.createMeshForItem(item);
    this.selectItem(id);
    this.focusItemMesh(id);
    this.persistCoordinatesLocally();
    this.updateStats();
    this.renderCatalog(document.getElementById('stadiumSearchInput')?.value || '');
    Notify.success(`${item.name} placé sur le Stade de Mbao.`);
  },

  unplaceActiveItem() {
    if (!this.selectedItemId) return;
    const id = this.selectedItemId;
    const item = this.items.find(i => i.id === id);
    const mesh = this.itemMeshes.get(id);

    if (mesh) {
      this.scene.remove(mesh);
      this.itemMeshes.delete(id);
    }

    if (item) {
      item.is_placed = false;
    }

    this.deselectItem();
    this.persistCoordinatesLocally();
    this.updateStats();
    this.renderCatalog(document.getElementById('stadiumSearchInput')?.value || '');
    Notify.info('Élément remis dans la réserve.');
  },

  focusItemMesh(id) {
    const mesh = this.itemMeshes.get(id);
    if (!mesh || !this.controls) return;

    const targetPos = mesh.position.clone();
    this.controls.target.copy(targetPos);
    this.camera.position.set(targetPos.x, targetPos.y + 25, targetPos.z + 35);
  },

  toggleLabels() {
    this.showLabels = !this.showLabels;
    const btn = document.getElementById('btnToggleLabels');
    if (btn) btn.textContent = this.showLabels ? '🏷️ Étiquettes : ON' : '🏷️ Étiquettes : OFF';

    this.itemMeshes.forEach(mesh => {
      const lbl = mesh.getObjectByName('floatingLabel');
      if (lbl) lbl.visible = this.showLabels;
    });
  },

  // =========================================================================
  // VUES DE CAMÉRA PRÉRÉGLÉES
  // =========================================================================
  setCameraView(viewType) {
    document.querySelectorAll('.stadium-camera-tools .stadium-tool-btn').forEach(b => b.classList.remove('active'));

    if (viewType === 'perspective') {
      document.getElementById('camView3D')?.classList.add('active');
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 75, 110);
    } else if (viewType === 'top') {
      document.getElementById('camViewTop')?.classList.add('active');
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 160, 0.1);
    } else if (viewType === 'entrance') {
      document.getElementById('camViewGate')?.classList.add('active');
      this.controls.target.set(0, 1.5, 0);
      this.camera.position.set(0, 3, 68); // Devant l'arche Sud
    } else if (viewType === 'benches') {
      document.getElementById('camViewBenches')?.classList.add('active');
      this.controls.target.set(0, 1.5, -20);
      this.camera.position.set(0, 4, -45); // Devant les bancs de touche face à la pelouse
    }
  },

  centerView() {
    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 75, 110);
    }
  },

  // =========================================================================
  // SAUVEGARDE & PERSISTANCE (LOCAL + SUPABASE)
  // =========================================================================
  persistCoordinatesLocally() {
    const layoutMap = {};
    this.items.forEach(item => {
      layoutMap[item.id] = {
        pos_x: item.pos_x,
        pos_z: item.pos_z,
        rotation_y: item.rotation_y,
        is_placed: item.is_placed
      };
    });
    localStorage.setItem('kermesse_stadium_layout_coords', JSON.stringify(layoutMap));
  },

  async saveLayoutToServer() {
    this.persistCoordinatesLocally();

    const client = SupabaseClient.client;
    if (client) {
      try {
        for (const item of this.items) {
          if (item.id.startsWith('struct-') || item.source_id?.startsWith('struct-')) {
            await client.from('stadium_placements').upsert({
              id: item.source_id || item.id,
              name: item.name,
              item_type: item.item_type || 'custom',
              category: item.category || 'maneges',
              icon: item.icon || '🎪',
              color: item.color || '#3b82f6',
              pos_x: item.pos_x,
              pos_z: item.pos_z,
              rotation_y: item.rotation_y,
              is_placed: item.is_placed,
              zone_code: item.zone_code || 'jeux',
              updated_at: new Date().toISOString()
            });
          }
        }
        Notify.success('Plan du Stade de Mbao sauvegardé sur le serveur.');
        return;
      } catch (e) {
        console.warn('[LocationsModule] Erreur sauvegarde serveur:', e);
      }
    }

    Notify.success('Plan du Stade de Mbao enregistré localement.');
  },

  resetLayoutPrompt() {
    if (!confirm('Réinitialiser tous les emplacements par défaut sur le terrain ?')) return;

    localStorage.removeItem('kermesse_stadium_layout_coords');
    if (typeof DecorationModule !== 'undefined') {
      DecorationModule.aggregateAllStructures().then(items => {
        this.items = items;
        this.spawnAllPlacedMeshes();
        this.renderCatalog();
        this.updateStats();
        Notify.info('Emplacements réinitialisés.');
      });
    }
  },

  // =========================================================================
  // EXPORT & IMPRESSION DU PLAN DE MASSE OFFICIEL
  // =========================================================================
  openPrintModal() {
    const placed = this.items.filter(i => i.is_placed);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog stadium-legend-modal">
        <div class="modal-header">
          <h3>🖨️ Plan d'Implantation Officiel — Stade de Mbao</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body" style="max-height: 70vh; overflow-y: auto;">
          <div style="background: #f8fafc; border: 1px solid var(--gray-200); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
            <div style="font-weight: 700; color: var(--gray-900); font-size: 1.05rem;">
              LOVE AND CHARITY (L&C) — ÉDITION KERMESSE 2026
            </div>
            <div style="font-size: 0.85rem; color: var(--gray-600); margin-top: 0.25rem;">
              Lieu : <strong>Stade Municipal de Mbao (Dakar)</strong> | Répertoire officiel des emplacements
            </div>
          </div>

          <table class="data-table" style="font-size: 0.82rem;">
            <thead>
              <tr>
                <th>N° / Nom</th>
                <th>Catégorie</th>
                <th>Zone Stade</th>
                <th>Coordonnées (X, Z)</th>
                <th>Orientation</th>
              </tr>
            </thead>
            <tbody>
              ${placed.map(p => `
                <tr>
                  <td><strong>${p.name}</strong></td>
                  <td>${p.category}</td>
                  <td>${p.zone_code || 'Général'}</td>
                  <td style="font-family: monospace;">X: ${Math.round(p.pos_x)}m, Z: ${Math.round(p.pos_z)}m</td>
                  <td>${Math.round(p.rotation_y || 0)}°</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Fermer</button>
          <button class="btn btn-primary" onclick="window.print()">Imprimer la fiche</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;
  },

  // =========================================================================
  // BOUCLE DE RENDU ET NETTOYAGE
  // =========================================================================
  animate() {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (this.controls) this.controls.update();

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  },

  cleanup() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.resizeHandler) {
      window.removeEventListener('resize', this.resizeHandler);
      this.resizeHandler = null;
    }

    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler);
      this.keyHandler = null;
    }

    if (this.isFullscreen) {
      this.isFullscreen = false;
      document.getElementById('stadiumWorkspaceRoot')?.classList.remove('is-fullscreen');
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      } catch (e) {}
    }

    if (this.renderer) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      if (this.renderer.domElement && this.renderer.domElement.parentNode) {
        this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
      }
      this.renderer = null;
    }

    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.itemMeshes.clear();
    this.stadiumSpotlights = [];
  }
};

window.LocationsModule = LocationsModule;
