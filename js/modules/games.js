/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : JEUX (STANDS & ATTRACTIONS)
 * 
 * Gestion des jeux et attractions associés aux stands :
 * - Prix du ticket en Francs
 * - Règles et lots associés
 * - Possibilité de regrouper plusieurs attractions sous un même stand (ex: manèges)
 */

const GamesModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎯</span> Jeux & Attractions de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="GamesModule.openCreateModal()">
              <span>➕</span> Nouveau Jeu
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="gameSearch" placeholder="Rechercher un jeu ou un stand..." oninput="GamesModule.filterTable()">
            </div>
          </div>

          <div class="table-responsive" id="gamesTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">Aucun jeu configuré</div>
              <div class="empty-desc">Ajoutez les attractions et jeux de la kermesse (ex: Tir à la corde, Lancer de balle, Pêche aux canards, Manèges...).</div>
              <button class="btn btn-primary" onclick="GamesModule.openCreateModal()">
                <span>➕</span> Configurer le premier jeu
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
      const { data: games, error } = await client
        .from('games')
        .select(`
          id, name, ticket_price_f, rules_summary, prizes_description, is_active,
          stand:stands(id, name, number, color_name, color_hex)
        `)
        .order('name', { ascending: true });

      if (error) throw error;
      this.renderTable(games || []);
    } catch (e) {
      console.error('[GamesModule Error]', e);
    }
  },

  renderTable(games) {
    const container = document.getElementById('gamesTableContainer');
    if (!container) return;

    if (!games || games.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <div class="empty-title">Aucun jeu configuré</div>
          <div class="empty-desc">Ajoutez les attractions et jeux de la kermesse (ex: Tir à la corde, Lancer de balle, Pêche aux canards, Manèges...).</div>
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
            <th>Stand Associé</th>
            <th>Prix du Ticket</th>
            <th>Règles / Fonctionnement</th>
            <th>Lots à Gagner</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="gamesTableBody">
          ${games.map(g => `
            <tr data-name="${g.name}" data-stand="${g.stand ? g.stand.name : ''}">
              <td><strong>${g.name}</strong></td>
              <td>
                ${g.stand ? `
                  <span class="stand-tag" style="background-color: ${g.stand.color_hex}15; color: ${g.stand.color_hex}; border-color: ${g.stand.color_hex};">
                    <span class="color-dot" style="background-color: ${g.stand.color_hex};"></span>
                    ${g.stand.name}
                  </span>
                ` : '<span style="color: var(--gray-400);">Aucun stand</span>'}
              </td>
              <td><span class="badge badge-primary">${g.ticket_price_f.toLocaleString()} ${KermesseConfig.currency}</span></td>
              <td><span style="font-size: 0.85rem;">${g.rules_summary || '-'}</span></td>
              <td><span style="font-size: 0.85rem; color: var(--success); font-weight: 500;">${g.prizes_description || '-'}</span></td>
              <td style="text-align: right;">
                <button class="btn-icon danger" onclick="GamesModule.deleteGame('${g.id}', '${g.name}')" title="Supprimer">🗑️</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('gameSearch').value || '').toLowerCase();
    const rows = document.querySelectorAll('#gamesTableBody tr');

    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const stand = (r.dataset.stand || '').toLowerCase();
      r.style.display = name.includes(q) || stand.includes(q) ? '' : 'none';
    });
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let stands = [];

    if (client) {
      const { data } = await client.from('stands').select('id, name').order('number');
      stands = data || [];
    }

    if (stands.length === 0) {
      Notify.warning('Vous devez d\'abord créer un Stand avant de configurer un jeu.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ajouter un Jeu / Attraction</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createGameForm">
            <div class="form-group">
              <label>Stand associé *</label>
              <select id="gStand" class="form-control" required>
                ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nom du jeu *</label>
                <input type="text" id="gName" class="form-control" required placeholder="Ex: Tir à la corde, Lancer de balle...">
              </div>
              <div class="form-group">
                <label>Prix du ticket (${KermesseConfig.currency}) *</label>
                <input type="number" id="gPrice" class="form-control" value="200" min="0" step="50" required>
              </div>
            </div>

            <div class="form-group">
              <label>Règles / Fonctionnement en bref</label>
              <input type="text" id="gRules" class="form-control" placeholder="Ex: 3 essais par joueur, réussir 2 lancers">
            </div>

            <div class="form-group">
              <label>Lots remis en cas de victoire</label>
              <input type="text" id="gPrizes" class="form-control" placeholder="Ex: 1 Ticket triangulaire pour grand lot, ou friandise">
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

    modal.querySelector('#saveGameBtn').onclick = async () => {
      const standId = document.getElementById('gStand').value;
      const name = document.getElementById('gName').value.trim();
      const price = parseInt(document.getElementById('gPrice').value, 10);
      const rules = document.getElementById('gRules').value.trim();
      const prizes = document.getElementById('gPrizes').value.trim();

      if (!name || isNaN(price)) {
        Notify.error('Veuillez remplir les informations requises.');
        return;
      }

      if (client) {
        const { error } = await client.from('games').insert([{
          stand_id: standId,
          name,
          ticket_price_f: price,
          rules_summary: rules,
          prizes_description: prizes,
          is_active: true
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_JEU', 'game', null, `Création du jeu ${name} au prix de ${price} F`);
        Notify.success(`Jeu ${name} créé avec succès.`);
        close();
        GamesModule.render(document.getElementById('mainContent'));
      }
    };
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
