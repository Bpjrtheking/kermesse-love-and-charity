/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 2 : BILLETTERIE, POINT DE VENTE (POS) & COMPTABILITÉ DES VENTES
 * 
 * 1. Caisse 2 : Vente des tickets de jeux reliée directement aux Stands & Jeux créés (sélection tactile 1-clic)
 * 2. Caisse 1 : Entrée & Accueil des visiteurs (comptage flux et tickets d'entrée)
 * 3. Caisse 3 : Monnaie & Jetons (Change, émission et remboursement de jetons)
 * 4. Comptabilité automatisée : Suivi des recettes par stand/jeu, calcul de monnaie et journal immuable
 */

const TicketsModule = {
  currentTab: 'pos_games', // 'pos_games', 'pos_entry', 'tokens', 'sales_journal', 'bilan_summary'
  activeStandFilter: 'all',
  
  games: [],
  stands: [],
  registers: [],
  sales: [],
  tokens: [],
  
  // Panier en cours pour la caisse tactile des jeux
  cart: [],

  // Panier pour la caisse d'entrée
  entryCart: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎟️</span> Pôle 2 : Billetterie &amp; Point de Vente Caisse
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('cash')">
              <span>💵</span> Gérer les Caisses &amp; Fonds
            </button>
            <button class="btn btn-primary btn-sm" onclick="TicketsModule.switchTab('pos_games')">
              <span>🎯</span> Caisse Tactile Jeux
            </button>
          </div>
        </div>

        <div class="card-body">
          <!-- KPI Summary Cards -->
          <div class="stats-grid" id="ticketsKpisGrid">
            <div class="stat-card">
              <div class="stat-label">Total Recettes Encaissées</div>
              <div class="stat-value" id="kpiTotalRevenue" style="color: var(--success, #10b981);">0 F</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Tickets Jeux Vendus</div>
              <div class="stat-value" id="kpiTotalGameTickets" style="color: var(--primary);">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Visiteurs Entrés (Entrées)</div>
              <div class="stat-value" id="kpiTotalVisitors" style="color: #2563eb;">0</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Dette Jetons en Circulation</div>
              <div class="stat-value" id="kpiTotalTokenDebt" style="color: var(--warning, #f59e0b);">0 F</div>
            </div>
          </div>

          <!-- Tabs Navigation -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn active" id="tabBtnPosGames" onclick="TicketsModule.switchTab('pos_games')">
              🎯 Caisse 2 : Vente Tickets Jeux (Stands)
            </button>
            <button class="tab-btn" id="tabBtnPosEntry" onclick="TicketsModule.switchTab('pos_entry')">
              🎟️ Caisse 1 : Entrée &amp; Accueil
            </button>
            <button class="tab-btn" id="tabBtnTokens" onclick="TicketsModule.switchTab('tokens')">
              🪙 Caisse 3 : Monnaie &amp; Jetons
            </button>
            <button class="tab-btn" id="tabBtnSales" onclick="TicketsModule.switchTab('sales_journal')">
              🧾 Journal des Ventes
            </button>
            <button class="tab-btn" id="tabBtnBilan" onclick="TicketsModule.switchTab('bilan_summary')">
              📊 Bilan Financier Kermesse
            </button>
          </div>

          <!-- Dynamic Content -->
          <div id="ticketsTabContent">
            <div style="text-align: center; padding: 2rem; color: var(--gray-500);">Chargement de la billetterie et des jeux...</div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  switchTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btnMap = {
      'pos_games': 'tabBtnPosGames',
      'pos_entry': 'tabBtnPosEntry',
      'tokens': 'tabBtnTokens',
      'sales_journal': 'tabBtnSales',
      'bilan_summary': 'tabBtnBilan'
    };
    const activeBtn = document.getElementById(btnMap[tab]);
    if (activeBtn) activeBtn.classList.add('active');

    this.renderCurrentTab();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        // 1. Jeux avec Stand rattaché
        const { data: gData } = await client
          .from('games')
          .select('id, name, ticket_price_f, stand_id, is_active, stand:stands(id, name, number, color_name, color_hex)')
          .order('name');
        if (gData) this.games = gData;

        // 2. Stands
        const { data: sData } = await client.from('stands').select('id, name, number, color_name, color_hex').order('number');
        if (sData) this.stands = sData;

        // 3. Caisses
        const { data: rData } = await client
          .from('cash_registers')
          .select('id, name, status, initial_amount_f, stand_id')
          .order('name');
        if (rData) this.registers = rData;

        // 4. Ventes
        const { data: vData } = await client
          .from('ticket_sales')
          .select(`
            id, quantity, unit_price_f, total_amount_f, item_name, category, created_at,
            stand:stands(name, color_name, color_hex),
            cash_register:cash_registers(name),
            seller:app_users(login)
          `)
          .order('created_at', { ascending: false })
          .limit(200);
        if (vData) this.sales = vData;

        // 5. Jetons & dettes
        const { data: tData } = await client.from('token_debts').select('*');
        if (tData) this.tokens = tData;
      }
    } catch (e) {
      console.warn('[TicketsModule Load Warning]', e);
    }

    // Récupération locale de secours
    const storedSales = localStorage.getItem('kermesse_ticket_sales');
    if (storedSales) {
      try {
        const localSales = JSON.parse(storedSales);
        this.sales = [...this.sales, ...localSales.filter(ls => !this.sales.some(s => s.id === ls.id))];
      } catch (e) {}
    }

    // S'assurer que les 3 caisses officielles existent localement si DB vide
    if (!this.registers || this.registers.length === 0) {
      this.registers = [
        { id: 'reg-1', name: 'Caisse 1 — Entrée & Accueil Visiteurs', status: 'open', initial_amount_f: 20000 },
        { id: 'reg-2', name: 'Caisse 2 — Vente Tickets Jeux & Stands', status: 'open', initial_amount_f: 20000 },
        { id: 'reg-3', name: 'Caisse 3 — Change & Jetons de Monnaie', status: 'open', initial_amount_f: 20000 },
        { id: 'reg-4', name: 'Caisse 4 — Restauration & Buvette (Optionnelle)', status: 'open', initial_amount_f: 20000 }
      ];
    }

    this.updateKpis();
    this.renderCurrentTab();
  },

  updateKpis() {
    let totalRev = 0;
    let totalGameTickets = 0;
    let totalVisitors = 0;

    this.sales.forEach(s => {
      totalRev += (s.total_amount_f || 0);
      if (s.category === 'entree') {
        totalVisitors += (s.quantity || 1);
      } else {
        totalGameTickets += (s.quantity || 0);
      }
    });

    let tokenDebt = 0;
    this.tokens.forEach(t => {
      if (t.status === 'en_circulation') {
        tokenDebt += (t.token_value_f * (t.quantity_given - t.quantity_redeemed));
      }
    });

    const elR = document.getElementById('kpiTotalRevenue');
    const elG = document.getElementById('kpiTotalGameTickets');
    const elV = document.getElementById('kpiTotalVisitors');
    const elT = document.getElementById('kpiTotalTokenDebt');

    if (elR) elR.textContent = `${totalRev.toLocaleString()} ${KermesseConfig.currency}`;
    if (elG) elG.textContent = totalGameTickets.toLocaleString();
    if (elV) elV.textContent = totalVisitors.toLocaleString();
    if (elT) elT.textContent = `${tokenDebt.toLocaleString()} ${KermesseConfig.currency}`;
  },

  renderCurrentTab() {
    const container = document.getElementById('ticketsTabContent');
    if (!container) return;

    if (this.currentTab === 'pos_games') {
      this.renderPosGamesTab(container);
    } else if (this.currentTab === 'pos_entry') {
      this.renderPosEntryTab(container);
    } else if (this.currentTab === 'tokens') {
      this.renderTokensTab(container);
    } else if (this.currentTab === 'sales_journal') {
      this.renderSalesJournalTab(container);
    } else if (this.currentTab === 'bilan_summary') {
      this.renderBilanSummaryTab(container);
    }
  },

  // ============================================================================
  // 1. ONGLET : CAISSE 2 — VENTE TICKETS JEUX & STANDS (POINT DE VENTE TACTILE)
  // ============================================================================
  renderPosGamesTab(container) {
    const activeGames = (this.games || []).filter(g => g.is_active !== false);
    const standsList = this.stands || [];

    // Filtrage par stand
    const filteredGames = this.activeStandFilter === 'all'
      ? activeGames
      : activeGames.filter(g => g.stand && g.stand.id === this.activeStandFilter);

    // Caisses disponibles pour les jeux (priorité Caisse 2)
    const openRegs = this.registers.filter(r => r.status === 'open');
    const defaultReg = openRegs.find(r => r.name.includes('Caisse 2')) || openRegs[0];

    const cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem; align-items: start;">
        
        <!-- COLONNE GAUCHE : SÉLECTION DES JEUX (TACTILE) -->
        <div>
          <!-- Barre d'info caisse -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #1e40af;">🎯 Caisse Active :</span>
              <select id="posActiveRegister" class="form-control" style="display: inline-block; width: auto; font-size: 0.85rem; padding: 4px 8px; margin-left: 6px;">
                ${openRegs.map(r => `<option value="${r.id}" ${defaultReg && defaultReg.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div style="font-size: 0.8rem; color: #3b82f6;">
              💡 Cliquez sur un jeu pour l'ajouter au panier. Tout est comptabilisé automatiquement par Stand.
            </div>
          </div>

          <!-- Filtres rapides par Stand -->
          <div style="display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <button class="btn btn-sm ${this.activeStandFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="TicketsModule.setStandFilter('all')">
              🎪 Tous les Stands (${activeGames.length})
            </button>
            ${standsList.map(s => `
              <button class="btn btn-sm ${this.activeStandFilter === s.id ? 'btn-primary' : 'btn-secondary'}" style="${this.activeStandFilter === s.id ? `background: ${s.color_hex}; border-color: ${s.color_hex};` : ''}" onclick="TicketsModule.setStandFilter('${s.id}')">
                <span class="color-dot" style="background-color: ${s.color_hex};"></span>
                ${s.color_name} ${s.number}
              </button>
            `).join('')}
          </div>

          <!-- Grille des jeux / attractions -->
          ${filteredGames.length === 0 ? `
            <div class="empty-state" style="padding: 2rem;">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">Aucun jeu disponible</div>
              <div class="empty-desc">Ajoutez des jeux dans le catalogue pour qu'ils apparaissent instantanément sur la caisse tactile.</div>
              <button class="btn btn-primary" onclick="App.navigateTo('games')">
                <span>➕</span> Configurer des jeux
              </button>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
              ${filteredGames.map(g => {
                const standColor = g.stand ? g.stand.color_hex : '#64748b';
                const standName = g.stand ? `${g.stand.color_name} ${g.stand.number}` : 'Général';
                const price = g.ticket_price_f || 200;

                return `
                  <div class="card" style="border: 2px solid ${standColor}40; border-top: 5px solid ${standColor}; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                    <div class="card-body" style="padding: 0.85rem;" onclick="TicketsModule.addToCart('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}')">
                      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.35rem;">
                        <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.72rem; padding: 1px 6px;">
                          ${standName}
                        </span>
                        <strong style="color: var(--primary); font-size: 1.05rem;">
                          ${price.toLocaleString()} F
                        </strong>
                      </div>
                      <div style="font-weight: 700; font-size: 0.95rem; color: var(--gray-900); margin-bottom: 0.5rem; min-height: 2.2em; line-height: 1.2;">
                        ${g.name}
                      </div>
                      <div style="display: flex; gap: 0.3rem;" onclick="event.stopPropagation();">
                        <button class="btn btn-secondary btn-sm" style="flex: 1; padding: 2px 4px; font-size: 0.75rem;" onclick="TicketsModule.addToCart('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}', 1)">
                          +1 Ticket
                        </button>
                        <button class="btn btn-secondary btn-sm" style="flex: 1; padding: 2px 4px; font-size: 0.75rem;" onclick="TicketsModule.addToCart('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}', 3)">
                          +3
                        </button>
                        <button class="btn btn-secondary btn-sm" style="flex: 1; padding: 2px 4px; font-size: 0.75rem;" onclick="TicketsModule.addToCart('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}', 5)">
                          +5
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- COLONNE DROITE : PANIER DE VENTE & CALCULATEUR MONNAIE -->
        <div class="card" style="border: 2px solid var(--primary); box-shadow: var(--shadow-md); position: sticky; top: 1rem;">
          <div class="card-header" style="background: var(--primary); color: white; padding: 0.75rem 1rem;">
            <div class="card-title" style="color: white; font-size: 1rem;">
              <span>🛒</span> Panier en cours (${this.cart.reduce((s, i) => s + i.qty, 0)})
            </div>
            ${this.cart.length > 0 ? `
              <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 2px 8px; font-size: 0.75rem;" onclick="TicketsModule.clearCart()">
                Vider
              </button>
            ` : ''}
          </div>

          <div class="card-body" style="padding: 1rem;">
            ${this.cart.length === 0 ? `
              <div style="text-align: center; padding: 2rem 0; color: var(--gray-400);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎯</div>
                <div style="font-size: 0.9rem;">Panier vide</div>
                <div style="font-size: 0.78rem;">Cliquez sur un jeu pour commencer la commande.</div>
              </div>
            ` : `
              <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                ${this.cart.map((item, idx) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--gray-100);">
                    <div>
                      <div style="font-weight: 700; font-size: 0.85rem; color: var(--gray-900);">
                        ${item.name}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">
                        <span class="stand-tag" style="background-color: ${item.standColor}15; color: ${item.standColor}; border-color: ${item.standColor}; padding: 0 4px; font-size: 0.68rem;">
                          ${item.standName}
                        </span>
                        ${item.price} F &times; ${item.qty}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <strong style="color: var(--primary); font-size: 0.9rem;">
                        ${(item.price * item.qty).toLocaleString()} F
                      </strong>
                      <button class="btn-icon danger" style="padding: 2px 5px; font-size: 0.75rem;" onclick="TicketsModule.removeFromCart(${idx})">
                        &times;
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Total Panier -->
              <div style="background: var(--gray-50); padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid var(--gray-200);">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.15rem; font-weight: 800;">
                  <span>TOTAL :</span>
                  <span style="color: var(--success, #10b981); font-size: 1.4rem;">
                    ${cartTotal.toLocaleString()} ${KermesseConfig.currency}
                  </span>
                </div>
              </div>

              <!-- Calculateur rapide de monnaie rendu -->
              <div style="margin-bottom: 1rem; background: #f8fafc; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-700); margin-bottom: 0.35rem; display: block;">
                  Espèces Remises par le client :
                </label>
                <div style="display: flex; gap: 0.3rem; margin-bottom: 0.4rem; flex-wrap: wrap;">
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="TicketsModule.setGivenCash(${cartTotal})">Exact</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="TicketsModule.setGivenCash(1000)">1 000 F</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="TicketsModule.setGivenCash(2000)">2 000 F</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="TicketsModule.setGivenCash(5000)">5 000 F</button>
                  <button type="button" class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="TicketsModule.setGivenCash(10000)">10 000 F</button>
                </div>
                <input type="number" id="posCashGiven" class="form-control" style="font-weight: 700; font-size: 1rem;" placeholder="Montant reçu..." oninput="TicketsModule.calcChange(${cartTotal})">
                <div id="posChangeDisplay" style="margin-top: 0.35rem; font-weight: 700; font-size: 0.85rem; color: #1e40af;">
                  Monnaie à rendre : 0 F
                </div>
              </div>

              <!-- Bouton d'encaissement immédiat -->
              <button class="btn btn-primary" style="width: 100%; font-size: 1.1rem; font-weight: 800; padding: 0.75rem;" onclick="TicketsModule.checkoutCart()">
                💳 Valider &amp; Encaisser (${cartTotal.toLocaleString()} F)
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  },

  setStandFilter(standId) {
    this.activeStandFilter = standId;
    this.renderCurrentTab();
  },

  addToCart(gameId, name, price, standName, standColor, standId, quantity = 1) {
    const existing = this.cart.find(i => i.gameId === gameId);
    if (existing) {
      existing.qty += quantity;
    } else {
      this.cart.push({
        gameId,
        name,
        price,
        standName,
        standColor,
        standId: standId || null,
        qty: quantity
      });
    }

    Notify.info(`+${quantity} ${name} au panier`);
    this.renderCurrentTab();
  },

  removeFromCart(idx) {
    this.cart.splice(idx, 1);
    this.renderCurrentTab();
  },

  clearCart() {
    this.cart = [];
    this.renderCurrentTab();
  },

  setGivenCash(amount) {
    const input = document.getElementById('posCashGiven');
    if (input) {
      input.value = amount;
      const cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
      this.calcChange(cartTotal);
    }
  },

  calcChange(total) {
    const input = document.getElementById('posCashGiven');
    const disp = document.getElementById('posChangeDisplay');
    if (!input || !disp) return;

    const given = parseInt(input.value || '0', 10);
    const change = given - total;

    if (given <= 0) {
      disp.innerHTML = 'Monnaie à rendre : 0 F';
      disp.style.color = '#1e40af';
    } else if (change < 0) {
      disp.innerHTML = `⚠️ Manque <strong>${Math.abs(change).toLocaleString()} F</strong> pour couvrir le total !`;
      disp.style.color = 'var(--danger, #ef4444)';
    } else {
      disp.innerHTML = `💵 <strong>À RENDRE : ${change.toLocaleString()} F</strong>`;
      disp.style.color = 'var(--success, #10b981)';
    }
  },

  async checkoutCart() {
    if (this.cart.length === 0) return;

    const regSelect = document.getElementById('posActiveRegister');
    const regId = regSelect ? regSelect.value : null;

    if (!regId) {
      Notify.warning('Veuillez sélectionner une caisse ouverte.');
      return;
    }

    const reg = this.registers.find(r => r.id === regId);
    const regName = reg ? reg.name : 'Caisse 2';

    const cartTotal = this.cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalTickets = this.cart.reduce((sum, item) => sum + item.qty, 0);
    const currentUser = Auth.getCurrentUser();
    const sellerLogin = currentUser ? currentUser.login : 'Caissier';

    const client = SupabaseClient.client;
    const now = new Date().toISOString();
    const newSales = [];

    for (const item of this.cart) {
      const saleItem = {
        id: 'sale-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        cash_register_id: regId,
        stand_id: item.standId,
        game_id: item.gameId,
        item_name: item.name,
        category: 'jeu',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        seller_id: currentUser ? currentUser.id : null,
        created_at: now,
        stand: { name: item.standName, color_name: item.standName, color_hex: item.standColor },
        cash_register: { name: regName },
        seller: { login: sellerLogin }
      };

      newSales.push(saleItem);
    }

    if (client) {
      try {
        const insertPayloads = newSales.map(s => ({
          cash_register_id: s.cash_register_id,
          stand_id: s.stand_id,
          game_id: s.game_id,
          item_name: s.item_name,
          category: s.category,
          quantity: s.quantity,
          unit_price_f: s.unit_price_f,
          total_amount_f: s.total_amount_f,
          sold_by: s.seller_id
        }));

        await client.from('ticket_sales').insert(insertPayloads);

        // Mouvement de caisse entrant
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente POS : ${totalTickets} ticket(s) de jeux`,
          user_id: currentUser ? currentUser.id : null
        }]);
      } catch (e) {
        console.warn('[Checkout Supabase Warning]', e);
      }
    }

    // Persistance locale de secours
    const stored = JSON.parse(localStorage.getItem('kermesse_ticket_sales') || '[]');
    stored.push(...newSales);
    localStorage.setItem('kermesse_ticket_sales', JSON.stringify(stored));
    this.sales.unshift(...newSales);

    AuditLogger.log(
      'VENTE_TICKETS_JEUX',
      'ticket_sale',
      null,
      `Encaissement de ${cartTotal} F (${totalTickets} tickets jeux) sur ${regName} par ${sellerLogin}`
    );

    Notify.success(`✅ Vente de ${cartTotal.toLocaleString()} F (${totalTickets} tickets) enregistrée avec succès !`);
    this.cart = [];
    this.updateKpis();
    this.renderCurrentTab();
  },

  // ============================================================================
  // 2. ONGLET : CAISSE 1 — ENTRÉE & ACCUEIL VISITEURS
  // ============================================================================
  renderPosEntryTab(container) {
    const entryTypes = [
      { id: 'ent-enf', name: 'Entrée Enfant', price: 200, icon: '🧒' },
      { id: 'ent-adu', name: 'Entrée Adulte', price: 500, icon: '🧑' },
      { id: 'ent-fam', name: 'Pass Famille (4 personnes)', price: 1200, icon: '👨‍👩‍👧‍👦' },
      { id: 'ent-don', name: 'Entrée Bienfaiteur / Donateur', price: 2000, icon: '❤️' }
    ];

    const openRegs = this.registers.filter(r => r.status === 'open');
    const defaultReg = openRegs.find(r => r.name.includes('Caisse 1')) || openRegs[0];
    const totalVisitors = this.sales.filter(s => s.category === 'entree').reduce((sum, s) => sum + s.quantity, 0);
    const totalEntryRevenue = this.sales.filter(s => s.category === 'entree').reduce((sum, s) => sum + s.total_amount_f, 0);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem;">
        
        <div>
          <!-- Bannière Caisse 1 -->
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #065f46;">🎟️ Caisse d'Entrée Active :</span>
              <select id="posEntryActiveRegister" class="form-control" style="display: inline-block; width: auto; font-size: 0.85rem; padding: 4px 8px; margin-left: 6px;">
                ${openRegs.map(r => `<option value="${r.id}" ${defaultReg && defaultReg.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div style="font-size: 0.85rem; font-weight: 700; color: #047857;">
              👥 Visiteurs comptabilisés : ${totalVisitors.toLocaleString()}
            </div>
          </div>

          <h3 style="font-size: 1rem; margin-bottom: 0.75rem; color: var(--gray-800);">Sélectionnez les billets d'entrée :</h3>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0.85rem;">
            ${entryTypes.map(t => `
              <div class="card" style="border: 2px solid #10b98140; border-top: 5px solid #10b981; cursor: pointer; transition: transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                <div class="card-body" style="padding: 1rem;" onclick="TicketsModule.addEntryToCart('${t.id}', '${t.name}', ${t.price}, 1)">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 1.75rem;">${t.icon}</span>
                    <strong style="font-size: 1.2rem; color: #047857;">${t.price.toLocaleString()} F</strong>
                  </div>
                  <div style="font-weight: 700; font-size: 1rem; margin-bottom: 0.75rem;">${t.name}</div>
                  <div style="display: flex; gap: 0.35rem;" onclick="event.stopPropagation();">
                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TicketsModule.addEntryToCart('${t.id}', '${t.name}', ${t.price}, 1)">+1 Entrée</button>
                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TicketsModule.addEntryToCart('${t.id}', '${t.name}', ${t.price}, 2)">+2</button>
                    <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="TicketsModule.addEntryToCart('${t.id}', '${t.name}', ${t.price}, 5)">+5</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Panier Entrée -->
        <div class="card" style="border: 2px solid #10b981; box-shadow: var(--shadow-md);">
          <div class="card-header" style="background: #10b981; color: white; padding: 0.75rem 1rem;">
            <div class="card-title" style="color: white; font-size: 1rem;">
              <span>🎟️</span> Billets d'Entrée (${this.entryCart.reduce((s, i) => s + i.qty, 0)})
            </div>
            ${this.entryCart.length > 0 ? `
              <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 2px 8px; font-size: 0.75rem;" onclick="TicketsModule.clearEntryCart()">
                Vider
              </button>
            ` : ''}
          </div>

          <div class="card-body" style="padding: 1rem;">
            ${this.entryCart.length === 0 ? `
              <div style="text-align: center; padding: 2rem 0; color: var(--gray-400);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎟️</div>
                <div style="font-size: 0.9rem;">Aucun billet d'entrée sélectionné</div>
              </div>
            ` : `
              <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem;">
                ${this.entryCart.map((item, idx) => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--gray-100);">
                    <div>
                      <div style="font-weight: 700; font-size: 0.85rem;">${item.name}</div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">${item.price} F &times; ${item.qty}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.35rem;">
                      <strong style="color: #047857; font-size: 0.9rem;">
                        ${(item.price * item.qty).toLocaleString()} F
                      </strong>
                      <button class="btn-icon danger" style="padding: 2px 5px;" onclick="TicketsModule.removeEntryFromCart(${idx})">&times;</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="background: #ecfdf5; padding: 0.85rem; border-radius: var(--radius-md); margin-bottom: 1rem; border: 1px solid #a7f3d0;">
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 1.15rem; font-weight: 800;">
                  <span>TOTAL ENTRÉE :</span>
                  <span style="color: #047857; font-size: 1.4rem;">
                    ${this.entryCart.reduce((sum, item) => sum + (item.price * item.qty), 0).toLocaleString()} F
                  </span>
                </div>
              </div>

              <button class="btn btn-primary" style="width: 100%; font-size: 1.1rem; font-weight: 800; padding: 0.75rem; background: #10b981; border-color: #059669;" onclick="TicketsModule.checkoutEntryCart()">
                🎟️ Encaisser &amp; Valider Entrées
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  },

  addEntryToCart(id, name, price, quantity = 1) {
    const existing = this.entryCart.find(i => i.id === id);
    if (existing) {
      existing.qty += quantity;
    } else {
      this.entryCart.push({ id, name, price, qty: quantity });
    }
    this.renderCurrentTab();
  },

  removeEntryFromCart(idx) {
    this.entryCart.splice(idx, 1);
    this.renderCurrentTab();
  },

  clearEntryCart() {
    this.entryCart = [];
    this.renderCurrentTab();
  },

  async checkoutEntryCart() {
    if (this.entryCart.length === 0) return;

    const regSelect = document.getElementById('posEntryActiveRegister');
    const regId = regSelect ? regSelect.value : null;

    if (!regId) {
      Notify.warning('Veuillez sélectionner une caisse ouverte.');
      return;
    }

    const reg = this.registers.find(r => r.id === regId);
    const regName = reg ? reg.name : 'Caisse 1 Entrée';

    const cartTotal = this.entryCart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const totalTickets = this.entryCart.reduce((sum, item) => sum + item.qty, 0);
    const currentUser = Auth.getCurrentUser();
    const sellerLogin = currentUser ? currentUser.login : 'Caissier Entrée';

    const client = SupabaseClient.client;
    const now = new Date().toISOString();
    const newSales = [];

    for (const item of this.entryCart) {
      const saleItem = {
        id: 'entry-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        cash_register_id: regId,
        stand_id: null,
        game_id: null,
        item_name: item.name,
        category: 'entree',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        seller_id: currentUser ? currentUser.id : null,
        created_at: now,
        stand: { name: 'Entrée Principale', color_name: 'Vert', color_hex: '#10b981' },
        cash_register: { name: regName },
        seller: { login: sellerLogin }
      };

      newSales.push(saleItem);
    }

    if (client) {
      try {
        const insertPayloads = newSales.map(s => ({
          cash_register_id: s.cash_register_id,
          stand_id: null,
          game_id: null,
          item_name: s.item_name,
          category: 'entree',
          quantity: s.quantity,
          unit_price_f: s.unit_price_f,
          total_amount_f: s.total_amount_f,
          sold_by: s.seller_id
        }));

        await client.from('ticket_sales').insert(insertPayloads);

        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Billetterie Entrée : ${totalTickets} visiteur(s)`,
          user_id: currentUser ? currentUser.id : null
        }]);
      } catch (e) {
        console.warn('[Entry Checkout Supabase Warning]', e);
      }
    }

    const stored = JSON.parse(localStorage.getItem('kermesse_ticket_sales') || '[]');
    stored.push(...newSales);
    localStorage.setItem('kermesse_ticket_sales', JSON.stringify(stored));
    this.sales.unshift(...newSales);

    AuditLogger.log(
      'VENTE_ENTREES_VISITEURS',
      'ticket_sale',
      null,
      `Encaissement de ${cartTotal} F (${totalTickets} entrées) sur ${regName} par ${sellerLogin}`
    );

    Notify.success(`🎟️ ${totalTickets} entrée(s) validée(s) (${cartTotal.toLocaleString()} F) !`);
    this.entryCart = [];
    this.updateKpis();
    this.renderCurrentTab();
  },

  // ============================================================================
  // 3. ONGLET : CAISSE 3 — MONNAIE & JETONS (COMPTOIR DE CHANGE)
  // ============================================================================
  renderTokensTab(container) {
    const tokenValues = [50, 100, 200, 250];
    const openRegs = this.registers.filter(r => r.status === 'open');
    const defaultReg = openRegs.find(r => r.name.includes('Caisse 3')) || openRegs[0];

    container.innerHTML = `
      <div class="alert-banner warning" style="margin-bottom: 1.25rem;">
        <div>
          🪙 <strong>Comptoir de Change Love &amp; Charity (Caisse 3) :</strong> Les jetons remis aux participants représentent une dette de monnaie de la caisse.
          <br><em>Règle de sécurité stricte : Aucun remboursement en liquide n'est effectué sans la remise physique du jeton correspondant.</em>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        
        <!-- ÉMISSION DE JETONS / MONNAIE -->
        <div class="card" style="border: 2px solid #f59e0b;">
          <div class="card-header" style="background: #fef3c7;">
            <h3 style="margin: 0; color: #b45309; font-size: 1rem;">🪙 Remise de Jetons (Émission de Monnaie)</h3>
          </div>
          <div class="card-body">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
              En cas de manque de petite monnaie en caisse, remettez un jeton au participant.
            </p>
            <div class="form-group">
              <label>Caisse émettrice :</label>
              <select id="tokenIssueRegister" class="form-control">
                ${openRegs.map(r => `<option value="${r.id}" ${defaultReg && defaultReg.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Valeur faciale du Jeton</label>
                <select id="tokenIssueVal" class="form-control">
                  ${tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité remise</label>
                <input type="number" id="tokenIssueQty" class="form-control" value="1" min="1">
              </div>
            </div>
            <button class="btn btn-primary" style="width: 100%; background: #d97706; border-color: #b45309;" onclick="TicketsModule.recordTokenIssue()">
              🪙 Enregistrer la remise de jeton
            </button>
          </div>
        </div>

        <!-- REMBOURSEMENT DE JETONS CONTRE ESPÈCES -->
        <div class="card" style="border: 2px solid #10b981;">
          <div class="card-header" style="background: #dcfce7;">
            <h3 style="margin: 0; color: #15803d; font-size: 1rem;">💵 Remboursement en Espèces (Restitution Jeton)</h3>
          </div>
          <div class="card-body">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
              Le participant rapporte son jeton physique pour récupérer son argent en liquide.
            </p>
            <div class="form-group">
              <label>Caisse remboursant :</label>
              <select id="tokenRefundRegister" class="form-control">
                ${openRegs.map(r => `<option value="${r.id}" ${defaultReg && defaultReg.id === r.id ? 'selected' : ''}>${r.name}</option>`).join('')}
              </select>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Jeton rapporté</label>
                <select id="tokenRefundVal" class="form-control">
                  ${tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité récupérée</label>
                <input type="number" id="tokenRefundQty" class="form-control" value="1" min="1">
              </div>
            </div>
            <button class="btn btn-primary" style="width: 100%; background: #16a34a; border-color: #15803d;" onclick="TicketsModule.recordTokenRefund()">
              💵 Rembourser en espèces &amp; Récupérer le jeton
            </button>
          </div>
        </div>

      </div>
    `;
  },

  async recordTokenIssue() {
    const regId = document.getElementById('tokenIssueRegister')?.value;
    const val = parseInt(document.getElementById('tokenIssueVal')?.value, 10);
    const qty = parseInt(document.getElementById('tokenIssueQty')?.value, 10);

    if (!regId || isNaN(val) || isNaN(qty) || qty <= 0) {
      Notify.error('Paramètres invalides.');
      return;
    }

    const totalF = val * qty;
    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('token_debts').insert([{
          cash_register_id: regId,
          token_value_f: val,
          quantity_given: qty,
          quantity_redeemed: 0,
          status: 'en_circulation'
        }]);
      } catch (e) {}
    }

    AuditLogger.log('EMISSION_JETON', 'token_debt', null, `Émission de ${qty} jeton(s) de ${val} F (Dette: ${totalF} F)`);
    Notify.success(`🪙 ${qty} jeton(s) de ${val} F émis (Dette enregistrée : ${totalF} F).`);
    await this.loadData();
  },

  async recordTokenRefund() {
    const regId = document.getElementById('tokenRefundRegister')?.value;
    const val = parseInt(document.getElementById('tokenRefundVal')?.value, 10);
    const qty = parseInt(document.getElementById('tokenRefundQty')?.value, 10);

    if (!regId || isNaN(val) || isNaN(qty) || qty <= 0) {
      Notify.error('Paramètres invalides.');
      return;
    }

    const totalF = val * qty;
    const client = SupabaseClient.client;
    const currentUser = Auth.getCurrentUser();

    if (client) {
      try {
        // Enregistrer la sortie de caisse
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'remboursement_jeton',
          amount_f: -totalF,
          reason: `Remboursement de ${qty} jeton(s) de ${val} F`,
          user_id: currentUser ? currentUser.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('REMBOURSEMENT_JETON', 'cash_movement', null, `Remboursement en espèces de ${totalF} F contre ${qty} jeton(s) de ${val} F`);
    Notify.success(`💵 ${totalF} F remboursés en espèces. Jeton(s) récupéré(s) !`);
    await this.loadData();
  },

  // ============================================================================
  // 4. ONGLET : JOURNAL DES VENTES DE TICKETS
  // ============================================================================
  renderSalesJournalTab(container) {
    const sales = this.sales;

    container.innerHTML = `
      <div class="toolbar" style="margin-bottom: 1rem; display: flex; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <div class="search-box">
          <input type="text" id="salesSearch" class="form-control" placeholder="Rechercher par jeu, stand ou caisse..." oninput="TicketsModule.filterSalesJournal()">
        </div>
      </div>

      <div class="table-responsive" id="salesJournalTableContainer">
        ${this.generateSalesTable(sales)}
      </div>
    `;
  },

  generateSalesTable(sales) {
    if (!sales || sales.length === 0) {
      return `
        <div class="empty-state">
          <div class="empty-icon">🧾</div>
          <div class="empty-title">Aucune vente enregistrée</div>
          <div class="empty-desc">Les ventes de tickets de jeux et d'entrées effectuées apparaîtront ici avec la caisse, le stand et le caissier.</div>
        </div>
      `;
    }

    return `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date &amp; Heure</th>
            <th>Article / Billet Vendu</th>
            <th>Stand Concerné</th>
            <th>Caisse</th>
            <th>Quantité</th>
            <th>Prix Unitaire</th>
            <th>Total Encaissé</th>
            <th>Caissier</th>
          </tr>
        </thead>
        <tbody id="salesJournalBody">
          ${sales.map(s => {
            const dateStr = s.created_at ? new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '-';
            const standName = s.stand ? s.stand.name : (s.category === 'entree' ? 'Entrée Visiteurs' : 'Général');
            const standColor = s.stand ? s.stand.color_hex : '#10b981';

            return `
              <tr data-name="${s.item_name || ''}" data-stand="${standName}">
                <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-600);">${dateStr}</td>
                <td>
                  <strong>${s.item_name || 'Ticket'}</strong>
                  ${s.category === 'entree' ? '<span class="badge badge-success" style="font-size: 0.7rem; margin-left: 4px;">Entrée</span>' : ''}
                </td>
                <td>
                  <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.75rem;">
                    ${standName}
                  </span>
                </td>
                <td><span class="badge badge-gray" style="font-size: 0.75rem;">${s.cash_register ? s.cash_register.name : 'Caisse'}</span></td>
                <td><strong>${s.quantity}</strong></td>
                <td>${s.unit_price_f} F</td>
                <td><strong style="color: var(--success, #10b981); font-size: 0.95rem;">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                <td><span class="badge badge-gray">${s.seller ? s.seller.login : 'Caissier'}</span></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  filterSalesJournal() {
    const q = (document.getElementById('salesSearch')?.value || '').toLowerCase();
    const rows = document.querySelectorAll('#salesJournalBody tr');

    rows.forEach(r => {
      const name = (r.dataset.name || '').toLowerCase();
      const stand = (r.dataset.stand || '').toLowerCase();
      r.style.display = (name.includes(q) || stand.includes(q)) ? '' : 'none';
    });
  },

  // ============================================================================
  // 5. ONGLET : BILAN FINANCIER GLOBAL KERMESSE (COMPTA AUTOMATIQUE)
  // ============================================================================
  renderBilanSummaryTab(container) {
    // Calculs consolidés automatiques
    let revEntree = 0;
    let revJeux = 0;
    let revResto = 0;

    const standRevenues = {};

    this.sales.forEach(s => {
      const amt = s.total_amount_f || 0;
      if (s.category === 'entree') {
        revEntree += amt;
      } else if (s.category === 'restauration') {
        revResto += amt;
      } else {
        revJeux += amt;
        const stName = s.stand ? s.stand.name : 'Stand Non Rattaché';
        standRevenues[stName] = (standRevenues[stName] || 0) + amt;
      }
    });

    const totalBrut = revEntree + revJeux + revResto;

    container.innerHTML = `
      <div style="max-width: 800px; margin: 0 auto;">
        
        <!-- CARTE BILAN CONSOLIDÉ OFFICIEL -->
        <div class="card" style="border: 2px solid var(--primary); box-shadow: var(--shadow-lg); margin-bottom: 1.5rem;">
          <div class="card-header" style="background: var(--primary); color: white;">
            <div class="card-title" style="color: white;">
              <span>🏆</span> Bilan Consolidé des Recettes — Love and Charity (L&amp;C)
            </div>
          </div>
          <div class="card-body">
            
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 1.5rem; text-align: center;">
              <div style="background: #ecfdf5; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #a7f3d0;">
                <div style="font-size: 0.85rem; color: #065f46; font-weight: 700;">🎟️ Caisse 1 : Entrées</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #047857; margin-top: 4px;">
                  ${revEntree.toLocaleString()} F
                </div>
              </div>

              <div style="background: #eff6ff; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #bfdbfe;">
                <div style="font-size: 0.85rem; color: #1e40af; font-weight: 700;">🎯 Caisse 2 : Jeux &amp; Stands</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #1d4ed8; margin-top: 4px;">
                  ${revJeux.toLocaleString()} F
                </div>
              </div>

              <div style="background: #fef3c7; padding: 1rem; border-radius: var(--radius-md); border: 1px solid #fde68a;">
                <div style="font-size: 0.85rem; color: #92400e; font-weight: 700;">🍔 Caisse 4 : Restauration</div>
                <div style="font-size: 1.4rem; font-weight: 800; color: #b45309; margin-top: 4px;">
                  ${revResto.toLocaleString()} F
                </div>
              </div>
            </div>

            <!-- TOTAL BRUT MAJEUR -->
            <div style="background: #f8fafc; border: 2px dashed var(--gray-300); padding: 1.25rem; border-radius: var(--radius-md); text-align: center; margin-bottom: 1.5rem;">
              <div style="font-size: 1rem; font-weight: 700; color: var(--gray-700);">
                TOTAL DES RECETTES BRUTES ENCAISSÉES :
              </div>
              <div style="font-size: 2.2rem; font-weight: 900; color: var(--success, #10b981); margin-top: 0.25rem;">
                ${totalBrut.toLocaleString()} ${KermesseConfig.currency}
              </div>
              <div style="font-size: 0.85rem; color: var(--gray-500); margin-top: 0.25rem;">
                Fonds intégralement dédiés aux actions caritatives de Love and Charity
              </div>
            </div>

            <!-- PALMARÈS DES STANDS LES PLUS RENTABLES -->
            <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--gray-800); margin-bottom: 0.75rem;">
              🏆 Palmarès des Stands de Jeux (Recettes générées) :
            </h4>

            ${Object.keys(standRevenues).length === 0 ? `
              <p style="color: var(--gray-500); font-size: 0.85rem;">Aucune vente de tickets de jeux pour l'instant.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${Object.entries(standRevenues)
                  .sort((a, b) => b[1] - a[1])
                  .map(([standName, amount], idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 1rem; background: var(--gray-50); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-weight: 800; color: var(--primary); font-size: 1.1rem;">#${idx + 1}</span>
                        <strong>🎪 ${standName}</strong>
                      </div>
                      <strong style="color: var(--success, #10b981); font-size: 1.05rem;">
                        ${amount.toLocaleString()} F
                      </strong>
                    </div>
                  `).join('')}
              </div>
            `}
          </div>
        </div>

      </div>
    `;
  }
};

window.TicketsModule = TicketsModule;
