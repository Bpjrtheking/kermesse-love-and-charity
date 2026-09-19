/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : EMPLACEMENTS (LOCALISATION DU MATÉRIEL & DES STANDS)
 * 
 * Gestion des lieux physiques : Stock central, Stands, Cuisine, Scène, Véhicules...
 * Avec champ de précision libre (ex: "Salle 2, derrière le bâtiment principal").
 */

const LocationsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📍</span> Gestion des Emplacements & Lieux
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="LocationsModule.openCreateModal()">
              <span>➕</span> Nouvel Emplacement
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="locationsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">📍</div>
              <div class="empty-title">Aucun emplacement enregistré</div>
              <div class="empty-desc">Créez les différents lieux de la kermesse (Stock central, Cuisine, Scène, Véhicule...) pour savoir exactement où se trouve le matériel.</div>
              <button class="btn btn-primary" onclick="LocationsModule.openCreateModal()">
                <span>➕</span> Créer le premier emplacement
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
      const { data: locations, error } = await client
        .from('locations')
        .select('*')
        .order('name');

      if (error) throw error;
      this.renderTable(locations || []);
    } catch (e) {
      console.error('[LocationsModule Error]', e);
    }
  },

  renderTable(locations) {
    const container = document.getElementById('locationsTableContainer');
    if (!container) return;

    if (!locations || locations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📍</div>
          <div class="empty-title">Aucun emplacement enregistré</div>
          <div class="empty-desc">Créez les différents lieux de la kermesse (Stock central, Cuisine, Scène, Véhicule...) pour savoir exactement où se trouve le matériel.</div>
          <button class="btn btn-primary" onclick="LocationsModule.openCreateModal()">
            <span>➕</span> Créer le premier emplacement
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom du Lieu</th>
            <th>Précision d'Emplacement</th>
            <th>Statut</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${locations.map(l => `
            <tr>
              <td><strong>${l.name}</strong></td>
              <td>${l.precision_details || '<span style="color: var(--gray-400);">Aucune précision</span>'}</td>
              <td><span class="badge badge-success">Actif</span></td>
              <td style="text-align: right;">
                <button class="btn-icon danger" onclick="LocationsModule.deleteLocation('${l.id}', '${l.name}')" title="Supprimer">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  openCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ajouter un Emplacement</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createLocForm">
            <div class="form-group">
              <label>Nom du lieu *</label>
              <input type="text" id="locName" class="form-control" required placeholder="Ex: Stock central, Cuisine, Scène, Réserve camion...">
            </div>
            <div class="form-group">
              <label>Précision géographique / Détails d'accès</label>
              <textarea id="locDetails" class="form-control" rows="2" placeholder="Ex: Salle 2, derrière le bâtiment principal, clé auprès du gardien"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveLocBtn">Enregistrer le lieu</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveLocBtn').onclick = async () => {
      const name = document.getElementById('locName').value.trim();
      const details = document.getElementById('locDetails').value.trim();

      if (!name) {
        Notify.error('Veuillez renseigner le nom du lieu.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('locations').insert([{
          name,
          precision_details: details,
          is_active: true
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_EMPLACEMENT', 'location', null, `Création du lieu ${name}`);
        Notify.success(`Lieu ${name} enregistré.`);
        close();
        LocationsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  deleteLocation(id, name) {
    Notify.confirm(
      'Supprimer ce lieu ?',
      `Confirmez-vous la suppression de l'emplacement ${name} ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { error } = await client.from('locations').delete().eq('id', id);
          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
          AuditLogger.log('SUPPRESSION_EMPLACEMENT', 'location', id, `Suppression de l'emplacement ${name}`);
          Notify.success(`Lieu ${name} supprimé.`);
          LocationsModule.render(document.getElementById('mainContent'));
        }
      },
      'Supprimer',
      true
    );
  }
};

window.LocationsModule = LocationsModule;
