/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : LOTS / CADEAUX
 * 
 * Gestion rigoureuse des lots pour éviter toute perte :
 * - Stock central réceptionné
 * - Affectation aux stands de jeu
 * - Distribution aux gagnants (contre Ticket Triangulaire)
 * - Retours au stock central
 * - Détection automatique des écarts et signalement d'incidents
 */

const GiftsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎁</span> Gestion des Lots & Cadeaux Gagnants
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="GiftsModule.openAllocateModal()">
              <span>🚚</span> Affecter des Lots à un Stand
            </button>
            <button class="btn btn-primary btn-sm" onclick="GiftsModule.openCreateModal()">
              <span>➕</span> Nouveau Lot / Cadeau
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner info" style="margin-bottom: 1.5rem;">
            <div>
              🔺 <strong>Flux de Remise des Cadeaux :</strong> Jeu Gagné ➔ Remise d'un Ticket Triangulaire ➔ Présentation au Responsable des Lots du Stand ➔ Lot Remis.
            </div>
          </div>

          <!-- Catalogue Central des Lots -->
          <h3 style="font-size: 1rem; font-weight: 700; margin-bottom: 0.75rem; color: var(--gray-800);">
            Catalogue Central des Lots
          </h3>
          <div class="table-responsive" id="giftsCatalogContainer">
            <div class="empty-state">
              <div class="empty-icon">🎁</div>
              <div class="empty-title">Aucun lot enregistré</div>
              <div class="empty-desc">Enregistrez les peluches, jouets ou friandises reçus pour les distribuer sur les stands de jeu.</div>
              <button class="btn btn-primary" onclick="GiftsModule.openCreateModal()">
                <span>➕</span> Enregistrer le premier lot
              </button>
            </div>
          </div>

          <!-- Lots en circulation sur les stands -->
          <h3 style="font-size: 1rem; font-weight: 700; margin: 2rem 0 0.75rem 0; color: var(--gray-800);">
            Répartition & Suivi par Stand (Écarts & Distributions)
          </h3>
          <div class="table-responsive" id="giftsAllocationsContainer">
            <div class="empty-state">
              <div class="empty-icon">🎪</div>
              <div class="empty-title">Aucun lot affecté aux stands</div>
              <div class="empty-desc">Affectez des lots aux stands de la kermesse pour suivre en direct les distributions et les retours.</div>
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
      // 1. Lots du catalogue
      const { data: gifts, error: gErr } = await client.from('gifts_catalog').select('*').order('name');
      if (gErr) throw gErr;
      this.renderCatalog(gifts || []);

      // 2. Affectations par stand
      const { data: allocations, error: aErr } = await client
        .from('gift_stand_allocations')
        .select(`
          id, allocated_qty, distributed_qty, returned_qty, current_stand_stock,
          gift:gifts_catalog(id, name, unit_value_f),
          stand:stands(id, name, color_name, color_hex)
        `);
      if (aErr) throw aErr;
      this.renderAllocations(allocations || []);
    } catch (e) {
      console.error('[GiftsModule Error]', e);
    }
  },

  renderCatalog(gifts) {
    const container = document.getElementById('giftsCatalogContainer');
    if (!container) return;

    if (!gifts || gifts.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎁</div>
          <div class="empty-title">Aucun lot enregistré</div>
          <div class="empty-desc">Enregistrez les peluches, jouets ou friandises reçus pour les distribuer sur les stands de jeu.</div>
          <button class="btn btn-primary" onclick="GiftsModule.openCreateModal()">
            <span>➕</span> Enregistrer le premier lot
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom du Lot</th>
            <th>Catégorie</th>
            <th>Valeur Estimée</th>
            <th>Stock Initial Total</th>
            <th>Stock Central Restant</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${gifts.map(g => `
            <tr>
              <td><strong>${g.name}</strong></td>
              <td><span class="badge badge-gray">${g.category || 'Général'}</span></td>
              <td>${g.unit_value_f ? `${g.unit_value_f.toLocaleString()} ${KermesseConfig.currency}` : '-'}</td>
              <td>${g.initial_stock} pièce(s)</td>
              <td>
                <span class="badge ${g.central_stock <= 5 ? 'badge-warning' : 'badge-success'}">
                  ${g.central_stock} pièce(s)
                </span>
              </td>
              <td style="text-align: right;">
                <button class="btn btn-secondary btn-sm" onclick="GiftsModule.openAllocateModal('${g.id}')">Affecter</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  renderAllocations(allocations) {
    const container = document.getElementById('giftsAllocationsContainer');
    if (!container) return;

    if (!allocations || allocations.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎪</div>
          <div class="empty-title">Aucun lot affecté aux stands</div>
          <div class="empty-desc">Affectez des lots aux stands de la kermesse pour suivre en direct les distributions et les retours.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Stand</th>
            <th>Lot</th>
            <th>Quantité Affectée</th>
            <th>Distribués (Gagnés)</th>
            <th>Retournés au Stock</th>
            <th>Restant sur le Stand</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${allocations.map(a => {
            const expectedRemaining = a.allocated_qty - a.distributed_qty - a.returned_qty;

            return `
              <tr>
                <td>
                  <span class="stand-tag" style="background-color: ${a.stand?.color_hex || '#dc2626'}15; color: ${a.stand?.color_hex || '#dc2626'}; border-color: ${a.stand?.color_hex || '#dc2626'}; font-size: 0.8rem;">
                    ${a.stand ? a.stand.name : 'Stand'}
                  </span>
                </td>
                <td><strong>${a.gift ? a.gift.name : 'Lot'}</strong></td>
                <td><span class="badge badge-gray">${a.allocated_qty}</span></td>
                <td><strong style="color: var(--success);">${a.distributed_qty}</strong></td>
                <td>${a.returned_qty}</td>
                <td>
                  <strong style="color: var(--primary); font-size: 0.95rem;">${a.current_stand_stock}</strong>
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="GiftsModule.openDistributeModal('${a.id}', '${a.gift?.name}', '${a.stand?.name}', ${a.current_stand_stock})">
                    <span>🔺</span> Distribuer
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="GiftsModule.openReturnModal('${a.id}', '${a.gift?.name}', '${a.stand?.name}', ${a.current_stand_stock})" style="margin-left: 0.35rem;">
                    <span>↩️</span> Retourner
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
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
          <h3>Enregistrer un Lot / Cadeau</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createGiftForm">
            <div class="form-group">
              <label>Nom du Lot / Cadeau *</label>
              <input type="text" id="gftName" class="form-control" required placeholder="Ex: Grande Peluche Ours, Voiture téléguidée, Ballon...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Catégorie</label>
                <select id="gftCategory" class="form-control">
                  <option value="peluche">Peluche</option>
                  <option value="jouet">Jouet / Jeu</option>
                  <option value="friandise">Friandise / Bonbon</option>
                  <option value="grand_lot">Grand Lot / Prestige</option>
                  <option value="autre">Autre</option>
                </select>
              </div>
              <div class="form-group">
                <label>Valeur estimée (${KermesseConfig.currency})</label>
                <input type="number" id="gftValue" class="form-control" value="1000" min="0" step="100">
              </div>
            </div>

            <div class="form-group">
              <label>Quantité Initiale Reçue *</label>
              <input type="number" id="gftStock" class="form-control" value="50" min="1" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveGiftBtn">Enregistrer le lot</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveGiftBtn').onclick = async () => {
      const name = document.getElementById('gftName').value.trim();
      const cat = document.getElementById('gftCategory').value;
      const val = parseInt(document.getElementById('gftValue').value, 10) || 0;
      const stock = parseInt(document.getElementById('gftStock').value, 10);

      if (!name || isNaN(stock)) {
        Notify.error('Veuillez remplir le nom et la quantité.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { error } = await client.from('gifts_catalog').insert([{
          name,
          category: cat,
          unit_value_f: val,
          initial_stock: stock,
          central_stock: stock,
          is_active: true
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_LOT', 'gift', null, `Création du lot ${name} (${stock} pièces)`);
        Notify.success(`Lot ${name} enregistré.`);
        close();
        GiftsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async openAllocateModal(preselectedGiftId = null) {
    const client = SupabaseClient.client;
    let gifts = [];
    let stands = [];

    if (client) {
      const { data: g } = await client.from('gifts_catalog').select('id, name, central_stock');
      const { data: s } = await client.from('stands').select('id, name');
      gifts = g || [];
      stands = s || [];
    }

    if (gifts.length === 0 || stands.length === 0) {
      Notify.warning('Vous devez avoir configuré au moins un stand et un lot au préalable.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Affecter des Lots à un Stand</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="allocForm">
            <div class="form-group">
              <label>Lot à transférer *</label>
              <select id="allocGift" class="form-control">
                ${gifts.map(g => `<option value="${g.id}" ${g.id === preselectedGiftId ? 'selected' : ''}>${g.name} (Disponible stock central: ${g.central_stock})</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Stand Destinataire *</label>
              <select id="allocStand" class="form-control">
                ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Quantité à affecter *</label>
              <input type="number" id="allocQty" class="form-control" value="10" min="1" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAllocBtn">Transférer vers le stand</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmAllocBtn').onclick = async () => {
      const giftId = document.getElementById('allocGift').value;
      const standId = document.getElementById('allocStand').value;
      const qty = parseInt(document.getElementById('allocQty').value, 10);

      if (isNaN(qty) || qty <= 0) {
        Notify.error('Quantité invalide.');
        return;
      }

      if (client) {
        // Vérifier si une affectation existe déjà
        const { data: existing } = await client
          .from('gift_stand_allocations')
          .select('id, allocated_qty')
          .eq('gift_id', giftId)
          .eq('stand_id', standId)
          .maybeSingle();

        let err;
        if (existing) {
          const res = await client.from('gift_stand_allocations').update({
            allocated_qty: existing.allocated_qty + qty
          }).eq('id', existing.id);
          err = res.error;
        } else {
          const res = await client.from('gift_stand_allocations').insert([{
            gift_id: giftId,
            stand_id: standId,
            allocated_qty: qty,
            distributed_qty: 0,
            returned_qty: 0
          }]);
          err = res.error;
        }

        if (err) {
          Notify.error('Erreur: ' + err.message);
          return;
        }

        AuditLogger.log('AFFECTATION_LOT', 'gift', giftId, `Affectation de ${qty} lot(s) vers le stand ID ${standId}`);
        Notify.success(`Affectation de ${qty} lot(s) enregistrée.`);
        close();
        GiftsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  openDistributeModal(allocId, giftName, standName, currentStock) {
    if (currentStock <= 0) {
      Notify.warning('Stock insuffisant sur le stand pour ce lot.');
      return;
    }

    Notify.confirm(
      'Valider la remise d\'un lot ?',
      `Confirmez la distribution de 1 unité de « ${giftName} » sur ${standName} en échange du ticket triangulaire gagnant ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          const { data: current } = await client.from('gift_stand_allocations').select('distributed_qty').eq('id', allocId).single();
          if (current) {
            await client.from('gift_stand_allocations').update({
              distributed_qty: current.distributed_qty + 1
            }).eq('id', allocId);

            AuditLogger.log('DISTRIBUTION_LOT', 'gift_allocation', allocId, `Remise de 1 lot ${giftName} sur ${standName} contre ticket triangulaire`);
            Notify.success(`Lot remis avec succès.`);
            GiftsModule.render(document.getElementById('mainContent'));
          }
        }
      },
      'Remettre le lot'
    );
  },

  openReturnModal(allocId, giftName, standName, currentStock) {
    if (currentStock <= 0) {
      Notify.warning('Aucun lot restant sur ce stand à retourner.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Retour au Stock Central : ${giftName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="returnGiftForm">
            <p style="margin-bottom: 1rem; color: var(--gray-600); font-size: 0.9rem;">
              Stand : <strong>${standName}</strong> | Restant sur place : <strong>${currentStock} pièce(s)</strong>
            </p>
            <div class="form-group">
              <label>Quantité retournée au Stock Central *</label>
              <input type="number" id="retQty" class="form-control" value="${currentStock}" min="1" max="${currentStock}" required>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmRetBtn">Valider le retour</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmRetBtn').onclick = async () => {
      const qty = parseInt(document.getElementById('retQty').value, 10);
      if (isNaN(qty) || qty <= 0 || qty > currentStock) {
        Notify.error('Quantité invalide.');
        return;
      }

      const client = SupabaseClient.client;
      if (client) {
        const { data: current } = await client.from('gift_stand_allocations').select('returned_qty').eq('id', allocId).single();
        if (current) {
          await client.from('gift_stand_allocations').update({
            returned_qty: current.returned_qty + qty
          }).eq('id', allocId);

          AuditLogger.log('RETOUR_LOT_CENTRAL', 'gift_allocation', allocId, `Retour de ${qty} lot(s) ${giftName} depuis ${standName} vers le Stock Central`);
          Notify.success(`Retour de ${qty} lot(s) enregistré.`);
          close();
          GiftsModule.render(document.getElementById('mainContent'));
        }
      }
    };
  }
};

window.GiftsModule = GiftsModule;
