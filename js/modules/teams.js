/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : ÉQUIPES (IDENTIFICATION VISUELLE PAR COULEURS)
 * 
 * Permet de structurer l'organisation avec des codes couleurs configurables :
 * Noir (Organisation), Blanc (Trésorerie), Bleu, Rouge, Vert, etc.
 */

const TeamsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🏷️</span> Organisation des Équipes & Couleurs
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="TeamsModule.openCreateModal()">
              <span>➕</span> Nouvelle Équipe
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="teamsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🏷️</div>
              <div class="empty-title">Aucune équipe enregistrée</div>
              <div class="empty-desc">Créez des équipes pour organiser vos bénévoles par couleur (ex: Noir pour l'organisation, Blanc pour la trésorerie...).</div>
              <button class="btn btn-primary" onclick="TeamsModule.openCreateModal()">
                <span>➕</span> Créer la première équipe
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
      const { data: teams, error } = await client
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      this.renderTable(teams || []);
    } catch (e) {
      console.error('[TeamsModule Error]', e);
    }
  },

  renderTable(teams) {
    const container = document.getElementById('teamsTableContainer');
    if (!container) return;

    if (!teams || teams.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏷️</div>
          <div class="empty-title">Aucune équipe enregistrée</div>
          <div class="empty-desc">Créez des équipes pour organiser vos bénévoles par couleur (ex: Noir pour l'organisation, Blanc pour la trésorerie...).</div>
          <button class="btn btn-primary" onclick="TeamsModule.openCreateModal()">
            <span>➕</span> Créer la première équipe
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Couleur</th>
            <th>Nom de l'Équipe</th>
            <th>Rôle / Description</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${teams.map(t => `
            <tr>
              <td>
                <span class="stand-tag" style="background-color: ${t.color_hex}15; color: ${t.color_hex}; border-color: ${t.color_hex};">
                  <span class="color-dot" style="background-color: ${t.color_hex};"></span>
                  ${t.color_name}
                </span>
              </td>
              <td><strong>${t.name}</strong></td>
              <td>${t.description || '<span style="color: var(--gray-400);">Aucune description</span>'}</td>
              <td style="text-align: right;">
                <button class="btn-icon danger" onclick="TeamsModule.deleteTeam('${t.id}', '${t.name}')" title="Supprimer">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  openCreateModal() {
    const defaultColors = [
      { name: 'Noir', hex: '#0f172a' },
      { name: 'Blanc', hex: '#ffffff' },
      { name: 'Rouge', hex: '#dc2626' },
      { name: 'Bleu', hex: '#2563eb' },
      { name: 'Vert', hex: '#16a34a' },
      { name: 'Jaune', hex: '#eab308' },
      { name: 'Orange', hex: '#ea580c' },
      { name: 'Violet', hex: '#9333ea' }
    ];

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Créer une Équipe</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createTeamForm">
            <div class="form-group">
              <label>Nom de l'équipe *</label>
              <input type="text" id="tName" class="form-control" required placeholder="Ex: Équipe Organisation Centrale, Trésorerie...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nom de la couleur *</label>
                <input type="text" id="tColorName" class="form-control" required placeholder="Ex: Noir, Blanc, Bleu...">
              </div>
              <div class="form-group">
                <label>Code Couleur Hex</label>
                <input type="color" id="tColorHex" class="form-control" value="#dc2626" style="height: 42px; padding: 2px;">
              </div>
            </div>

            <div style="margin-bottom: 1.25rem;">
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--gray-600);">Couleurs prédéfinies :</span>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap;">
                ${defaultColors.map(c => `
                  <button type="button" class="badge" style="background-color: ${c.hex}; color: ${c.name === 'Blanc' || c.name === 'Jaune' ? '#000' : '#fff'}; cursor: pointer; border: 1px solid #cbd5e1;" onclick="document.getElementById('tColorName').value='${c.name}'; document.getElementById('tColorHex').value='${c.hex}';">
                    ${c.name}
                  </button>
                `).join('')}
              </div>
            </div>

            <div class="form-group">
              <label>Description / Missions</label>
              <textarea id="tDesc" class="form-control" rows="2" placeholder="Responsabilités spécifiques de cette équipe"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveTeamBtn">Créer l'équipe</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveTeamBtn').onclick = async () => {
      const name = document.getElementById('tName').value.trim();
      const colorName = document.getElementById('tColorName').value.trim();
      const colorHex = document.getElementById('tColorHex').value;
      const desc = document.getElementById('tDesc').value.trim();

      if (!name || !colorName) {
        Notify.error('Veuillez spécifier le nom et la couleur de l\'équipe.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('teams').insert([{
          name,
          color_name: colorName,
          color_hex: colorHex,
          description: desc
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_EQUIPE', 'team', null, `Création de l'équipe ${name} (${colorName})`);
        Notify.success(`Équipe ${name} créée avec succès.`);
        close();
        TeamsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  deleteTeam(id, name) {
    Notify.confirm(
      'Supprimer l\'équipe ?',
      `Confirmez-vous la suppression de l'équipe ${name} ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { error } = await client.from('teams').delete().eq('id', id);
          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
          AuditLogger.log('SUPPRESSION_EQUIPE', 'team', id, `Suppression de l'équipe ${name}`);
          Notify.success(`Équipe ${name} supprimée.`);
          TeamsModule.render(document.getElementById('mainContent'));
        }
      },
      'Supprimer',
      true
    );
  }
};

window.TeamsModule = TeamsModule;
