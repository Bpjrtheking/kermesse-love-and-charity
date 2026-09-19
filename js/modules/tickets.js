/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : TICKETS & JETONS DE MONNAIE
 * 
 * 1. Ticket rectangulaire : Accès aux jeux
 * 2. Ticket triangulaire : Remis en cas de victoire pour retirer un lot
 * 3. Jetons de monnaie (50F, 100F, 200F, 250F) : Représentent une dette de monnaie
 *    RÈGLE ABSOLUE : « Pas de jeton = pas de remboursement correspondant »
 */

const TicketsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎟️</span> Gestion des Tickets & Jetons de Monnaie
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="TicketsModule.openCreateTicketTypeModal()">
              <span>➕</span> Nouveau Type de Billet
            </button>
            <button class="btn btn-primary btn-sm" onclick="TicketsModule.openSaleModal()">
              <span>💳</span> Enregistrer une Vente
            </button>
          </div>
        </div>
        <div class="card-body">
          <!-- Règle de gestion des jetons rappelée en haut -->
          <div class="alert-banner info" style="margin-bottom: 1.5rem;">
            <div>
              🪙 <strong>Système de Jetons de Monnaie (50 F, 100 F, 200 F, 250 F) :</strong> Les jetons remis aux participants représentent une dette de monnaie de la caisse. <em>Règle stricte : Pas de jeton présenté = Pas de remboursement en espèces.</em>
            </div>
          </div>

          <!-- Section Vente & Catalogue -->
          <div class="stats-grid" id="ticketsKpis">
            <div class="stat-card">
              <div class="stat-icon green">🎟️</div>
              <div class="stat-details">
                <h3>Total Tickets Vendus</h3>
                <div class="stat-value" id="tTotalSold">0</div>
                <div class="stat-sub">Tickets rectangulaires de jeu</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon amber">🔺</div>
              <div class="stat-details">
                <h3>Tickets Lots Émis</h3>
                <div class="stat-value" id="tTotalLots">0</div>
                <div class="stat-sub">Tickets triangulaires gagnants</div>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon blue">🪙</div>
              <div class="stat-details">
                <h3>Jetons en Dette</h3>
                <div class="stat-value" id="tTotalTokens">0 F</div>
                <div class="stat-sub">Monnaie due aux participants</div>
              </div>
            </div>
          </div>

          <div class="card" style="margin-top: 1.5rem;">
            <div class="card-header">
              <div class="card-title"><span>📋</span> Types de Billets & Jetons Configurés</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div class="table-responsive" id="ticketsCatalogContainer">
                <div class="empty-state">
                  <div class="empty-icon">🎟️</div>
                  <div class="empty-title">Aucun type de ticket configuré</div>
                  <div class="empty-desc">Configurez vos tickets rectangulaires d'accès aux jeux et vos jetons de monnaie.</div>
                  <button class="btn btn-primary" onclick="TicketsModule.openCreateTicketTypeModal()">
                    <span>➕</span> Créer un type de ticket
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Historique des Ventes de tickets -->
          <div class="card" style="margin-top: 1.5rem;">
            <div class="card-header">
              <div class="card-title"><span>🧾</span> Journal des Ventes de Billets</div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div class="table-responsive" id="ticketsSalesContainer">
                <div class="empty-state">
                  <div class="empty-icon">🧾</div>
                  <div class="empty-title">Aucune vente enregistrée</div>
                  <div class="empty-desc">Les ventes de tickets effectuées aux caisses apparaîtront ici avec le montant, le stand et le caissier.</div>
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
      // 1. Catalogue des tickets
      const { data: catalog } = await client
        .from('tickets_catalog')
        .select(`
          id, type, name, value_f, color, description,
          stand:stands(name, color_name)
        `)
        .order('name');

      this.renderCatalog(catalog || []);

      // 2. Ventes de tickets
      const { data: sales } = await client
        .from('ticket_sales')
        .select(`
          id, quantity, unit_price_f, total_amount_f, created_at,
          ticket:tickets_catalog(name, type),
          stand:stands(name),
          seller:app_users(login)
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      this.renderSales(sales || []);

      // 3. Calcul KPIs
      let totalQty = 0;
      if (sales) {
        sales.forEach(s => totalQty += s.quantity);
      }
      document.getElementById('tTotalSold').textContent = totalQty;

      // 4. Jetons en dette
      const { data: debts } = await client.from('token_debts').select('token_value_f, quantity_given, quantity_redeemed');
      let totalTokenDebt = 0;
      if (debts) {
        debts.forEach(d => {
          const remaining = d.quantity_given - d.quantity_redeemed;
          if (remaining > 0) totalTokenDebt += (remaining * d.token_value_f);
        });
      }
      document.getElementById('tTotalTokens').textContent = `${totalTokenDebt.toLocaleString()} ${KermesseConfig.currency}`;

    } catch (e) {
      console.error('[TicketsModule Error]', e);
    }
  },

  renderCatalog(items) {
    const container = document.getElementById('ticketsCatalogContainer');
    if (!container) return;

    if (!items || items.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎟️</div>
          <div class="empty-title">Aucun type de ticket configuré</div>
          <div class="empty-desc">Configurez vos tickets rectangulaires d'accès aux jeux et vos jetons de monnaie.</div>
          <button class="btn btn-primary" onclick="TicketsModule.openCreateTicketTypeModal()">
            <span>➕</span> Créer un type de ticket
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Type de Support</th>
            <th>Nom</th>
            <th>Valeur / Prix</th>
            <th>Stand Attribué</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(t => {
            let badgeClass = 'badge-primary';
            let icon = '🎟️';
            let label = 'Ticket Rectangulaire (Jeu)';
            if (t.type === 'triangulaire_lot') {
              badgeClass = 'badge-warning';
              icon = '🔺';
              label = 'Ticket Triangulaire (Lot)';
            } else if (t.type === 'jeton_monnaie') {
              badgeClass = 'badge-success';
              icon = '🪙';
              label = 'Jeton de Monnaie';
            }

            return `
              <tr>
                <td>
                  <span class="badge ${badgeClass}">
                    ${icon} ${label}
                  </span>
                </td>
                <td><strong>${t.name}</strong></td>
                <td><strong>${t.value_f.toLocaleString()} ${KermesseConfig.currency}</strong></td>
                <td>${t.stand ? `<span class="stand-tag">${t.stand.name}</span>` : '<span style="color: var(--gray-400);">Général</span>'}</td>
                <td>${t.description || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  renderSales(sales) {
    const container = document.getElementById('ticketsSalesContainer');
    if (!container) return;

    if (!sales || sales.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">Aucune vente enregistrée</div>
          <div class="empty-desc">Les ventes de tickets effectuées aux caisses apparaîtront ici avec le montant, le stand et le caissier.</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Billet Vendu</th>
            <th>Quantité</th>
            <th>Prix Unitaire</th>
            <th>Total Encaissé</th>
            <th>Vendeur / Caissier</th>
          </tr>
        </thead>
        <tbody>
          ${sales.map(s => `
            <tr>
              <td style="font-family: monospace; color: var(--gray-500); font-size: 0.8rem;">
                ${new Date(s.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td><strong>${s.ticket ? s.ticket.name : 'Billet'}</strong></td>
              <td><span class="badge badge-gray">${s.quantity}</span></td>
              <td>${s.unit_price_f} ${KermesseConfig.currency}</td>
              <td><strong style="color: var(--success);">${s.total_amount_f.toLocaleString()} ${KermesseConfig.currency}</strong></td>
              <td>${s.seller ? s.seller.login : 'Inconnu'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openCreateTicketTypeModal() {
    const client = SupabaseClient.client;
    let stands = [];
    if (client) {
      const { data } = await client.from('stands').select('id, name');
      stands = data || [];
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Configurer un Type de Billet ou Jeton</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createTicketTypeForm">
            <div class="form-group">
              <label>Format / Nature du support *</label>
              <select id="ttType" class="form-control" required onchange="
                const val = this.value;
                const priceGroup = document.getElementById('priceGroup');
                const standGroup = document.getElementById('standGroup');
                if (val === 'jeton_monnaie') {
                  document.getElementById('ttValue').value = 200;
                }
              ">
                <option value="rectangulaire_jeu">🎟️ Ticket Rectangulaire — Accès aux jeux</option>
                <option value="triangulaire_lot">🔺 Ticket Triangulaire — Remise de lot gagnant</option>
                <option value="jeton_monnaie">🪙 Jeton de Monnaie (50F, 100F, 200F, 250F)</option>
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Nom du billet / jeton *</label>
                <input type="text" id="ttName" class="form-control" required placeholder="Ex: Ticket Jeu Rouge 1, Jeton 200F...">
              </div>
              <div class="form-group" id="priceGroup">
                <label>Valeur Faciale / Prix (${KermesseConfig.currency}) *</label>
                <input type="number" id="ttValue" class="form-control" value="200" min="0" step="50" required>
              </div>
            </div>

            <div class="form-group" id="standGroup">
              <label>Stand attribué (optionnel)</label>
              <select id="ttStand" class="form-control">
                <option value="">Tous stands / Général</option>
                ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-group">
              <label>Description / Précision</label>
              <input type="text" id="ttDesc" class="form-control" placeholder="Couleur du papier ou détail de validité">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveTicketTypeBtn">Enregistrer le type</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveTicketTypeBtn').onclick = async () => {
      const type = document.getElementById('ttType').value;
      const name = document.getElementById('ttName').value.trim();
      const value = parseInt(document.getElementById('ttValue').value, 10);
      const standId = document.getElementById('ttStand').value || null;
      const desc = document.getElementById('ttDesc').value.trim();

      if (!name || isNaN(value)) {
        Notify.error('Veuillez renseigner le nom et la valeur.');
        return;
      }

      if (client) {
        const { error } = await client.from('tickets_catalog').insert([{
          type,
          name,
          value_f: value,
          stand_id: standId,
          description: desc,
          is_active: true
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CREATION_TYPE_TICKET', 'ticket', null, `Création du type de ticket ${name} (${type}, ${value} F)`);
        Notify.success(`Type ${name} enregistré.`);
        close();
        TicketsModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async openSaleModal() {
    const client = SupabaseClient.client;
    if (!client) return;

    // Charger les caisses ouvertes
    const { data: openRegisters } = await client
      .from('cash_registers')
      .select('id, name, stand:stands(name)')
      .eq('status', 'open');

    if (!openRegisters || openRegisters.length === 0) {
      Notify.warning('Aucune caisse n\'est actuellement ouverte. Veuillez ouvrir une caisse avant d\'enregistrer des ventes.');
      return;
    }

    // Charger les tickets de jeu
    const { data: tickets } = await client
      .from('tickets_catalog')
      .select('id, name, value_f, type')
      .eq('type', 'rectangulaire_jeu');

    if (!tickets || tickets.length === 0) {
      Notify.warning('Veuillez d\'abord configurer au moins un Ticket Rectangulaire dans le catalogue.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Enregistrer une Vente de Tickets</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="saleTicketForm">
            <div class="form-group">
              <label>Caisse Encaissante *</label>
              <select id="saleRegister" class="form-control" required>
                ${openRegisters.map(r => `<option value="${r.id}">${r.name} (${r.stand ? r.stand.name : 'Générale'})</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Ticket / Billet *</label>
                <select id="saleTicket" class="form-control" required onchange="
                  const selected = ${JSON.stringify(tickets)}.find(t => t.id === this.value);
                  if (selected) {
                    document.getElementById('saleUnitPrice').value = selected.value_f;
                    TicketsModule.calcSaleTotal();
                  }
                ">
                  ${tickets.map(t => `<option value="${t.id}">${t.name} (${t.value_f} ${KermesseConfig.currency})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Prix Unitaire (${KermesseConfig.currency})</label>
                <input type="number" id="saleUnitPrice" class="form-control" value="${tickets[0].value_f}" readonly>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Quantité Vendue *</label>
                <input type="number" id="saleQty" class="form-control" value="1" min="1" required oninput="TicketsModule.calcSaleTotal()">
              </div>
              <div class="form-group">
                <label>Total à Encaisser</label>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--success); padding-top: 0.35rem;" id="saleTotalDisplay">
                  ${tickets[0].value_f} ${KermesseConfig.currency}
                </div>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmSaleBtn">Encaisser & Valider</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmSaleBtn').onclick = async () => {
      const regId = document.getElementById('saleRegister').value;
      const ticketId = document.getElementById('saleTicket').value;
      const qty = parseInt(document.getElementById('saleQty').value, 10);
      const unitPrice = parseInt(document.getElementById('saleUnitPrice').value, 10);
      const totalAmount = qty * unitPrice;
      const user = Auth.getCurrentUser();

      if (isNaN(qty) || qty <= 0) {
        Notify.error('Quantité invalide.');
        return;
      }

      // 1. Insérer la vente
      const { error: sErr } = await client.from('ticket_sales').insert([{
        cash_register_id: regId,
        ticket_id: ticketId,
        quantity: qty,
        unit_price_f: unitPrice,
        total_amount_f: totalAmount,
        sold_by: user ? user.id : null
      }]);

      if (sErr) {
        Notify.error('Erreur vente: ' + sErr.message);
        return;
      }

      // 2. Enregistrer le mouvement de caisse
      await client.from('cash_movements').insert([{
        cash_register_id: regId,
        type: 'vente',
        amount_f: totalAmount,
        reason: `Vente de ${qty} ticket(s)`,
        user_id: user ? user.id : null
      }]);

      AuditLogger.log('VENTE_TICKET', 'cash_register', regId, `Vente de ${qty} ticket(s) pour un total de ${totalAmount} F par ${user?.login}`);
      Notify.success(`Vente de ${totalAmount.toLocaleString()} F enregistrée.`);
      close();
      TicketsModule.render(document.getElementById('mainContent'));
    };
  },

  calcSaleTotal() {
    const qty = parseInt(document.getElementById('saleQty').value, 10) || 0;
    const unitPrice = parseInt(document.getElementById('saleUnitPrice').value, 10) || 0;
    const total = qty * unitPrice;
    const display = document.getElementById('saleTotalDisplay');
    if (display) {
      display.textContent = `${total.toLocaleString()} ${KermesseConfig.currency}`;
    }
  }
};

window.TicketsModule = TicketsModule;
