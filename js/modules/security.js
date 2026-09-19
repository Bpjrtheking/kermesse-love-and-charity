/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 9 : ACCUEIL, NETTOYAGE & SÉCURITÉ
 * 
 * Responsable : admin_securite
 * Missions :
 * - Accueil & Objets Trouvés (orientation, bracelets, registres des objets trouvés et restitués)
 * - Nettoyage & Sanitaires (rondes propreté, poubelles, savons, papier toilette, contrôle continu)
 * - Sécurité & Secours (poste premiers secours, défibrillateur, procédure alerte enfant perdu)
 * - Registre officiel des incidents (chutes, litiges, pannes, vols, résolutions)
 */

const SecurityModule = {
  currentTab: 'incidents', // 'incidents', 'emergencies', 'cleaning', 'lostfound'

  incidents: [],
  cleaningRounds: [],
  lostItems: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🛡️</span> Pôle 9 : Accueil, Nettoyage &amp; Sécurité
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-danger btn-sm" onclick="SecurityModule.openLostChildModal()">
              <span>🚨</span> Alerte Enfant Perdu
            </button>
            <button class="btn btn-secondary btn-sm" onclick="SecurityModule.openCreateCleaningModal()">
              <span>🧹</span> Pointer Ronde Nettoyage
            </button>
            <button class="btn btn-primary btn-sm" onclick="SecurityModule.openCreateIncidentModal()">
              <span>⚠️</span> Déclarer un Incident
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="securityStatsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
            <div class="stat-card">
              <div class="stat-label">Incidents En Cours</div>
              <div class="stat-value" id="secIncidentsOpen" style="color: var(--danger, #ef4444);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Rondes Nettoyage Validées</div>
              <div class="stat-value" id="secCleaningCount" style="color: var(--success, #10b981);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Objets Trouvés en Attente</div>
              <div class="stat-value" id="secLostCount" style="color: var(--warning, #f59e0b);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Poste Secours &amp; DAE</div>
              <div class="stat-value" style="color: var(--primary);">Opérationnel ✅</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabSecIncidents" onclick="SecurityModule.switchTab('incidents')">
              🚨 Registre des Incidents
            </button>
            <button class="tab-btn" id="tabSecEmergencies" onclick="SecurityModule.switchTab('emergencies')">
              🚑 Urgences &amp; Premiers Secours
            </button>
            <button class="tab-btn" id="tabSecCleaning" onclick="SecurityModule.switchTab('cleaning')">
              🧹 Rondes Nettoyage &amp; Sanitaires
            </button>
            <button class="tab-btn" id="tabSecLostFound" onclick="SecurityModule.switchTab('lostfound')">
              🎒 Accueil &amp; Objets Trouvés
            </button>
          </div>

          <!-- Dynamic Tab Content -->
          <div id="securityTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement du pôle Sécurité...</div>
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
      tab === 'incidents' ? 'tabSecIncidents' : 
      (tab === 'emergencies' ? 'tabSecEmergencies' : 
      (tab === 'cleaning' ? 'tabSecCleaning' : 'tabSecLostFound'))
    );
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        const { data: iData } = await client.from('incidents').select('*').order('created_at', { ascending: false });
        if (iData) this.incidents = iData;

        const { data: cData } = await client.from('cleaning_rounds').select('*').order('checked_at', { ascending: false });
        if (cData) this.cleaningRounds = cData;

        const { data: lData } = await client.from('lost_and_found').select('*').order('created_at', { ascending: false });
        if (lData) this.lostItems = lData;
      }
    } catch (e) {
      console.warn('[SecurityModule] Supabase error:', e);
    }

    // Fallbacks
    if (!this.incidents || this.incidents.length === 0) {
      const storedI = localStorage.getItem('kermesse_incidents_data');
      if (storedI) {
        try { this.incidents = JSON.parse(storedI); } catch (e) {}
      } else {
        this.incidents = [
          { id: 'inc-1', title: 'File d\'attente billetterie dense', description: 'Affluence forte à l\'entrée, besoin d\'un second caissier', severity: 'moyenne', status: 'ouvert', location: 'Zone 3 : Billetterie', reporter_name: 'Mamadou Sy', created_at: new Date().toISOString() }
        ];
        localStorage.setItem('kermesse_incidents_data', JSON.stringify(this.incidents));
      }
    }

    if (!this.cleaningRounds || this.cleaningRounds.length === 0) {
      const storedC = localStorage.getItem('kermesse_cleaning_rounds');
      if (storedC) {
        try { this.cleaningRounds = JSON.parse(storedC); } catch (e) {}
      } else {
        this.cleaningRounds = [
          { id: 'cln-1', zone_name: 'Bloc Sanitaires Principaux', checker_name: 'Équipe Propreté', trash_emptied: true, toilets_clean: true, soap_paper_ok: true, notes: 'Savon et papier réapprovisionnés', checked_at: new Date().toISOString() },
          { id: 'cln-2', zone_name: 'Zone 4 : Restauration & Buvette', checker_name: 'Équipe Propreté', trash_emptied: true, toilets_clean: true, soap_paper_ok: true, notes: 'Poubelles tri vidées et sacs changés', checked_at: new Date().toISOString() }
        ];
        localStorage.setItem('kermesse_cleaning_rounds', JSON.stringify(this.cleaningRounds));
      }
    }

    if (!this.lostItems || this.lostItems.length === 0) {
      const storedL = localStorage.getItem('kermesse_lost_found');
      if (storedL) {
        try { this.lostItems = JSON.parse(storedL); } catch (e) {}
      } else {
        this.lostItems = [
          { id: 'lost-1', item_name: 'Casquette bleue enfant "Spiderman"', description: 'Trouvée près du stand Chamboule-tout', location_found: 'Stand 2', found_by: 'Bénévole Stand', status: 'en_attente', created_at: new Date().toISOString() },
          { id: 'lost-2', item_name: 'Trousseau de 3 clés avec porte-clés rouge', description: 'Restitué à son propriétaire à l\'accueil', location_found: 'Zone Repos', found_by: 'Visiteur', status: 'restitue', returned_to: 'M. Sow', returned_at: new Date().toISOString(), created_at: new Date().toISOString() }
        ];
        localStorage.setItem('kermesse_lost_found', JSON.stringify(this.lostItems));
      }
    }

    this.updateStats();
    this.renderCurrentTab();
  },

  updateStats() {
    const openIncidents = this.incidents.filter(i => i.status !== 'resolu').length;
    const cleaningCount = this.cleaningRounds.length;
    const pendingLost = this.lostItems.filter(l => l.status === 'en_attente').length;

    const elI = document.getElementById('secIncidentsOpen');
    const elC = document.getElementById('secCleaningCount');
    const elL = document.getElementById('secLostCount');

    if (elI) elI.textContent = openIncidents;
    if (elC) elC.textContent = cleaningCount;
    if (elL) elL.textContent = pendingLost;
  },

  renderCurrentTab() {
    const container = document.getElementById('securityTabContent');
    if (!container) return;

    if (this.currentTab === 'incidents') {
      this.renderIncidentsTab(container);
    } else if (this.currentTab === 'emergencies') {
      this.renderEmergenciesTab(container);
    } else if (this.currentTab === 'cleaning') {
      this.renderCleaningTab(container);
    } else if (this.currentTab === 'lostfound') {
      this.renderLostFoundTab(container);
    }
  },

  // 1. ONGLET REGISTRE DES INCIDENTS
  renderIncidentsTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
          <input type="text" id="incSearch" class="form-control" placeholder="Rechercher par incident, lieu..." oninput="SecurityModule.filterIncidents()">
        </div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="SecurityModule.openCreateIncidentModal()">
            <span>➕</span> Déclarer un Incident
          </button>
        </div>
      </div>

      <div class="table-responsive" id="incidentsTableContainer">
        ${this.generateIncidentsTable(this.incidents)}
      </div>
    `;
  },

  generateIncidentsTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-title">Aucun incident signalé</div>
          <div class="empty-desc">La kermesse se déroule dans le calme. Tout incident signalé apparaîtra ici en temps réel.</div>
        </div>
      `;
    }

    const sevBadges = {
      'faible': 'badge-gray',
      'moyenne': 'badge-warning',
      'critique': 'badge-danger'
    };

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Incident</th>
            <th>Lieu / Stand</th>
            <th>Gravité</th>
            <th>Déclaré par</th>
            <th>Date &amp; Heure</th>
            <th>Statut</th>
            <th style="text-align: right;">Résolution</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(i => {
            const isResolved = i.status === 'resolu';
            return `
              <tr>
                <td>
                  <strong>${i.title}</strong>
                  ${i.description ? `<div style="font-size: 0.78rem; color: var(--gray-600); margin-top: 2px;">${i.description}</div>` : ''}
                </td>
                <td>${i.location || '-'}</td>
                <td><span class="badge ${sevBadges[i.severity] || 'badge-gray'}">${(i.severity || 'Moyenne').toUpperCase()}</span></td>
                <td>${i.reporter_name || '-'}</td>
                <td>${new Date(i.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td><span class="badge ${isResolved ? 'badge-success' : 'badge-danger'}">${isResolved ? 'Résolu ✅' : 'En cours ⚠️'}</span></td>
                <td style="text-align: right;">
                  <button class="btn btn-sm ${isResolved ? 'btn-secondary' : 'btn-success'}" onclick="SecurityModule.toggleIncidentStatus('${i.id}')">
                    ${isResolved ? 'Rouvrir' : 'Clôturer ✅'}
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterIncidents() {
    const q = (document.getElementById('incSearch')?.value || '').toLowerCase();
    const filtered = this.incidents.filter(i => {
      return (i.title || '').toLowerCase().includes(q) ||
             (i.location || '').toLowerCase().includes(q) ||
             (i.reporter_name || '').toLowerCase().includes(q);
    });
    const c = document.getElementById('incidentsTableContainer');
    if (c) c.innerHTML = this.generateIncidentsTable(filtered);
  },

  async toggleIncidentStatus(id) {
    const inc = this.incidents.find(i => i.id === id);
    if (!inc) return;

    inc.status = inc.status === 'resolu' ? 'ouvert' : 'resolu';

    const client = SupabaseClient.client;
    if (client && !id.startsWith('inc-')) {
      await client.from('incidents').update({ status: inc.status }).eq('id', id);
    }

    localStorage.setItem('kermesse_incidents_data', JSON.stringify(this.incidents));
    Notify.success(`Incident marqué comme ${inc.status === 'resolu' ? 'Résolu' : 'En cours'}.`);
    this.updateStats();
    this.renderCurrentTab();
  },

  // 2. ONGLET URGENCES & PREMIERS SECOURS
  renderEmergenciesTab(container) {
    container.innerHTML = `
      <div class="alert-banner danger" style="margin-bottom: 1.5rem;">
        <div>
          🚨 <strong>CONSIGNES EN CAS D'URGENCE VITALE :</strong> Alerter immédiatement le poste de secours central (Zone 10 - Direction), puis composer le <strong>15 (SAMU)</strong> ou le <strong>18 (Pompiers)</strong>. Dégager immédiatement les voies de circulation visiteurs.
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
        <div class="card" style="border-left: 6px solid #dc2626;">
          <div class="card-body">
            <h4 style="margin: 0 0 0.75rem 0; color: #dc2626; font-size: 1.1rem;">📞 Numéros d'Urgence</h4>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.9rem;">
              <div><strong>🚑 SAMU :</strong> <a href="tel:15" style="font-weight: 800; color: #dc2626; font-size: 1.1rem; text-decoration: none;">15</a></div>
              <div><strong>🚒 Pompiers :</strong> <a href="tel:18" style="font-weight: 800; color: #dc2626; font-size: 1.1rem; text-decoration: none;">18</a></div>
              <div><strong>🚓 Police / Secours :</strong> <a href="tel:17" style="font-weight: 800; color: #dc2626; font-size: 1.1rem; text-decoration: none;">17</a></div>
              <div><strong>📱 Référent Secours L&amp;C :</strong> <strong>Mounir (SuperAdmin)</strong></div>
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 6px solid #16a34a;">
          <div class="card-body">
            <h4 style="margin: 0 0 0.75rem 0; color: #16a34a; font-size: 1.1rem;">🏥 Poste de Premiers Secours</h4>
            <div style="font-size: 0.85rem; color: var(--gray-700); line-height: 1.5;">
              <div>📍 <strong>Emplacement :</strong> Espace Organisation (Zone 10)</div>
              <div>🩹 <strong>Matériel disponible :</strong> Trousse complète de secours, pansements, désinfectants, compresses, couverture de survie</div>
              <div>⚡ <strong>Défibrillateur (DAE) :</strong> Fixé au mur de l'accueil Direction, vérifié et prêt à l'emploi</div>
            </div>
          </div>
        </div>

        <div class="card" style="border-left: 6px solid #f59e0b;">
          <div class="card-body">
            <h4 style="margin: 0 0 0.75rem 0; color: #d97706; font-size: 1.1rem;">👶 Procédure Enfant Perdu</h4>
            <div style="font-size: 0.85rem; color: var(--gray-700); line-height: 1.5;">
              <p>1. Conduire immédiatement l'enfant au <strong>Point Information / Accueil (Zone 1)</strong>.</p>
              <p>2. Déclencher l'alerte sur l'application ci-dessous pour prévenir tous les stands.</p>
              <p>3. Diffuser une annonce sonore au micro général sans donner le nom de famille.</p>
            </div>
            <button class="btn btn-danger btn-sm" onclick="SecurityModule.openLostChildModal()" style="width: 100%; margin-top: 0.5rem;">
              📢 Lancer une Alerte Enfant Perdu
            </button>
          </div>
        </div>
      </div>
    `;
  },

  // 3. ONGLET RONDES NETTOYAGE & SANITAIRES
  renderCleaningTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div style="font-size: 0.9rem; color: var(--gray-600); align-self: center;">
          🧹 Suivi du nettoyage continu, passage sanitaires et vidage des poubelles.
        </div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="SecurityModule.openCreateCleaningModal()">
            <span>➕</span> Valider un Passage Propreté
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.cleaningRounds.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🧹</div>
            <div class="empty-title">Aucune ronde enregistrée</div>
            <div class="empty-desc">Enregistrez les passages propreté pour garantir l'hygiène et le confort des visiteurs.</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Zone / Sanitaire</th>
                <th>Agent de Propreté</th>
                <th>Poubelles Vidées</th>
                <th>Sanitaires Propres</th>
                <th>Savon &amp; Papier OK</th>
                <th>Notes</th>
                <th>Heure du passage</th>
              </tr>
            </thead>
            <tbody>
              ${this.cleaningRounds.map(r => `
                <tr>
                  <td><strong>${r.zone_name}</strong></td>
                  <td>${r.checker_name}</td>
                  <td><span class="badge ${r.trash_emptied ? 'badge-success' : 'badge-danger'}">${r.trash_emptied ? 'Oui ✅' : 'Non'}</span></td>
                  <td><span class="badge ${r.toilets_clean ? 'badge-success' : 'badge-danger'}">${r.toilets_clean ? 'Oui ✅' : 'Non'}</span></td>
                  <td><span class="badge ${r.soap_paper_ok ? 'badge-success' : 'badge-danger'}">${r.soap_paper_ok ? 'Oui ✅' : 'Non'}</span></td>
                  <td>${r.notes || '-'}</td>
                  <td><span class="badge badge-gray">${new Date(r.checked_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  // 4. ONGLET ACCUEIL & OBJETS TROUVÉS
  renderLostFoundTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div style="font-size: 0.9rem; color: var(--gray-600); align-self: center;">
          🎒 Tous les objets perdus sont centralisés au stand Accueil (Zone 1).
        </div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="SecurityModule.openCreateLostItemModal()">
            <span>➕</span> Enregistrer un Objet Trouvé
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.lostItems.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🎒</div>
            <div class="empty-title">Aucun objet trouvé actuellement</div>
            <div class="empty-desc">Les doudous, clés, téléphones et vêtements trouvés seront consignés ici.</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Objet</th>
                <th>Lieu où il a été trouvé</th>
                <th>Trouvé par</th>
                <th>Date / Heure</th>
                <th>Statut</th>
                <th>Restitution</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.lostItems.map(l => {
                const isReturned = l.status === 'restitue';
                return `
                  <tr>
                    <td>
                      <strong>${l.item_name}</strong>
                      ${l.description ? `<div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">${l.description}</div>` : ''}
                    </td>
                    <td>${l.location_found || 'Site kermesse'}</td>
                    <td>${l.found_by || 'Anonyme'}</td>
                    <td>${new Date(l.created_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="badge ${isReturned ? 'badge-success' : 'badge-warning'}">${isReturned ? 'Restitué ✅' : 'En attente ⏳'}</span></td>
                    <td>${l.returned_to ? `Remis à <strong>${l.returned_to}</strong>` : '-'}</td>
                    <td style="text-align: right;">
                      ${!isReturned ? `
                        <button class="btn btn-sm btn-success" onclick="SecurityModule.returnLostItem('${l.id}')">
                          🤝 Restituer
                        </button>
                      ` : '<span style="font-size: 0.8rem; color: var(--success);">Dossier clos</span>'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  // MODAL ALERTE ENFANT PERDU
  openLostChildModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header" style="background: #dc2626; color: white;">
          <h3 style="color: white;">🚨 ALERTE ENFANT PERDU</h3>
          <button class="modal-close-btn" style="color: white;">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
            Cette alerte enverra une consigne d'urgence immédiate dans le canal de messagerie de tous les responsables de stand.
          </p>
          <form id="lostChildForm">
            <div class="form-group">
              <label>Prénom de l'enfant *</label>
              <input type="text" id="childFirstName" class="form-control" required placeholder="Ex: Léo">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Âge approximatif *</label>
                <input type="text" id="childAge" class="form-control" required placeholder="Ex: 5 ans">
              </div>
              <div class="form-group">
                <label>Lieu où il a été vu pour la dernière fois</label>
                <input type="text" id="childLastSeen" class="form-control" placeholder="Ex: Près du stand pêche aux canards">
              </div>
            </div>
            <div class="form-group">
              <label>Description vestimentaire précise *</label>
              <textarea id="childClothing" class="form-control" rows="2" required placeholder="Ex: T-shirt rayé jaune, short bleu, casquette rouge, baskets blanches..."></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-danger" id="broadcastLostChildBtn">🚨 Diffuser l'Alerte Générale</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#broadcastLostChildBtn').onclick = async () => {
      const name = document.getElementById('childFirstName').value.trim();
      const age = document.getElementById('childAge').value.trim();
      const lastSeen = document.getElementById('childLastSeen').value.trim();
      const clothing = document.getElementById('childClothing').value.trim();

      if (!name || !clothing) {
        Notify.error('Veuillez remplir le prénom et la description vestimentaire.');
        return;
      }

      const alertMsg = `🚨 ALERTE ENFANT PERDU : ${name} (${age || 'âge non précisé'}). Vêtements : ${clothing}. Dernier lieu vu : ${lastSeen || 'Non précisé'}. Ouvrez l'œil et signalez immédiatement à la direction !`;

      // Enregistrer dans les incidents
      const newInc = {
        id: 'inc-' + Date.now(),
        title: `🚨 ENFANT RECHERCHÉ : ${name} (${age})`,
        description: `Vêtements : ${clothing}. Lieu : ${lastSeen}`,
        severity: 'critique',
        status: 'ouvert',
        location: lastSeen || 'Site général',
        reporter_name: Auth.getCurrentUser()?.full_name || 'Accueil Sécurité',
        created_at: new Date().toISOString()
      };
      SecurityModule.incidents.unshift(newInc);
      localStorage.setItem('kermesse_incidents_data', JSON.stringify(SecurityModule.incidents));

      // Envoyer un message broadcast dans kermesse_messages si disponible
      const client = SupabaseClient.client;
      if (client) {
        try {
          await client.from('kermesse_messages').insert([{
            channel: 'direction',
            message: alertMsg,
            sender_id: Auth.getCurrentUser()?.id,
            sender_name: 'SÉCURITÉ URGENCE'
          }]);
        } catch (e) {}
      }

      Notify.error(`Alerte diffusée : ${alertMsg}`);
      close();
      SecurityModule.updateStats();
      SecurityModule.switchTab('incidents');
    };
  },

  // MODAL CRÉATION INCIDENT
  openCreateIncidentModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Déclarer un Incident de Sécurité / Fonctionnement</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createIncForm">
            <div class="form-group">
              <label>Intitulé de l'incident *</label>
              <input type="text" id="incTitle" class="form-control" required placeholder="Ex: Chute enfant sans gravité, rupture de stock gobelets, litige jetons...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Lieu / Zone / Stand *</label>
                <input type="text" id="incLocation" class="form-control" required placeholder="Ex: Stand 4, Zone Restauration, Entrée...">
              </div>
              <div class="form-group">
                <label>Niveau de Gravité *</label>
                <select id="incSeverity" class="form-control" required>
                  <option value="faible">Faible (Information, matériel)</option>
                  <option value="moyenne" selected>Moyenne (Besoin d'intervention)</option>
                  <option value="critique">Critique (Urgence médicale / Sécurité)</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>Description des faits &amp; mesures prises</label>
              <textarea id="incDesc" class="form-control" rows="3" placeholder="Circonstances, personnes impliquées, soins apportés..."></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveIncBtn">Enregistrer l'incident</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveIncBtn').onclick = async () => {
      const title = document.getElementById('incTitle').value.trim();
      const location = document.getElementById('incLocation').value.trim();
      const severity = document.getElementById('incSeverity').value;
      const desc = document.getElementById('incDesc').value.trim();

      if (!title || !location) {
        Notify.error('Veuillez remplir les champs obligatoires.');
        return;
      }

      const newInc = {
        id: 'inc-' + Date.now(),
        title,
        location,
        severity,
        description: desc,
        status: 'ouvert',
        reporter_name: Auth.getCurrentUser()?.full_name || 'Admin Sécurité',
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('incidents').insert([{
            title: newInc.title,
            location: newInc.location,
            severity: newInc.severity,
            description: newInc.description,
            status: newInc.status,
            reporter_name: newInc.reporter_name
          }]).select();
          if (data && data[0]) newInc.id = data[0].id;
        } catch (e) {}
      }

      SecurityModule.incidents.unshift(newInc);
      localStorage.setItem('kermesse_incidents_data', JSON.stringify(SecurityModule.incidents));
      Notify.success('Incident enregistré dans le registre officiel.');
      close();
      SecurityModule.updateStats();
      SecurityModule.renderCurrentTab();
    };
  },

  // MODAL RONDE NETTOYAGE
  openCreateCleaningModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Passage Nettoyage / Sanitaires</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createCleanForm">
            <div class="form-group">
              <label>Zone vérifiée *</label>
              <select id="clnZone" class="form-control" required>
                <option value="Bloc Sanitaires Principaux">Bloc Sanitaires Principaux</option>
                <option value="Zone 4 : Restauration & Buvette">Zone 4 : Restauration & Buvette (Poubelles tri)</option>
                <option value="Zone 1 : Entrée & Sortie">Zone 1 : Entrée & Sortie</option>
                <option value="Zone 5 : Allée des Jeux">Zone 5 : Allée des Jeux</option>
                <option value="Zone 7 : Espace Repos">Zone 7 : Espace Repos Familles</option>
              </select>
            </div>
            <div class="form-group">
              <label>Agent / Responsable du contrôle *</label>
              <input type="text" id="clnChecker" class="form-control" required value="${Auth.getCurrentUser()?.full_name || 'Équipe Propreté'}">
            </div>
            <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
              <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="clnTrash" checked> Poubelles vidées et sacs neufs installés
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="clnToilets" checked> Sol nettoyé / Sanitaires désinfectés
              </label>
              <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="clnSoap" checked> Papier toilette &amp; Savon réapprovisionnés
              </label>
            </div>
            <div class="form-group">
              <label>Remarques éventuelles</label>
              <input type="text" id="clnNotes" class="form-control" placeholder="Rien à signaler, bon état...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveCleanBtn">Valider le passage</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveCleanBtn').onclick = async () => {
      const zone = document.getElementById('clnZone').value;
      const checker = document.getElementById('clnChecker').value.trim();
      const trash = document.getElementById('clnTrash').checked;
      const toilets = document.getElementById('clnToilets').checked;
      const soap = document.getElementById('clnSoap').checked;
      const notes = document.getElementById('clnNotes').value.trim();

      const newRound = {
        id: 'cln-' + Date.now(),
        zone_name: zone,
        checker_name: checker,
        trash_emptied: trash,
        toilets_clean: toilets,
        soap_paper_ok: soap,
        notes: notes || null,
        checked_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('cleaning_rounds').insert([newRound]).select();
          if (data && data[0]) newRound.id = data[0].id;
        } catch (e) {}
      }

      SecurityModule.cleaningRounds.unshift(newRound);
      localStorage.setItem('kermesse_cleaning_rounds', JSON.stringify(SecurityModule.cleaningRounds));
      Notify.success('Passage propreté validé.');
      close();
      SecurityModule.updateStats();
      SecurityModule.renderCurrentTab();
    };
  },

  // MODAL OBJET TROUVÉ
  openCreateLostItemModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Objet Trouvé</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createLostForm">
            <div class="form-group">
              <label>Description de l'objet *</label>
              <input type="text" id="lostName" class="form-control" required placeholder="Ex: Trousseau de clés, doudou lapin marron, veste rouge...">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Lieu où il a été trouvé</label>
                <input type="text" id="lostLoc" class="form-control" placeholder="Ex: Devant stand 3, pelouse...">
              </div>
              <div class="form-group">
                <label>Trouvé par (nom ou bénévole)</label>
                <input type="text" id="lostFinder" class="form-control" placeholder="Ex: Fatou D., un visiteur...">
              </div>
            </div>
            <div class="form-group">
              <label>Détails complémentaires (marque, couleur, poche...)</label>
              <textarea id="lostDesc" class="form-control" rows="2"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveLostBtn">Enregistrer l'objet</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveLostBtn').onclick = async () => {
      const name = document.getElementById('lostName').value.trim();
      const loc = document.getElementById('lostLoc').value.trim();
      const finder = document.getElementById('lostFinder').value.trim();
      const desc = document.getElementById('lostDesc').value.trim();

      if (!name) {
        Notify.error('La description de l\'objet est obligatoire.');
        return;
      }

      const newItem = {
        id: 'lost-' + Date.now(),
        item_name: name,
        location_found: loc || null,
        found_by: finder || null,
        description: desc || null,
        status: 'en_attente',
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('lost_and_found').insert([newItem]).select();
          if (data && data[0]) newItem.id = data[0].id;
        } catch (e) {}
      }

      SecurityModule.lostItems.unshift(newItem);
      localStorage.setItem('kermesse_lost_found', JSON.stringify(SecurityModule.lostItems));
      Notify.success('Objet trouvé enregistré au stand Accueil.');
      close();
      SecurityModule.updateStats();
      SecurityModule.renderCurrentTab();
    };
  },

  returnLostItem(id) {
    const ownerName = prompt('Nom et prénom de la personne à qui l\'objet est restitué :');
    if (!ownerName) return;

    const item = this.lostItems.find(l => l.id === id);
    if (!item) return;

    item.status = 'restitue';
    item.returned_to = ownerName;
    item.returned_at = new Date().toISOString();

    const client = SupabaseClient.client;
    if (client && !id.startsWith('lost-')) {
      client.from('lost_and_found').update({
        status: 'restitue',
        returned_to: ownerName,
        returned_at: item.returned_at
      }).eq('id', id).then();
    }

    localStorage.setItem('kermesse_lost_found', JSON.stringify(this.lostItems));
    Notify.success(`Objet restitué à ${ownerName}.`);
    this.updateStats();
    this.renderCurrentTab();
  }
};

window.SecurityModule = SecurityModule;
