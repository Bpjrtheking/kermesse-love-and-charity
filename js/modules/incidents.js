/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : INCIDENTS (TRAÇABILITÉ & RÉSOLUTION EN TEMPS RÉEL)
 * 
 * Types d'incidents :
 * - Disparition d'argent
 * - Disparition de nourriture
 * - Disparition de matériel
 * - Ticket suspect
 * - Problème de caisse
 * - Écart de stock
 * - Enfant non surveillé
 * - Matériel endommagé
 * - Problème avec un parent
 * - Autre
 */

const IncidentsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🚨</span> Registre des Incidents & Anomalies
          </div>
          <div class="card-actions">
            <button class="btn btn-danger btn-sm" onclick="IncidentsModule.openReportModal()">
              <span>⚠️</span> Déclarer un Incident
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="incSearch" placeholder="Rechercher par numéro, titre ou auteur..." oninput="IncidentsModule.filterTable()">
            </div>
            <div class="filters-group">
              <select id="incStatusFilter" class="filter-select" onchange="IncidentsModule.filterTable()">
                <option value="">Tous statuts</option>
                <option value="ouvert">Ouvert (À traiter)</option>
                <option value="en_cours">En cours de résolution</option>
                <option value="resolu">Résolu / Clôturé</option>
              </select>
            </div>
          </div>

          <div class="table-responsive" id="incidentsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🚨</div>
              <div class="empty-title">Aucun incident signalé</div>
              <div class="empty-desc">Tout incident (disparition d'argent, enfant non surveillé, ticket suspect, casse de matériel) doit être consigné ici immédiatement pour être résolu.</div>
              <button class="btn btn-danger" onclick="IncidentsModule.openReportModal()">
                <span>⚠️</span> Signaler un incident
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (!client) return;

    try {
      const { data: incidents, error } = await client
        .from('incidents')
        .select(`
          id, incident_number, type, title, description, severity, status, persons_involved, resolution_notes, created_at,
          reporter:app_users!incidents_reported_by_fkey(login, full_name),
          location:locations(name),
          stand:stands(name),
          assigned:members(first_name, last_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.renderTable(incidents || []);
    } catch (e) {
      console.error('[IncidentsModule Error]', e);
    }
  },

  renderTable(incidents) {
    const container = document.getElementById('incidentsTableContainer');
    if (!container) return;

    if (!incidents || incidents.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚨</div>
          <div class="empty-title">Aucun incident signalé</div>
          <div class="empty-desc">Tout incident (disparition d'argent, enfant non surveillé, ticket suspect, casse de matériel) doit être consigné ici immédiatement pour être résolu.</div>
          <button class="btn btn-danger" onclick="IncidentsModule.openReportModal()">
            <span>⚠️</span> Signaler un incident
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>N° Incident</th>
            <th>Type & Titre</th>
            <th>Lieu / Stand</th>
            <th>Gravité</th>
            <th>Signalé Par</th>
            <th>Statut</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="incidentsTableBody">
          ${incidents.map(i => {
            let sevBadge = '<span class="badge badge-gray">Faible</span>';
            if (i.severity === 'moyen') sevBadge = '<span class="badge badge-warning">Moyen</span>';
            if (i.severity === 'eleve' || i.severity === 'critique') sevBadge = '<span class="badge badge-danger">Critique</span>';

            let statBadge = '<span class="badge badge-danger">Ouvert</span>';
            if (i.status === 'en_cours') statBadge = '<span class="badge badge-warning">En cours</span>';
            if (i.status === 'resolu') statBadge = '<span class="badge badge-success">Résolu</span>';

            return `
              <tr data-num="${i.incident_number}" data-title="${i.title}" data-status="${i.status}">
                <td><code>${i.incident_number}</code></td>
                <td>
                  <strong>${i.title}</strong>
                  <div style="font-size: 0.8rem; color: var(--gray-600);">${i.description}</div>
                  ${i.resolution_notes ? `<div style="font-size: 0.75rem; color: var(--success); margin-top: 2px;">💡 Résolution : ${i.resolution_notes}</div>` : ''}
                </td>
                <td>${i.stand ? i.stand.name : (i.location ? i.location.name : '-')}</td>
                <td>${sevBadge}</td>
                <td><strong>${i.reporter ? (i.reporter.full_name || i.reporter.login) : 'Anonyme'}</strong></td>
                <td>${statBadge}</td>
                <td style="text-align: right;">
                  ${i.status !== 'resolu' ? `
                    <button class="btn btn-success btn-sm" onclick="IncidentsModule.openResolveModal('${i.id}', '${i.incident_number}')">Résoudre</button>
                  ` : '<span style="color: var(--success); font-weight: 600; font-size: 0.85rem;">Clôturé</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('incSearch').value || '').toLowerCase();
    const st = document.getElementById('incStatusFilter').value;
    const rows = document.querySelectorAll('#incidentsTableBody tr');

    rows.forEach(r => {
      const num = (r.dataset.num || '').toLowerCase();
      const title = (r.dataset.title || '').toLowerCase();
      const status = r.dataset.status || '';

      const matchText = num.includes(q) || title.includes(q);
      const matchStatus = !st || status === st;

      r.style.display = matchText && matchStatus ? '' : 'none';
    });
  },

  async openReportModal() {
    const client = SupabaseClient.client;
    let stands = [];
    let locations = [];

    if (client) {
      const { data: s } = await client.from('stands').select('id, name');
      const { data: l } = await client.from('locations').select('id, name');
      stands = s || [];
      locations = l || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Signaler un Incident</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="reportIncForm">
            <div class="form-row">
              <div class="form-group">
                <label>Type d'incident *</label>
                <select id="incType" class="form-control" required>
                  <option value="disparition_argent">💰 Disparition d'argent</option>
                  <option value="disparition_nourriture">🍔 Disparition de nourriture</option>
                  <option value="disparition_materiel">📦 Disparition de matériel</option>
                  <option value="ticket_suspect">🎟️ Ticket suspect ou contrefait</option>
                  <option value="probleme_caisse">💵 Problème de caisse / Écart</option>
                  <option value="enfant_non_surveille">👶 Enfant égaré / Non surveillé</option>
                  <option value="materiel_endommage">🔨 Matériel endommagé / Cassé</option>
                  <option value="probleme_parent">🗣️ Litige avec un parent / participant</option>
                  <option value="autre">⚠️ Autre problème</option>
                </select>
              </div>
              <div class="form-group">
                <label>Niveau de Gravité *</label>
                <select id="incSeverity" class="form-control" required>
                  <option value="faible">Faible (mineur)</option>
                  <option value="moyen" selected>Moyen</option>
                  <option value="eleve">Élevé (urgent)</option>
                  <option value="critique">Critique (alerte immédiate)</option>
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Titre résumé *</label>
              <input type="text" id="incTitle" class="form-control" required placeholder="Ex: Manque 5 bouteilles au Stand Bleu, Enfant cherchant sa mère...">
            </div>

            <div class="form-group">
              <label>Description précise des faits *</label>
              <textarea id="incDesc" class="form-control" rows="3" required placeholder="Que s'est-il passé ? Quand ? Qui a été prévenu ?"></textarea>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand Concerné</label>
                <select id="incStand" class="form-control">
                  <option value="">Aucun stand spécifique</option>
                  ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Lieu physique</label>
                <select id="incLoc" class="form-control">
                  <option value="">Sélectionner un lieu...</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Personnes concernées / Témoins</label>
              <input type="text" id="incPersons" class="form-control" placeholder="Bénévoles ou participants présents">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-danger" id="saveIncBtn">Enregistrer l'incident</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveIncBtn').onclick = async () => {
      const type = document.getElementById('incType').value;
      const severity = document.getElementById('incSeverity').value;
      const title = document.getElementById('incTitle').value.trim();
      const desc = document.getElementById('incDesc').value.trim();
      const standId = document.getElementById('incStand').value || null;
      const locId = document.getElementById('incLoc').value || null;
      const persons = document.getElementById('incPersons').value.trim();
      const user = Auth.getCurrentUser();

      if (!title || !desc) {
        Notify.error('Veuillez remplir le titre et la description.');
        return;
      }

      const num = 'INC-' + Math.floor(1000 + Math.random() * 9000);

      if (client) {
        const { error } = await client.from('incidents').insert([{
          incident_number: num,
          type,
          title,
          description: desc,
          severity,
          stand_id: standId,
          location_id: locId,
          persons_involved: persons,
          reported_by: user ? user.id : null,
          status: 'ouvert'
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('DECLARATION_INCIDENT', 'incident', null, `Déclaration de l'incident ${num} (${title}) par ${user?.full_name || user?.login}`);
        Notify.success(`Incident ${num} consigné au registre.`);
        close();
        IncidentsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  openResolveModal(incId, incNum) {
    const notes = prompt(`Indiquez les mesures prises pour résoudre l'incident ${incNum} :`);
    if (!notes) return;

    Notify.confirm(
      'Clôturer l\'incident ?',
      `Confirmez-vous la résolution de l'incident ${incNum} avec la note : "${notes}" ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const user = Auth.getCurrentUser();
          const resolverName = user?.full_name || user?.login || 'Administrateur';
          await client.from('incidents').update({
            status: 'resolu',
            resolution_notes: `${notes} (Résolu par ${resolverName})`,
            resolved_at: new Date().toISOString()
          }).eq('id', incId);

          AuditLogger.log('RESOLUTION_INCIDENT', 'incident', incId, `Résolution de l'incident ${incNum} par ${resolverName}: ${notes}`);
          Notify.success(`Incident ${incNum} marqué comme résolu.`);
          IncidentsModule.render(document.getElementById('mainContent'));
        }
      },
      'Résoudre l\'incident'
    );
  }
};

window.IncidentsModule = IncidentsModule;
