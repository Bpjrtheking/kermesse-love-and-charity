/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 7 : BÉNÉVOLES & PLANNING
 * 
 * Responsable : admin_benevoles
 * Missions :
 * - Fiches bénévoles complètes & coordonnées (téléphone, WhatsApp direct)
 * - Affectation par groupes & en masse (sélection multiple de 10, 20, 50 bénévoles d'un coup)
 * - Affectation précise par PÔLE (Restauration, Sécurité, Stands, Caisses, Logistique, Déco...)
 * - Planning opérationnel regroupé par pôle avec compteurs de déploiement
 * - Moteur anti-conflits d'affectation
 * - Pointage des présences (Planifié, Présent, Retard, Absent)
 */

const MembersModule = {
  currentTab: 'list', // 'list', 'planning', 'conflicts'
  planningPoleFilter: 'all', // 'all' ou code du pôle
  selectedMemberIds: new Set(),

  members: [],
  teams: [],
  stands: [],
  schedules: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>👥</span> Pôle 7 : Bénévoles &amp; Planning Opérationnel
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="MembersModule.openCreateScheduleModal()">
              <span>📅</span> Affecter un Créneau
            </button>
            <button class="btn btn-primary btn-sm" onclick="MembersModule.openCreateModal()">
              <span>➕</span> Nouveau Bénévole
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="volunteerStatsGrid">
            <div class="stat-card">
              <div class="stat-label">Total Bénévoles</div>
              <div class="stat-value" id="volTotalCount">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Créneaux Planifiés</div>
              <div class="stat-value" id="volShiftsCount" style="color: var(--primary);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Présents sur le terrain</div>
              <div class="stat-value" id="volPresentCount" style="color: var(--success, #10b981);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Conflits d'Affectation</div>
              <div class="stat-value" id="volConflictsCount" style="color: var(--danger, #ef4444); font-weight: 800;">0</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabVolList" onclick="MembersModule.switchTab('list')">
              👥 Bénévoles &amp; Affectation en Masse
            </button>
            <button class="tab-btn" id="tabVolPlanning" onclick="MembersModule.switchTab('planning')">
              📅 Planning par Pôles &amp; Postes
            </button>
            <button class="tab-btn" id="tabVolConflicts" onclick="MembersModule.switchTab('conflicts')">
              ⚠️ Vérificateur Anti-Conflits
            </button>
          </div>

          <!-- Dynamic Tab Content -->
          <div id="membersTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement des bénévoles et du planning...</div>
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
      tab === 'list' ? 'tabVolList' : (tab === 'planning' ? 'tabVolPlanning' : 'tabVolConflicts')
    );
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        const { data: mData } = await client
          .from('members')
          .select('*, teams(id, name, color_hex), stands(id, name, number)')
          .order('last_name', { ascending: true });
        if (mData) this.members = mData;

        const { data: tData } = await client.from('teams').select('id, name');
        if (tData) this.teams = tData;

        const { data: sData } = await client.from('stands').select('id, name, number, color_name');
        if (sData) this.stands = sData;

        const { data: scData } = await client.from('volunteer_schedules').select('*').order('start_time');
        if (scData) this.schedules = scData;
      }
    } catch (e) {
      console.warn('[MembersModule] Supabase error:', e);
    }

    // LocalStorage Fallbacks
    if (!this.members || this.members.length === 0) {
      const storedM = localStorage.getItem('kermesse_members_data');
      if (storedM) {
        try { this.members = JSON.parse(storedM); } catch (e) {}
      } else {
        this.members = [
          { id: 'mem-1', first_name: 'Mounir', last_name: 'SuperAdmin', phone: '+221 77 100 00 01', primary_role: 'Coordination Générale', is_active: true },
          { id: 'mem-2', first_name: 'David', last_name: 'Ly', phone: '+221 77 200 00 02', primary_role: 'Responsable Décoration', is_active: true },
          { id: 'mem-3', first_name: 'Sarah', last_name: 'Mendy', phone: '+221 77 300 00 03', primary_role: 'Responsable Communication', is_active: true },
          { id: 'mem-4', first_name: 'Mamadou', last_name: 'Sy', phone: '+221 77 400 00 04', primary_role: 'Caissier Billetterie', is_active: true },
          { id: 'mem-5', first_name: 'Fatou', last_name: 'Diop', phone: '+221 77 500 00 05', primary_role: 'Animatrice Stand', is_active: true }
        ];
        localStorage.setItem('kermesse_members_data', JSON.stringify(this.members));
      }
    }

    if (!this.schedules || this.schedules.length === 0) {
      const storedSc = localStorage.getItem('kermesse_volunteer_schedules');
      if (storedSc) {
        try { this.schedules = JSON.parse(storedSc); } catch (e) {}
      } else {
        this.schedules = [
          { id: 'sch-1', member_id: 'mem-4', member_name: 'Mamadou Sy', member_phone: '+221 77 400 00 04', location_or_stand: 'Zone 3 : Billetterie Centrale', pole_name: 'Billetterie & Caisses', shift_date: '2026-09-20', start_time: '10:00', end_time: '13:00', role_title: 'Caissier billetterie', status: 'present' },
          { id: 'sch-2', member_id: 'mem-5', member_name: 'Fatou Diop', member_phone: '+221 77 500 00 05', location_or_stand: 'Stand 1 : Pêche aux canards', pole_name: 'Stands & Jeux', shift_date: '2026-09-20', start_time: '10:00', end_time: '14:00', role_title: 'Arbitre & animateur', status: 'present' }
        ];
        localStorage.setItem('kermesse_volunteer_schedules', JSON.stringify(this.schedules));
      }
    }

    this.updateStats();
    this.renderCurrentTab();
  },

  // MOTEUR DE DÉTECTION DES CONFLITS D'HORAIRE
  detectConflicts() {
    const conflicts = [];
    const grouped = {};

    this.schedules.forEach(s => {
      const key = `${s.member_id || s.member_name}_${s.shift_date}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    });

    Object.keys(grouped).forEach(key => {
      const shifts = grouped[key];
      if (shifts.length > 1) {
        for (let i = 0; i < shifts.length; i++) {
          for (let j = i + 1; j < shifts.length; j++) {
            const s1 = shifts[i];
            const s2 = shifts[j];
            if (s1.start_time < s2.end_time && s2.start_time < s1.end_time) {
              conflicts.push({
                member_name: s1.member_name,
                shift1: s1,
                shift2: s2,
                date: s1.shift_date
              });
            }
          }
        }
      }
    });

    return conflicts;
  },

  updateStats() {
    const conflicts = this.detectConflicts();
    const totalVols = this.members.length;
    const totalShifts = this.schedules.length;
    const presentCount = this.schedules.filter(s => s.status === 'present').length;

    const elV = document.getElementById('volTotalCount');
    const elS = document.getElementById('volShiftsCount');
    const elP = document.getElementById('volPresentCount');
    const elC = document.getElementById('volConflictsCount');

    if (elV) elV.textContent = totalVols;
    if (elS) elS.textContent = totalShifts;
    if (elP) elP.textContent = presentCount;
    if (elC) {
      elC.textContent = conflicts.length;
      elC.style.color = conflicts.length > 0 ? '#ef4444' : '#10b981';
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('membersTabContent');
    if (!container) return;

    if (this.currentTab === 'list') {
      this.renderListTab(container);
    } else if (this.currentTab === 'planning') {
      this.renderPlanningTab(container);
    } else if (this.currentTab === 'conflicts') {
      this.renderConflictsTab(container);
    }
  },

  // 1. ONGLET BÉNÉVOLES & AFFECTATION EN MASSE
  renderListTab(container) {
    const selectedCount = this.selectedMemberIds.size;

    container.innerHTML = `
      <!-- BANDEAU D'AFFECTATION EN MASSE FLOTTANT / VISIBLE -->
      <div id="bulkActionBar" style="display: ${selectedCount > 0 ? 'flex' : 'none'}; background: #eff6ff; border: 2px solid #3b82f6; border-radius: var(--radius-md); padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <span style="font-size: 1.25rem;">⚡</span>
          <div>
            <strong style="color: #1d4ed8; font-size: 1rem;"><span id="bulkSelectedCount">${selectedCount}</span> bénévole(s) sélectionné(s)</strong>
            <div style="font-size: 0.8rem; color: #3b82f6;">Vous pouvez affecter ce groupe entier en un seul clic à un pôle (Restauration, Sécurité, Stands, etc.).</div>
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="MembersModule.clearSelection()">
            ✕ Désélectionner tout
          </button>
          <button class="btn btn-primary btn-sm" onclick="MembersModule.openBulkScheduleModal()">
            🚀 Affecter le groupe en masse
          </button>
        </div>
      </div>

      <!-- BOUTONS D'AIDE À LA SÉLECTION RAPIDE POUR GRANDS VOLUMES (10, 20, 50) -->
      <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1rem; background: var(--gray-50); padding: 0.65rem 1rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
        <span style="font-size: 0.85rem; font-weight: 700; color: var(--gray-700);">Sélection rapide :</span>
        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.78rem;" onclick="MembersModule.selectQuickCount(10)">
          +10 Bénévoles
        </button>
        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.78rem;" onclick="MembersModule.selectQuickCount(15)">
          +15 Bénévoles
        </button>
        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.78rem;" onclick="MembersModule.selectQuickCount(20)">
          +20 Bénévoles
        </button>
        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.78rem;" onclick="MembersModule.selectQuickCount(50)">
          +50 Bénévoles
        </button>
        <button class="btn btn-secondary btn-sm" style="padding: 2px 8px; font-size: 0.78rem;" onclick="MembersModule.selectAllMembers()">
          Tout sélectionner (${this.members.length})
        </button>
      </div>

      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box">
          <input type="text" id="memberSearch" class="form-control" placeholder="Rechercher par nom, rôle ou téléphone..." oninput="MembersModule.filterMembers()">
        </div>
      </div>

      <div class="table-responsive" id="membersTableContainer">
        ${this.generateMembersTable(this.members)}
      </div>
    `;
  },

  generateMembersTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <div class="empty-title">Aucun bénévole enregistré</div>
          <div class="empty-desc">Enregistrez les bénévoles pour leur assigner des créneaux et des pôles de mission.</div>
          <button class="btn btn-primary" onclick="MembersModule.openCreateModal()">
            <span>➕</span> Ajouter le premier bénévole
          </button>
        </div>
      `;
    }

    const allSelected = list.length > 0 && list.every(m => this.selectedMemberIds.has(m.id));

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">
              <input type="checkbox" id="selectAllCheckbox" ${allSelected ? 'checked' : ''} onchange="MembersModule.toggleSelectAll(this.checked)" title="Tout sélectionner / Tout désélectionner">
            </th>
            <th>Bénévole</th>
            <th>Téléphone &amp; WhatsApp</th>
            <th>Rôle Principal</th>
            <th>Affectation(s) Planifiée(s)</th>
            <th>Statut</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="membersTableBody">
          ${list.map(m => {
            const assignedShifts = this.schedules.filter(s => s.member_id === m.id || s.member_name === `${m.first_name} ${m.last_name}`);
            const cleanPhone = (m.phone || '').replace(/[^0-9+]/g, '');
            const isChecked = this.selectedMemberIds.has(m.id);

            return `
              <tr style="${isChecked ? 'background-color: #f0f7ff;' : ''}">
                <td style="text-align: center;">
                  <input type="checkbox" class="member-checkbox" value="${m.id}" ${isChecked ? 'checked' : ''} onchange="MembersModule.toggleMemberSelection('${m.id}', this.checked)">
                </td>
                <td>
                  <strong>${(m.last_name || '').toUpperCase()}</strong> ${m.first_name || ''}
                  ${m.notes ? `<div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">💡 ${m.notes}</div>` : ''}
                </td>
                <td>
                  ${m.phone ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span>${m.phone}</span>
                      <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="badge badge-success" style="text-decoration: none;" title="Ouvrir WhatsApp direct">
                        💬 WhatsApp
                      </a>
                    </div>
                  ` : '<span style="color: var(--gray-400);">Non renseigné</span>'}
                </td>
                <td><span class="badge badge-primary">${m.primary_role || 'Bénévole'}</span></td>
                <td>
                  ${assignedShifts.length > 0 ? `
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                      ${assignedShifts.map(s => `
                        <span class="badge badge-gray" style="font-size: 0.75rem; text-align: left;">
                          📍 <strong>${s.pole_name || 'Poste'}</strong> : ${s.location_or_stand} (${s.start_time}-${s.end_time})
                        </span>
                      `).join('')}
                    </div>
                  ` : '<span class="badge badge-warning" style="font-size: 0.75rem;">Aucun créneau affecté</span>'}
                </td>
                <td>
                  ${m.is_active !== false ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-gray">Inactif</span>'}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="MembersModule.openScheduleForMember('${m.id}', '${m.first_name} ${m.last_name}', '${m.phone || ''}')" title="Affecter un créneau individuel">
                    📅 Créneau
                  </button>
                  <button class="btn-icon danger" onclick="MembersModule.deleteMember('${m.id}', '${m.first_name} ${m.last_name}')" title="Supprimer">
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

  toggleMemberSelection(id, isChecked) {
    if (isChecked) {
      this.selectedMemberIds.add(id);
    } else {
      this.selectedMemberIds.delete(id);
    }
    this.updateBulkActionBar();
  },

  toggleSelectAll(isChecked) {
    if (isChecked) {
      this.members.forEach(m => this.selectedMemberIds.add(m.id));
    } else {
      this.selectedMemberIds.clear();
    }
    this.renderCurrentTab();
  },

  selectQuickCount(count) {
    this.selectedMemberIds.clear();
    const slice = this.members.slice(0, count);
    slice.forEach(m => this.selectedMemberIds.add(m.id));
    Notify.info(`${slice.length} premier(s) bénévole(s) sélectionné(s).`);
    this.renderCurrentTab();
  },

  selectAllMembers() {
    this.selectedMemberIds.clear();
    this.members.forEach(m => this.selectedMemberIds.add(m.id));
    Notify.info(`Tous les ${this.members.length} bénévoles ont été sélectionnés.`);
    this.renderCurrentTab();
  },

  clearSelection() {
    this.selectedMemberIds.clear();
    this.renderCurrentTab();
  },

  updateBulkActionBar() {
    const bar = document.getElementById('bulkActionBar');
    const countEl = document.getElementById('bulkSelectedCount');
    const count = this.selectedMemberIds.size;

    if (bar && countEl) {
      countEl.textContent = count;
      bar.style.display = count > 0 ? 'flex' : 'none';
    }
  },

  filterMembers() {
    const q = (document.getElementById('memberSearch')?.value || '').toLowerCase();
    const filtered = this.members.filter(m => {
      const fullName = `${m.first_name} ${m.last_name}`.toLowerCase();
      const role = (m.primary_role || '').toLowerCase();
      const phone = (m.phone || '').toLowerCase();
      return fullName.includes(q) || role.includes(q) || phone.includes(q);
    });

    const container = document.getElementById('membersTableContainer');
    if (container) container.innerHTML = this.generateMembersTable(filtered);
  },

  // MODALE D'AFFECTATION EN MASSE (BULK ASSIGNMENT)
  openBulkScheduleModal() {
    const selectedIds = Array.from(this.selectedMemberIds);
    if (selectedIds.length === 0) {
      Notify.warning('Veuillez sélectionner au moins un bénévole à affecter.');
      return;
    }

    const selectedMembers = this.members.filter(m => selectedIds.includes(m.id));

    const poles = [
      { code: 'Restauration & Buvette', label: '🍔 Pôle 4 : Restauration & Buvette (Cuisine, snacks, bar)' },
      { code: 'Accueil & Sécurité', label: '🛡️ Pôle 9 : Accueil, Nettoyage & Sécurité (Filtrage, entrées, rondes)' },
      { code: 'Stands & Jeux', label: '🎪 Pôle 5 : Stands & Jeux (Surveillance manèges, arbitres, animateurs)' },
      { code: 'Billetterie & Caisses', label: '💵 Pôle 2 : Billetterie & Caisses (Vente tickets, caisses stands)' },
      { code: 'Décoration & Organisation', label: '🎨 Pôle 3 : Décoration & Organisation (Aménagement zones, guidage)' },
      { code: 'Logistique & Matériel', label: '📦 Pôle 8 : Logistique & Installation (Manutention, portage, tentes)' },
      { code: 'Communication', label: '📢 Pôle 1 : Communication & Signalétique' },
      { code: 'Lots & Cadeaux', label: '🎁 Pôle 6 : Lots & Cadeaux (Comptoir gros lots)' }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>⚡ Affectation en Masse de ${selectedMembers.length} Bénévole(s)</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <!-- Aperçu des bénévoles sélectionnés -->
          <div style="background: #eff6ff; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid #bfdbfe; margin-bottom: 1rem;">
            <div style="font-weight: 700; color: #1e40af; font-size: 0.85rem; margin-bottom: 0.35rem;">
              👥 Bénévoles concernés (${selectedMembers.length}) :
            </div>
            <div style="max-height: 90px; overflow-y: auto; display: flex; flex-wrap: wrap; gap: 0.3rem;">
              ${selectedMembers.map(m => `
                <span class="badge badge-primary" style="font-size: 0.75rem;">
                  ${m.first_name} ${m.last_name}
                </span>
              `).join('')}
            </div>
          </div>

          <form id="bulkScheduleForm">
            <div class="form-group">
              <label>Pôle d'Affectation Kermesse *</label>
              <select id="bulkPole" class="form-control" required onchange="MembersModule.onBulkPoleChange()">
                ${poles.map(p => `<option value="${p.code}">${p.label}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Poste ou Stand Précis *</label>
                <input type="text" id="bulkLocation" class="form-control" required placeholder="Ex: Stand 1 Pêche aux canards, Entrée principale, Cuisine centrale...">
                <div id="bulkStandSuggestions" style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;"></div>
              </div>
              <div class="form-group">
                <label>Mission / Rôle sur le terrain *</label>
                <input type="text" id="bulkRole" class="form-control" required value="Surveillance et animation" placeholder="Ex: Surveillance des jeux, Service snack...">
              </div>
            </div>

            <div class="form-group">
              <label>Raccourcis Horaires</label>
              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                <button type="button" class="btn btn-secondary btn-sm" onclick="MembersModule.setBulkTimePreset('09:00', '13:00')">
                  ☀️ Matin (09h - 13h)
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="MembersModule.setBulkTimePreset('13:00', '18:00')">
                  ⛅ Après-midi (13h - 18h)
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="MembersModule.setBulkTimePreset('09:00', '18:00')">
                  🌟 Journée Entière (09h - 18h)
                </button>
                <button type="button" class="btn btn-secondary btn-sm" onclick="MembersModule.setBulkTimePreset('18:00', '21:00')">
                  🌙 Soirée / Démontage (18h - 21h)
                </button>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Date *</label>
                <input type="date" id="bulkDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}">
              </div>
              <div class="form-group">
                <label>Heure Début *</label>
                <input type="time" id="bulkStart" class="form-control" required value="10:00">
              </div>
              <div class="form-group">
                <label>Heure Fin *</label>
                <input type="time" id="bulkEnd" class="form-control" required value="14:00">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmBulkScheduleBtn">
            🚀 Valider l'affectation des ${selectedMembers.length} bénévoles
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    // Remplir les suggestions au départ
    setTimeout(() => MembersModule.onBulkPoleChange(), 50);

    modal.querySelector('#confirmBulkScheduleBtn').onclick = async () => {
      const pole = document.getElementById('bulkPole').value;
      const location = document.getElementById('bulkLocation').value.trim();
      const role = document.getElementById('bulkRole').value.trim();
      const date = document.getElementById('bulkDate').value;
      const start = document.getElementById('bulkStart').value;
      const end = document.getElementById('bulkEnd').value;

      if (!location || !role || !date || !start || !end) {
        Notify.error('Veuillez renseigner tous les champs obligatoires.');
        return;
      }

      if (start >= end) {
        Notify.error('L\'heure de fin doit être postérieure à l\'heure de début.');
        return;
      }

      const client = SupabaseClient.client;
      let insertedCount = 0;
      let conflictsDetected = 0;
      const newSchedules = [];

      for (const m of selectedMembers) {
        // Vérification de conflit
        const hasConflict = MembersModule.schedules.some(s => {
          return (s.member_id === m.id || s.member_name === `${m.first_name} ${m.last_name}`) &&
                 s.shift_date === date &&
                 (start < s.end_time && end > s.start_time);
        });

        if (hasConflict) conflictsDetected++;

        const sched = {
          id: 'sch-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          member_id: m.id,
          member_name: `${m.first_name} ${m.last_name}`,
          member_phone: m.phone || null,
          location_or_stand: location,
          pole_name: pole,
          shift_date: date,
          start_time: start,
          end_time: end,
          role_title: role,
          status: 'planifie',
          created_at: new Date().toISOString()
        };

        newSchedules.push(sched);
        insertedCount++;
      }

      if (client) {
        try {
          const insertPayloads = newSchedules.map(s => ({
            member_id: s.member_id,
            member_name: s.member_name,
            member_phone: s.member_phone,
            location_or_stand: s.location_or_stand,
            pole_name: s.pole_name,
            shift_date: s.shift_date,
            start_time: s.start_time,
            end_time: s.end_time,
            role_title: s.role_title,
            status: s.status
          }));
          await client.from('volunteer_schedules').insert(insertPayloads);
        } catch (e) {
          console.warn('[Bulk Schedule Supabase Warning]', e);
        }
      }

      MembersModule.schedules.push(...newSchedules);
      localStorage.setItem('kermesse_volunteer_schedules', JSON.stringify(MembersModule.schedules));

      AuditLogger.log(
        'AFFECTATION_GROUPE_PLANNING',
        'volunteer_schedule',
        null,
        `Affectation en masse de ${insertedCount} bénévoles au Pôle ${pole} (${location}) de ${start} à ${end}`
      );

      if (conflictsDetected > 0) {
        Notify.warning(`${insertedCount} bénévoles affectés, mais ${conflictsDetected} conflit(s) d'horaires détecté(s).`);
      } else {
        Notify.success(`🎉 ${insertedCount} bénévoles affectés avec succès au Pôle "${pole}" !`);
      }

      MembersModule.selectedMemberIds.clear();
      close();
      MembersModule.updateStats();
      MembersModule.switchTab('planning');
    };
  },

  onBulkPoleChange() {
    const pole = document.getElementById('bulkPole')?.value;
    const locInput = document.getElementById('bulkLocation');
    const roleInput = document.getElementById('bulkRole');
    const suggContainer = document.getElementById('bulkStandSuggestions');
    if (!locInput || !roleInput || !suggContainer) return;

    suggContainer.innerHTML = '';

    if (pole === 'Stands & Jeux') {
      roleInput.value = 'Surveillance des manèges & animation de jeu';
      if (this.stands.length > 0) {
        locInput.value = `Stand ${this.stands[0].number} : ${this.stands[0].name}`;
        suggContainer.innerHTML = this.stands.slice(0, 4).map(s => `
          <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Stand ${s.number} : ${s.name}'">
            🎪 Stand ${s.number}
          </button>
        `).join('');
      } else {
        locInput.value = 'Espace Stands & Jeux Kermesse';
      }
    } else if (pole === 'Restauration & Buvette') {
      locInput.value = 'Zone Restauration & Buvette Centrale';
      roleInput.value = 'Cuisine, préparation sandwichs et service';
      suggContainer.innerHTML = `
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Cuisine & Préparation denrées'">🍔 Cuisine</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Comptoir Vente Snacks & Crêpes'">🥞 Snack/Crêpes</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Comptoir Boissons & Bar'">🥤 Buvette</button>
      `;
    } else if (pole === 'Accueil & Sécurité') {
      locInput.value = 'Entrée Principale (Contrôle et Filtrage)';
      roleInput.value = 'Accueil des familles, sécurité & orientation';
      suggContainer.innerHTML = `
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Entrée Principale (Filtrage)'">🚪 Entrée</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Sortie Visiteurs & Flux'">🚶 Sortie</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Rondes de Surveillance & Sécurité'">🛡️ Rondes</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Rondes Sanitaires & Propreté'">🧹 Nettoyage</button>
      `;
    } else if (pole === 'Billetterie & Caisses') {
      locInput.value = 'Zone 3 : Billetterie Centrale (Caisse)';
      roleInput.value = 'Vente des tickets de jeux et encaissement';
      suggContainer.innerHTML = `
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Caisse Centrale 1'">💵 Caisse 1</button>
        <button type="button" class="badge badge-gray" style="cursor: pointer; border: none;" onclick="document.getElementById('bulkLocation').value='Caisse Centrale 2'">💵 Caisse 2</button>
      `;
    } else if (pole === 'Logistique & Matériel') {
      locInput.value = 'Espace Stockage Central & Manutention';
      roleInput.value = 'Montage barnums, portage matériel & ravitaillement';
    } else if (pole === 'Décoration & Organisation') {
      locInput.value = 'Zones Festives & Allées Kermesse';
      roleInput.value = 'Installation décorations, fléchage & guidage';
    }
  },

  setBulkTimePreset(start, end) {
    const sInput = document.getElementById('bulkStart');
    const eInput = document.getElementById('bulkEnd');
    if (sInput && eInput) {
      sInput.value = start;
      eInput.value = end;
    }
  },

  // 2. ONGLET PLANNING PAR PÔLES & POSTES (OPÉRATIONNEL)
  renderPlanningTab(container) {
    const polesCounts = {};
    this.schedules.forEach(s => {
      const p = s.pole_name || 'Autre';
      polesCounts[p] = (polesCounts[p] || 0) + 1;
    });

    const activeFilter = this.planningPoleFilter;
    const filteredList = activeFilter === 'all' 
      ? this.schedules 
      : this.schedules.filter(s => (s.pole_name || 'Autre') === activeFilter);

    container.innerHTML = `
      <!-- RÉCAPITULATIF OPÉRATIONNEL PAR PÔLE (COMBIEN SONT OÙ) -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.65rem; color: var(--gray-800);">
          📊 Répartition des Bénévoles sur le Terrain par Pôle :
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.65rem;">
          <div class="stat-card" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${activeFilter === 'all' ? 'var(--primary)' : 'var(--gray-200)'};" onclick="MembersModule.filterPlanningByPole('all')">
            <div style="font-size: 0.8rem; color: var(--gray-600);">🌐 Tous les Pôles</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--primary);">${this.schedules.length} planifié(s)</div>
          </div>
          <div class="stat-card" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${activeFilter === 'Restauration & Buvette' ? '#f97316' : 'var(--gray-200)'};" onclick="MembersModule.filterPlanningByPole('Restauration & Buvette')">
            <div style="font-size: 0.8rem; color: var(--gray-600);">🍔 Restauration</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #f97316;">${polesCounts['Restauration & Buvette'] || 0} bénévole(s)</div>
          </div>
          <div class="stat-card" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${activeFilter === 'Accueil & Sécurité' ? '#10b981' : 'var(--gray-200)'};" onclick="MembersModule.filterPlanningByPole('Accueil & Sécurité')">
            <div style="font-size: 0.8rem; color: var(--gray-600);">🛡️ Sécurité &amp; Accueil</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #10b981;">${polesCounts['Accueil & Sécurité'] || 0} bénévole(s)</div>
          </div>
          <div class="stat-card" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${activeFilter === 'Stands & Jeux' ? '#8b5cf6' : 'var(--gray-200)'};" onclick="MembersModule.filterPlanningByPole('Stands & Jeux')">
            <div style="font-size: 0.8rem; color: var(--gray-600);">🎪 Stands &amp; Jeux</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #8b5cf6;">${polesCounts['Stands & Jeux'] || 0} bénévole(s)</div>
          </div>
          <div class="stat-card" style="padding: 0.75rem; cursor: pointer; border: 2px solid ${activeFilter === 'Billetterie & Caisses' ? '#2563eb' : 'var(--gray-200)'};" onclick="MembersModule.filterPlanningByPole('Billetterie & Caisses')">
            <div style="font-size: 0.8rem; color: var(--gray-600);">💵 Billetterie &amp; Caisses</div>
            <div style="font-size: 1.35rem; font-weight: 800; color: #2563eb;">${polesCounts['Billetterie & Caisses'] || 0} bénévole(s)</div>
          </div>
        </div>
      </div>

      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box">
          <input type="text" id="schedSearch" class="form-control" placeholder="Rechercher par bénévole, lieu ou stand..." oninput="MembersModule.filterSchedules()">
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button class="btn btn-primary btn-sm" onclick="MembersModule.openCreateScheduleModal()">
            <span>➕</span> Créneau Individuel
          </button>
        </div>
      </div>

      <div class="table-responsive" id="schedulesTableContainer">
        ${this.generateSchedulesTable(filteredList)}
      </div>
    `;
  },

  filterPlanningByPole(poleCode) {
    this.planningPoleFilter = poleCode;
    this.renderCurrentTab();
  },

  generateSchedulesTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">Aucun créneau planifié</div>
          <div class="empty-desc">Sélectionnez vos bénévoles dans le premier onglet pour les affecter en masse à un pôle (Restauration, Sécurité, Stands...).</div>
          <button class="btn btn-primary" onclick="MembersModule.switchTab('list')">
            <span>👥</span> Aller à la sélection des bénévoles
          </button>
        </div>
      `;
    }

    const statusBadges = {
      'planifie': { label: 'Planifié', badge: 'badge-primary' },
      'present': { label: 'Présent ✅', badge: 'badge-success' },
      'retard': { label: 'En retard ⏰', badge: 'badge-warning' },
      'absent': { label: 'Absent ❌', badge: 'badge-danger' }
    };

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Bénévole</th>
            <th>Pôle &amp; Emplacement / Stand</th>
            <th>Mission / Rôle</th>
            <th>Date &amp; Horaires</th>
            <th>Présence Terrain</th>
            <th style="text-align: right;">Pointer Présence</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(s => {
            const st = statusBadges[s.status] || { label: s.status, badge: 'badge-gray' };
            const cleanPhone = (s.member_phone || '').replace(/[^0-9+]/g, '');

            return `
              <tr>
                <td>
                  <strong>${s.member_name}</strong>
                  ${s.member_phone ? `
                    <div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">
                      <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" style="text-decoration: none; color: #16a34a;">
                        💬 ${s.member_phone}
                      </a>
                    </div>
                  ` : ''}
                </td>
                <td>
                  <span class="badge badge-gray" style="font-weight: 700; margin-bottom: 2px;">
                    ${s.pole_name || 'Kermesse'}
                  </span>
                  <div style="font-size: 0.85rem; font-weight: 600; color: var(--gray-900);">
                    📍 ${s.location_or_stand}
                  </div>
                </td>
                <td><span class="badge badge-primary">${s.role_title}</span></td>
                <td>
                  <strong>${s.shift_date}</strong><br>
                  <span class="badge badge-gray" style="font-size: 0.8rem; font-weight: 700;">
                    ⏰ ${s.start_time} - ${s.end_time}
                  </span>
                </td>
                <td><span class="badge ${st.badge}">${st.label}</span></td>
                <td style="text-align: right;">
                  <button class="btn btn-sm btn-secondary" onclick="MembersModule.cyclePresenceStatus('${s.id}')" title="Pointer présence">
                    🔄 Pointer
                  </button>
                </td>
                <td style="text-align: right;">
                  <button class="btn-icon danger" onclick="MembersModule.deleteSchedule('${s.id}')" title="Supprimer">
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

  filterSchedules() {
    const q = (document.getElementById('schedSearch')?.value || '').toLowerCase();
    const filtered = this.schedules.filter(s => {
      return (s.member_name || '').toLowerCase().includes(q) ||
             (s.location_or_stand || '').toLowerCase().includes(q) ||
             (s.pole_name || '').toLowerCase().includes(q) ||
             (s.role_title || '').toLowerCase().includes(q);
    });

    const container = document.getElementById('schedulesTableContainer');
    if (container) container.innerHTML = this.generateSchedulesTable(filtered);
  },

  async cyclePresenceStatus(id) {
    const s = this.schedules.find(item => item.id === id);
    if (!s) return;

    const cycle = {
      'planifie': 'present',
      'present': 'retard',
      'retard': 'absent',
      'absent': 'planifie'
    };

    s.status = cycle[s.status] || 'present';

    const client = SupabaseClient.client;
    if (client && !id.startsWith('sch-')) {
      try {
        await client.from('volunteer_schedules').update({ status: s.status }).eq('id', id);
      } catch (e) {}
    }

    localStorage.setItem('kermesse_volunteer_schedules', JSON.stringify(this.schedules));
    Notify.success(`Pointage de ${s.member_name} mis à jour.`);
    this.updateStats();
    this.renderCurrentTab();
  },

  // 3. ONGLET VÉRIFICATEUR ANTI-CONFLITS
  renderConflictsTab(container) {
    const conflicts = this.detectConflicts();

    container.innerHTML = `
      <div class="alert-banner ${conflicts.length > 0 ? 'danger' : 'success'}" style="margin-bottom: 1.5rem;">
        <div>
          ${conflicts.length > 0 ? `
            ⚠️ <strong>ALERTE CONFLIT D'AFFECTATION :</strong> ${conflicts.length} conflit(s) d'horaires détecté(s). Des personnes sont programmées sur des postes qui se chevauchent dans le temps !
          ` : `
            ✅ <strong>AUCUN CONFLIT D'HORAIRE :</strong> Tous les plannings sont fluides. Aucun bénévole n'est affecté à deux endroits en même temps.
          `}
        </div>
      </div>

      ${conflicts.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-title">Planning Optimisé &amp; Sans Conflit</div>
          <div class="empty-desc">La règle d'or « Une personne à un seul endroit à la fois » est parfaitement respectée sur tous les créneaux.</div>
        </div>
      ` : `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${conflicts.map(c => `
            <div class="card" style="border-left: 6px solid var(--danger, #ef4444);">
              <div class="card-body">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <h4 style="margin: 0; font-size: 1.1rem; color: var(--danger, #ef4444);">
                    🚨 Conflit sur ${c.member_name} (Date : ${c.date})
                  </h4>
                  <span class="badge badge-danger">Double affectation</span>
                </div>
                <div class="conflict-shifts-grid">
                  <div>
                    <strong>Affectation A :</strong><br>
                    📍 ${c.shift1.location_or_stand} (${c.shift1.role_title})<br>
                    ⏰ Horaires : <strong>${c.shift1.start_time} - ${c.shift1.end_time}</strong>
                  </div>
                  <div>
                    <strong>Affectation B (En Conflit) :</strong><br>
                    📍 ${c.shift2.location_or_stand} (${c.shift2.role_title})<br>
                    ⏰ Horaires : <strong>${c.shift2.start_time} - ${c.shift2.end_time}</strong>
                  </div>
                </div>
                <div style="margin-top: 0.75rem; text-align: right;">
                  <button class="btn btn-danger btn-sm" onclick="MembersModule.deleteSchedule('${c.shift2.id}')">
                    🗑️ Supprimer le créneau B en conflit
                  </button>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  // CRÉATION DE CRÉNEAU INDIVIDUEL
  openCreateScheduleModal(defaultMemberId = null, defaultMemberName = null, defaultPhone = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Affecter un Créneau Individuel</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createScheduleForm">
            <div id="conflictAlertBox" style="display: none; margin-bottom: 1rem;" class="alert-banner danger">
              <div id="conflictAlertText"></div>
            </div>

            <div class="form-group">
              <label>Bénévole *</label>
              <select id="schMember" class="form-control" required onchange="MembersModule.verifyFormConflict()">
                <option value="">Sélectionner un bénévole...</option>
                ${this.members.map(m => `
                  <option value="${m.id}" data-name="${m.first_name} ${m.last_name}" data-phone="${m.phone || ''}" ${defaultMemberId === m.id ? 'selected' : ''}>
                    ${m.last_name.toUpperCase()} ${m.first_name} (${m.primary_role})
                  </option>
                `).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Date *</label>
                <input type="date" id="schDate" class="form-control" required value="${new Date().toISOString().split('T')[0]}" onchange="MembersModule.verifyFormConflict()">
              </div>
              <div class="form-group">
                <label>Pôle Kermesse</label>
                <select id="schPole" class="form-control">
                  <option value="Stands & Jeux">Pôle 5 : Stands &amp; Jeux</option>
                  <option value="Billetterie & Caisses">Pôle 2 : Billetterie &amp; Caisses</option>
                  <option value="Restauration & Buvette">Pôle 4 : Restauration &amp; Buvette</option>
                  <option value="Accueil & Sécurité">Pôle 9 : Accueil &amp; Sécurité</option>
                  <option value="Décoration & Organisation">Pôle 3 : Décoration &amp; Organisation</option>
                  <option value="Logistique & Matériel">Pôle 8 : Logistique &amp; Installation</option>
                  <option value="Communication">Pôle 1 : Communication &amp; Affichage</option>
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Heure de Début *</label>
                <input type="time" id="schStartTime" class="form-control" required value="10:00" onchange="MembersModule.verifyFormConflict()">
              </div>
              <div class="form-group">
                <label>Heure de Fin *</label>
                <input type="time" id="schEndTime" class="form-control" required value="14:00" onchange="MembersModule.verifyFormConflict()">
              </div>
            </div>

            <div class="form-group">
              <label>Lieu / Stand Précis *</label>
              <input type="text" id="schLocation" class="form-control" required placeholder="Ex: Stand 3 Tir aux ballons, Caisse 2, Cuisine snack...">
            </div>

            <div class="form-group">
              <label>Rôle ou Mission sur le créneau *</label>
              <input type="text" id="schRole" class="form-control" required placeholder="Ex: Arbitre de jeu, Caissier, Accueil visiteurs, Cuistot...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveScheduleBtn">Confirmer l'affectation</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveScheduleBtn').onclick = async () => {
      const memberSelect = document.getElementById('schMember');
      const memberId = memberSelect.value;
      const memberOpt = memberSelect.options[memberSelect.selectedIndex];
      const memberName = memberOpt ? memberOpt.dataset.name : '';
      const memberPhone = memberOpt ? memberOpt.dataset.phone : '';

      const shiftDate = document.getElementById('schDate').value;
      const startTime = document.getElementById('schStartTime').value;
      const endTime = document.getElementById('schEndTime').value;
      const poleName = document.getElementById('schPole').value;
      const location = document.getElementById('schLocation').value.trim();
      const roleTitle = document.getElementById('schRole').value.trim();

      if (!memberId || !shiftDate || !startTime || !endTime || !location || !roleTitle) {
        Notify.error('Veuillez remplir tous les champs obligatoires (*)');
        return;
      }

      if (startTime >= endTime) {
        Notify.error('L\'heure de fin doit être postérieure à l\'heure de début.');
        return;
      }

      // Vérification stricte anti-conflit
      const conflicts = MembersModule.schedules.filter(s => {
        return (s.member_id === memberId || s.member_name === memberName) &&
               s.shift_date === shiftDate &&
               (startTime < s.end_time && endTime > s.start_time);
      });

      if (conflicts.length > 0) {
        const c = conflicts[0];
        const proceed = confirm(`⚠️ ATTENTION CONFLIT D'AFFECTATION !\n\n${memberName} est DÉJÀ affecté(e) le ${shiftDate} de ${c.start_time} à ${c.end_time} à "${c.location_or_stand}".\n\nSouhaitez-vous forcer cette double affectation malgré le conflit ?`);
        if (!proceed) return;
      }

      const newSchedule = {
        id: 'sch-' + Date.now(),
        member_id: memberId,
        member_name: memberName,
        member_phone: memberPhone || null,
        location_or_stand: location,
        pole_name: poleName,
        shift_date: shiftDate,
        start_time: startTime,
        end_time: endTime,
        role_title: roleTitle,
        status: 'planifie',
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('volunteer_schedules').insert([{
            member_id: newSchedule.member_id,
            member_name: newSchedule.member_name,
            member_phone: newSchedule.member_phone,
            location_or_stand: newSchedule.location_or_stand,
            pole_name: newSchedule.pole_name,
            shift_date: newSchedule.shift_date,
            start_time: newSchedule.start_time,
            end_time: newSchedule.end_time,
            role_title: newSchedule.role_title,
            status: newSchedule.status
          }]).select();
          if (data && data[0]) newSchedule.id = data[0].id;
        } catch (e) {}
      }

      MembersModule.schedules.push(newSchedule);
      localStorage.setItem('kermesse_volunteer_schedules', JSON.stringify(MembersModule.schedules));
      Notify.success(`Créneau affecté à ${memberName} (${startTime} - ${endTime}).`);
      close();
      MembersModule.updateStats();
      MembersModule.renderCurrentTab();
    };

    setTimeout(() => this.verifyFormConflict(), 100);
  },

  verifyFormConflict() {
    const memberSelect = document.getElementById('schMember');
    const alertBox = document.getElementById('conflictAlertBox');
    const alertText = document.getElementById('conflictAlertText');
    if (!memberSelect || !alertBox) return;

    const memberId = memberSelect.value;
    const shiftDate = document.getElementById('schDate')?.value;
    const startTime = document.getElementById('schStartTime')?.value;
    const endTime = document.getElementById('schEndTime')?.value;

    if (!memberId || !shiftDate || !startTime || !endTime) {
      alertBox.style.display = 'none';
      return;
    }

    const memberOpt = memberSelect.options[memberSelect.selectedIndex];
    const memberName = memberOpt ? memberOpt.dataset.name : '';

    const conflicts = this.schedules.filter(s => {
      return (s.member_id === memberId || s.member_name === memberName) &&
             s.shift_date === shiftDate &&
             (startTime < s.end_time && endTime > s.start_time);
    });

    if (conflicts.length > 0) {
      const c = conflicts[0];
      alertText.innerHTML = `⚠️ <strong>Conflit d'affectation détecté :</strong> ${memberName} est déjà planifié(e) de <strong>${c.start_time} à ${c.end_time}</strong> à <em>${c.location_or_stand}</em> !`;
      alertBox.style.display = 'block';
    } else {
      alertBox.style.display = 'none';
    }
  },

  openScheduleForMember(id, name, phone) {
    this.openCreateScheduleModal(id, name, phone);
  },

  async deleteSchedule(id) {
    if (!confirm('Supprimer ce créneau de planning ?')) return;

    this.schedules = this.schedules.filter(s => s.id !== id);

    const client = SupabaseClient.client;
    if (client && !id.startsWith('sch-')) {
      try {
        await client.from('volunteer_schedules').delete().eq('id', id);
      } catch (e) {}
    }

    localStorage.setItem('kermesse_volunteer_schedules', JSON.stringify(this.schedules));
    Notify.info('Créneau supprimé.');
    this.updateStats();
    this.renderCurrentTab();
  },

  // CRÉATION DE BÉNÉVOLE
  openCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Nouveau Bénévole</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createMemberForm">
            <div class="form-row">
              <div class="form-group">
                <label>Prénom *</label>
                <input type="text" id="mFirstName" class="form-control" required placeholder="Ex: Mamadou">
              </div>
              <div class="form-group">
                <label>Nom de famille *</label>
                <input type="text" id="mLastName" class="form-control" required placeholder="Ex: Diallo">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Numéro WhatsApp / Téléphone *</label>
                <input type="tel" id="mPhone" class="form-control" required placeholder="Ex: +221 77 000 00 00">
                <div class="form-hint">Permettra de contacter directement le bénévole en 1 clic</div>
              </div>
              <div class="form-group">
                <label>Responsabilité Principale *</label>
                <input type="text" id="mPrimaryRole" class="form-control" required placeholder="Ex: Caissier, Arbitre, Sécurité, Service...">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand Rattaché (optionnel)</label>
                <select id="mStand" class="form-control">
                  <option value="">Aucun stand attitré</option>
                  ${this.stands.map(s => `<option value="${s.id}">Stand ${s.number} : ${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Équipe</label>
                <select id="mTeam" class="form-control">
                  <option value="">Aucune équipe</option>
                  ${this.teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Compétences &amp; Disponibilités</label>
              <textarea id="mNotes" class="form-control" rows="2" placeholder="Ex: Disponible dès 9h, bilingue, secouriste, etc."></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveMemberBtn">Enregistrer le bénévole</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveMemberBtn').onclick = async () => {
      const first = document.getElementById('mFirstName').value.trim();
      const last = document.getElementById('mLastName').value.trim();
      const phone = document.getElementById('mPhone').value.trim();
      const primaryRole = document.getElementById('mPrimaryRole').value.trim();
      const standId = document.getElementById('mStand').value || null;
      const teamId = document.getElementById('mTeam').value || null;
      const notes = document.getElementById('mNotes').value.trim();

      if (!first || !last || !primaryRole) {
        Notify.error('Veuillez remplir les champs obligatoires (*)');
        return;
      }

      const newMember = {
        id: 'mem-' + Date.now(),
        first_name: first,
        last_name: last,
        phone,
        primary_role: primaryRole,
        stand_id: standId,
        team_id: teamId,
        notes,
        is_active: true,
        created_at: new Date().toISOString()
      };

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data } = await client.from('members').insert([{
            first_name: first,
            last_name: last,
            phone,
            primary_role: primaryRole,
            stand_id: standId,
            team_id: teamId,
            notes,
            is_active: true
          }]).select();
          if (data && data[0]) newMember.id = data[0].id;
        } catch (e) {}
      }

      MembersModule.members.push(newMember);
      localStorage.setItem('kermesse_members_data', JSON.stringify(MembersModule.members));
      Notify.success(`Bénévole ${first} ${last} enregistré avec succès.`);
      close();
      MembersModule.updateStats();
      MembersModule.renderCurrentTab();
    };
  },

  async deleteMember(id, name) {
    if (!confirm(`Supprimer définitivement le bénévole ${name} ?`)) return;

    this.members = this.members.filter(m => m.id !== id);
    this.selectedMemberIds.delete(id);

    const client = SupabaseClient.client;
    if (client && !id.startsWith('mem-')) {
      try {
        await client.from('members').delete().eq('id', id);
      } catch (e) {}
    }

    localStorage.setItem('kermesse_members_data', JSON.stringify(this.members));
    Notify.info(`Bénévole ${name} supprimé.`);
    this.updateStats();
    this.renderCurrentTab();
  }
};

window.MembersModule = MembersModule;
