/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : MES TÂCHES & BLOC-NOTES (TO-DO & MÉMOS PERSONNELS)
 * 
 * Permet à chaque administrateur d'avoir son carnet de bord tout-en-un :
 * - Liste de tâches personnalisées avec cases à cocher et barre de progression
 * - Bloc-notes libre avec sauvegarde automatique instantanée
 * - Checklists types kermesse prêtes à l'emploi (Matin, Journée, Clôture)
 */

const TasksModule = {
  currentTab: 'tasks', // 'tasks', 'notes', 'templates'
  activeNoteId: null,

  tasks: [],
  notes: [],

  getUserKey(suffix) {
    const user = Auth.getCurrentUser();
    const login = user ? (user.login || 'user').toLowerCase() : 'default';
    return `lc_${suffix}_${login}`;
  },

  async render(container) {
    const user = Auth.getCurrentUser();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📝</span> Mes Tâches &amp; Bloc-Notes Personnel
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
          <!-- Jauge de Progression Dynamique -->
          <div id="tasksProgressCard" style="background: var(--gray-50, #f8fafc); border: 1px solid var(--gray-200); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
              <span style="font-weight: 700; color: var(--gray-800); font-size: 0.95rem;">
                Progression de mes tâches : <span id="tasksPercentText">0%</span>
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
              ✅ Ma To-Do List (<span id="tabTasksCount">0</span>)
            </button>
            <button class="tab-btn" id="tabTasksNotes" onclick="TasksModule.switchTab('notes')">
              📒 Mon Bloc-Notes Libre (<span id="tabNotesCount">0</span>)
            </button>
            <button class="tab-btn" id="tabTasksTemplates" onclick="TasksModule.switchTab('templates')">
              📋 Modèles de Checklists Kermesse
            </button>
          </div>

          <!-- Conteneur Dynamique -->
          <div id="tasksTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement de vos notes...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
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

  async loadData() {
    const taskKey = this.getUserKey('tasks');
    const noteKey = this.getUserKey('notes');

    // Charger les tâches
    const savedTasks = localStorage.getItem(taskKey);
    if (savedTasks) {
      try { this.tasks = JSON.parse(savedTasks); } catch (e) { this.tasks = []; }
    } else {
      // Exemples initiaux pour guider l'admin
      this.tasks = [
        { id: 'tsk-1', text: 'Vérifier la caisse et le fond initial avec le caissier', is_done: false, priority: 'urgent', due_time: '09h30', created_at: new Date().toISOString() },
        { id: 'tsk-2', text: 'Faire le tour des 10 zones pour s\'assurer de la signalétique', is_done: true, priority: 'normal', due_time: '10h00', created_at: new Date().toISOString() },
        { id: 'tsk-3', text: 'Vérifier la disponibilité de la trousse de secours et DAE', is_done: false, priority: 'urgent', due_time: '10h15', created_at: new Date().toISOString() }
      ];
      this.saveTasks();
    }

    // Charger les notes
    const savedNotes = localStorage.getItem(noteKey);
    if (savedNotes) {
      try { this.notes = JSON.parse(savedNotes); } catch (e) { this.notes = []; }
    } else {
      this.notes = [
        {
          id: 'note-1',
          title: '📌 Contacts & Urgences Kermesse',
          content: "• Référent Sono : 77 123 45 67\n• Référent Électricité / Groupe : 77 987 65 43\n• Code cadenas réserve stockage : 4826\n• Heure briefing bénévoles : 09h15 précises",
          updated_at: new Date().toISOString()
        }
      ];
      this.saveNotes();
    }

    if (this.notes.length > 0 && !this.activeNoteId) {
      this.activeNoteId = this.notes[0].id;
    }

    this.updateProgress();
    this.renderCurrentTab();
  },

  saveTasks() {
    localStorage.setItem(this.getUserKey('tasks'), JSON.stringify(this.tasks));
    this.updateProgress();
  },

  saveNotes() {
    localStorage.setItem(this.getUserKey('notes'), JSON.stringify(this.notes));
    const el = document.getElementById('tabNotesCount');
    if (el) el.textContent = this.notes.length;
  },

  updateProgress() {
    const total = this.tasks.length;
    const done = this.tasks.filter(t => t.is_done).length;
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

  // 1. ONGLET TO-DO LIST
  renderTasksTab(container) {
    container.innerHTML = `
      <!-- Formulaire d'ajout rapide (1 frappe + Entrée) -->
      <div class="tasks-quick-add-bar">
        <input type="text" id="newTaskInput" class="form-control tasks-quick-input" placeholder="Ajouter une tâche rapide (ex: Rappeler Fatima, Recharger jetons...)" onkeydown="if(event.key==='Enter') TasksModule.quickAddTask()">
        <div class="tasks-quick-options">
          <select id="newTaskPriority" class="form-control tasks-priority-select">
            <option value="normal">🟡 Normal</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="low">🟢 Basse</option>
          </select>
          <input type="text" id="newTaskDue" class="form-control tasks-due-input" placeholder="Heure (ex: 11h)">
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
      <div id="tasksListContainer" style="display: flex; flex-direction: column; gap: 0.5rem;">
        ${this.generateTasksHtml(this.tasks)}
      </div>
    `;
  },

  generateTasksHtml(list) {
    if (!list || list.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🎉</div>
          <div class="empty-title">Aucune tâche en attente !</div>
          <div class="empty-desc">Ajoutez une tâche ci-dessus ou chargez une checklist type de kermesse.</div>
        </div>
      `;
    }

    const prioLabels = {
      'urgent': '<span class="badge badge-danger" style="font-size: 0.75rem;">🔴 Urgent</span>',
      'normal': '<span class="badge badge-warning" style="font-size: 0.75rem;">🟡 Normal</span>',
      'low': '<span class="badge badge-gray" style="font-size: 0.75rem;">🟢 Basse</span>'
    };

    return list.map(t => `
      <div class="card task-item-row" style="margin: 0; padding: 0.75rem 1rem; border: 1px solid var(--gray-200); border-radius: 8px; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; background: ${t.is_done ? '#f8fafc' : '#fff'}; opacity: ${t.is_done ? '0.7' : '1'};">
        <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
          <input type="checkbox" style="width: 20px; height: 20px; cursor: pointer;" ${t.is_done ? 'checked' : ''} onchange="TasksModule.toggleTask('${t.id}')">
          <div style="flex: 1;">
            <span style="font-size: 0.95rem; font-weight: ${t.is_done ? 'normal' : '600'}; color: ${t.is_done ? 'var(--gray-500)' : 'var(--gray-900)'}; text-decoration: ${t.is_done ? 'line-through' : 'none'};">
              ${t.text}
            </span>
            ${t.due_time ? `<span style="font-size: 0.78rem; color: #dc2626; margin-left: 0.5rem; font-weight: 700;">⏰ ${t.due_time}</span>` : ''}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          ${prioLabels[t.priority] || ''}
          <button class="btn-icon danger" onclick="TasksModule.deleteTask('${t.id}')" title="Supprimer">✕</button>
        </div>
      </div>
    `).join('');
  },

  quickAddTask() {
    const input = document.getElementById('newTaskInput');
    if (!input) return;
    const text = input.value.trim();
    const priority = document.getElementById('newTaskPriority')?.value || 'normal';
    const dueTime = document.getElementById('newTaskDue')?.value.trim();

    if (!text) {
      Notify.warning('Écrivez l\'intitulé de la tâche.');
      return;
    }

    const newTask = {
      id: 'tsk-' + Date.now(),
      text,
      is_done: false,
      priority,
      due_time: dueTime || null,
      created_at: new Date().toISOString()
    };

    this.tasks.unshift(newTask);
    this.saveTasks();
    input.value = '';
    input.focus();

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.tasks);
    Notify.success('Tâche ajoutée.');
  },

  focusAddTask() {
    this.switchTab('tasks');
    setTimeout(() => {
      const input = document.getElementById('newTaskInput');
      if (input) input.focus();
    }, 100);
  },

  toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return;
    task.is_done = !task.is_done;
    this.saveTasks();

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.tasks);

    if (task.is_done) {
      Notify.success('Tâche terminée ! Bravo ✅');
    }
  },

  deleteTask(id) {
    this.tasks = this.tasks.filter(t => t.id !== id);
    this.saveTasks();
    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.tasks);
  },

  clearDoneTasks() {
    const count = this.tasks.filter(t => t.is_done).length;
    if (count === 0) {
      Notify.info('Aucune tâche terminée à nettoyer.');
      return;
    }
    this.tasks = this.tasks.filter(t => !t.is_done);
    this.saveTasks();
    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(this.tasks);
    Notify.info(`${count} tâche(s) archivée(s).`);
  },

  filterTasks(filter) {
    document.querySelectorAll('#tasksTabContent .filters-group button, #tasksTabContent div button').forEach(b => {
      if (b.id && b.id.startsWith('filter')) b.classList.remove('active');
    });
    const activeBtn = document.getElementById(
      filter === 'all' ? 'filterAll' : (filter === 'pending' ? 'filterPending' : (filter === 'urgent' ? 'filterUrgent' : 'filterDone'))
    );
    if (activeBtn) activeBtn.classList.add('active');

    let filtered = this.tasks;
    if (filter === 'pending') filtered = this.tasks.filter(t => !t.is_done);
    if (filter === 'urgent') filtered = this.tasks.filter(t => t.priority === 'urgent' && !t.is_done);
    if (filter === 'done') filtered = this.tasks.filter(t => t.is_done);

    const container = document.getElementById('tasksListContainer');
    if (container) container.innerHTML = this.generateTasksHtml(filtered);
  },

  // 2. ONGLET BLOC-NOTES LIBRE (AUTO-SAVE)
  renderNotesTab(container) {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId) || this.notes[0];

    container.innerHTML = `
      <div class="notes-workspace-grid">
        <!-- Liste latérale / sélecteur mobile des notes -->
        <div class="notes-sidebar-col">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="font-weight: 700; font-size: 0.85rem; color: var(--gray-700);">Mes Mémos (${this.notes.length})</span>
            <button class="btn btn-sm btn-primary" onclick="TasksModule.createNewNote()" title="Nouvelle note">➕ Note</button>
          </div>
          <div class="notes-list-scroll">
            ${this.notes.map(n => `
              <div class="note-card-item ${n.id === this.activeNoteId ? 'active' : ''}" onclick="TasksModule.selectNote('${n.id}')">
                <div class="note-card-title">
                  ${n.title || 'Note sans titre'}
                </div>
                <div class="note-card-time">
                  ${new Date(n.updated_at || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Éditeur de la note active avec auto-save -->
        <div class="notes-editor-col">
          ${activeNote ? `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <input type="text" id="noteTitleInput" class="form-control" style="font-weight: 700; font-size: 1.1rem; flex: 1; margin-right: 0.5rem;" value="${activeNote.title || ''}" placeholder="Titre de la note..." oninput="TasksModule.autoSaveActiveNote()">
              <div style="display: flex; gap: 0.35rem;">
                <button class="btn btn-sm btn-secondary" onclick="TasksModule.shareNoteOnWhatsapp()" title="Partager sur WhatsApp">
                  💬 WhatsApp
                </button>
                <button class="btn btn-sm btn-danger" onclick="TasksModule.deleteNote('${activeNote.id}')" title="Supprimer la note">
                  🗑️
                </button>
              </div>
            </div>
            <textarea id="noteContentInput" class="form-control" rows="12" style="font-family: inherit; font-size: 0.92rem; line-height: 1.6; resize: vertical;" placeholder="Écrivez vos notes, idées, numéros, consignes ici... Sauvegarde automatique en direct !" oninput="TasksModule.autoSaveActiveNote()">${activeNote.content || ''}</textarea>
            <div id="noteSaveStatus" style="font-size: 0.75rem; color: #10b981; margin-top: 0.35rem; font-style: italic;">
              💾 Enregistré automatiquement
            </div>
          ` : `
            <div class="empty-state">
              <div class="empty-title">Aucune note</div>
              <button class="btn btn-primary" onclick="TasksModule.createNewNote()">Créer une note</button>
            </div>
          `}
        </div>
      </div>
    `;
  },

  selectNote(id) {
    this.activeNoteId = id;
    this.renderCurrentTab();
  },

  createNewNote() {
    const newNote = {
      id: 'note-' + Date.now(),
      title: '📝 Nouvelle note',
      content: '',
      updated_at: new Date().toISOString()
    };
    this.notes.unshift(newNote);
    this.activeNoteId = newNote.id;
    this.saveNotes();
    this.renderCurrentTab();
    setTimeout(() => {
      const input = document.getElementById('noteTitleInput');
      if (input) { input.focus(); input.select(); }
    }, 100);
  },

  autoSaveActiveNote() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;

    const titleInput = document.getElementById('noteTitleInput');
    const contentInput = document.getElementById('noteContentInput');
    const statusEl = document.getElementById('noteSaveStatus');

    if (titleInput) activeNote.title = titleInput.value.trim() || 'Note sans titre';
    if (contentInput) activeNote.content = contentInput.value;
    activeNote.updated_at = new Date().toISOString();

    this.saveNotes();

    if (statusEl) {
      statusEl.textContent = '💾 Enregistré à ' + new Date().toLocaleTimeString();
      statusEl.style.color = '#10b981';
    }
  },

  deleteNote(id) {
    if (!confirm('Supprimer cette note ?')) return;
    this.notes = this.notes.filter(n => n.id !== id);
    this.activeNoteId = this.notes.length > 0 ? this.notes[0].id : null;
    this.saveNotes();
    this.renderCurrentTab();
    Notify.info('Note supprimée.');
  },

  shareNoteOnWhatsapp() {
    const activeNote = this.notes.find(n => n.id === this.activeNoteId);
    if (!activeNote) return;
    const text = `📝 *${activeNote.title}*\n\n${activeNote.content}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`, '_blank');
  },

  // 3. ONGLET MODÈLES DE CHECKLISTS KERMESSE PRÊTES À L'EMPLOI
  renderTemplatesTab(container) {
    container.innerHTML = `
      <div class="alert-banner info" style="margin-bottom: 1.5rem;">
        <div>
          📋 <strong>Kits de Checklists Recommandés :</strong> Cliquez sur <strong>« Injecter dans ma To-Do »</strong> pour charger instantanément les tâches incontournables de la journée sans rien oublier !
        </div>
      </div>

      <div class="templates-grid">
        <!-- Kit 1 : Matin / Montage -->
        <div class="card" style="border-left: 6px solid #2563eb;">
          <div class="card-body">
            <h4 style="color: #1e40af; margin-bottom: 0.5rem;">🌅 1. Kit Matin (Montage & Installation)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">Indispensable dès 08h00 pour ouvrir à l'heure.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Vérifier l'électricité et tester la sonorisation</li>
              <li>Poser les affiches et panneaux numérotés des stands</li>
              <li>Distribuer les fonds de caisse aux caissiers</li>
              <li>Pointer les présences des bénévoles à 9h15</li>
              <li>Tester le défibrillateur (DAE) et la trousse secours</li>
            </ul>
            <button class="btn btn-primary btn-sm" onclick="TasksModule.injectTemplate('morning')" style="width: 100%;">
              📥 Injecter le Kit Matin dans ma To-Do
            </button>
          </div>
        </div>

        <!-- Kit 2 : Journée / Exploitation -->
        <div class="card" style="border-left: 6px solid #10b981;">
          <div class="card-body">
            <h4 style="color: #065f46; margin-bottom: 0.5rem;">☀️ 2. Kit Jour J (En Pleine Action)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">À checker en continu entre 11h et 16h.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Vérifier les stocks de denrées & buvette à midi</li>
              <li>Organiser la rotation et le repas des bénévoles</li>
              <li>Effectuer la première ronde sanitaire & poubelles</li>
              <li>Faire un premier point caisse et ramassage espèces</li>
              <li>Vérifier que les stands ont assez de lots de secours</li>
            </ul>
            <button class="btn btn-success btn-sm" onclick="TasksModule.injectTemplate('day')" style="width: 100%;">
              📥 Injecter le Kit Jour J dans ma To-Do
            </button>
          </div>
        </div>

        <!-- Kit 3 : Soir / Clôture & Démontage -->
        <div class="card" style="border-left: 6px solid #f59e0b;">
          <div class="card-body">
            <h4 style="color: #92400e; margin-bottom: 0.5rem;">🌙 3. Kit Soir (Clôture & Démontage)</h4>
            <p style="font-size: 0.8rem; color: var(--gray-600); margin-bottom: 0.75rem;">Pour clôturer proprement sans perte de matériel.</p>
            <ul style="font-size: 0.82rem; color: var(--gray-700); padding-left: 1.25rem; line-height: 1.5; margin-bottom: 1rem;">
              <li>Fermer les caisses et compter les écarts théorique/réel</li>
              <li>Rapatrier tous les lots restants au stock central</li>
              <li>Démonter et plier les barnums et tables</li>
              <li>Vérifier et rendre le matériel prêté (sono, câbles...)</li>
              <li>Nettoyage final complet de la cour / site</li>
            </ul>
            <button class="btn btn-secondary btn-sm" onclick="TasksModule.injectTemplate('evening')" style="width: 100%;">
              📥 Injecter le Kit Soir dans ma To-Do
            </button>
          </div>
        </div>
      </div>
    `;
  },

  openTemplatesModal() {
    this.switchTab('templates');
  },

  injectTemplate(type) {
    const kits = {
      morning: [
        { text: 'Vérifier l\'électricité et tester la sono', priority: 'urgent', due_time: '08h30' },
        { text: 'Installer les barnums et panneaux de stands numérotés', priority: 'normal', due_time: '09h00' },
        { text: 'Distribuer les fonds de caisse initiaux', priority: 'urgent', due_time: '09h30' },
        { text: 'Briefing bénévoles et pointage des présences', priority: 'urgent', due_time: '09h45' },
        { text: 'Vérifier trousse de premiers secours et DAE', priority: 'normal', due_time: '09h55' }
      ],
      day: [
        { text: 'Point stock denrées buvette & réapprovisionnement', priority: 'normal', due_time: '12h00' },
        { text: 'Organiser la relève pour le repas des bénévoles', priority: 'urgent', due_time: '12h30' },
        { text: 'Vérification propreté sanitaires et vidage poubelles', priority: 'normal', due_time: '13h30' },
        { text: 'Contrôler les réserves de lots des stands les plus actifs', priority: 'urgent', due_time: '14h30' },
        { text: 'Annoncer au micro le tirage de la tombola', priority: 'normal', due_time: '16h00' }
      ],
      evening: [
        { text: 'Clôturer les caisses et valider les écarts', priority: 'urgent', due_time: '17h30' },
        { text: 'Rapatrier les lots invendus au stock central', priority: 'normal', due_time: '18h00' },
        { text: 'Démontage barnums, tables et pliage des chaises', priority: 'normal', due_time: '18h30' },
        { text: 'Contrôle et restitution du matériel lourd prêté', priority: 'urgent', due_time: '19h00' },
        { text: 'Nettoyage complet du site et évacuation des poubelles', priority: 'normal', due_time: '19h30' }
      ]
    };

    const items = kits[type] || [];
    items.forEach(it => {
      this.tasks.push({
        id: 'tsk-' + Math.random().toString(36).substr(2, 9),
        text: it.text,
        is_done: false,
        priority: it.priority,
        due_time: it.due_time,
        created_at: new Date().toISOString()
      });
    });

    this.saveTasks();
    Notify.success(`${items.length} tâches injectées dans votre To-Do list !`);
    this.switchTab('tasks');
  }
};

window.TasksModule = TasksModule;
