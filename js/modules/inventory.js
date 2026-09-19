/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : INVENTAIRES (INITIAL, PENDANT, FINAL)
 * 
 * Comparaison automatique Théorique vs Réel :
 * - Nourriture / Boissons
 * - Lots / Cadeaux
 * - Matériel
 * Détection immédiate des écarts inexpliqués.
 */

const InventoryModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📊</span> Inventaires & Contrôle des Écarts (Théorique vs Réel)
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="InventoryModule.openCreateInventoryModal()">
              <span>➕</span> Nouvel Inventaire
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="inventoryTableContainer">
            <div class="empty-state">
              <div class="empty-icon">📊</div>
              <div class="empty-title">Aucun inventaire enregistré</div>
              <div class="empty-desc">Réalisez des inventaires (initial avant la kermesse, intermédiaire en cours de journée, ou final) pour calculer automatiquement les écarts de stock.</div>
              <button class="btn btn-primary" onclick="InventoryModule.openCreateInventoryModal()">
                <span>➕</span> Lancer le premier inventaire
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
      const { data: inventories, error } = await client
        .from('inventories')
        .select(`
          id, title, type, phase, status, created_at, validated_at, notes,
          creator:app_users!inventories_created_by_fkey(login),
          items:inventory_items(id, item_name, theoretical_qty, counted_qty, variance_qty)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.renderInventories(inventories || []);
    } catch (e) {
      console.error('[InventoryModule Error]', e);
    }
  },

  renderInventories(inventories) {
    const container = document.getElementById('inventoryTableContainer');
    if (!container) return;

    if (!inventories || inventories.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-title">Aucun inventaire enregistré</div>
          <div class="empty-desc">Réalisez des inventaires (initial avant la kermesse, intermédiaire en cours de journée, ou final) pour calculer automatiquement les écarts de stock.</div>
          <button class="btn btn-primary" onclick="InventoryModule.openCreateInventoryModal()">
            <span>➕</span> Lancer le premier inventaire
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Titre & Périmètre</th>
            <th>Phase</th>
            <th>Articles Comptés</th>
            <th>Écarts Constatés</th>
            <th>Statut</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${inventories.map(inv => {
            const items = inv.items || [];
            const variances = items.filter(it => it.variance_qty !== 0);

            return `
              <tr>
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                  ${new Date(inv.created_at).toLocaleDateString('fr-FR')}
                </td>
                <td>
                  <strong>${inv.title}</strong>
                  <div style="font-size: 0.75rem; color: var(--gray-500);">Type : ${inv.type}</div>
                </td>
                <td><span class="badge badge-primary">${inv.phase}</span></td>
                <td>${items.length} référence(s)</td>
                <td>
                  ${variances.length > 0 ? `
                    <span class="badge badge-danger">⚠️ ${variances.length} écart(s)</span>
                  ` : '<span class="badge badge-success">0 écart</span>'}
                </td>
                <td>
                  ${inv.status === 'valide' ? '<span class="badge badge-success">Validé</span>' : '<span class="badge badge-warning">En cours</span>'}
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="InventoryModule.viewInventoryDetails('${inv.id}', '${inv.title}')">Consulter</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  async openCreateInventoryModal() {
    const client = SupabaseClient.client;
    let food = [];
    let gifts = [];

    if (client) {
      const { data: f } = await client.from('food_products').select('id, name, current_stock, unit');
      const { data: g } = await client.from('gifts_catalog').select('id, name, central_stock');
      food = f || [];
      gifts = g || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>Créer une Session d'Inventaire</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createInvForm">
            <div class="form-group">
              <label>Titre de l'inventaire *</label>
              <input type="text" id="invTitle" class="form-control" required placeholder="Ex: Inventaire Initial Nourriture, Inventaire Final Kermesse...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Périmètre / Type *</label>
                <select id="invType" class="form-control" onchange="InventoryModule.renderItemsToCount(this.value, ${JSON.stringify(food)}, ${JSON.stringify(gifts)})">
                  <option value="nourriture">Nourriture & Boissons</option>
                  <option value="lots">Lots & Cadeaux</option>
                </select>
              </div>
              <div class="form-group">
                <label>Phase *</label>
                <select id="invPhase" class="form-control">
                  <option value="initial">Initial (Avant le début)</option>
                  <option value="intermediaire">Intermédiaire (Pendant)</option>
                  <option value="final">Final (Clôture)</option>
                </select>
              </div>
            </div>

            <h4 style="font-size: 0.9rem; margin: 1.25rem 0 0.5rem 0; color: var(--gray-800);">Articles & Comptage Réel :</h4>
            <div id="itemsCountList" style="max-height: 250px; overflow-y: auto; border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 0.75rem;">
              <!-- Rempli dynamiquement -->
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveInvBtn">Enregistrer l'inventaire</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    this.renderItemsToCount('nourriture', food, gifts);

    modal.querySelector('#saveInvBtn').onclick = async () => {
      const title = document.getElementById('invTitle').value.trim();
      const type = document.getElementById('invType').value;
      const phase = document.getElementById('invPhase').value;
      const user = Auth.getCurrentUser();

      if (!title) {
        Notify.error('Veuillez renseigner un titre pour cet inventaire.');
        return;
      }

      if (client) {
        // 1. Créer l'inventaire
        const { data: inv, error: iErr } = await client.from('inventories').insert([{
          title,
          type,
          phase,
          created_by: user ? user.id : null,
          status: 'valide'
        }]).select().single();

        if (iErr) {
          Notify.error('Erreur: ' + iErr.message);
          return;
        }

        // 2. Insérer les items comptés
        const inputs = document.querySelectorAll('.inv-counted-input');
        const itemsToInsert = [];

        inputs.forEach(inp => {
          const itemId = inp.dataset.id;
          const itemName = inp.dataset.name;
          const theo = parseInt(inp.dataset.theo, 10) || 0;
          const counted = parseInt(inp.value, 10) || 0;
          const variance = counted - theo;

          itemsToInsert.push({
            inventory_id: inv.id,
            item_id: itemId,
            item_type: type,
            item_name: itemName,
            theoretical_qty: theo,
            counted_qty: counted,
            variance_qty: variance
          });
        });

        if (itemsToInsert.length > 0) {
          await client.from('inventory_items').insert(itemsToInsert);
        }

        AuditLogger.log('CREATION_INVENTAIRE', 'inventory', inv.id, `Inventaire ${title} (${phase}) enregistré avec ${itemsToInsert.length} articles.`);
        Notify.success(`Inventaire ${title} enregistré avec succès.`);
        close();
        InventoryModule.render(document.getElementById('mainContent'));
      }
    };
  },

  renderItemsToCount(type, food, gifts) {
    const box = document.getElementById('itemsCountList');
    if (!box) return;

    const list = type === 'nourriture' ? food : gifts;

    if (!list || list.length === 0) {
      box.innerHTML = `<p style="color: var(--gray-400); font-size: 0.85rem; text-align: center; padding: 1rem;">Aucun article disponible pour ce type.</p>`;
      return;
    }

    box.innerHTML = list.map(item => {
      const theo = type === 'nourriture' ? item.current_stock : item.central_stock;
      const unit = item.unit || 'pièce(s)';

      return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem; padding-bottom: 0.5rem; border-bottom: 1px solid var(--gray-200);">
          <div>
            <strong>${item.name}</strong>
            <div style="font-size: 0.78rem; color: var(--gray-500);">Théorique en stock : <strong>${theo} ${unit}</strong></div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="font-size: 0.8rem; margin: 0;">Réel compté :</label>
            <input type="number" class="form-control inv-counted-input" style="width: 80px; padding: 0.35rem;" 
                   value="${theo}" min="0" data-id="${item.id}" data-name="${item.name}" data-theo="${theo}">
          </div>
        </div>
      `;
    }).join('');
  },

  async viewInventoryDetails(invId, title) {
    const client = SupabaseClient.client;
    if (!client) return;

    const { data: items } = await client.from('inventory_items').select('*').eq('inventory_id', invId);

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>Détails : ${title}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <table class="data-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Théorique</th>
                <th>Réel Compté</th>
                <th>Écart</th>
              </tr>
            </thead>
            <tbody>
              ${(items || []).map(it => `
                <tr>
                  <td><strong>${it.item_name}</strong></td>
                  <td>${it.theoretical_qty}</td>
                  <td><strong>${it.counted_qty}</strong></td>
                  <td>
                    <span class="badge ${it.variance_qty < 0 ? 'badge-danger' : (it.variance_qty > 0 ? 'badge-success' : 'badge-gray')}">
                      ${it.variance_qty > 0 ? '+' : ''}${it.variance_qty}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector('.modal-close-btn').onclick = () => modal.remove();
    modal.querySelector('.close-btn').onclick = () => modal.remove();
  }
};

window.InventoryModule = InventoryModule;
