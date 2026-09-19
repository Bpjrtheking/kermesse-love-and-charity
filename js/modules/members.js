/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 7 : BÉNÉVOLES & PLANNING
 * 
 * Responsable : admin_benevoles
 * Missions :
 * - Fiches bénévoles complètes & coordonnées (téléphone, WhatsApp direct)
 * - Compétences & disponibilités
 * - Planning par créneaux horaires (qui est où et à quelle heure)
 * - MOTEUR DE DÉTECTION ET PRÉVENTION DES CONFLITS D'AFFECTATION
 *   (interdit qu'une personne soit affectée à 2 stands ou pôles simultanément)
 * - Suivi des présences réelles (Planifié, Présent, Retard, Absent)
 */

const MembersModule = {
  currentTab: 'list', // 'list', 'planning', 'conflicts'

  members: [],
  teams: [],
  stands: [],
  schedules: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>👥</span> Pôle 7 : Bénévoles &amp; Planning
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
          <div class="stats-grid" id="volunteerStatsGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
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
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabVolList" onclick="MembersModule.switchTab('list')">
              👥 Bénévoles &amp; Contacts
            </button>
            <button class="tab-btn" id="tabVolPlanning" onclick="MembersModule.switchTab('planning')">
              📅 Planning Créneaux &amp; Présences
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
          { id: 'mem-5', first_name: 'Fatou', last_name: 'Diop', phone: '+221 77 500 00 05', primary_role: 'Animatrice Stand Pêche aux canards', is_active: true }
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
          { id: 'sch-1', member_id: 'mem-4', member_name: 'Mamadou Sy', member_phone: '+221 77 400 00 04', location_or_stand: 'Zone 3 : Billetterie Centrale', pole_name: 'Billetterie', shift_date: '2026-09-20', start_time: '10:00', end_time: '13:00', role_title: 'Caissier billetterie', status: 'present' },
          { id: 'sch-2', member_id: 'mem-5', member_name: 'Fatou Diop', member_phone: '+221 77 500 00 05', location_or_stand: 'Stand 1 : Pêche aux canards', pole_name: 'Stands', shift_date: '2026-09-20', start_time: '10:00', end_time: '14:00', role_title: 'Arbitre & animateur', status: 'present' }
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
            // Chevauchement d'intervalles [start, end]
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

  // 1. ONGLET BÉNÉVOLES & CONTACTS
  renderListTab(container) {
    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
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
          <div class="empty-desc">Enregistrez les bénévoles pour leur assigner des créneaux et des stands.</div>
          <button class="btn btn-primary" onclick="MembersModule.openCreateModal()">
            <span>➕</span> Ajouter le premier bénévole
          </button>
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Bénévole</th>
            <th>Téléphone &amp; Contact</th>
            <th>Responsabilité Principale</th>
            <th>Équipe / Stand</th>
            <th>Créneaux Assignés</th>
            <th>Statut</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(m => {
            const assignedCount = this.schedules.filter(s => s.member_id === m.id || s.member_name === `${m.first_name} ${m.last_name}`).length;
            const cleanPhone = (m.phone || '').replace(/[^0-9+]/g, '');

            return `
              <tr>
                <td>
                  <strong>${(m.last_name || '').toUpperCase()}</strong> ${m.first_name || ''}
                  ${m.notes ? `<div style="font-size: 0.75rem; color: var(--gray-500); margin-top: 2px;">💡 ${m.notes}</div>` : ''}
                </td>
                <td>
                  ${m.phone ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span>${m.phone}</span>
                      <a href="https://wa.me/${cleanPhone.replace('+', '')}" target="_blank" class="badge badge-success" style="text-decoration: none;" title="Ouvrir WhatsApp">
                        💬 WhatsApp
                      </a>
                    </div>
                  ` : '<span style="color: var(--gray-400);">Non renseigné</span>'}
                </td>
                <td><span class="badge badge-primary">${m.primary_role || 'Bénévole'}</span></td>
                <td>
                  ${m.stands ? `<span class="badge badge-gray">🎪 Stand ${m.stands.number}</span>` : ''}
                  ${m.teams ? `<span class="badge" style="background: ${m.teams.color_hex}20; color: ${m.teams.color_hex};">${m.teams.name}</span>` : ''}
                  ${!m.stands && !m.teams ? '<span style="color: var(--gray-400); font-size: 0.8rem;">Non rattaché</span>' : ''}
                </td>
                <td>
                  <span class="badge ${assignedCount > 0 ? 'badge-primary' : 'badge-warning'}">
                    ${assignedCount} créneau(x)
                  </span>
                </td>
                <td>
                  ${m.is_active !== false ? '<span class="badge badge-success">Actif</span>' : '<span class="badge badge-gray">Inactif</span>'}
                </td>
                <td style="text-align: right;">
                  <button class="btn-icon" onclick="MembersModule.openScheduleForMember('${m.id}', '${m.first_name} ${m.last_name}', '${m.phone || ''}')" title="Affecter un créneau">
                    📅
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

  // 2. ONGLET PLANNING CRÉNEAUX & PRÉSENCES
  renderPlanningTab(container) {
    const statusBadges = {
      'planifie': { label: 'Planifié', badge: 'badge-primary' },
      'present': { label: 'Présent ✅', badge: 'badge-success' },
      'retard': { label: 'En retard ⏰', badge: 'badge-warning' },
      'absent': { label: 'Absent ❌', badge: 'badge-danger' }
    };

    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: space-between;">
        <div class="search-box" style="flex: 1; min-width: 220px;">
          <input type="text" id="schedSearch" class="form-control" placeholder="Rechercher par bénévole, lieu ou stand..." oninput="MembersModule.filterSchedules()">
        </div>
        <div>
          <button class="btn btn-primary btn-sm" onclick="MembersModule.openCreateScheduleModal()">
            <span>➕</span> Ajouter un Créneau
          </button>
        </div>
      </div>

      <div class="table-responsive" id="schedulesTableContainer">
        ${this.generateSchedulesTable(this.schedules)}
      </div>
    `;
  },

  generateSchedulesTable(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <div class="empty-title">Aucun créneau planifié</div>
          <div class="empty-desc">Affectez les bénévoles aux stands et pôles avec leurs horaires de passage.</div>
          <button class="btn btn-primary" onclick="MembersModule.openCreateScheduleModal()">
            <span>➕</span> Créer le premier créneau
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
            <th>Date &amp; Horaires</th>
            <th>Lieu / Stand</th>
            <th>Mission / Rôle</th>
            <th>Présence</th>
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
                  <strong>${s.shift_date}</strong><br>
                  <span class="badge badge-gray" style="font-size: 0.8rem; font-weight: 700;">
                    ⏰ ${s.start_time} - ${s.end_time}
                  </span>
                </td>
                <td>
                  <strong>${s.location_or_stand}</strong>
                  ${s.pole_name ? `<div style="font-size: 0.75rem; color: var(--gray-500);">${s.pole_name}</div>` : ''}
                </td>
                <td><span class="badge badge-primary">${s.role_title}</span></td>
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
      await client.from('volunteer_schedules').update({ status: s.status }).eq('id', id);
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
            ⚠️ <strong>ALERTE CONFLIT D'AFFECTATION :</strong> ${conflicts.length} conflit(s) d'horaires détecté(s). Des bénévoles sont programmés sur des stands ou missions qui se chevauchent dans le temps !
          ` : `
            ✅ <strong>AUCUN CONFLIT D'HORAIRE :</strong> Tous les plannings sont fluides. Aucun bénévole n'est affecté à deux endroits en même temps.
          `}
        </div>
      </div>

      ${conflicts.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">🛡️</div>
          <div class="empty-title">Planning Optimisé & Sans Conflit</div>
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
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem; background: #fff1f2; padding: 0.75rem; border-radius: 8px;">
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

  // MODAL DE CRÉATION DE CRÉNEAU AVEC DÉTECTION STRICTE
  openCreateScheduleModal(defaultMemberId = null, defaultMemberName = null, defaultPhone = null) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Affecter un Créneau de Planning</h3>
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
                  <option value="Décoration & Espaces">Pôle 3 : Décoration &amp; Espaces</option>
                  <option value="Logistique">Pôle 8 : Logistique &amp; Installation</option>
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
              <input type="text" id="schLocation" class="form-control" required placeholder="Ex: Stand 3 Tir aux ballons, Caisse 2...">
            </div>

            <div class="form-group">
              <label>Rôle ou Mission sur le créneau *</label>
              <input type="text" id="schRole" class="form-control" required placeholder="Ex: Arbitre de jeu, Caissier, Accueil visiteurs...">
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
      await client.from('volunteer_schedules').delete().eq('id', id);
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
                <input type="text" id="mPrimaryRole" class="form-control" required placeholder="Ex: Caissier, Arbitre, Sécurité...">
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

    const client = SupabaseClient.client;
    if (client && !id.startsWith('mem-')) {
      await client.from('members').delete().eq('id', id);
    }

    localStorage.setItem('kermesse_members_data', JSON.stringify(this.members));
    Notify.info(`Bénévole ${name} supprimé.`);
    this.updateStats();
    this.renderCurrentTab();
  }
};

window.MembersModule = MembersModule;
