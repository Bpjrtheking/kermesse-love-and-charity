/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : STOCKS / NOURRITURE & BOISSONS
 * 
 * Traçabilité intégrale des denrées pour éviter les disparitions :
 * - Entrées / Livraisons
 * - Sorties vers les stands
 * - Ventes
 * - Pertes / Casse déclarées
 * - Calcul automatique : Stock Théorique vs Réel
 */

const StocksModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🍔</span> Stocks de Nourriture & Boissons
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="StocksModule.openMovementModal()">
              <span>📦</span> Enregistrer un Mouvement
            </button>
            <button class="btn btn-primary btn-sm" onclick="StocksModule.openCreateProductModal()">
              <span>➕</span> Nouveau Produit
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="stockSearch" placeholder="Rechercher un produit alimentaire..." oninput="StocksModule.filterTable()">
            </div>
          </div>

          <div class="table-responsive" id="productsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🍔</div>
              <div class="empty-title">Aucun produit alimentaire enregistré</div>
              <div class="empty-desc">Enregistrez les boissons, snacks ou repas vendus ou distribués lors de la kermesse pour assurer le suivi des stocks.</div>
              <button class="btn btn-primary" onclick="StocksModule.openCreateProductModal()">
                <span>➕</span> Enregistrer le premier produit
              </button>
            </div>
          </div>

          <div class="card" style="margin-top: 2rem;">
            <div class="card-header">
              <div class="card-title"><span>📋</span> Historique Récent des Mouvements de Stock</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div class="table-responsive" id="stockMovementsContainer">
                <div class="empty-state">
                  <div class="empty-icon">📦</div>
                  <div class="empty-title">Aucun mouvement de stock</div>
                  <div class="empty-desc">Les entrées, sorties vers les stands et pertes déclarées seront listées ici avec horodatage et motif.</div>
                </div>
              </div>
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
      const { data: products, error } = await client
        .from('food_products')
        .select('*')
        .order('name');

      if (error) throw error;
      this.renderProducts(products || []);

      const { data: movements } = await client
        .from('stock_movements')
        .select(`
          id, type, quantity, reason, created_at,
          product:food_products(name, unit),
          stand:stands(name),
          user:app_users(login, full_name)
        `)
        .order('created_at', { ascending: false })
        .limit(15);

      this.renderMovements(movements || []);
    } catch (e) {
      console.error('[StocksModule Error]', e);
    }
  },

  renderProducts(products) {
    const container = document.getElementById('productsTableContainer');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🍔</div>
          <div class="empty-title">Aucun produit alimentaire enregistré</div>
          <div class="empty-desc">Enregistrez les boissons, snacks ou repas vendus ou distribués lors de la kermesse pour assurer le suivi des stocks.</div>
          <button class="btn btn-primary" onclick="StocksModule.openCreateProductModal()">
            <span>➕</span> Enregistrer le premier produit
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Catégorie</th>
            <th>Unité</th>
            <th>Prix de Vente</th>
            <th>Stock Initial</th>
            <th>Stock Actuel</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody id="productsTableBody">
          ${products.map(p => `
            <tr data-name="${p.name}" data-cat="${p.category}">
              <td><strong>${p.name}</strong></td>
              <td><span class="badge badge-gray">${p.category}</span></td>
              <td>${p.unit}</td>
              <td>${p.selling_price_f ? `${p.selling_price_f.toLocaleString()} ${KermesseConfig.currency}` : 'Gratuit'}</td>
              <td>${p.initial_stock} ${p.unit}</td>
              <td>
                <span class="badge ${p.current_stock < 10 ? 'badge-danger' : 'badge-success'}" style="font-size: 0.85rem;">
                  ${p.current_stock} ${p.unit}
                </span>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-secondary btn-sm" onclick="StocksModule.openQuickMovementModal('${p.id}', '${p.name}', '${p.unit}')">
                  Mouvement
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderMovements(movements) {
    const container = document.getElementById('stockMovementsContainer');
    if (!container) return;

    if (!movements || movements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📦</div>
          <div class="empty-title">Aucun mouvement de stock</div>
          <div class="empty-desc">Les entrées, sorties vers les stands et pertes déclarées seront listées ici avec horodatage et motif.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Produit</th>
            <th>Type de Mouvement</th>
            <th>Quantité</th>
            <th>Stand Concerné</th>
            <th>Motif / Justificatif</th>
            <th>Auteur</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => {
            let badgeClass = 'badge-primary';
            if (m.type === 'entree') badgeClass = 'badge-success';
            if (m.type === 'perte' || m.type === 'casse') badgeClass = 'badge-danger';
            if (m.type === 'sortie_stand') badgeClass = 'badge-warning';

            return `
              <tr>
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                  ${new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td><strong>${m.product ? m.product.name : 'Produit'}</strong></td>
                <td><span class="badge ${badgeClass}">${m.type}</span></td>
                <td><strong>${m.quantity} ${m.product ? m.product.unit : ''}</strong></td>
                <td>${m.stand ? m.stand.name : '<span style="color: var(--gray-400);">Stock Central</span>'}</td>
                <td>${m.reason || '-'}</td>
                <td><strong>${m.user ? (m.user.full_name || m.user.login) : '-'}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterTable() {
    const q = (document.getElementById('stockSearch').value || '').toLowerCase();
    const rows = document.querySelectorAll('#productsTableBody tr');
    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const cat = (r.dataset.cat || '').toLowerCase();
      r.style.display = name.includes(q) || cat.includes(q) ? '' : 'none';
    });
  },

  openCreateProductModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Produit Alimentaire</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createFoodForm">
            <div class="form-group">
              <label>Nom du produit *</label>
              <input type="text" id="fpName" class="form-control" required placeholder="Ex: Eau Minérale 50cl, Jus de Bissap, Sandwich...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Catégorie *</label>
                <select id="fpCategory" class="form-control">
                  <option value="boisson">Boisson</option>
                  <option value="snack">Snack / Friandise</option>
                  <option value="repas">Repas chaud</option>
                  <option value="ingredient">Ingrédient cuisine</option>
                </select>
              </div>
              <div class="form-group">
                <label>Unité de mesure *</label>
                <input type="text" id="fpUnit" class="form-control" value="bouteille" placeholder="bouteille, canette, portion, kg...">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stock Initial *</label>
                <input type="number" id="fpStock" class="form-control" value="100" min="0" required>
              </div>
              <div class="form-group">
                <label>Prix de Vente (${KermesseConfig.currency})</label>
                <input type="number" id="fpPrice" class="form-control" value="500" min="0" step="50">
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveFoodBtn">Créer le produit</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveFoodBtn').onclick = async () => {
      const name = document.getElementById('fpName').value.trim();
      const cat = document.getElementById('fpCategory').value;
      const unit = document.getElementById('fpUnit').value.trim();
      const stock = parseInt(document.getElementById('fpStock').value, 10);
      const price = parseInt(document.getElementById('fpPrice').value, 10) || 0;

      if (!name || isNaN(stock)) {
        Notify.error('Veuillez remplir les informations requises.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('food_products').insert([{
          name,
          category: cat,
          unit,
          initial_stock: stock,
          current_stock: stock,
          selling_price_f: price,
          is_active: true
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_PRODUIT_NOURRITURE', 'stock', null, `Création du produit ${name} avec stock initial de ${stock} ${unit}`);
        Notify.success(`Produit ${name} enregistré.`);
        close();
        StocksModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async openMovementModal() {
    const client = SupabaseClient.client;
    let products = [];
    let stands = [];

    if (client) {
      const { data: p } = await client.from('food_products').select('id, name, unit, current_stock');
      const { data: s } = await client.from('stands').select('id, name');
      products = p || [];
      stands = s || [];
    }

    if (products.length === 0) {
      Notify.warning('Veuillez d\'abord enregistrer un produit alimentaire.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer un Mouvement de Stock</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="stockMvtForm">
            <div class="form-group">
              <label>Produit Concerné *</label>
              <select id="smProduct" class="form-control">
                ${products.map(p => `<option value="${p.id}">${p.name} (En stock : ${p.current_stock} ${p.unit})</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Type de Mouvement *</label>
                <select id="smType" class="form-control">
                  <option value="sortie_stand">Sortie vers un Stand</option>
                  <option value="entree">Entrée / Livraison Réceptionnée</option>
                  <option value="vente">Vente Réalisée</option>
                  <option value="perte">Perte / Disparition Déclarée</option>
                  <option value="casse">Casse / Produit Endommagé</option>
                  <option value="retour">Retour au Stock Central</option>
                </select>
              </div>
              <div class="form-group">
                <label>Quantité *</label>
                <input type="number" id="smQty" class="form-control" value="10" min="1" required>
              </div>
            </div>

            <div class="form-group">
              <label>Stand Destinataire ou Concerné</label>
              <select id="smStand" class="form-control">
                <option value="">Stock Central / Cuisine</option>
                ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Motif / Justification *</label>
              <input type="text" id="smReason" class="form-control" required placeholder="Ex: Réassort du Stand Rouge 1, Bouteille cassée pendant transport...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveStockMvtBtn">Valider le mouvement</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveStockMvtBtn').onclick = async () => {
      const prodId = document.getElementById('smProduct').value;
      const type = document.getElementById('smType').value;
      const qty = parseInt(document.getElementById('smQty').value, 10);
      const standId = document.getElementById('smStand').value || null;
      const reason = document.getElementById('smReason').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(qty) || qty <= 0 || !reason) {
        Notify.error('Veuillez renseigner une quantité valide et un motif.');
        return;
      }

      if (client) {
        const { error } = await client.from('stock_movements').insert([{
          product_id: prodId,
          type,
          quantity: qty,
          stand_id: standId,
          reason,
          user_id: user ? user.id : null
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        // Si perte ou casse déclarée, créer automatiquement un incident de stock !
        if (type === 'perte' || type === 'casse') {
          await client.from('incidents').insert([{
            incident_number: 'INC-STOCK-' + Math.floor(1000 + Math.random() * 9000),
            type: 'disparition_nourriture',
            title: `Perte/Casse de stock : ${qty} unité(s)`,
            description: `Déclaration de ${type} par ${user?.full_name || user?.login} sur produit ID ${prodId}. Motif : ${reason}`,
            severity: 'faible',
            status: 'ouvert',
            reported_by: user ? user.id : null
          }]);
        }

        AuditLogger.log('MOUVEMENT_STOCK', 'stock', prodId, `${type} de ${qty} unité(s). Motif: ${reason} par ${user?.full_name || user?.login}`);
        Notify.success('Mouvement de stock enregistré.');
        close();
        StocksModule.render(document.getElementById('mainContent'));
      }
    };
  },

  openQuickMovementModal(productId, productName, unit) {
    this.openMovementModal().then(() => {
      const select = document.getElementById('smProduct');
      if (select) select.value = productId;
    });
  }
};

window.StocksModule = StocksModule;
