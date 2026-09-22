/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : TÂCHES COLLABORATIVES PAR PÔLE & BLOC-NOTES PERSONNEL
 * 
 * Collaboration multi-administrateurs & traçabilité nominative (« Qui a fait quoi ») :
 * - Les administrateurs d'un même pôle partagent les tâches en direct.
 * - Le SuperAdministrateur peut assigner des tâches à n'importe quel pôle.
 * - Chaque tâche indique qui l'a créée et qui l'a cochée/terminée (avec nom complet & date).
 * - Maintien d'un bloc-notes personnel et confidentiel sur l'appareil.
 */

const TasksModule = {
  currentTab: 'tasks', // 'tasks', 'notes', 'templates'
  selectedPoleFilter: 'all', // Pour le SuperAdmin ('all', 'admin_restauration', etc.)
  activeNoteId: null,
  noteCategoryFilter: 'all',
  noteSearchQuery: '',
  isFullscreen: false,

  tasks: [],
  notes: [],
  pollingInterval: null,

  POLES: [
    { code: 'admin_communication', name: 'Pôle 1 : Communication & Affichage', icon: '📢' },
    { code: 'admin_finances', name: 'Pôle 2 : Billetterie, Caisses & Compta', icon: '🎟️' },
    { code: 'admin_decoration', name: 'Pôle 3 : Organisation & Décoration', icon: '🎨' },
    { code: 'admin_restauration', name: 'Pôle 4 : Restauration', icon: '🍔' },
    { code: 'admin_stands', name: 'Pôle 5 : Stands & Jeux', icon: '🎪' },
    { code: 'admin_lots', name: 'Pôle 6 : Lots à gagner', icon: '🎁' },
    { code: 'admin_benevoles', name: 'Pôle 7 : Planning & Bénévoles', icon: '👥' },
    { code: 'admin_logistique', name: 'Pôle 8 : Logistique & Installation', icon: '📦' },
    { code: 'admin_securite', name: 'Pôle 9 : Accueil, Nettoyage & Sécurité', icon: '🛡️' }
  ],

  getUserKey(suffix) {
    const user = Auth.getCurrentUser();
    const login = user ? (user.login || 'user').toLowerCase() : 'default';
    return `lc_${suffix}_${login}`;
  },

  getPoleName(poleCode) {
    if (poleCode === 'all') return 'Tous les pôles (Général)';
    const p = this.POLES.find(it => it.code === poleCode);
    return p ? `${p.icon} ${p.name}` : (poleCode || 'Pôle');
  },

  async render(container) {
    const user = Auth.getCurrentUser();
    const isSuperAdmin = user && (user.is_original_superadmin || user.role_code === 'superadmin');

    const poleLabel = isSuperAdmin
      ? 'Vue Globale & Multi-Pôles'
      : (this.getPoleName(user.role_code) || 'Mon Pôle');

    container.innerHTML = `
      <div class="card">
        <div class="card-header" style="flex-wrap: wrap; gap: 0.75rem;">
          <div class="card-title">
            <span>📋</span> ${isSuperAdmin ? 'Tâches Collaboratives de la Kermesse' : `Tâches d'Équipe — ${poleLabel}`}
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="TasksModule.openTemplatesModal()">
              <span>📋</span> Checklists Prêtes à l'Emploi
            </button>
            <button class="btn btn-primary btn-sm" onclick="TasksModule.focusAddTask()">
              <span>➕</span> Nouvelle Tâche
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- Bannière informative d'équipe -->
          <div class="alert-banner info" style="margin-bottom: 1.25rem;">
            <div>
              👥 <strong>Synchronisation d'équipe :</strong> Les tâches ci-dessous sont <strong>partagées en temps réel</strong> entre tous les administrateurs de ce pôle et le SuperAdmin. Chaque coche ou ajout indique nominativement qui a fait l'action.
            </div>
          </div>

          <!-- Jauge de Progression Dynamique -->
          <div id="tasksProgressCard" style="background: var(--gray-50, #f8fafc); border: 1px solid var(--gray-200); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-weight: 700; color: var(--gray-800); font-size: 0.95rem;">
                Progression des tâches d'équipe : <span id="tasksPercentText">0%</span>
              </span>
              <span class="badge badge-primary" id="tasksRatioBadge">0 / 0 terminées</span>
            </div>
            <div style="width: 100%; height: 10px; background: var(--gray-200, #e2e8f0); border-radius: 5px; overflow: hidden;">
              <div id="tasksProgressBar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #10b981); transition: width 0.3s ease;"></div>
            </div>
          </div>

          <!-- Onglets Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.5rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabTasksList" onclick="TasksModule.switchTab('tasks')">
              👥 Tâches d'Équipe (<span id="tabTasksCount">0</span>)
            </button>
            <button class="tab-btn" id="tabTasksNotes" onclick="TasksModule.switchTab('notes')">
              📒 Mon Bloc-Notes Illimité (<span id="tabNotesCount">0</span>)
            </button>
            <button class="tab-btn" id="tabTasksTemplates" onclick="TasksModule.switchTab('templates')">
              📋 Modèles de Checklists
            </button>
          </div>

          <!-- Conteneur Dynamique -->
          <div id="tasksTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement des tâches de l'équipe...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
    this.startPolling();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(
      tab === 'tasks' ? 'tabTasksList' : (tab === 'notes' ? 'tabTasksNotes' : 'tabTasksTemplates')
    );
    if (btn) btn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData(silent = false) {
    const user = Auth.getCurrentUser();
    if (!user) return;

    const isSuperAdmin = Boolean(user.is_original_superadmin || user.role_code === 'superadmin');
    const client = SupabaseClient.client;

    let loadedTasks = [];

    // 1. Chargement depuis Supabase si connecté
    if (client && navigator.onLine) {
      try {
        let query = client.from('pole_tasks').select('*').order('created_at', { ascending: false });

        // Si admin de pôle : seulement son pôle et les tâches 'all'
        if (!isSuperAdmin) {
          query = query.or(`pole_code.eq.${user.role_code},pole_code.eq.all`);
        }

        const { data, error } = await query;
        if (!error && data) {
          loadedTasks = data;
          localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(data));
        }
      } catch (err) {
        console.warn('[TasksModule] Erreur Supabase:', err);
      }
    }

    // 2. Fallback cache local ou localStorage
    if (loadedTasks.length === 0) {
      try {
        const cached = localStorage.getItem('lc_cached_pole_tasks');
        if (cached) {
          const allCached = JSON.parse(cached);
          loadedTasks = isSuperAdmin ? allCached : allCached.filter(t => t.pole_code === user.role_code || t.pole_code === 'all');
        }
      } catch (e) {
        loadedTasks = [];
      }
    }

    // Si aucune tâche en base, charger quelques exemples initiaux pour le pôle
    if (loadedTasks.length === 0 && !isSuperAdmin) {
      loadedTasks = this.getDefaultInitialTasksForPole(user.role_code);
    }

    this.tasks = loadedTasks;

    // Charger les notes personnelles privées (stockées en local sur l'appareil)
    const noteKey = this.getUserKey('notes');
    const savedNotes = localStorage.getItem(noteKey);
    if (savedNotes) {
      try {
        this.notes = JSON.parse(savedNotes);
        // Si l'utilisateur n'avait que l'ancien mémo test sommaire de 2 lignes, migrer vers les mémos riches
        if (this.notes.length === 1 && this.notes[0].content && this.notes[0].content.includes('Mon espace privé personnel (visible uniquement sur mon appareil)')) {
          this.notes = this.getDefaultNotes();
          this.saveNotes();
        }
      } catch (e) {
        this.notes = this.getDefaultNotes();
      }
    } else {
      this.notes = this.getDefaultNotes();
      this.saveNotes();
    }

    if (this.notes.length > 0 && !this.activeNoteId) {
      this.activeNoteId = this.notes[0].id;
    }

    this.updateProgress();
    if (!silent) {
      this.renderCurrentTab();
    } else if (this.currentTab === 'tasks') {
      const container = document.getElementById('tasksListContainer');
      if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
    }
  },

  getDefaultNotes() {
    const now = new Date().toISOString();
    return [
      {
        id: 'note-1',
        title: '📌 Mémos & Organisation de la Journée',
        category: 'memo',
        content: `📌 MÉMOS GÉNÉRAUX & CONSIGNES DU JOUR J :
• Ce bloc-notes est 100% ILLIMITÉ et PRIVÉ sur cet appareil.
• Vous pouvez créer autant de notes et pages que vous le souhaitez sans aucune restriction.
• Utilisez la barre d'outils ci-dessus pour insérer des cases à cocher, des listes ou l'horodatage en 1 clic.

[ ] Vérifier l'installation et l'affichage de notre stand à 08h30
[ ] Récupérer les badges, clés et pochettes de caisse auprès de la Direction
[ ] Faire le point météo et s'assurer que les barnums sont bien arrimés
[ ] Prévoir le planning de roulement pour le repas de l'équipe (12h30)`,
        updated_at: now
      },
      {
        id: 'note-2',
        title: '🛒 Liste d\'Achats & Réassorts Express',
        category: 'achats',
        content: `🛒 BESOINS & RÉASSORTS URGENTS (ACHATS RAPIDES) :
[ ] 10 packs de bouteilles d'eau minérale 50cl
[ ] Glaçons alimentaires pour rafraîchir les canettes
[ ] 2 paquets de serviettes jetables & 300 gobelets
[ ] Scotch renforcé d'électricien & 3 feutres noirs larges
[ ] Rouleau de sacs poubelles 100L pour le nettoyage continu

📍 Magasin le plus proche : Supermarché Express à 5 min à pied`,
        updated_at: now
      },
      {
        id: 'note-3',
        title: '📞 Numéros Clés & Contacts d\'Urgence',
        category: 'contacts',
        content: `📞 RÉPERTOIRE KERMESSE & SECOURS :
• 👑 Direction Générale (SuperAdmin) : Poste 1 (Tente Direction)
• 🚑 SAMU / Urgences vitales : 15
• 🚒 Pompiers : 18
• 👮 Police Secours : 17
• 🏥 Poste Médical & Défibrillateur (DAE) : Stand Accueil / Direction
• ⚡ Électricien / Régie Sono : Stand Sono & Podium
• 🍔 Responsable Restauration : Stand Buvette Centrale`,
        updated_at: now
      },
      {
        id: 'note-4',
        title: '💰 Point de Caisse & Chiffres Personnels',
        category: 'caisse',
        content: `💰 POINT DE CAISSE PERSONNEL & ÉCARTS :
• Fonds de caisse initial remis le matin : 25 000 FCFA
• Responsable remise : Caissier en chef

[ ] 12h00 - Premier comptage intermédiaire espèces : ... FCFA
[ ] 14h30 - Remise sécurisée à la caisse centrale : ... FCFA
[ ] 17h30 - Clôture définitive et remise au coffre : ... FCFA

Remarques : Caisse scellée et signée.`,
        updated_at: now
      }
    ];
  },

  getDefaultInitialTasksForPole(roleCode) {
    const now = new Date().toISOString();
    switch (roleCode) {
      case 'admin_restauration':
        return [
          { id: 'def-1', pole_code: 'admin_restauration', title: 'Vérifier la température des frigos et glacières', priority: 'urgente', due_time: '08h45', is_completed: false, created_by_name: 'Direction Générale', created_by_role: 'SuperAdministrateur', created_at: now },
          { id: 'def-2', pole_code: 'admin_restauration', title: 'Faire l\'inventaire initial des canettes et boissons fraîches', priority: 'normale', due_time: '09h30', is_completed: false, created_by_name: 'Équipe Restauration', created_by_role: 'Responsable Restauration', created_at: now }
        ];
      case 'admin_finances':
        return [
          { id: 'def-3', pole_code: 'admin_finances', title: 'Distribuer les fonds de caisse scellés aux stands', priority: 'urgente', due_time: '09h00', is_completed: false, created_by_name: 'Direction Générale', created_by_role: 'SuperAdministrateur', created_at: now },
          { id: 'def-4', pole_code: 'admin_finances', title: 'Vérifier les souches de tickets d\'entrée numérotées', priority: 'normale', due_time: '09h30', is_completed: false, created_by_name: 'Équipe Billetterie', created_by_role: 'Responsable Billetterie', created_at: now }
        ];
      default:
        return [
          { id: 'def-5', pole_code: roleCode || 'all', title: 'Vérifier l\'installation et l\'affichage de notre pôle', priority: 'normale', due_time: '09h00', is_completed: false, created_by_name: 'Direction Générale', created_by_role: 'SuperAdministrateur', created_at: now }
        ];
    }
  },

  saveNotes() {
    localStorage.setItem(this.getUserKey('notes'), JSON.stringify(this.notes));
    const el = document.getElementById('tabNotesCount');
    if (el) el.textContent = this.notes.length;
  },

  updateProgress() {
    const list = this.getFilteredTasks();
    const total = list.length;
    const done = list.filter(t => t.is_completed).length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);

    const elPercent = document.getElementById('tasksPercentText');
    const elRatio = document.getElementById('tasksRatioBadge');
    const elBar = document.getElementById('tasksProgressBar');
    const elTabCount = document.getElementById('tabTasksCount');

    if (elPercent) elPercent.textContent = `${percent}%`;
    if (elRatio) elRatio.textContent = `${done} / ${total} terminées`;
    if (elBar) elBar.style.width = `${percent}%`;
    if (elTabCount) elTabCount.textContent = total - done;
  },

  getFilteredTasks() {
    const user = Auth.getCurrentUser();
    if (!user) return [];
    const isSuperAdmin = Boolean(user.is_original_superadmin || user.role_code === 'superadmin');

    if (!isSuperAdmin) {
      return this.tasks.filter(t => t.pole_code === user.role_code || t.pole_code === 'all');
    }

    // Vue SuperAdmin : filtre par pôle sélectionné
    if (this.selectedPoleFilter === 'all') {
      return this.tasks;
    }
    return this.tasks.filter(t => t.pole_code === this.selectedPoleFilter || t.pole_code === 'all');
  },

  renderCurrentTab() {
    const container = document.getElementById('tasksTabContent');
    if (!container) return;

    if (this.currentTab === 'tasks') {
      this.renderTasksTab(container);
    } else if (this.currentTab === 'notes') {
      this.renderNotesTab(container);
    } else if (this.currentTab === 'templates') {
      this.renderTemplatesTab(container);
    }
  },

  // 1. ONGLET TO-DO LIST PARTAGÉE DU PÔLE
  renderTasksTab(container) {
    const user = Auth.getCurrentUser();
    const isSuperAdmin = user && (user.is_original_superadmin || user.role_code === 'superadmin');

    container.innerHTML = `
      <!-- Sélecteur de pôle (SuperAdmin uniquement) -->
      ${isSuperAdmin ? `
        <div style="background: #fdf4ff; border: 1px solid #f0abfc; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.2rem;">👑</span>
            <span style="font-weight: 700; color: #86198f; font-size: 0.9rem;">Afficher les tâches d'un pôle spécifique :</span>
          </div>
          <select id="superAdminPoleFilter" class="form-control" style="max-width: 320px; font-weight: 600;" onchange="TasksModule.changePoleFilter(this.value)">
            <option value="all" ${this.selectedPoleFilter === 'all' ? 'selected' : ''}>🌟 Tous les Pôles (Vue d'ensemble)</option>
            ${this.POLES.map(p => `<option value="${p.code}" ${this.selectedPoleFilter === p.code ? 'selected' : ''}>${p.icon} ${p.name}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      <!-- Formulaire d'ajout collaboratif -->
      <div class="tasks-quick-add-bar">
        <input type="text" id="newTaskInput" class="form-control tasks-quick-input" placeholder="Ajouter une tâche d'équipe (ex: Contrôler stock glaçons, Réapprovisionner jetons...)" onkeydown="if(event.key==='Enter') TasksModule.quickAddTask()">
        <div class="tasks-quick-options">
          ${isSuperAdmin ? `
            <select id="newTaskPoleTarget" class="form-control" style="font-weight: 600; min-width: 160px;" title="Attribuer à quel pôle ?">
              ${this.POLES.map(p => `<option value="${p.code}" ${this.selectedPoleFilter === p.code ? 'selected' : ''}>${p.icon} ${p.name.split(':')[0]}</option>`).join('')}
              <option value="all">🌐 Tous les Pôles</option>
            </select>
          ` : ''}

          <select id="newTaskPriority" class="form-control tasks-priority-select">
            <option value="normale">🟡 Normal</option>
            <option value="urgente">🔴 Urgent</option>
            <option value="basse">🟢 Basse</option>
          </select>
          <input type="text" id="newTaskDue" class="form-control tasks-due-input" placeholder="Heure (ex: 11h30)">
          <button class="btn btn-primary tasks-add-btn" onclick="TasksModule.quickAddTask()">
            <span>➕</span> Ajouter
          </button>
        </div>
      </div>

      <!-- Filtres rapides -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;">
        <span style="font-size: 0.85rem; color: var(--gray-500); font-weight: 600;">Filtrer :</span>
        <button class="btn btn-sm btn-secondary active" id="filterAll" onclick="TasksModule.filterTasks('all')">Toutes</button>
        <button class="btn btn-sm btn-secondary" id="filterPending" onclick="TasksModule.filterTasks('pending')">À faire</button>
        <button class="btn btn-sm btn-secondary" id="filterUrgent" onclick="TasksModule.filterTasks('urgent')">🔴 Urgentes</button>
        <button class="btn btn-sm btn-secondary" id="filterDone" onclick="TasksModule.filterTasks('done')">Terminées</button>
        <button class="btn btn-sm btn-danger" style="margin-left: auto;" onclick="TasksModule.clearDoneTasks()">
          🗑️ Nettoyer les terminées
        </button>
      </div>

      <!-- Liste des tâches -->
      <div id="tasksListContainer" style="display: flex; flex-direction: column; gap: 0.65rem;">
        ${this.generateTasksHtml(this.getFilteredTasks())}
      </div>
    `;
  },

  changePoleFilter(val) {
    this.selectedPoleFilter = val;
    this.updateProgress();
    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
  },

  generateTasksHtml(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">Aucune tâche en attente pour ce pôle !</div>
          <div class="empty-desc">Ajoutez une consigne ou une tâche ci-dessus pour la partager avec l'équipe.</div>
        </div>
      `;
    }

    const prioLabels = {
      'urgente': '<span class="badge badge-danger" style="font-size: 0.72rem;">🔴 Urgent</span>',
      'urgent': '<span class="badge badge-danger" style="font-size: 0.72rem;">🔴 Urgent</span>',
      'normale': '<span class="badge badge-warning" style="font-size: 0.72rem;">🟡 Normal</span>',
      'normal': '<span class="badge badge-warning" style="font-size: 0.72rem;">🟡 Normal</span>',
      'basse': '<span class="badge badge-gray" style="font-size: 0.72rem;">🟢 Basse</span>',
      'low': '<span class="badge badge-gray" style="font-size: 0.72rem;">🟢 Basse</span>'
    };

    return list.map(t => {
      const isDone = Boolean(t.is_completed || t.is_done);
      const isDirectiveSuperAdmin = Boolean(
        (t.created_by_role && t.created_by_role.toLowerCase().includes('superadmin')) ||
        (t.created_by_name && (t.created_by_name.toLowerCase().includes('superadmin') || t.created_by_name.toLowerCase().includes('mounir')))
      );

      const poleTag = (t.pole_code && t.pole_code !== 'all') ? this.getPoleName(t.pole_code).split(':')[0] : 'Général';

      const formatTimeText = (dateStr) => {
        if (!dateStr) return '';
        try {
          const d = new Date(dateStr);
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
          return '';
        }
      };

      return `
        <div class="card task-item-row" style="margin: 0; padding: 0.85rem 1rem; border: 1px solid ${isDirectiveSuperAdmin ? '#f59e0b' : 'var(--gray-200)'}; border-left: 5px solid ${isDirectiveSuperAdmin ? '#d97706' : (isDone ? '#10b981' : '#3b82f6')}; border-radius: 8px; background: ${isDone ? '#f8fafc' : '#fff'}; opacity: ${isDone ? '0.75' : '1'};">
          <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 0.75rem;">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem; flex: 1;">
              <input type="checkbox" style="width: 22px; height: 22px; cursor: pointer; margin-top: 2px;" ${isDone ? 'checked' : ''} onchange="TasksModule.toggleTask('${t.id}')">
              
              <div style="flex: 1;">
                <!-- Titre & Badges -->
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                  <span style="font-size: 0.98rem; font-weight: ${isDone ? 'normal' : '700'}; color: ${isDone ? 'var(--gray-500)' : 'var(--gray-900)'}; text-decoration: ${isDone ? 'line-through' : 'none'};">
                    ${t.title || t.text}
                  </span>
                  
                  ${isDirectiveSuperAdmin ? `
                    <span class="badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a; font-size: 0.7rem; font-weight: 700;">
                      👑 Directive Direction
                    </span>
                  ` : ''}

                  <span class="badge badge-gray" style="font-size: 0.68rem;">
                    ${poleTag}
                  </span>

                  ${t.due_time ? `<span style="font-size: 0.75rem; color: #dc2626; font-weight: 700;">⏰ ${t.due_time}</span>` : ''}
                </div>

                <!-- Métadonnées : Qui a créé et qui a fait -->
                <div style="font-size: 0.78rem; color: var(--gray-500); display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-top: 0.35rem;">
                  <span>👤 Ajouté par : <strong>${t.created_by_name || 'Équipe'}</strong></span>

                  ${isDone && t.completed_by_name ? `
                    <span style="color: #059669; font-weight: 600; background: #ecfdf5; padding: 2px 6px; border-radius: 4px;">
                      ✅ Fait par : <strong>${t.completed_by_name}</strong> ${t.completed_at ? 'à ' + formatTimeText(t.completed_at) : ''}
                    </span>
                  ` : ''}
                </div>
              </div>
            </div>

            <!-- Actions & Priorité -->
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${prioLabels[t.priority] || ''}
              <button class="btn-icon danger" onclick="TasksModule.deleteTask('${t.id}')" title="Supprimer la tâche">✕</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  async quickAddTask() {
    const input = document.getElementById('newTaskInput');
    if (!input) return;

    const text = input.value.trim();
    const priority = document.getElementById('newTaskPriority')?.value || 'normale';
    const dueTime = document.getElementById('newTaskDue')?.value.trim();

    if (!text) {
      Notify.warning('Écrivez l\'intitulé de la tâche.');
      return;
    }

    const user = Auth.getCurrentUser();
    if (!user) {
      Notify.error('Session expirée, veuillez vous reconnecter.');
      return;
    }

    const isSuperAdmin = Boolean(user.is_original_superadmin || user.role_code === 'superadmin');
    const targetPole = isSuperAdmin
      ? (document.getElementById('newTaskPoleTarget')?.value || this.selectedPoleFilter || 'all')
      : (user.role_code || 'all');

    const creatorName = user.full_name || user.login || 'SuperAdmin';
    const creatorRole = isSuperAdmin ? 'SuperAdministrateur' : (user.role_name || user.role_code || 'Administrateur');

    const payload = {
      pole_code: targetPole,
      title: text,
      priority,
      due_time: dueTime || null,
      is_completed: false,
      created_by_id: user.id !== '00000000-0000-0000-0000-000000000001' ? user.id : null,
      created_by_name: creatorName,
      created_by_role: creatorRole
    };

    // 1. Ajout optimiste immédiat
    const tempTask = {
      ...payload,
      id: 'local-' + Date.now(),
      created_at: new Date().toISOString()
    };
    this.tasks.unshift(tempTask);
    input.value = '';

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
    this.updateProgress();

    // 2. Persistance Supabase / Offline
    const client = SupabaseClient.client;
    if (client && navigator.onLine) {
      try {
        const { data, error } = await client.from('pole_tasks').insert([payload]).select().single();
        if (!error && data) {
          tempTask.id = data.id;
          Notify.success(`Tâche enregistrée pour ${this.getPoleName(targetPole)}`);
          await this.loadData(true);
          return;
        }
      } catch (err) {
        console.warn('[TasksModule] Sauvegarde locale après exception Supabase:', err);
      }
    }

    // Fallback local
    localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(this.tasks));
    Notify.success('Tâche ajoutée localement.');
  },

  focusAddTask() {
    this.switchTab('tasks');
    setTimeout(() => {
      const input = document.getElementById('newTaskInput');
      if (input) input.focus();
    }, 100);
  },

  async toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;

    const user = Auth.getCurrentUser();
    const isNowDone = !(task.is_completed || task.is_done);
    task.is_completed = isNowDone;
    task.is_done = isNowDone;

    if (isNowDone) {
      task.completed_by_name = user ? (user.full_name || user.login) : 'Admin';
      task.completed_at = new Date().toISOString();
    } else {
      task.completed_by_name = null;
      task.completed_at = null;
    }

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
    this.updateProgress();

    if (isNowDone) {
      Notify.success(`Tâche validée par ${task.completed_by_name} ! ✅`);
    }

    // Synchronisation en base de données Supabase
    const client = SupabaseClient.client;
    if (client && navigator.onLine && !id.startsWith('local-') && !id.startsWith('def-')) {
      try {
        await client.from('pole_tasks').update({
          is_completed: isNowDone,
          completed_by_name: task.completed_by_name,
          completed_at: task.completed_at,
          completed_by_id: user?.id || null,
          updated_at: new Date().toISOString()
        }).eq('id', id);
      } catch (err) {
        console.warn('[TasksModule] Erreur update Supabase:', err);
      }
    }

    localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(this.tasks));
  },

  async deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
    this.updateProgress();

    const client = SupabaseClient.client;
    if (client && navigator.onLine && !id.startsWith('local-') && !id.startsWith('def-')) {
      try {
        await client.from('pole_tasks').delete().eq('id', id);
      } catch (e) {}
    }

    localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(this.tasks));
    Notify.info('Tâche supprimée.');
  },

  clearDoneTasks() {
    const doneTasks = this.tasks.filter(t => t.is_completed || t.is_done);
    if (doneTasks.length === 0) {
      Notify.info('Aucune tâche terminée à nettoyer.');
      return;
    }

    Notify.confirm(
      'Archiver les tâches terminées ?',
      `Confirmez-vous le retrait de ${doneTasks.length} tâche(s) terminée(s) de la liste d'équipe ?`,
      async () => {
        const client = SupabaseClient.client;
        const doneIds = doneTasks.map(t => t.id).filter(id => !id.startsWith('local-') && !id.startsWith('def-'));

        this.tasks = this.tasks.filter(t => !t.is_completed && !t.is_done);
        const container = document.getElementById('tasksListContainer');
        if (container) container.innerHTML = this.generateTasksHtml(this.getFilteredTasks());
        this.updateProgress();

        if (client && navigator.onLine && doneIds.length > 0) {
          try {
            await client.from('pole_tasks').delete().in('id', doneIds);
          } catch (e) {}
        }

        localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(this.tasks));
        Notify.success(`${doneTasks.length} tâche(s) archivée(s).`);
      }
    );
  },

  filterTasks(filter) {
    document.querySelectorAll('#tasksTabContent .filters-group button, #tasksTabContent div button').forEach(b => {
      if (b.id && b.id.startsWith('filter')) b.classList.remove('active');
    });
    const activeBtn = document.getElementById(
      filter === 'all' ? 'filterAll' : (filter === 'pending' ? 'filterPending' : (filter === 'urgent' ? 'filterUrgent' : 'filterDone'))
    );
    if (activeBtn) activeBtn.classList.add('active');

    let filtered = this.getFilteredTasks();
    if (filter === 'pending') filtered = filtered.filter(t => !t.is_completed && !t.is_done);
    if (filter === 'urgent') filtered = filtered.filter(t => (t.priority === 'urgente' || t.priority === 'urgent') && !t.is_completed && !t.is_done);
    if (filter === 'done') filtered = filtered.filter(t => t.is_completed || t.is_done);

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(filtered);
  },

  // 2. ONGLET BLOC-NOTES LIBRE PERSONNEL (100% ILLIMITÉ & PRIVÉ SUR L'APPAREIL)
  getFilteredNotes() {
    let list = this.notes || [];
    const q = (this.noteSearchQuery || '').toLowerCase();
    const cat = this.noteCategoryFilter || 'all';

    if (cat !== 'all') {
      list = list.filter(n => (n.category || 'memo') === cat);
    }
    if (q) {
      list = list.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.content || '').toLowerCase().includes(q)
      );
    }
    return list;
  },

  renderNotesTab(container) {
    const filteredNotes = this.getFilteredNotes();
    const activeNote = this.notes.find(n => n.id === this.activeNoteId) || filteredNotes[0] || this.notes[0];
    if (activeNote) this.activeNoteId = activeNote.id;

    const catLabels = {
      memo: '📌 Mémo',
      achats: '🛒 Achats',
      caisse: '💰 Caisse',
      contacts: '📞 Contacts',
      checklist: '☑️ Checklist'
    };

    container.innerHTML = `
      <!-- Bannière explicative d'espace illimité -->
      <div class="alert-banner info" style="margin-bottom: 1.25rem; font-size: 0.86rem; border-left: 5px solid #3b82f6;">
        <div>
          ♾️ <strong>Bloc-Notes 100% Illimité & Privé :</strong> Écrivez autant de texte, de listes et de mémos que vous souhaitez, <strong>sans aucun plafond de longueur ni de nombre de notes</strong>. Vos écrits sont enregistrés automatiquement en direct sur votre appareil en toute confidentialité.
        </div>
      </div>

      <div class="notes-workspace-grid">
        <!-- Colonne latérale : Liste illimitée des notes, recherche & filtres -->
        <div class="notes-sidebar-col">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <span style="font-weight: 700; font-size: 0.9rem; color: var(--gray-800);">
              📑 Mes Mémos (<span id="notesCountBadge">${this.notes.length}</span>)
            </span>
            <div style="display: flex; gap: 0.35rem;">
              <button class="btn btn-sm btn-primary" onclick="TasksModule.openNewNoteMenu()" title="Créer une note illimitée">
                <span>➕</span> Nouvelle Note
              </button>
            </div>
          </div>

          <!-- Barre de recherche instantanée -->
          <input type="text" class="notes-search-input" id="notesSearchBox" placeholder="🔍 Rechercher dans mes notes..." value="${this.noteSearchQuery || ''}" oninput="TasksModule.searchNotes(this.value)">

          <!-- Filtres par catégorie -->
          <div class="notes-categories-bar">
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'all' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('all')">🌟 Toutes</button>
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'memo' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('memo')">📌 Mémos</button>
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'achats' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('achats')">🛒 Achats</button>
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'caisse' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('caisse')">💰 Caisse</button>
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'contacts' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('contacts')">📞 Contacts</button>
            <button class="notes-cat-btn ${this.noteCategoryFilter === 'checklist' ? 'active' : ''}" onclick="TasksModule.filterNoteCategory('checklist')">☑️ Checklists</button>
          </div>

          <!-- Liste des cartes de notes -->
          <div class="notes-list-scroll" id="notesListScrollContainer">
            ${this.renderNotesCardsHtml(filteredNotes)}
          </div>
        </div>

        <!-- Colonne centrale : Éditeur de texte illimité avec barre d'outils et auto-save -->
        <div class="notes-editor-col ${this.isFullscreen ? 'fullscreen-mode' : ''}" id="notesEditorCol">
          ${activeNote ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <input type="text" id="noteTitleInput" class="form-control" style="font-weight: 700; font-size: 1.15rem; flex: 1; min-width: 200px;" value="${activeNote.title || ''}" placeholder="Titre du mémo..." oninput="TasksModule.autoSaveActiveNote()">
              
              <select id="noteCategorySelect" class="form-control" style="width: auto; font-size: 0.82rem; font-weight: 600;" onchange="TasksModule.changeActiveNoteCategory(this.value)">
                <option value="memo" ${(activeNote.category || 'memo') === 'memo' ? 'selected' : ''}>📌 Mémo</option>
                <option value="achats" ${activeNote.category === 'achats' ? 'selected' : ''}>🛒 Achats</option>
                <option value="caisse" ${activeNote.category === 'caisse' ? 'selected' : ''}>💰 Caisse</option>
                <option value="contacts" ${activeNote.category === 'contacts' ? 'selected' : ''}>📞 Contacts</option>
                <option value="checklist" ${activeNote.category === 'checklist' ? 'selected' : ''}>☑️ Checklist</option>
              </select>

              <div style="display: flex; gap: 0.35rem; align-items: center; flex-wrap: wrap;">
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.toggleFullscreenNote()" title="Mode Plein Écran">
                  ${this.isFullscreen ? '✕ Réduire' : '⛶ Plein Écran'}
                </button>
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.copyNoteText()" title="Copier tout le texte">
                  📑 Copier
                </button>
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.shareNoteOnWhatsapp()" title="Partager sur WhatsApp">
                  💬 WhatsApp
                </button>
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.downloadNoteAsTxt()" title="Télécharger en fichier TXT">
                  💾 TXT
                </button>
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.duplicateActiveNote()" title="Dupliquer la note">
                  📋 Dupliquer
                </button>
                <button class="btn btn-sm btn-danger" onclick="TasksModule.deleteNote('${activeNote.id}')" title="Supprimer la note">
                  🗑️
                </button>
              </div>
            </div>

            <!-- Barre d'outils d'insertion rapide -->
            <div class="notes-toolbar">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--gray-500); margin-right: 0.25rem;">Insérer :</span>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n[ ] ')" title="Ajouter une case à cocher">☑️ Case</button>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n• ')" title="Ajouter une puce">• Puce</button>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n1. ')" title="Ajouter un numéro">🔢 Numéro</button>
              <button class="note-tool-btn" onclick="TasksModule.insertCurrentTime()" title="Insérer l'heure">⏰ Heure</button>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n⭐ IMPORTANT : ')" title="Insérer une alerte">⭐ Urgent</button>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n👤 Contact : ... | 📞 Tél : ...')" title="Insérer un contact">📞 Contact</button>
              <button class="note-tool-btn" onclick="TasksModule.insertNoteText('\\n💰 Montant : ... FCFA | Motif : ...')" title="Insérer un montant">💰 Caisse</button>
              <button class="note-tool-btn" style="margin-left: auto; color: #2563eb; background: #eff6ff; border-color: #bfdbfe;" onclick="TasksModule.openNewNoteMenu()" title="Modèles de notes">📋 Modèles Prêts</button>
            </div>

            <!-- Zone de texte illimitée auto-extensible -->
            <textarea id="noteContentInput" class="notes-textarea-unlimited" placeholder="Écrivez vos notes libres sans aucune limite... Sauvegarde automatique immédiate !" oninput="TasksModule.autoSaveActiveNote()">${activeNote.content || ''}</textarea>

            <!-- Barre de statut inférieure avec compteurs en temps réel -->
            <div class="notes-bottom-status-bar">
              <div style="display: flex; gap: 0.65rem; align-items: center; flex-wrap: wrap;">
                <span class="badge badge-success" style="font-size: 0.72rem; font-weight: 700;">
                  ♾️ Capacité Illimitée (∞)
                </span>
                <span id="noteWordsCount" style="font-weight: 600;">0 mot(s)</span>
                <span>•</span>
                <span id="noteCharsCount">0 caractère(s)</span>
                <span>•</span>
                <span id="noteLinesCount">0 ligne(s)</span>
              </div>
              <div id="noteSaveStatus" style="color: #10b981; font-weight: 600; font-size: 0.75rem;">
                💾 Sauvegarde automatique active
              </div>
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-icon">📝</div>
              <div class="empty-title">Aucune note dans cette sélection</div>
              <div class="empty-desc">Créez votre première note illimitée en cliquant ci-dessous.</div>
              <button class="btn btn-primary" onclick="TasksModule.createNewNote()">➕ Créer une Note Illimitée</button>
            </div>
          `}
        </div>
      </div>
    `;

    setTimeout(() => {
      if (activeNote) {
        this.updateTextStats(activeNote.content || '');
        this.adjustTextareaHeight();
      }
    }, 50);
  },

  renderNotesCardsHtml(list) {
    if (!list || list.length === 0) {
      return `
        <div style="text-align: center; padding: 1.5rem; color: var(--gray-400); font-size: 0.85rem;">
          Aucun mémo trouvé.
        </div>
      `;
    }

    const catBadges = {
      memo: '📌',
      achats: '🛒',
      caisse: '💰',
      contacts: '📞',
      checklist: '☑️'
    };

    return list.map(n => {
      const isActive = n.id === this.activeNoteId;
      const snippet = (n.content || '').replace(/\n+/g, ' ').substring(0, 45);
      const emoji = catBadges[n.category] || '📝';

      return `
        <div class="note-card-item ${isActive ? 'active' : ''}" onclick="TasksModule.selectNote('${n.id}')">
          <div class="note-card-header-row">
            <div class="note-card-title">
              ${emoji} ${n.title || 'Note sans titre'}
            </div>
          </div>
          <div class="note-card-snippet">
            ${snippet || '<em style="color: var(--gray-400);">Note vide...</em>'}
          </div>
          <div class="note-card-meta">
            <span>${new Date(n.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>${(n.content || '').length} car.</span>
          </div>
        </div>
      `;
    }).join('');
  },

  searchNotes(q) {
    this.noteSearchQuery = q;
    const container = document.getElementById('notesListScrollContainer');
    if (container) {
      container.innerHTML = this.renderNotesCardsHtml(this.getFilteredNotes());
    }
  },

  filterNoteCategory(cat) {
    this.noteCategoryFilter = cat;
    this.renderCurrentTab();
  },

  selectNote(id) {
    this.activeNoteId = id;
    this.renderCurrentTab();
  },

  openNewNoteMenu() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 520px;">
        <div class="modal-header">
          <h3>➕ Créer un Nouveau Mémo (Illimité)</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1.25rem;">
            Choisissez un modèle prêt à l'emploi ou partez d'une note blanche. Vos notes sont 100% illimitées et sauvegardées en direct.
          </p>
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 0.85rem 1rem;" onclick="TasksModule.createNewNote('blank'); document.querySelector('.modal-backdrop.open')?.remove();">
              <div style="font-size: 1.2rem; margin-right: 0.75rem;">📝</div>
              <div>
                <strong style="display: block; color: var(--gray-900);">Note Vierge / Libre</strong>
                <span style="font-size: 0.78rem; color: var(--gray-500);">Page blanche pour écrire librement sans aucune restriction.</span>
              </div>
            </button>

            <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 0.85rem 1rem;" onclick="TasksModule.createNewNote('achats'); document.querySelector('.modal-backdrop.open')?.remove();">
              <div style="font-size: 1.2rem; margin-right: 0.75rem;">🛒</div>
              <div>
                <strong style="display: block; color: var(--gray-900);">Liste d'Achats & Réassorts Express</strong>
                <span style="font-size: 0.78rem; color: var(--gray-500);">Pour lister les courses, packs d'eau, glaçons, serviettes ou gobelets.</span>
              </div>
            </button>

            <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 0.85rem 1rem;" onclick="TasksModule.createNewNote('contacts'); document.querySelector('.modal-backdrop.open')?.remove();">
              <div style="font-size: 1.2rem; margin-right: 0.75rem;">📞</div>
              <div>
                <strong style="display: block; color: var(--gray-900);">Répertoire Urgences & Contacts Kermesse</strong>
                <span style="font-size: 0.78rem; color: var(--gray-500);">Numéros de la Direction, SAMU, Pompiers, Police et régie technique.</span>
              </div>
            </button>

            <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 0.85rem 1rem;" onclick="TasksModule.createNewNote('caisse'); document.querySelector('.modal-backdrop.open')?.remove();">
              <div style="font-size: 1.2rem; margin-right: 0.75rem;">💰</div>
              <div>
                <strong style="display: block; color: var(--gray-900);">Point de Caisse & Écarts Personnels</strong>
                <span style="font-size: 0.78rem; color: var(--gray-500);">Suivi du fond de caisse initial et des remises d'espèces intermédiaires.</span>
              </div>
            </button>

            <button class="btn btn-secondary" style="justify-content: flex-start; text-align: left; padding: 0.85rem 1rem;" onclick="TasksModule.createNewNote('checklist'); document.querySelector('.modal-backdrop.open')?.remove();">
              <div style="font-size: 1.2rem; margin-right: 0.75rem;">☑️</div>
              <div>
                <strong style="display: block; color: var(--gray-900);">Checklist Personnelle avec Cases à Cocher</strong>
                <span style="font-size: 0.78rem; color: var(--gray-500);">Pour vous fixer vos propres objectifs et étapes de la journée.</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  },

  createNewNote(templateType = 'blank') {
    const templates = {
      blank: {
        title: '📝 Note sans titre',
        category: 'memo',
        content: ''
      },
      achats: {
        title: '🛒 Liste d\'Achats & Réassorts Express',
        category: 'achats',
        content: `🛒 BESOINS & RÉASSORTS URGENTS (ACHATS RAPIDES) :\n[ ] 10 packs de bouteilles d'eau minérale 50cl\n[ ] Glaçons alimentaires pour rafraîchir les canettes\n[ ] 2 paquets de serviettes jetables & 300 gobelets\n[ ] Scotch renforcé d'électricien & 3 feutres noirs larges\n[ ] Rouleau de sacs poubelles 100L pour le nettoyage continu\n\n📍 Magasin le plus proche : Supermarché Express à 5 min à pied`
      },
      contacts: {
        title: '📞 Numéros Clés & Contacts d\'Urgence',
        category: 'contacts',
        content: `📞 RÉPERTOIRE KERMESSE & SECOURS :\n• 👑 Direction Générale (SuperAdmin) : Poste 1 (Tente Direction)\n• 🚑 SAMU / Urgences vitales : 15\n• 🚒 Pompiers : 18\n• 👮 Police Secours : 17\n• 🏥 Poste Médical & Défibrillateur (DAE) : Stand Accueil / Direction\n• ⚡ Électricien / Régie Sono : Stand Sono & Podium\n• 🍔 Responsable Restauration : Stand Buvette Centrale`
      },
      caisse: {
        title: '💰 Point de Caisse & Chiffres Personnels',
        category: 'caisse',
        content: `💰 POINT DE CAISSE PERSONNEL & ÉCARTS :\n• Fonds de caisse initial remis le matin : 25 000 FCFA\n• Responsable remise : Caissier en chef\n\n[ ] 12h00 - Premier comptage intermédiaire espèces : ... FCFA\n[ ] 14h30 - Remise sécurisée à la caisse centrale : ... FCFA\n[ ] 17h30 - Clôture définitive et remise au coffre : ... FCFA\n\nRemarques : Caisse scellée et signée.`
      },
      checklist: {
        title: '☑️ Ma Checklist Libre Personnelle',
        category: 'checklist',
        content: `☑️ MA CHECKLIST PERSONNELLE :\n[ ] Arriver à 08h00 pour le briefing général\n[ ] Prendre mon badge officiel et mon carnet\n[ ] Vérifier l'installation matérielle de mon stand\n[ ] Faire un test de la connexion 4G/Wifi\n[ ] Noter les consignes de sécurité transmises par la direction`
      }
    };

    const chosen = templates[templateType] || templates.blank;
    const newNote = {
      id: 'note-' + Date.now(),
      title: chosen.title,
      category: chosen.category,
      content: chosen.content,
      updated_at: new Date().toISOString()
    };

    this.notes.unshift(newNote);
    this.activeNoteId = newNote.id;
    this.saveNotes();
    this.renderCurrentTab();
    Notify.success('Nouvelle note créée.');

    setTimeout(() => {
      const input = document.getElementById('noteTitleInput');
      if (input) { input.focus(); input.select(); }
    }, 100);
  },

  autoSaveActiveNote() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;

    const titleInput = document.getElementById('noteTitleInput');
    const catSelect = document.getElementById('noteCategorySelect');
    const contentInput = document.getElementById('noteContentInput');
    const statusEl = document.getElementById('noteSaveStatus');

    if (titleInput) activeNote.title = titleInput.value.trim() || 'Note sans titre';
    if (catSelect) activeNote.category = catSelect.value;
    if (contentInput) activeNote.content = contentInput.value;
    activeNote.updated_at = new Date().toISOString();

    this.saveNotes();
    this.updateTextStats(activeNote.content || '');
    this.adjustTextareaHeight();

    if (statusEl) {
      statusEl.innerHTML = '💾 Enregistré à ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      statusEl.style.color = '#10b981';
    }

    // Mettre à jour l'intitulé dans la liste latérale sans tout réinitialiser
    const container = document.getElementById('notesListScrollContainer');
    if (container) {
      container.innerHTML = this.renderNotesCardsHtml(this.getFilteredNotes());
    }
  },

  changeActiveNoteCategory(val) {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (activeNote) {
      activeNote.category = val;
      this.autoSaveActiveNote();
      this.renderCurrentTab();
    }
  },

  insertNoteText(prefix, suffix = '') {
    const el = document.getElementById('noteContentInput');
    if (!el) return;

    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const oldVal = el.value;

    const insert = prefix + suffix;
    el.value = oldVal.substring(0, start) + prefix + oldVal.substring(start, end) + suffix + oldVal.substring(end);
    el.selectionStart = el.selectionEnd = start + prefix.length;
    el.focus();
    this.autoSaveActiveNote();
  },

  insertCurrentTime() {
    const timeStr = ` [${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}] `;
    this.insertNoteText(timeStr);
  },

  toggleFullscreenNote() {
    this.isFullscreen = !this.isFullscreen;
    const el = document.getElementById('notesEditorCol');
    if (el) {
      el.classList.toggle('fullscreen-mode', this.isFullscreen);
    }
    this.renderCurrentTab();
  },

  copyNoteText() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;

    const full = `${activeNote.title}\n\n${activeNote.content}`;
    navigator.clipboard.writeText(full).then(() => {
      Notify.success('Texte intégral copié dans le presse-papier !');
    }).catch(() => {
      Notify.info('Veuillez sélectionner le texte pour copier.');
    });
  },

  downloadNoteAsTxt() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;

    const filename = (activeNote.title || 'note').replace(/[^a-zA-Z0-9àéèçù_ -]/g, '').trim() + '.txt';
    const textContent = `${activeNote.title}\nDate: ${new Date(activeNote.updated_at || Date.now()).toLocaleString()}\n----------------------------------------\n\n${activeNote.content}`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
    Notify.success(`Fichier ${filename} téléchargé.`);
  },

  duplicateActiveNote() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;

    const clone = {
      id: 'note-' + Date.now(),
      title: `${activeNote.title} (Copie)`,
      category: activeNote.category || 'memo',
      content: activeNote.content || '',
      updated_at: new Date().toISOString()
    };

    this.notes.unshift(clone);
    this.activeNoteId = clone.id;
    this.saveNotes();
    this.renderCurrentTab();
    Notify.success('Note dupliquée avec succès.');
  },

  deleteNote(id) {
    Notify.confirm(
      'Supprimer cette note ?',
      'Confirmez-vous la suppression définitive de ce mémo personnel ?',
      () => {
        this.notes = this.notes.filter(n => n.id !== id);
        this.activeNoteId = this.notes.length > 0 ? this.notes[0].id : null;
        this.saveNotes();
        this.renderCurrentTab();
        Notify.info('Note supprimée.');
      },
      'Supprimer la note'
    );
  },

  shareNoteOnWhatsapp() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;
    const text = `📝 *${activeNote.title}*\n\n${activeNote.content}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  },

  updateTextStats(text) {
    const words = text && text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text ? text.length : 0;
    const lines = text ? text.split('\n').length : 0;

    const elWords = document.getElementById('noteWordsCount');
    const elChars = document.getElementById('noteCharsCount');
    const elLines = document.getElementById('noteLinesCount');

    if (elWords) elWords.textContent = `${words} mot(s)`;
    if (elChars) elChars.textContent = `${chars} caractère(s)`;
    if (elLines) elLines.textContent = `${lines} ligne(s)`;
  },

  adjustTextareaHeight() {
    const el = document.getElementById('noteContentInput');
    if (!el) return;
    el.style.height = 'auto';
    const nextH = Math.max(380, el.scrollHeight + 15);
    el.style.height = nextH + 'px';
  },

  // 3. MODÈLES DE CHECKLISTS
  renderTemplatesTab(container) {
    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.5rem;">
        <div>
          📋 <strong>Kits de Checklists Recommandés :</strong> Cliquez sur <strong>« Injecter dans la To-Do d'Équipe »</strong> pour charger instantanément les tâches incontournables de la kermesse avec attribution automatique !
        </div>
      </div>

      <div class="templates-grid">
        <!-- Kit 1 : Matin -->
        <div class="card" style="border-left: 6px solid #2563eb;">
          <div class="card-body">
            <h4 style="color: #1e40af; margin-bottom: 0.5rem;">🌅 1. Kit Matin (Montage & Ouverture)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">Indispensable dès 08h00 pour ouvrir les stands à l'heure.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Vérifier l'électricité et tester la sonorisation</li>
              <li>Poser les affiches et panneaux numérotés des stands</li>
              <li>Distribuer les fonds de caisse aux caissiers</li>
              <li>Pointer les présences des bénévoles à 9h15</li>
              <li>Tester le défibrillateur (DAE) et la trousse secours</li>
            </ul>
            <button class="btn btn-primary btn-sm" onclick="TasksModule.injectTemplate('morning')" style="width: 100%;">
              📥 Injecter le Kit Matin dans notre To-Do
            </button>
          </div>
        </div>

        <!-- Kit 2 : Journée -->
        <div class="card" style="border-left: 6px solid #10b981;">
          <div class="card-body">
            <h4 style="color: #065f46; margin-bottom: 0.5rem;">☀️ 2. Kit Jour J (Exploitation en Pleine Action)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">À checker en continu entre 11h et 16h.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Vérifier les stocks de denrées & buvette à midi</li>
              <li>Organiser la rotation et le repas des bénévoles</li>
              <li>Effectuer la première ronde sanitaire & vidage poubelles</li>
              <li>Faire un premier point caisse et ramassage espèces</li>
              <li>Vérifier les réserves de lots des stands les plus fréquentés</li>
            </ul>
            <button class="btn btn-success btn-sm" onclick="TasksModule.injectTemplate('day')" style="width: 100%;">
              📥 Injecter le Kit Jour J dans notre To-Do
            </button>
          </div>
        </div>

        <!-- Kit 3 : Soir -->
        <div class="card" style="border-left: 6px solid #f59e0b;">
          <div class="card-body">
            <h4 style="color: #92400e; margin-bottom: 0.5rem;">🌙 3. Kit Soir (Clôture & Démontage)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">Pour clôturer proprement sans perte de matériel.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Fermer les caisses et compter les écarts théorique/réel</li>
              <li>Rapatrier tous les lots restants au stock central</li>
              <li>Démonter et plier les barnums et tables</li>
              <li>Vérifier et rendre le matériel prêté (sono, câbles...)</li>
              <li>Nettoyage final complet du site et évacuation des déchets</li>
            </ul>
            <button class="btn btn-secondary btn-sm" onclick="TasksModule.injectTemplate('evening')" style="width: 100%;">
              📥 Injecter le Kit Soir dans notre To-Do
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openTemplatesModal() {
    this.switchTab('templates');
  },

  async injectTemplate(type) {
    const user = Auth.getCurrentUser();
    const isSuperAdmin = user && (user.is_original_superadmin || user.role_code === 'superadmin');
    const targetPole = isSuperAdmin ? (this.selectedPoleFilter || 'all') : (user?.role_code || 'all');
    const creatorName = user?.full_name || user?.login || 'Admin';
    const creatorRole = isSuperAdmin ? 'SuperAdministrateur' : (user?.role_name || 'Admin');

    const kits = {
      morning: [
        { text: 'Tester l\'électricité et le micro de la sono', priority: 'urgente', due_time: '08h30' },
        { text: 'Installer les panneaux numérotés et couleurs de stands', priority: 'normale', due_time: '09h00' },
        { text: 'Distribuer les fonds de caisse scellés', priority: 'urgente', due_time: '09h30' },
        { text: 'Briefing bénévoles et contrôle des présences', priority: 'urgente', due_time: '09h45' },
        { text: 'Vérifier trousse de secours et accès DAE', priority: 'normale', due_time: '09h55' }
      ],
      day: [
        { text: 'Contrôle stocks buvette & denrées fraîches', priority: 'normale', due_time: '12h00' },
        { text: 'Organiser les pauses repas des bénévoles par stand', priority: 'urgente', due_time: '12h30' },
        { text: 'Ronde propreté sanitaire et réappro savon/papier', priority: 'normale', due_time: '13h30' },
        { text: 'Réapprovisionner les stands qui manquent de lots', priority: 'urgente', due_time: '14h30' },
        { text: 'Annoncer au micro le tirage de la tombola', priority: 'normale', due_time: '16h00' }
      ],
      evening: [
        { text: 'Clôturer les caisses et valider les écarts', priority: 'urgente', due_time: '17h30' },
        { text: 'Rapatrier les lots non distribués au stock central', priority: 'normale', due_time: '18h00' },
        { text: 'Démontage barnums, pliage des chaises et tables', priority: 'normale', due_time: '18h30' },
        { text: 'Contrôler la chaîne de prêt et restituer le matériel', priority: 'urgente', due_time: '19h00' },
        { text: 'Ronde finale propreté du site et évacuation poubelles', priority: 'normale', due_time: '19h30' }
      ]
    };

    const items = kits[type] || [];
    const client = SupabaseClient.client;
    const toInsert = items.map(it => ({
      pole_code: targetPole,
      title: it.text,
      priority: it.priority,
      due_time: it.due_time,
      is_completed: false,
      created_by_name: creatorName,
      created_by_role: creatorRole
    }));

    if (client && navigator.onLine) {
      try {
        await client.from('pole_tasks').insert(toInsert);
        Notify.success(`${items.length} tâches injectées et partagées avec l'équipe !`);
        await this.loadData(true);
        this.switchTab('tasks');
        return;
      } catch (e) {
        console.warn('[TasksModule] Exception injection Supabase:', e);
      }
    }

    toInsert.forEach(it => {
      this.tasks.push({ ...it, id: 'local-' + Math.random().toString(36).substr(2, 9), created_at: new Date().toISOString() });
    });

    localStorage.setItem('lc_cached_pole_tasks', JSON.stringify(this.tasks));
    Notify.success(`${items.length} tâches injectées dans votre liste d'équipe !`);
    this.switchTab('tasks');
  },

  startPolling() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);

    // Rafraîchissement automatique discret toutes les 8 secondes pour synchroniser les coches des collègues
    this.pollingInterval = setInterval(() => {
      if (typeof App !== 'undefined' && App.currentModule === 'tasks') {
        this.loadData(true);
      }
    }, 8000);
  }
};

window.TasksModule = TasksModule;
