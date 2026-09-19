/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 1 : COMMUNICATION & AFFICHAGE
 * 
 * Responsable : admin_communication
 * Missions :
 * - Affiches, flyers, réseaux sociaux, WhatsApp, annonces
 * - Impression, affichage dans les lieux prévus
 * - Signalétique sur place (panneaux stands, jeux, plan kermesse, numérotation)
 * - Statut (à faire, en cours, terminé), dates, matériels requis
 */

const CommunicationModule = {
  currentTab: 'items', // 'items', 'signage', 'whatsapp'

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📢</span> Pôle 1 : Communication & Affichage
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="CommunicationModule.openCreateModal()">
              <span>➕</span> Nouveau Support / Tâche
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="commStatsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-label">Total Actions Comm</div>
              <div class="stat-value" id="commTotalCount">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">À Faire / En cours</div>
              <div class="stat-value" id="commPendingCount" style="color: var(--warning, #f59e0b);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Terminés / Affichés</div>
              <div class="stat-value" id="commDoneCount" style="color: var(--success, #10b981);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Stands Signalés</div>
              <div class="stat-value" id="commStandsCount">0</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabCommItems" onclick="CommunicationModule.switchTab('items')">
              📋 Supports & Tâches
            </button>
            <button class="tab-btn" id="tabCommSignage" onclick="CommunicationModule.switchTab('signage')">
              🪧 Signalétique Stands & Plan
            </button>
            <button class="tab-btn" id="tabCommWhatsapp" onclick="CommunicationModule.switchTab('whatsapp')">
              📱 Modèles WhatsApp & Réseaux
            </button>
          </div>

          <!-- Tab Content Containers -->
          <div id="commTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement du pôle Communication...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(
      tab === 'items' ? 'tabCommItems' : (tab === 'signage' ? 'tabCommSignage' : 'tabCommWhatsapp')
    );
    if (activeBtn) activeBtn.classList.add('active');

    this.renderCurrentTab();
  },

  // Données locales en mémoire / fallback
  items: [],
  stands: [],

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        // Charger les tâches de communication
        const { data: cData, error: cErr } = await client
          .from('communication_items')
          .select('*')
          .order('created_at', { ascending: false });

        if (!cErr && cData) this.items = cData;

        // Charger les stands pour la signalétique
        const { data: sData, error: sErr } = await client
          .from('stands')
          .select('id, name, number, color_name, color_hex')
          .order('number', { ascending: true });

        if (!sErr && sData) this.stands = sData;
      }
    } catch (e) {
      console.warn('[CommunicationModule] Supabase load error, using local fallback:', e);
    }

    // Récupérer fallback local si vide
    if (!this.items || this.items.length === 0) {
      const stored = localStorage.getItem('kermesse_communication_items');
      if (stored) {
        try { this.items = JSON.parse(stored); } catch (e) {}
      } else {
        // Données d'exemple initiales
        this.items = [
          {
            id: 'comm-1',
            title: 'Affiches officielles A3 de la Kermesse',
            type: 'affiche',
            responsible_name: 'Équipe Communication',
            status: 'termine',
            target_date: '2026-09-20',
            display_location: 'Églises partenaires, commerces du quartier, école',
            materials_needed: 'Impression 50 exemplaires couleur A3, scotch résistant',
            notes: 'Affiches imprimées et distribuées'
          },
          {
            id: 'comm-2',
            title: 'Flyers de présentation & tombola',
            type: 'flyer',
            responsible_name: 'Sarah M.',
            status: 'en_cours',
            target_date: '2026-09-21',
            display_location: 'Distribution sortie des classes & accueil kermesse',
            materials_needed: '1000 flyers A5 quadri',
            notes: 'En cours d\'impression'
          },
          {
            id: 'comm-3',
            title: 'Panneaux de signalétique stands & jeux',
            type: 'signaletique_panneau',
            responsible_name: 'David L.',
            status: 'a_faire',
            target_date: '2026-09-22',
            display_location: 'Sur chaque stand (Couleur + N°)',
            materials_needed: 'Cartons rigides, feutres larges, œillets de fixation',
            notes: 'À finaliser la veille de la kermesse'
          },
          {
            id: 'comm-4',
            title: 'Plan officiel de la Kermesse & Délimitation des 10 zones',
            type: 'plan_kermesse',
            responsible_name: 'Mounir (SuperAdmin)',
            status: 'en_cours',
            target_date: '2026-09-22',
            display_location: 'Grand panneau d\'accueil à l\'entrée & stand Billetterie',
            materials_needed: 'Bâche imprimée 2x1m',
            notes: 'Plan avec les 10 zones et repères numérotés'
          }
        ];
        localStorage.setItem('kermesse_communication_items', JSON.stringify(this.items));
      }
    }

    this.updateStats();
    this.renderCurrentTab();
  },

  updateStats() {
    const total = this.items.length;
    const pending = this.items.filter(i => i.status !== 'termine').length;
    const done = this.items.filter(i => i.status === 'termine').length;
    const standsCount = this.stands.length;

    const elTotal = document.getElementById('commTotalCount');
    const elPending = document.getElementById('commPendingCount');
    const elDone = document.getElementById('commDoneCount');
    const elStands = document.getElementById('commStandsCount');

    if (elTotal) elTotal.textContent = total;
    if (elPending) elPending.textContent = pending;
    if (elDone) elDone.textContent = done;
    if (elStands) elStands.textContent = standsCount;
  },

  renderCurrentTab() {
    const container = document.getElementById('commTabContent');
    if (!container) return;

    if (this.currentTab === 'items') {
      this.renderItemsTab(container);
    } else if (this.currentTab === 'signage') {
      this.renderSignageTab(container);
    } else if (this.currentTab === 'whatsapp') {
      this.renderWhatsappTab(container);
    }
  },

  // 1. ONGLET SUPPORTS & CAMPAGNES
  renderItemsTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
          <input type="text" id="commSearch" class="form-control" placeholder="Rechercher un support, responsable, lieu..." oninput="CommunicationModule.filterItems()">
        </div>
        <div class="filters-group" style="display: flex; gap: 0.5rem;">
          <select id="commTypeFilter" class="form-control" onchange="CommunicationModule.filterItems()">
            <option value="">Tous les types</option>
            <option value="affiche">Affiches</option>
            <option value="flyer">Flyers</option>
            <option value="signaletique_panneau">Signalétique & Panneaux</option>
            <option value="plan_kermesse">Plan Kermesse</option>
            <option value="whatsapp">Communication WhatsApp</option>
            <option value="reseaux_sociaux">Réseaux Sociaux</option>
            <option value="annonce">Annonces / Invitations</option>
          </select>
          <select id="commStatusFilter" class="form-control" onchange="CommunicationModule.filterItems()">
            <option value="">Tous les statuts</option>
            <option value="a_faire">À faire</option>
            <option value="en_cours">En cours</option>
            <option value="termine">Terminé</option>
          </select>
        </div>
      </div>

      <div class="table-responsive" id="commTableContainer">
        ${this.generateItemsTable(this.items)}
      </div>
    `;
  },

  generateItemsTable(itemsList) {
    if (!itemsList || itemsList.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📢</div>
          <div class="empty-title">Aucune tâche de communication enregistrée</div>
          <div class="empty-desc">Créez des affiches, flyers, panneaux de signalétique ou campagnes WhatsApp pour organiser la communication de la kermesse.</div>
          <button class="btn btn-primary" onclick="CommunicationModule.openCreateModal()">
            <span>➕</span> Créer la première action
          </button>
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Support / Action</th>
            <th>Type</th>
            <th>Responsable</th>
            <th>Emplacement / Cible</th>
            <th>Date Prévue</th>
            <th>Statut</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList.map(item => {
            let badgeClass = 'badge-gray';
            let labelStatus = 'À faire';
            if (item.status === 'en_cours') { badgeClass = 'badge-warning'; labelStatus = 'En cours'; }
            if (item.status === 'termine') { badgeClass = 'badge-success'; labelStatus = 'Terminé'; }

            const typeLabels = {
              'affiche': '🖼️ Affiche',
              'flyer': '📄 Flyer',
              'signaletique_panneau': '🪧 Signalétique',
              'plan_kermesse': '🗺️ Plan Kermesse',
              'whatsapp': '📱 WhatsApp',
              'reseaux_sociaux': '🌐 Réseaux Sociaux',
              'annonce': '📣 Annonce'
            };

            return `
              <tr>
                <td>
                  <strong>${item.title}</strong>
                  ${item.materials_needed ? `<div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">📦 Matériel : ${item.materials_needed}</div>` : ''}
                </td>
                <td><span class="badge badge-primary">${typeLabels[item.type] || item.type}</span></td>
                <td>${item.responsible_name || '-'}</td>
                <td>${item.display_location || '-'}</td>
                <td>${item.target_date || '-'}</td>
                <td><span class="badge ${badgeClass}">${labelStatus}</span></td>
                <td style="text-align: right;">
                  <button class="btn-icon" onclick="CommunicationModule.toggleStatus('${item.id}')" title="Changer le statut">
                    ${item.status === 'termine' ? '↩️' : '✅'}
                  </button>
                  <button class="btn-icon danger" onclick="CommunicationModule.deleteItem('${item.id}')" title="Supprimer">
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
    const q = (document.getElementById('commSearch')?.value || '').toLowerCase();
    const t = document.getElementById('commTypeFilter')?.value;
    const s = document.getElementById('commStatusFilter')?.value;

    const filtered = this.items.filter(i => {
      const matchText = (i.title || '').toLowerCase().includes(q) ||
                        (i.responsible_name || '').toLowerCase().includes(q) ||
                        (i.display_location || '').toLowerCase().includes(q);
      const matchType = !t || i.type === t;
      const matchStatus = !s || i.status === s;
      return matchText && matchType && matchStatus;
    });

    const container = document.getElementById('commTableContainer');
    if (container) container.innerHTML = this.generateItemsTable(filtered);
  },

  // 2. ONGLET SIGNALÉTIQUE STANDS & PLAN
  renderSignageTab(container) {
    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.5rem;">
        <div>
          🪧 <strong>Signalétique physique sur le terrain :</strong> Chaque stand doit disposer de son panneau visible à l'entrée avec son <strong>numéro</strong>, sa <strong>couleur officielle</strong>, son <strong>nom de jeu</strong> et les tarifs en tickets/jetons.
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
        ${this.stands.length === 0 ? `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <div class="empty-icon">🎪</div>
            <div class="empty-title">Aucun stand configuré</div>
            <div class="empty-desc">Les panneaux de signalétique s'afficheront ici automatiquement dès que les stands sont enregistrés.</div>
          </div>
        ` : this.stands.map(s => `
          <div class="card" style="border-left: 6px solid ${s.color_hex || '#3b82f6'};">
            <div class="card-body" style="padding: 1.25rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
                <span class="badge" style="background-color: ${s.color_hex || '#3b82f6'}; color: #fff; font-size: 0.85rem; font-weight: 700;">
                  Stand N° ${s.number}
                </span>
                <span style="font-size: 0.8rem; font-weight: 600; color: var(--gray-600);">
                  Couleur : ${s.color_name || 'Standard'}
                </span>
              </div>
              <h4 style="margin: 0.5rem 0; font-size: 1.1rem; color: var(--gray-900);">${s.name}</h4>
              <p style="font-size: 0.8rem; color: var(--gray-500); margin-bottom: 1rem;">
                Panneau d'affichage requis : Format A3 Plastifié ou carton rigide avec nom du jeu et règle.
              </p>
              <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-secondary btn-sm" onclick="CommunicationModule.printStandSign('${s.id}', '${s.name}', '${s.number}', '${s.color_name}')" style="width: 100%;">
                  🖨️ Générer / Imprimer Panneau
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  printStandSign(id, name, number, color) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Panneau Stand ${number} - Love & Charity</title>
        <style>
          @page { size: A4 landscape; margin: 20mm; }
          body { font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 2rem; }
          .banner { background: #1e3a8a; color: white; padding: 15px; border-radius: 12px; margin-bottom: 2rem; }
          .number-circle { display: inline-block; width: 140px; height: 140px; line-height: 140px; border-radius: 50%; background: #2563eb; color: white; font-size: 70px; font-weight: 900; margin: 1.5rem auto; box-shadow: 0 8px 16px rgba(0,0,0,0.15); }
          .stand-name { font-size: 42px; font-weight: 800; color: #111827; margin-bottom: 1rem; }
          .color-tag { font-size: 24px; color: #4b5563; font-weight: 600; text-transform: uppercase; letter-spacing: 2px; }
          .footer-sign { margin-top: 3rem; font-size: 18px; color: #6b7280; border-top: 2px dashed #d1d5db; padding-top: 1rem; }
        </style>
      </head>
      <body>
        <div class="banner">
          <h1>KERMESSE LOVE AND CHARITY (L&amp;C) 2026</h1>
        </div>
        <div class="color-tag">Secteur Couleur : ${color || 'Bleu'}</div>
        <div class="number-circle">${number}</div>
        <div class="stand-name">${name}</div>
        <div class="footer-sign">
          Love and Charity &bull; Merci de respecter les consignes et les arbitres du jeu
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
      </html>
    `);
    printWindow.document.close();
  },

  // 3. ONGLET MODÈLES WHATSAPP & RÉSEAUX
  renderWhatsappTab(container) {
    const templates = [
      {
        title: "Invitation Générale Familles & Visiteurs",
        target: "Parents, écoles, groupes de quartier",
        content: `🎉 *GRANDE KERMESSE LOVE AND CHARITY 2026* 🎉\n\nChers parents, amis et voisins,\nL'association Love & Charity a la joie de vous inviter à sa grande kermesse annuelle !\n\n📅 *Date :* Ce week-end dès 10h00\n📍 *Lieu :* Cour principale & Stands kermesse\n🎯 *Au programme :* Grands jeux pour tous les âges, manèges, stands gourmands (crêpes, gaufres, boissons fraîches), et notre super tombola avec d'incroyables lots à gagner ! 🎁\n\nVenez nombreux partager un moment chaleureux et festif en famille au profit de nos actions caritatives ! ❤️`
      },
      {
        title: "Consigne Organisation Bénévoles & Horaires",
        target: "Groupe WhatsApp interne Bénévoles",
        content: `👋 *MESSAGE IMPORTANT AUX BÉNÉVOLES L&C* 👋\n\nMerci à toutes et à tous pour votre précieux engagement !\n\n⏰ *Rappel des horaires :*\n- *08h00 :* Arrivée équipe Logistique & Décoration (montage tentes, tables, sono)\n- *09h15 :* Briefing général de tous les responsables de stand\n- *10h00 :* Ouverture officielle des billetteries et des stands\n\nN'oubliez pas de badger ou de vous signaler auprès du responsable du Pôle Bénévoles dès votre arrivée. Bonne kermesse à tous ! 🚀`
      },
      {
        title: "Annonce Tirage Tombola & Retrait des Lots",
        target: "Visiteurs & Acheteurs de tickets tombola",
        content: `📢 *TIRAGE AU SORT DE LA GRANDE TOMBOLA L&C !* 🎁\n\nLe tirage des tickets gagnants aura lieu aujourd'hui à *16h30 précises* devant l'Espace Podium / Direction !\n\n🎫 Vérifiez bien vos numéros de tickets achetés à la billetterie.\nDe superbes lots (High-Tech, paniers gourmands, jouets enfants) vous attendent au comptoir Lots !\nBonne chance à tous les participants ! ✨`
      }
    ];

    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.5rem;">
        <div>
          📱 <strong>Diffusion Rapide WhatsApp :</strong> Cliquez sur <strong>Copier le message</strong> ou <strong>Ouvrir dans WhatsApp</strong> pour diffuser immédiatement les annonces officielles auprès de vos contacts et groupes.
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        ${templates.map((tpl, idx) => `
          <div class="card" style="background: var(--gray-50, #f9fafb); border: 1px solid var(--gray-200);">
            <div class="card-body">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <h4 style="margin: 0; font-size: 1rem; color: var(--gray-900);">💬 ${tpl.title}</h4>
                <span class="badge badge-gray">${tpl.target}</span>
              </div>
              <textarea id="whatsappTpl_${idx}" class="form-control" rows="5" readonly style="font-family: monospace; font-size: 0.85rem; background: #fff; margin-bottom: 0.75rem;">${tpl.content}</textarea>
              <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
                <button class="btn btn-secondary btn-sm" onclick="CommunicationModule.copyWhatsappText('whatsappTpl_${idx}')">
                  📋 Copier le message
                </button>
                <button class="btn btn-primary btn-sm" onclick="CommunicationModule.shareOnWhatsapp('whatsappTpl_${idx}')">
                  🚀 Partager sur WhatsApp
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  copyWhatsappText(elementId) {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    textarea.select();
    navigator.clipboard.writeText(textarea.value).then(() => {
      Notify.success('Message copié dans le presse-papier !');
    }).catch(() => {
      Notify.info('Veuillez sélectionner le texte pour copier.');
    });
  },

  shareOnWhatsapp(elementId) {
    const textarea = document.getElementById(elementId);
    if (!textarea) return;
    const encoded = encodeURIComponent(textarea.value);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  },

  // MODAL CRÉATION
  openCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouveau Support / Action Communication</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createCommForm">
            <div class="form-group">
              <label>Intitulé du support / de l'action *</label>
              <input type="text" id="commTitle" class="form-control" required placeholder="Ex: Affiches A3 commerces, flyers entrée...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Type de support *</label>
                <select id="commType" class="form-control" required>
                  <option value="affiche">🖼️ Affiche</option>
                  <option value="flyer">📄 Flyer</option>
                  <option value="signaletique_panneau">🪧 Signalétique & Panneau</option>
                  <option value="plan_kermesse">🗺️ Plan de la kermesse</option>
                  <option value="whatsapp">📱 Message WhatsApp</option>
                  <option value="reseaux_sociaux">🌐 Réseaux Sociaux</option>
                  <option value="annonce">📣 Annonce / Invitation</option>
                </select>
              </div>
              <div class="form-group">
                <label>Statut *</label>
                <select id="commStatus" class="form-control" required>
                  <option value="a_faire">À faire</option>
                  <option value="en_cours" selected>En cours</option>
                  <option value="termine">Terminé</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Responsable *</label>
                <input type="text" id="commResponsible" class="form-control" required value="${Auth.getCurrentUser()?.full_name || 'Équipe Comm'}">
              </div>
              <div class="form-group">
                <label>Date prévue</label>
                <input type="date" id="commTargetDate" class="form-control">
              </div>
            </div>

            <div class="form-group">
              <label>Emplacement d'affichage / Cible</label>
              <input type="text" id="commLocation" class="form-control" placeholder="Ex: Entrée principale, vitrines, stand billetterie...">
            </div>

            <div class="form-group">
              <label>Matériel nécessaire (impression, scotch, piquets...)</label>
              <input type="text" id="commMaterials" class="form-control" placeholder="Ex: Papier 160g, scotch d'électricien, feutres...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveCommBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveCommBtn').onclick = async () => {
      const title = document.getElementById('commTitle').value.trim();
      const type = document.getElementById('commType').value;
      const status = document.getElementById('commStatus').value;
      const responsible = document.getElementById('commResponsible').value.trim();
      const targetDate = document.getElementById('commTargetDate').value;
      const location = document.getElementById('commLocation').value.trim();
      const materials = document.getElementById('commMaterials').value.trim();

      if (!title || !responsible) {
        Notify.error('Veuillez renseigner les champs obligatoires.');
        return;
      }

      const newItem = {
        id: 'comm-' + Date.now(),
        title,
        type,
        responsible_name: responsible,
        status,
        target_date: targetDate || null,
        display_location: location || null,
        materials_needed: materials || null,
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data, error } = await client.from('communication_items').insert([{
            title: newItem.title,
            type: newItem.type,
            responsible_name: newItem.responsible_name,
            status: newItem.status,
            target_date: newItem.target_date,
            display_location: newItem.display_location,
            materials_needed: newItem.materials_needed
          }]).select();

          if (!error && data && data[0]) {
            newItem.id = data[0].id;
          }
        } catch (e) {
          console.warn('[CommunicationModule] Insert error, fallback local:', e);
        }
      }

      CommunicationModule.items.unshift(newItem);
      localStorage.setItem('kermesse_communication_items', JSON.stringify(CommunicationModule.items));
      Notify.success('Action de communication enregistrée avec succès.');
      close();
      CommunicationModule.updateStats();
      CommunicationModule.renderCurrentTab();
    };
  },

  async toggleStatus(id) {
    const item = this.items.find(i => i.id === id);
    if (!item) return;

    item.status = item.status === 'termine' ? 'en_cours' : 'termine';

    const client = SupabaseClient.client;
    if (client && !id.startsWith('comm-')) {
      await client.from('communication_items').update({ status: item.status }).eq('id', id);
    }

    localStorage.setItem('kermesse_communication_items', JSON.stringify(this.items));
    Notify.success(`Statut mis à jour : ${item.status === 'termine' ? 'Terminé' : 'En cours'}`);
    this.updateStats();
    this.renderCurrentTab();
  },

  async deleteItem(id) {
    if (!confirm('Supprimer cette action de communication ?')) return;

    this.items = this.items.filter(i => i.id !== id);

    const client = SupabaseClient.client;
    if (client && !id.startsWith('comm-')) {
      await client.from('communication_items').delete().eq('id', id);
    }

    localStorage.setItem('kermesse_communication_items', JSON.stringify(this.items));
    Notify.info('Support supprimé.');
    this.updateStats();
    this.renderCurrentTab();
  }
};

window.CommunicationModule = CommunicationModule;
