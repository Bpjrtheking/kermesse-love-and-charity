/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 4 : RESTAURATION — CARTE DES PRODUITS & MENU
 * 
 * Gestion simplifiée à la demande :
 * - Nom du produit
 * - Catégorie (Boisson, Snack, Repas chaud, etc.)
 * - Prix de vente en Francs
 * - ZÉRO contrainte de stock : les ventes sont libres et illimitées.
 */

const StocksModule = {
  products: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🍔</span> Pôle 4 : Restauration — Carte &amp; Produits
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('caisse_restauration')">
              <span>💰</span> Ouvrir la Caisse Restauration
            </button>
            <button class="btn btn-primary btn-sm" style="background: #ea580c; border-color: #c2410c;" onclick="StocksModule.openCreateProductModal()">
              <span>➕</span> Nouveau Produit
            </button>
          </div>
        </div>

        <div class="card-body">
          <div style="background: #fff7ed; border: 1px solid #ffedd5; border-radius: var(--radius-md); padding: 0.85rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #9a3412;">ℹ️ Mode Vente Libre :</span>
              <span style="font-size: 0.85rem; color: #7c2d12; margin-left: 6px;">
                Aucune limite de stock imposée. Renseignez uniquement le nom, la catégorie et le prix pour encaisser immédiatement.
              </span>
            </div>
            <div id="stocksTotalCountBadge" style="font-weight: 800; color: #ea580c;">0 article(s)</div>
          </div>

          <div class="toolbar" style="margin-bottom: 1rem;">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input type="text" id="stockSearch" placeholder="Rechercher une boisson, snack, plat..." oninput="StocksModule.filterTable()">
            </div>
          </div>

          <div class="table-responsive" id="productsTableContainer">
            <div style="text-align: center; padding: 2.5rem; color: var(--gray-500);">
              Chargement de la carte de restauration...
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;
    this.products = [];

    if (client) {
      try {
        const { data, error } = await client
          .from('food_products')
          .select('id, name, category, selling_price_f, is_active, created_at')
          .eq('is_active', true)
          .order('name');

        if (!error && data) {
          this.products = data;
        }
      } catch (e) {
        console.warn('[StocksModule Supabase Warning]', e);
      }
    }

    if (this.products.length === 0) {
      const stored = localStorage.getItem('kermesse_food_products');
      if (stored) {
        try {
          this.products = JSON.parse(stored);
        } catch (e) {}
      }
    }

    // Persistance locale
    localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
    this.renderProducts();
  },

  renderProducts() {
    const container = document.getElementById('productsTableContainer');
    const badge = document.getElementById('stocksTotalCountBadge');
    if (badge) badge.textContent = `${this.products.length} article(s) au menu`;
    if (!container) return;

    if (!this.products || this.products.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 2.5rem; background: var(--gray-50); border: 2px dashed var(--gray-300); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">🍔</div>
          <div style="font-weight: 800; font-size: 1.15rem; color: var(--gray-800);">Aucun produit alimentaire enregistré</div>
          <div style="font-size: 0.85rem; color: var(--gray-500); max-width: 450px; margin: 0.4rem auto 1.25rem;">
            Ajoutez les boissons, snacks ou repas servis lors de la kermesse avec leur tarif de vente.
          </div>
          <button class="btn btn-primary" style="background: #ea580c; border-color: #c2410c;" onclick="StocksModule.openCreateProductModal()">
            <span>➕</span> Ajouter le premier produit
          </button>
        </div>
      `;
      return;
    }

    const getEmoji = (name, cat) => {
      const n = (name || '').toLowerCase();
      const c = (cat || '').toLowerCase();
      if (n.includes('eau') || n.includes('minérale')) return '💧';
      if (n.includes('jus') || n.includes('bissap') || n.includes('cocktail')) return '🧃';
      if (n.includes('coca') || n.includes('soda') || n.includes('fanta') || n.includes('sprite')) return '🥤';
      if (n.includes('bière') || n.includes('biere')) return '🍺';
      if (n.includes('burger') || n.includes('hamb')) return '🍔';
      if (n.includes('sandwich') || n.includes('pain') || n.includes('panini')) return '🥪';
      if (n.includes('pizza')) return '🍕';
      if (n.includes('frite')) return '🍟';
      if (n.includes('poulet') || n.includes('chawarma') || n.includes('brochette')) return '🍗';
      if (n.includes('glace') || n.includes('cornet')) return '🍦';
      if (n.includes('crêpe') || n.includes('crepe') || n.includes('gâteau') || n.includes('cake')) return '🍰';
      if (c.includes('boisson')) return '🥤';
      if (c.includes('snack')) return '🍿';
      if (c.includes('repas')) return '🍽️';
      return '🍴';
    };

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th style="width: 50px;">Icon</th>
            <th>Nom du Produit</th>
            <th>Catégorie</th>
            <th>Prix de Vente</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="productsTableBody">
          ${this.products.map(p => `
            <tr data-name="${p.name}" data-cat="${p.category || ''}">
              <td style="font-size: 1.5rem; text-align: center;">${getEmoji(p.name, p.category)}</td>
              <td><strong>${p.name}</strong></td>
              <td><span class="badge badge-gray" style="text-transform: capitalize;">${p.category || 'Général'}</span></td>
              <td>
                <strong style="color: #c2410c; font-size: 1rem;">
                  ${(p.selling_price_f || 0).toLocaleString()} ${KermesseConfig.currency}
                </strong>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-secondary btn-sm" onclick="StocksModule.openEditProductModal('${p.id}')" title="Modifier le produit">
                  <span>✏️</span> Modifier
                </button>
                <button class="btn btn-danger btn-sm" onclick="StocksModule.deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" title="Supprimer du menu" style="margin-left: 0.35rem;">
                  <span>🗑️</span>
                </button>
              </td>
            </tr>
          `).join('')}
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
      <div class="modal-dialog" style="max-width: 480px;">
        <div class="modal-header">
          <h3>Nouveau Produit — Restauration</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createFoodForm">
            <div class="form-group">
              <label>Nom du produit *</label>
              <input type="text" id="fpName" class="form-control" required placeholder="Ex: Jus de Bissap, Sandwich Poulet, Eau 50cl...">
            </div>

            <div class="form-group">
              <label>Catégorie *</label>
              <select id="fpCategory" class="form-control">
                <option value="Boisson">🥤 Boisson</option>
                <option value="Snack / Friandise">🍿 Snack / Friandise</option>
                <option value="Repas chaud">🍗 Repas chaud / Plat</option>
                <option value="Dessert & Glace">🍰 Dessert &amp; Douceur</option>
                <option value="Autre">🍽️ Autre</option>
              </select>
            </div>

            <div class="form-group">
              <label>Prix de Vente (${KermesseConfig.currency}) *</label>
              <input type="number" id="fpPrice" class="form-control" value="500" min="0" step="50" required placeholder="Ex: 500">
              <small style="color: var(--gray-500); font-size: 0.75rem;">
                Le produit sera immédiatement disponible en caisse avec vente illimitée.
              </small>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveFoodBtn" style="background: #ea580c; border-color: #c2410c;">Ajouter au Menu</button>
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
      const priceStr = document.getElementById('fpPrice').value;

      if (!name || priceStr === '') {
        Notify.error('Veuillez renseigner le nom et le prix de vente.');
        return;
      }
      const price = Math.max(0, parseInt(priceStr, 10) || 0);

      const client = SupabaseClient.client;
      let newId = 'prod-' + Date.now();

      if (client) {
        try {
          const { data, error } = await client.from('food_products').insert([{
            name,
            category: cat,
            selling_price_f: price,
            unit: 'portion',
            initial_stock: 999999,
            current_stock: 999999,
            is_active: true
          }]).select('id');

          if (!error && data && data[0]) {
            newId = data[0].id;
          }
        } catch (e) {
          console.warn('[Food Product Insert DB Warning]', e);
        }
      }

      this.products.push({
        id: newId,
        name,
        category: cat,
        selling_price_f: price,
        is_active: true
      });

      localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
      AuditLogger.log('CREATION_PRODUIT_RESTAURATION', 'food_products', newId, `Création ${name} (${price} F)`);
      Notify.success(`« ${name} » ajouté au menu.`);
      close();
      this.renderProducts();
    };
  },

  openEditProductModal(productId) {
    const prod = this.products.find(p => p.id === productId);
    if (!prod) return;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 480px;">
        <div class="modal-header">
          <h3>Modifier le Produit</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editFoodForm">
            <div class="form-group">
              <label>Nom du produit *</label>
              <input type="text" id="editFpName" class="form-control" required value="${prod.name.replace(/"/g, '&quot;')}">
            </div>

            <div class="form-group">
              <label>Catégorie *</label>
              <select id="editFpCategory" class="form-control">
                <option value="Boisson" ${prod.category === 'Boisson' ? 'selected' : ''}>🥤 Boisson</option>
                <option value="Snack / Friandise" ${prod.category === 'Snack / Friandise' ? 'selected' : ''}>🍿 Snack / Friandise</option>
                <option value="Repas chaud" ${prod.category === 'Repas chaud' ? 'selected' : ''}>🍗 Repas chaud / Plat</option>
                <option value="Dessert & Glace" ${prod.category === 'Dessert & Glace' ? 'selected' : ''}>🍰 Dessert &amp; Douceur</option>
                <option value="Autre" ${prod.category === 'Autre' ? 'selected' : ''}>🍽️ Autre</option>
              </select>
            </div>

            <div class="form-group">
              <label>Prix de Vente (${KermesseConfig.currency}) *</label>
              <input type="number" id="editFpPrice" class="form-control" value="${prod.selling_price_f || 0}" min="0" step="50" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditFoodBtn" style="background: #ea580c; border-color: #c2410c;">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditFoodBtn').onclick = async () => {
      const name = document.getElementById('editFpName').value.trim();
      const cat = document.getElementById('editFpCategory').value;
      const priceStr = document.getElementById('editFpPrice').value;

      if (!name || priceStr === '') {
        Notify.error('Veuillez renseigner le nom et le prix.');
        return;
      }
      const price = Math.max(0, parseInt(priceStr, 10) || 0);

      prod.name = name;
      prod.category = cat;
      prod.selling_price_f = price;

      const client = SupabaseClient.client;
      if (client && CaissesCore.isUuid(productId)) {
        try {
          await client.from('food_products').update({
            name,
            category: cat,
            selling_price_f: price
          }).eq('id', productId);
        } catch (e) {
          console.warn('[Food Product Update DB Warning]', e);
        }
      }

      localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
      AuditLogger.log('MODIFICATION_PRODUIT_RESTAURATION', 'food_products', productId, `Modification ${name} (${price} F)`);
      Notify.success(`« ${name} » modifié.`);
      close();
      this.renderProducts();
    };
  },

  async deleteProduct(productId, name) {
    if (!confirm(`Supprimer définitivement « ${name} » du menu de restauration ?`)) {
      return;
    }

    const client = SupabaseClient.client;
    if (client && CaissesCore.isUuid(productId)) {
      try {
        await client.from('food_products').delete().eq('id', productId);
      } catch (e) {
        console.warn('[Food Product Delete DB Warning]', e);
      }
    }

    this.products = this.products.filter(p => p.id !== productId);
    localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
    AuditLogger.log('SUPPRESSION_PRODUIT_RESTAURATION', 'food_products', productId, `Suppression ${name}`);
    Notify.success(`« ${name} » supprimé du menu.`);
    this.renderProducts();
  }
};

window.StocksModule = StocksModule;
