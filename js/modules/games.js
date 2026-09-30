/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : JEUX (STANDS & ATTRACTIONS)
 * 
 * Gestion des jeux et attractions :
 * - Catalogue préalable des jeux (création libre sans stand ni tarif obligatoire au départ)
 * - Prix du ticket en Francs (configurable ou modifiable plus tard)
 * - Matériaux et équipements nécessaires pour chaque jeu
 * - Transmission automatique des besoins en matériel au Pôle Logistique & Installation
 * - Possibilité d'affecter un jeu à un stand lors de la création du stand ou du jeu
 */

const GamesModule = {
  games: [],
  stands: [],
  materialRequests: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎯</span> Catalogue des Jeux &amp; Attractions de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="GamesModule.openCreateModal()">
              <span>➕</span> Nouveau Jeu
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner info" style="margin-bottom: 1.25rem;">
            <div>
              💡 <strong>Catalogue Flexible :</strong> Vous pouvez d'abord enregistrer tous vos jeux et lister les matériaux nécessaires. Le tarif et le rattachement aux stands peuvent être définis maintenant ou plus tard lors de la création de vos stands.
            </div>
          </div>

          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="gameSearch" placeholder="Rechercher par nom de jeu, stand ou matériel..." oninput="GamesModule.filterTable()">
            </div>
            <div class="filters-group">
              <select id="gameStandFilter" class="filter-select" onchange="GamesModule.filterTable()">
                <option value="">Tous les jeux</option>
                <option value="assigned">Jeux rattachés à un stand</option>
                <option value="unassigned">Jeux non rattachés (En attente)</option>
              </select>
            </div>
          </div>

          <div class="table-responsive" id="gamesTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">Chargement des jeux...</div>
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
        // Chargement des stands
        const { data: sData } = await client
          .from('stands')
          .select('id, name, number, color_name, color_hex')
          .order('number');
        if (sData) this.stands = sData;

        // Chargement des jeux avec stand associé et image
        let gData = null;
        let gError = null;

        try {
          const res = await client
            .from('games')
            .select(`
              id, name, ticket_price_f, rules_summary, prizes_description, materials_needed, is_active, image_url,
              stand:stands(id, name, number, color_name, color_hex)
            `)
            .order('name', { ascending: true });
          gData = res.data;
          gError = res.error;
        } catch (e) {
          gError = e;
        }

        if (gError) {
          // Si image_url n'est pas encore créée en DB, fallback sans cette colonne
          try {
            const fallback = await client
              .from('games')
              .select(`
                id, name, ticket_price_f, rules_summary, prizes_description, materials_needed, is_active,
                stand:stands(id, name, number, color_name, color_hex)
              `)
              .order('name', { ascending: true });
            if (!fallback.error && fallback.data) gData = fallback.data;
          } catch (e) {}
        }

        if (gData) {
          this.games = gData;
        }

        // Chargement des demandes matérielles
        try {
          const { data: rData } = await client.from('stand_material_requests').select('*');
          if (rData) this.materialRequests = rData;
        } catch (e) {
          // Table may not exist yet if script not run
        }
      }
    } catch (e) {
      console.warn('[GamesModule Load Warning]', e);
    }

    // Fallbacks locaux et synchronisation des images locales
    const storedG = localStorage.getItem('kermesse_games_cache');
    let localGames = [];
    if (storedG) {
      try { localGames = JSON.parse(storedG); } catch (e) {}
    }

    if (!this.games || this.games.length === 0) {
      this.games = localGames;
    } else {
      // Si une image a été mise en cache localement pour un jeu, la préserver
      this.games.forEach(g => {
        if (!g.image_url) {
          const localMatch = localGames.find(lg => lg.id === g.id);
          if (localMatch && localMatch.image_url) {
            g.image_url = localMatch.image_url;
          }
        }
      });
    }

    const storedReq = localStorage.getItem('kermesse_stand_material_requests');
    if (storedReq) {
      try {
        const localReqs = JSON.parse(storedReq);
        this.materialRequests = [...this.materialRequests, ...localReqs.filter(lr => !this.materialRequests.some(r => r.id === lr.id))];
      } catch (e) {}
    }

    this.renderTable(this.games || []);
  },

  // Compression et conversion d'une image locale en DataURL léger
  compressAndLoadImage(file, callback) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      Notify.error('Le fichier sélectionné doit être une image (JPG, PNG, WebP...).');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Redimensionnement max 480x480 pour garder une taille plume (~30-50 Ko)
        const maxDim = 480;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
        callback(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  },

  renderTable(games) {
    const container = document.getElementById('gamesTableContainer');
    if (!container) return;

    if (!games || games.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <div class="empty-title">Aucun jeu configuré</div>
          <div class="empty-desc">Ajoutez les attractions et jeux de la kermesse (ex: Tir à la corde, Lancer de balle, Pêche aux canards, Manèges...). Vous pourrez spécifier les matériaux nécessaires et les envoyer à la logistique.</div>
          <button class="btn btn-primary" onclick="GamesModule.openCreateModal()">
            <span>➕</span> Configurer le premier jeu
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom du Jeu</th>
            <th>Stand Rattaché</th>
            <th>Prix du Ticket</th>
            <th>Matériaux Nécessaires</th>
            <th>Règles / Lots</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="gamesTableBody">
          ${games.map(g => {
            const hasStand = Boolean(g.stand);
            const req = this.materialRequests.find(r => r.game_name === g.name || (g.stand && r.stand_name === g.stand.name));
            const hasMaterials = Boolean(g.materials_needed && g.materials_needed.trim());

            return `
              <tr data-name="${g.name}" data-stand="${hasStand ? g.stand.name : ''}" data-assigned="${hasStand ? 'true' : 'false'}" data-mat="${g.materials_needed || ''}">
                <td>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    ${g.image_url ? `
                      <img src="${g.image_url}" alt="${g.name}" style="width: 44px; height: 44px; border-radius: var(--radius-md); object-fit: cover; border: 1px solid var(--gray-200); flex-shrink: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    ` : `
                      <div style="width: 44px; height: 44px; border-radius: var(--radius-md); background: #eff6ff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem; flex-shrink: 0; border: 1px dashed #93c5fd;">🎯</div>
                    `}
                    <div>
                      <strong style="font-size: 0.95rem;">${g.name}</strong>
                      ${!hasStand ? '<div style="font-size: 0.75rem; color: var(--warning, #eab308);">⏳ Non rattaché à un stand</div>' : ''}
                    </div>
                  </div>
                </td>
                <td>
                  ${hasStand ? `
                    <span class="stand-tag" style="background-color: ${g.stand.color_hex}15; color: ${g.stand.color_hex}; border-color: ${g.stand.color_hex};">
                      <span class="color-dot" style="background-color: ${g.stand.color_hex};"></span>
                      ${g.stand.name}
                    </span>
                  ` : '<span class="badge badge-gray">Catalogue général</span>'}
                </td>
                <td>
                  ${(g.ticket_price_f !== null && g.ticket_price_f !== undefined && g.ticket_price_f > 0) ? `
                    <span class="badge badge-primary">${g.ticket_price_f.toLocaleString()} ${KermesseConfig.currency}</span>
                  ` : '<span class="badge badge-gray" title="Tarif à fixer plus tard">À définir</span>'}
                </td>
                <td>
                  ${hasMaterials ? `
                    <div style="font-size: 0.85rem; max-width: 250px; line-height: 1.3;">
                      📦 ${g.materials_needed}
                    </div>
                    <div style="margin-top: 4px;">
                      ${req ? (
                        req.status === 'fourni' ? '<span class="badge badge-success">✅ Fourni par Logistique</span>' :
                        req.status === 'en_cours' ? '<span class="badge badge-warning">🔄 Logistique en cours</span>' :
                        '<span class="badge badge-primary">🚚 Transmis à Logistique</span>'
                      ) : `
                        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.75rem;" onclick="GamesModule.transmitMaterialRequest('${g.id}', '${g.name}', '${hasStand ? g.stand.name : 'Stand à attribuer'}', \`${(g.materials_needed || '').replace(/"/g, '&quot;')}\`)">
                          🚚 Transmettre à Logistique
                        </button>
                      `}
                    </div>
                  ` : '<span style="color: var(--gray-400); font-size: 0.8rem;">Aucun matériel spécifié</span>'}
                </td>
                <td>
                  <div style="font-size: 0.8rem; color: var(--gray-600);">
                    ${g.rules_summary ? `📜 ${g.rules_summary}` : ''}
                  </div>
                  <div style="font-size: 0.8rem; color: var(--success); font-weight: 500;">
                    ${g.prizes_description ? `🎁 ${g.prizes_description}` : ''}
                  </div>
                  ${!g.rules_summary && !g.prizes_description ? '<span style="color: var(--gray-400); font-size: 0.8rem;">-</span>' : ''}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn-icon" onclick="GamesModule.openEditModal('${g.id}')" title="Modifier le jeu">✏️</button>
                  <button class="btn-icon danger" onclick="GamesModule.deleteGame('${g.id}', '${g.name}')" title="Supprimer">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('gameSearch').value || '').toLowerCase();
    const filter = document.getElementById('gameStandFilter').value;
    const rows = document.querySelectorAll('#gamesTableBody tr');

    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const stand = (r.dataset.stand || '').toLowerCase();
      const mat = (r.dataset.mat || '').toLowerCase();
      const isAssigned = r.dataset.assigned === 'true';

      const matchText = name.includes(q) || stand.includes(q) || mat.includes(q);
      const matchFilter = !filter || (filter === 'assigned' && isAssigned) || (filter === 'unassigned' && !isAssigned);

      r.style.display = matchText && matchFilter ? '' : 'none';
    });
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let stands = [];

    if (client) {
      const { data } = await client.from('stands').select('id, name, number, color_name').order('number');
      stands = data || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Ajouter un Jeu / Attraction</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createGameForm">
            <div class="form-group">
              <label>Nom du jeu ou de l'attraction *</label>
              <input type="text" id="gName" class="form-control" required placeholder="Ex: Tir à la corde, Lancer d'anneaux, Pêche aux canards, Manège...">
            </div>

            <!-- Image de l'attraction (Parcourir sur PC) -->
            <div class="form-group">
              <label style="display: flex; justify-content: space-between; align-items: center;">
                <span>📸 Photo / Image du jeu</span>
                <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: normal;">Affichée sur l'écran tactile des caisses</span>
              </label>
              <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                <input type="file" id="cgImageInput" accept="image/*" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm" id="cgBrowseBtn" style="display: flex; align-items: center; gap: 6px;">
                  <span>📁</span> Parcourir une image sur mon PC...
                </button>
                <button type="button" class="btn btn-danger btn-sm" id="cgRemoveImgBtn" style="display: none; padding: 4px 8px;">
                  <span>🗑️</span> Enlever la photo
                </button>
              </div>
              <div id="cgImagePreviewBox" style="display: none; margin-top: 0.6rem;">
                <img id="cgImagePreview" src="" alt="Aperçu jeu" style="max-width: 160px; max-height: 100px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid var(--primary); box-shadow: var(--shadow-sm);">
                <div style="font-size: 0.75rem; color: var(--success); margin-top: 2px;">✅ Image prête (optimisée pour la caisse)</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand associé (Optionnel)</label>
                <select id="gStand" class="form-control">
                  <option value="">-- Aucun (Laisser dans le catalogue pour l'associer plus tard) --</option>
                  ${stands.map(s => `<option value="${s.id}">${s.color_name} ${s.number} — ${s.name}</option>`).join('')}
                </select>
                <div class="form-hint">Vous pourrez aussi associer ce jeu directement lors de la création d'un stand.</div>
              </div>
              <div class="form-group">
                <label>Prix du ticket (${KermesseConfig.currency}) (Optionnel)</label>
                <input type="number" id="gPrice" class="form-control" placeholder="Ex: 200 (ou laisser vide)" min="0" step="50">
              </div>
            </div>

            <div class="form-group">
              <label>Matériaux &amp; Équipements nécessaires</label>
              <textarea id="gMaterials" class="form-control" rows="2" placeholder="Ex: 2 tables, 15 balles de tennis, 1 corde de 10m, 1 bâche de protection..."></textarea>
              <div class="form-hint">Ces besoins pourront être automatiquement transmis au Pôle Logistique &amp; Installation pour qu'ils préparent le matériel pour vous.</div>
            </div>

            <div class="form-check" style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem;">
              <input type="checkbox" id="gSendLogisticsNow" checked>
              <label for="gSendLogisticsNow" style="margin: 0; font-size: 0.85rem; cursor: pointer;">
                🚚 <strong>Transmettre immédiatement</strong> la demande au Pôle Logistique &amp; Installation
              </label>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Règles / Fonctionnement en bref</label>
                <input type="text" id="gRules" class="form-control" placeholder="Ex: 3 essais par joueur, réussir 2 lancers">
              </div>
              <div class="form-group">
                <label>Lots remis en cas de victoire</label>
                <input type="text" id="gPrizes" class="form-control" placeholder="Ex: Friandise, Ticket triangulaire">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveGameBtn">Enregistrer le jeu</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    // Gestion de la sélection d'image depuis le PC
    let currentImageDataUrl = null;
    const fileInput = modal.querySelector('#cgImageInput');
    const browseBtn = modal.querySelector('#cgBrowseBtn');
    const removeBtn = modal.querySelector('#cgRemoveImgBtn');
    const previewBox = modal.querySelector('#cgImagePreviewBox');
    const previewImg = modal.querySelector('#cgImagePreview');

    browseBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      GamesModule.compressAndLoadImage(file, (dataUrl) => {
        currentImageDataUrl = dataUrl;
        previewImg.src = dataUrl;
        previewBox.style.display = 'block';
        removeBtn.style.display = 'inline-flex';
      });
    };

    removeBtn.onclick = () => {
      currentImageDataUrl = null;
      fileInput.value = '';
      previewImg.src = '';
      previewBox.style.display = 'none';
      removeBtn.style.display = 'none';
    };

    modal.querySelector('#saveGameBtn').onclick = async () => {
      const standId = document.getElementById('gStand').value || null;
      const name = document.getElementById('gName').value.trim();
      const rawPrice = document.getElementById('gPrice').value.trim();
      const price = rawPrice === '' ? 0 : parseInt(rawPrice, 10);
      const materials = document.getElementById('gMaterials').value.trim();
      const sendLogistics = document.getElementById('gSendLogisticsNow').checked;
      const rules = document.getElementById('gRules').value.trim();
      const prizes = document.getElementById('gPrizes').value.trim();

      if (!name) {
        Notify.error('Veuillez renseigner au moins le nom du jeu.');
        return;
      }

      const client = SupabaseClient.client;
      let newGameId = 'game-' + Date.now();

      if (client) {
        try {
          const insertPayload = {
            stand_id: standId,
            name,
            ticket_price_f: isNaN(price) ? 0 : price,
            rules_summary: rules,
            prizes_description: prizes,
            materials_needed: materials,
            image_url: currentImageDataUrl || null,
            is_active: true
          };

          const { data, error } = await client.from('games').insert([insertPayload]).select();
          if (error) {
            delete insertPayload.materials_needed;
            let retry = await client.from('games').insert([insertPayload]).select();
            if (retry.error) {
              delete insertPayload.image_url;
              retry = await client.from('games').insert([insertPayload]).select();
            }
            if (retry.error) throw retry.error;
            if (retry.data && retry.data[0]) newGameId = retry.data[0].id;
          } else if (data && data[0]) {
            newGameId = data[0].id;
          }
        } catch (e) {
          console.warn('[Games Insert Error]', e);
          Notify.warning('Jeu enregistré localement : ' + e.message);
        }
      }

      // Envoi de la demande de matériel à la logistique si coché et matériaux saisis
      if (materials && sendLogistics) {
        const currentUser = Auth.getCurrentUser();
        const requesterName = currentUser ? (currentUser.full_name || currentUser.login) : 'Responsable des Stands';
        let standLabel = 'Stand à attribuer';
        if (standId) {
          const st = stands.find(s => s.id === standId);
          if (st) standLabel = st.name;
        }

        await GamesModule.recordMaterialRequest({
          stand_id: standId,
          stand_name: standLabel,
          game_name: name,
          materials_needed: materials,
          requested_by_name: requesterName
        });
      }

      // Sauvegarde dans le cache local
      const newGameObject = {
        id: newGameId,
        name,
        ticket_price_f: isNaN(price) ? 0 : price,
        rules_summary: rules,
        prizes_description: prizes,
        materials_needed: materials,
        image_url: currentImageDataUrl || null,
        is_active: true,
        stand: standId ? stands.find(s => s.id === standId) : null
      };

      const cachedGames = JSON.parse(localStorage.getItem('kermesse_games_cache') || '[]');
      cachedGames.unshift(newGameObject);
      localStorage.setItem('kermesse_games_cache', JSON.stringify(cachedGames));

      AuditLogger.log('CREATION_JEU', 'game', newGameId, `Création du jeu ${name}`);
      Notify.success(`Jeu "${name}" enregistré avec succès.`);
      close();
      GamesModule.render(document.getElementById('mainContent'));
    };
  },

  async openEditModal(gameId) {
    const game = this.games.find(g => g.id === gameId);
    if (!game) return;

    const client = SupabaseClient.client;
    let stands = [];

    if (client) {
      const { data } = await client.from('stands').select('id, name, number, color_name').order('number');
      stands = data || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 600px;">
        <div class="modal-header">
          <h3>Modifier le Jeu : ${game.name}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editGameForm">
            <div class="form-group">
              <label>Nom du jeu *</label>
              <input type="text" id="egName" class="form-control" value="${game.name}" required>
            </div>

            <!-- Image de l'attraction (Parcourir sur PC) -->
            <div class="form-group">
              <label style="display: flex; justify-content: space-between; align-items: center;">
                <span>📸 Photo / Image du jeu</span>
                <span style="font-size: 0.75rem; color: var(--gray-500); font-weight: normal;">Affichée sur l'écran tactile des caisses</span>
              </label>
              <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                <input type="file" id="egImageInput" accept="image/*" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm" id="egBrowseBtn" style="display: flex; align-items: center; gap: 6px;">
                  <span>📁</span> Parcourir une image sur mon PC...
                </button>
                <button type="button" class="btn btn-danger btn-sm" id="egRemoveImgBtn" style="${game.image_url ? 'display: inline-flex;' : 'display: none;'} padding: 4px 8px;">
                  <span>🗑️</span> Enlever la photo
                </button>
              </div>
              <div id="egImagePreviewBox" style="${game.image_url ? 'display: block;' : 'display: none;'} margin-top: 0.6rem;">
                <img id="egImagePreview" src="${game.image_url || ''}" alt="Aperçu jeu" style="max-width: 160px; max-height: 100px; object-fit: cover; border-radius: var(--radius-md); border: 2px solid var(--primary); box-shadow: var(--shadow-sm);">
                <div style="font-size: 0.75rem; color: var(--success); margin-top: 2px;">✅ Image actuelle configurée</div>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand associé</label>
                <select id="egStand" class="form-control">
                  <option value="">-- Aucun (Catalogue général) --</option>
                  ${stands.map(s => `
                    <option value="${s.id}" ${(game.stand && game.stand.id === s.id) ? 'selected' : ''}>
                      ${s.color_name} ${s.number} — ${s.name}
                    </option>
                  `).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Prix du ticket (${KermesseConfig.currency})</label>
                <input type="number" id="egPrice" class="form-control" value="${game.ticket_price_f || 0}" min="0" step="50">
              </div>
            </div>

            <div class="form-group">
              <label>Matériaux nécessaires pour ce jeu</label>
              <textarea id="egMaterials" class="form-control" rows="2">${game.materials_needed || ''}</textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Règles / Fonctionnement</label>
                <input type="text" id="egRules" class="form-control" value="${game.rules_summary || ''}">
              </div>
              <div class="form-group">
                <label>Lots à gagner</label>
                <input type="text" id="egPrizes" class="form-control" value="${game.prizes_description || ''}">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditGameBtn">Enregistrer les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    // Gestion de la photo depuis le PC
    let currentImageDataUrl = game.image_url || null;
    const fileInput = modal.querySelector('#egImageInput');
    const browseBtn = modal.querySelector('#egBrowseBtn');
    const removeBtn = modal.querySelector('#egRemoveImgBtn');
    const previewBox = modal.querySelector('#egImagePreviewBox');
    const previewImg = modal.querySelector('#egImagePreview');

    browseBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      GamesModule.compressAndLoadImage(file, (dataUrl) => {
        currentImageDataUrl = dataUrl;
        previewImg.src = dataUrl;
        previewBox.style.display = 'block';
        removeBtn.style.display = 'inline-flex';
      });
    };

    removeBtn.onclick = () => {
      currentImageDataUrl = null;
      fileInput.value = '';
      previewImg.src = '';
      previewBox.style.display = 'none';
      removeBtn.style.display = 'none';
    };

    modal.querySelector('#saveEditGameBtn').onclick = async () => {
      const standId = document.getElementById('egStand').value || null;
      const name = document.getElementById('egName').value.trim();
      const price = parseInt(document.getElementById('egPrice').value || '0', 10);
      const materials = document.getElementById('egMaterials').value.trim();
      const rules = document.getElementById('egRules').value.trim();
      const prizes = document.getElementById('egPrizes').value.trim();

      if (!name) {
        Notify.error('Le nom du jeu est obligatoire.');
        return;
      }

      if (client) {
        try {
          const updatePayload = {
            stand_id: standId,
            name,
            ticket_price_f: isNaN(price) ? 0 : price,
            rules_summary: rules,
            prizes_description: prizes,
            materials_needed: materials,
            image_url: currentImageDataUrl
          };
          const { error } = await client.from('games').update(updatePayload).eq('id', gameId);
          if (error) {
            delete updatePayload.materials_needed;
            let retry = await client.from('games').update(updatePayload).eq('id', gameId);
            if (retry.error) {
              delete updatePayload.image_url;
              await client.from('games').update(updatePayload).eq('id', gameId);
            }
          }
        } catch (e) {
          console.warn('[Game Update Error]', e);
        }
      }

      // Mettre à jour l'objet local
      game.name = name;
      game.ticket_price_f = isNaN(price) ? 0 : price;
      game.rules_summary = rules;
      game.prizes_description = prizes;
      game.materials_needed = materials;
      game.image_url = currentImageDataUrl;
      game.stand = standId ? stands.find(s => s.id === standId) : null;

      const cachedGames = JSON.parse(localStorage.getItem('kermesse_games_cache') || '[]');
      const idx = cachedGames.findIndex(g => g.id === gameId);
      if (idx >= 0) {
        cachedGames[idx] = { ...cachedGames[idx], ...game };
        localStorage.setItem('kermesse_games_cache', JSON.stringify(cachedGames));
      }

      Notify.success(`Jeu "${name}" mis à jour.`);
      close();
      GamesModule.render(document.getElementById('mainContent'));
    };
  },

  async transmitMaterialRequest(gameId, gameName, standName, materialsNeeded) {
    if (!materialsNeeded || !materialsNeeded.trim()) {
      Notify.warning('Veuillez d\'abord spécifier les matériaux nécessaires pour ce jeu.');
      return;
    }

    const currentUser = Auth.getCurrentUser();
    const requesterName = currentUser ? (currentUser.full_name || currentUser.login) : 'Responsable des Stands';

    await this.recordMaterialRequest({
      stand_id: null,
      stand_name: standName || 'Stand à attribuer',
      game_name: gameName,
      materials_needed: materialsNeeded,
      requested_by_name: requesterName
    });

    Notify.success(`Demande de matériaux pour "${gameName}" transmise au Pôle Logistique & Installation !`);
    await this.loadData();
  },

  async recordMaterialRequest(reqObj) {
    const newReq = {
      id: 'req-' + Date.now(),
      stand_id: reqObj.stand_id || null,
      stand_name: reqObj.stand_name || 'Stand',
      game_name: reqObj.game_name || null,
      materials_needed: reqObj.materials_needed,
      requested_by_name: reqObj.requested_by_name || 'Admin Stands',
      status: 'a_preparer',
      created_at: new Date().toISOString()
    };

    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('stand_material_requests').insert([{
          stand_id: newReq.stand_id,
          stand_name: newReq.stand_name,
          game_name: newReq.game_name,
          materials_needed: newReq.materials_needed,
          requested_by_name: newReq.requested_by_name,
          status: 'a_preparer'
        }]);
      } catch (e) {
        console.warn('[Material Request Supabase Warning]', e);
      }
    }

    // Persistance locale de secours
    const stored = JSON.parse(localStorage.getItem('kermesse_stand_material_requests') || '[]');
    stored.push(newReq);
    localStorage.setItem('kermesse_stand_material_requests', JSON.stringify(stored));
    this.materialRequests.push(newReq);

    AuditLogger.log(
      'DEMANDE_MATERIEL_STAND',
      'logistics',
      null,
      `Demande matériel transmise par ${newReq.requested_by_name} pour ${newReq.stand_name} (${newReq.materials_needed})`
    );
  },

  deleteGame(id, name) {
    Notify.confirm(
      'Supprimer ce jeu ?',
      `Confirmez-vous la suppression du jeu ${name} ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { error } = await client.from('games').delete().eq('id', id);
          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
          AuditLogger.log('SUPPRESSION_JEU', 'game', id, `Suppression du jeu ${name}`);
          Notify.success(`Jeu ${name} supprimé.`);
          GamesModule.render(document.getElementById('mainContent'));
        }
      },
      'Supprimer',
      true
    );
  }
};

window.GamesModule = GamesModule;
