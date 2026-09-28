/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * PÔLE 2 : BILLETTERIE, CAISSES & COMPTABILITÉ
 * 
 * Les 4 modules demandés :
 * 1. CaisseEntreeModule  : Caisse 1 — Entrée & Accueil Visiteurs + Onglet Dépenses + Annulation directe & Stepper (+ / -)
 * 2. CaisseJeuxModule    : Caisse 2 — Tickets de Jeux & Stands (relié au Pôle 5) + Onglet Dépenses + Annulation directe & Stepper (+ / -)
 * 3. CaisseJetonsModule  : Caisse 3 — Change & Jetons de Monnaie + Onglet Dépenses
 * 4. CaisseBilanModule   : Bilan Financier Consolidé & Palmarès des Stands
 */

// ==============================================================================
// GESTIONNAIRE CENTRAL ET PERSISTANCE DES CAISSES (CaissesCore)
// ==============================================================================
const CaissesCore = {
  isUuid(str) {
    return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
  },

  getCancelledSaleIds() {
    try {
      const stored = localStorage.getItem('kermesse_cancelled_sale_ids');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  addCancelledSaleId(id) {
    if (!id) return;
    const ids = this.getCancelledSaleIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem('kermesse_cancelled_sale_ids', JSON.stringify(ids));
    }
  },

  async loadEntryCatalog() {
    const client = SupabaseClient.client;
    let catalog = [];

    if (client) {
      try {
        const { data, error } = await client
          .from('tickets_catalog')
          .select('id, name, value_f, color, description, is_active')
          .eq('type', 'entree')
          .eq('is_active', true)
          .order('value_f', { ascending: true });

        if (!error && data && data.length > 0) {
          catalog = data.map(d => ({
            id: d.id,
            name: d.name,
            price: d.value_f,
            icon: d.color || '🎟️',
            description: d.description || ''
          }));
        }
      } catch (e) {
        console.warn('[CaissesCore DB Warning]', e);
      }
    }

    if (catalog.length === 0) {
      const stored = localStorage.getItem('kermesse_entry_catalog');
      if (stored) {
        try {
          catalog = JSON.parse(stored);
        } catch (e) {}
      }
    }

    // Suggestions par défaut si rien n'est encore configuré
    if (!catalog || catalog.length === 0) {
      catalog = [
        { id: 'ent-enf', name: 'Entrée Enfant (-12 ans)', price: 200, icon: '🧒', description: 'Moins de 12 ans' },
        { id: 'ent-adu', name: 'Entrée Adulte', price: 500, icon: '🧑', description: 'Tarif standard' },
        { id: 'ent-fam', name: 'Pass Famille', price: 1200, icon: '👨‍👩‍👧‍👦', description: 'Valable pour 4 personnes' },
        { id: 'ent-don', name: 'Entrée Donateur & Bienfaiteur', price: 2000, icon: '❤️', description: 'Soutien aux œuvres sociales' }
      ];
      localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
    }

    return catalog;
  },

  async saveEntryCatalog(catalog) {
    localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
  },

  async getOrCreateRegister(roleKey, defaultName) {
    const client = SupabaseClient.client;
    let reg = null;

    if (client) {
      try {
        const { data } = await client
          .from('cash_registers')
          .select('id, name, initial_amount_f, status, opened_at, closed_at, counted_amount_f, expected_amount_f, variance_f')
          .or(`name.ilike.%${roleKey}%,name.ilike.%${defaultName.substring(0, 8)}%`)
          .limit(1);

        if (data && data.length > 0) {
          reg = data[0];
        }
      } catch (e) {
        console.warn('[CaissesCore DB Error]', e);
      }
    }

    // Récupération locale
    if (!reg) {
      const stored = localStorage.getItem('kermesse_cash_registers');
      if (stored) {
        try {
          const list = JSON.parse(stored);
          reg = list.find(r => r.name.toLowerCase().includes(roleKey.toLowerCase()));
        } catch (e) {}
      }
    }

    // Création si inexistante (solde initial à 0 F par défaut)
    if (!reg) {
      const newId = 'reg-' + roleKey + '-' + Date.now();
      reg = {
        id: newId,
        name: defaultName,
        initial_amount_f: 0,
        status: 'open',
        opened_at: new Date().toISOString()
      };

      if (client) {
        try {
          const { data, error } = await client.from('cash_registers').insert([{
            name: reg.name,
            initial_amount_f: 0,
            status: 'open'
          }]).select('id');
          if (!error && data && data[0]) reg.id = data[0].id;
        } catch (e) {}
      }

      this.saveLocalRegister(reg);
    }

    return reg;
  },

  saveLocalRegister(reg) {
    let list = [];
    const stored = localStorage.getItem('kermesse_cash_registers');
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const idx = list.findIndex(r => r.id === reg.id || r.name === reg.name);
    if (idx >= 0) list[idx] = reg; else list.push(reg);
    localStorage.setItem('kermesse_cash_registers', JSON.stringify(list));
  },

  async loadExpenses(registerId) {
    const client = SupabaseClient.client;
    let list = [];

    if (client && registerId && this.isUuid(registerId)) {
      try {
        const { data } = await client
          .from('cash_movements')
          .select('id, amount_f, reason, created_at, type, user:app_users(login)')
          .eq('cash_register_id', registerId)
          .eq('type', 'depense_autorisee')
          .order('created_at', { ascending: false });
        if (data) list = data;
      } catch (e) {}
    }

    const localKey = `kermesse_expenses_${registerId}`;
    const stored = localStorage.getItem(localKey);
    if (stored) {
      try {
        const local = JSON.parse(stored);
        list = [...list, ...local.filter(l => !list.some(d => d.id === l.id))];
      } catch (e) {}
    }

    return list;
  },

  async addExpense(registerId, registerName, amount, motive, receiptRef = '') {
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const finalAmount = -Math.abs(amount);
    let newId = 'mvt-exp-' + Date.now();

    if (client && this.isUuid(registerId)) {
      try {
        const { data } = await client.from('cash_movements').insert([{
          cash_register_id: registerId,
          type: 'depense_autorisee',
          amount_f: finalAmount,
          reason: motive + (receiptRef ? ` (Réf: ${receiptRef})` : ''),
          user_id: user ? user.id : null
        }]).select('id');

        if (data && data[0]) newId = data[0].id;

        await client.from('expenses').insert([{
          cash_register_id: registerId,
          amount_f: Math.abs(amount),
          category: 'autre',
          motive,
          receipt_ref: receiptRef || null,
          user_id: user ? user.id : null,
          status: 'approuve'
        }]);
      } catch (e) {
        console.warn('[Add Expense DB Error]', e);
      }
    }

    const localKey = `kermesse_expenses_${registerId}`;
    let localList = [];
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) localList = JSON.parse(stored);
    } catch (e) {}

    localList.unshift({
      id: newId,
      cash_register_id: registerId,
      amount_f: finalAmount,
      reason: motive + (receiptRef ? ` (Réf: ${receiptRef})` : ''),
      created_at: new Date().toISOString(),
      type: 'depense_autorisee',
      user: { login: user ? user.login : 'Caissier' }
    });
    localStorage.setItem(localKey, JSON.stringify(localList));

    AuditLogger.log('DEPENSE_CAISSE', 'cash_movement', newId, `Dépense de ${Math.abs(amount)} F sur ${registerName} : ${motive}`);
  },

  async editExpense(movementId, registerId, registerName, amount, motive) {
    const finalAmount = -Math.abs(amount);
    const client = SupabaseClient.client;

    if (client && this.isUuid(movementId)) {
      try {
        await client.from('cash_movements').update({
          amount_f: finalAmount,
          reason: motive
        }).eq('id', movementId);
      } catch (e) {}
    }

    const localKey = `kermesse_expenses_${registerId}`;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        let localList = JSON.parse(stored);
        const item = localList.find(x => x.id === movementId);
        if (item) {
          item.amount_f = finalAmount;
          item.reason = motive;
          localStorage.setItem(localKey, JSON.stringify(localList));
        }
      }
    } catch (e) {}

    AuditLogger.log('MODIFICATION_DEPENSE', 'cash_movement', movementId, `Modification dépense sur ${registerName} : ${Math.abs(amount)} F (${motive})`);
  },

  async deleteExpense(movementId, registerId, registerName, amount) {
    const client = SupabaseClient.client;
    if (client && this.isUuid(movementId)) {
      try {
        await client.from('cash_movements').delete().eq('id', movementId);
      } catch (e) {}
    }

    const localKey = `kermesse_expenses_${registerId}`;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        let localList = JSON.parse(stored).filter(x => x.id !== movementId);
        localStorage.setItem(localKey, JSON.stringify(localList));
      }
    } catch (e) {}

    AuditLogger.log('SUPPRESSION_DEPENSE', 'cash_movement', movementId, `Suppression dépense de ${amount} F sur ${registerName}`);
  },

  async updateInitialAmount(registerId, newInitial) {
    const client = SupabaseClient.client;
    const initial = Math.max(0, parseInt(newInitial, 10) || 0);

    if (client && this.isUuid(registerId)) {
      try {
        await client.from('cash_registers').update({ initial_amount_f: initial }).eq('id', registerId);
      } catch (e) {}
    }

    let list = [];
    const stored = localStorage.getItem('kermesse_cash_registers');
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const reg = list.find(r => r.id === registerId);
    if (reg) {
      reg.initial_amount_f = initial;
      localStorage.setItem('kermesse_cash_registers', JSON.stringify(list));
    }
    AuditLogger.log('MODIFICATION_FOND', 'cash_register', registerId, `Fond initial ajusté à ${initial} F`);
  },

  async closeRegister(registerId, registerName, expectedAmount, countedAmount, notes = '') {
    const variance = countedAmount - expectedAmount;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();

    if (client && this.isUuid(registerId)) {
      try {
        await client.from('cash_registers').update({
          status: 'closed',
          expected_amount_f: expectedAmount,
          counted_amount_f: countedAmount,
          variance_f: variance,
          closed_at: new Date().toISOString(),
          closed_by: user ? user.id : null,
          closing_notes: notes
        }).eq('id', registerId);
      } catch (e) {}
    }

    let list = [];
    const stored = localStorage.getItem('kermesse_cash_registers');
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const reg = list.find(r => r.id === registerId);
    if (reg) {
      reg.status = 'closed';
      reg.expected_amount_f = expectedAmount;
      reg.counted_amount_f = countedAmount;
      reg.variance_f = variance;
      reg.closed_at = new Date().toISOString();
      reg.closing_notes = notes;
      localStorage.setItem('kermesse_cash_registers', JSON.stringify(list));
    }

    AuditLogger.log('CLOTURE_CAISSE', 'cash_register', registerId, `Clôture de ${registerName} : Attendu ${expectedAmount} F, Compté ${countedAmount} F, Écart ${variance} F`);
  },

  async reopenRegister(registerId, registerName) {
    const client = SupabaseClient.client;
    if (client && this.isUuid(registerId)) {
      try {
        await client.from('cash_registers').update({
          status: 'open',
          closed_at: null,
          closed_by: null
        }).eq('id', registerId);
      } catch (e) {}
    }

    let list = [];
    const stored = localStorage.getItem('kermesse_cash_registers');
    if (stored) {
      try { list = JSON.parse(stored); } catch (e) {}
    }
    const reg = list.find(r => r.id === registerId);
    if (reg) {
      reg.status = 'open';
      delete reg.closed_at;
      localStorage.setItem('kermesse_cash_registers', JSON.stringify(list));
    }

    AuditLogger.log('REOUVERTURE_CAISSE', 'cash_register', registerId, `Réouverture de la caisse ${registerName}`);
  }
};


// ==============================================================================
// 1. MODULE : CAISSE ENTRÉE (CaisseEntreeModule)
// ==============================================================================
const CaisseEntreeModule = {
  currentTab: 'pos', // 'pos', 'expenses', 'journal', 'closure'
  register: null,
  sales: [],
  expenses: [],
  cart: [],

  entryCatalog: [],

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Entrée', 'Caisse 1 — Entrée & Accueil');
    await this.loadData();
    this.entryCatalog = await CaissesCore.loadEntryCatalog();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎟️</span> Caisse 1 : Entrée &amp; Accueil Visiteurs
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Caisse Ouverte' : '🔴 Caisse Clôturée'}
            </span>
          </div>
        </div>

        <div class="card-body">
          <!-- Navigation des onglets -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('pos')">
              🎟️ Vente Entrées
            </button>
            <button class="tab-btn ${this.currentTab === 'config' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('config')">
              ⚙️ Tarifs &amp; Billets (${this.entryCatalog.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('expenses')">
              💸 Dépenses (${this.expenses.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('journal')">
              🧾 Journal des Entrées (${this.sales.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'closure' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('closure')">
              🔒 Contrôle &amp; Clôture
            </button>
          </div>

          <div id="caisseEntreeTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('mainContent'));
  },

  async loadData() {
    const client = SupabaseClient.client;
    this.sales = [];

    // Liste des ventes annulées
    const cancelledIds = CaissesCore.getCancelledSaleIds();

    if (client) {
      try {
        const { data: vData } = await client
          .from('ticket_sales')
          .select('id, quantity, unit_price_f, total_amount_f, item_name, category, created_at, seller:app_users(login)')
          .eq('category', 'entree')
          .order('created_at', { ascending: false });
        if (vData) {
          this.sales = vData.filter(s => !cancelledIds.includes(s.id));
        }
      } catch (e) {}
    }

    // Récupération locale de secours
    const stored = localStorage.getItem('kermesse_entry_sales');
    if (stored) {
      try {
        const local = JSON.parse(stored);
        const filteredLocal = local.filter(l => !cancelledIds.includes(l.id));
        this.sales = [...this.sales, ...filteredLocal.filter(l => !this.sales.some(s => s.id === l.id))];
      } catch (e) {}
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseEntreeTabContainer');
    if (!container) return;

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'config') this.renderConfigTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
    else if (this.currentTab === 'closure') this.renderClosureTab(container);
  },

  // 1. Onglet Vente Entrée
  renderPosTab(container) {
    const totalVisitors = this.sales.reduce((s, x) => s + (x.quantity || 1), 0);
    const totalRevenue = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem;">
        
        <div>
          <!-- Indicateurs du pôle entrée -->
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #065f46;">👥 Visiteurs accueillis :</span>
              <strong style="color: #047857; font-size: 1.25rem; margin-left: 6px;">${totalVisitors.toLocaleString()}</strong>
            </div>
            <div>
              <span style="font-weight: 700; color: #065f46;">Recette Entrées :</span>
              <strong style="color: #047857; font-size: 1.25rem; margin-left: 6px;">${totalRevenue.toLocaleString()} F</strong>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
            <h4 style="margin: 0;">Sélectionnez les billets d'entrée :</h4>
            <button class="btn btn-secondary btn-sm" onclick="CaisseEntreeModule.switchTab('config')" title="Ajouter ou modifier les tarifs des billets">
              <span>⚙️</span> Gérer les tarifs (${this.entryCatalog.length})
            </button>
          </div>

          ${this.entryCatalog.length === 0 ? `
            <div class="empty-state" style="padding: 2rem; background: var(--gray-50); border: 2px dashed var(--gray-300); border-radius: var(--radius-md); text-align: center; margin-bottom: 1.5rem;">
              <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎟️</div>
              <div style="font-weight: 800; font-size: 1.1rem; color: var(--gray-800);">Aucun billet d'entrée configuré</div>
              <div style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 1.25rem;">
                Créez vos tarifs d'entrée (Adultes, Enfants, Pass, etc.) pour commencer à encaisser.
              </div>
              <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" style="background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.switchTab('config')">
                  <span>⚙️</span> Configurer les tarifs
                </button>
                <button class="btn btn-secondary btn-sm" onclick="CaisseEntreeModule.loadDefaultSuggestions()">
                  <span>🔄</span> Suggestions par défaut
                </button>
              </div>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.85rem;">
              ${this.entryCatalog.map(t => {
                const inCart = this.cart.find(i => i.id === t.id);
                const qty = inCart ? inCart.qty : 0;

                return `
                  <div class="card" style="border: 2px solid ${qty > 0 ? '#10b981' : '#e2e8f0'}; border-top: 5px solid #10b981; transition: box-shadow 0.15s; background: ${qty > 0 ? '#f0fdf4' : 'white'};">
                    <div class="card-body" style="padding: 1rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <span style="font-size: 2rem;">${t.icon || '🎟️'}</span>
                        <strong style="font-size: 1.15rem; color: #047857;">${t.price > 0 ? `${t.price.toLocaleString()} F` : 'Gratuit'}</strong>
                      </div>
                      <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.35rem; min-height: 2.2em; line-height: 1.2;">
                        ${t.name}
                      </div>
                      ${t.description ? `<div style="font-size: 0.72rem; color: var(--gray-500); margin-bottom: 0.5rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.description}</div>` : ''}

                      <!-- 2 BOUTONS : AUGMENTER (+) ET DIMINUER (-) -->
                      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--gray-50); padding: 4px 8px; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                        <button class="btn btn-secondary btn-sm" style="width: 38px; height: 38px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="CaisseEntreeModule.decrementItem('${t.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div style="text-align: center;">
                          <span style="font-size: 1.2rem; font-weight: 800; color: ${qty > 0 ? '#047857' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <div style="font-size: 0.7rem; color: var(--gray-500); line-height: 1;">billet(s)</div>
                        </div>
                        <button class="btn btn-primary btn-sm" style="width: 38px; height: 38px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center; background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.incrementItem('${t.id}', '${t.name.replace(/'/g, "\\'")}', ${t.price})" title="Augmenter">
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          <!-- SECTION : DERNIÈRES ENTRÉES VALIDÉES (ANNULATION DIRECTE SUR CET ÉCRAN) -->
          <div style="margin-top: 2rem; border-top: 2px dashed var(--gray-200); padding-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="margin: 0; font-size: 1rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.4rem;">
                <span>🧾</span> Derniers billets d'entrée validés
              </h4>
              <span style="font-size: 0.8rem; color: var(--gray-500);">Cliquez sur 🗑️ pour annuler un billet validé par erreur</span>
            </div>

            ${this.sales.length === 0 ? `
              <p style="color: var(--gray-400); font-size: 0.85rem; font-style: italic;">Aucun billet d'entrée validé pour le moment.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 280px; overflow-y: auto;">
                ${this.sales.slice(0, 8).map(s => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                    <div>
                      <div style="font-weight: 700; font-size: 0.9rem;">
                        🎟️ ${s.item_name} <span class="badge badge-gray" style="font-size: 0.72rem; margin-left: 4px;">×${s.quantity}</span>
                      </div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">
                        Validé à ${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <strong style="color: var(--success); font-size: 1rem;">
                        +${(s.total_amount_f || 0).toLocaleString()} F
                      </strong>
                      <button class="btn btn-danger btn-sm" onclick="CaisseEntreeModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Annuler et enlever ce billet" style="display: flex; align-items: center; gap: 4px;">
                        <span>🗑️</span> Enlever
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>

        <!-- Panier Entrée (Colonne Droite) -->
        <div class="card" style="border: 2px solid #10b981; box-shadow: var(--shadow-md); position: sticky; top: 1rem;">
          <div class="card-header" style="background: #10b981; color: white;">
            <div class="card-title" style="color: white; font-size: 1rem;">
              <span>🛒</span> Panier Entrée (${this.cart.reduce((s, i) => s + i.qty, 0)})
            </div>
            ${this.cart.length > 0 ? `
              <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 2px 8px; font-size: 0.75rem;" onclick="CaisseEntreeModule.cart = []; CaisseEntreeModule.renderCurrentTab();">Vider</button>
            ` : ''}
          </div>

          <div class="card-body" style="padding: 1rem;">
            ${this.cart.length === 0 ? `
              <div style="text-align: center; padding: 2rem 0; color: var(--gray-400);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🎟️</div>
                <div style="font-weight: 700;">Panier vide</div>
                <div style="font-size: 0.8rem; margin-top: 4px;">Utilisez les boutons <strong>+</strong> pour choisir le nombre de billets</div>
              </div>
            ` : `
              <div style="max-height: 220px; overflow-y: auto; margin-bottom: 1rem;">
                ${this.cart.map(item => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--gray-100);">
                    <div style="flex: 1;">
                      <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">${(item.price * item.qty).toLocaleString()} F (${item.price} F / billet)</div>
                    </div>
                    <!-- Stepper dans le panier -->
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseEntreeModule.decrementItem('${item.id}')">−</button>
                      <strong style="min-width: 24px; text-align: center; font-size: 0.95rem;">${item.qty}</strong>
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseEntreeModule.incrementItem('${item.id}', '${item.name}', ${item.price})">+</button>
                      <button class="btn btn-danger btn-sm" style="padding: 2px 6px; font-size: 0.75rem; margin-left: 2px;" onclick="CaisseEntreeModule.removeItem('${item.id}')" title="Retirer">✕</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 2px solid var(--gray-200); padding-top: 0.5rem; margin-bottom: 1rem;">
                <span>Total à payer :</span>
                <span style="color: #047857;">${cartTotal.toLocaleString()} F</span>
              </div>

              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.8rem;">Espèces reçues :</label>
                <input type="number" id="caisseEntreeCashGiven" class="form-control" placeholder="Montant remis" oninput="CaisseEntreeModule.calcChange(${cartTotal})">
                <div id="caisseEntreeChangeDisp" style="margin-top: 4px; font-weight: 700; font-size: 0.85rem; color: #1e40af;">Monnaie à rendre : 0 F</div>
              </div>

              <button class="btn btn-primary" style="width: 100%; font-size: 1.05rem; font-weight: 800; background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.checkout()">
                💳 Valider &amp; Encaisser (${cartTotal.toLocaleString()} F)
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  },

  incrementItem(id, name, price) {
    const ex = this.cart.find(i => i.id === id);
    if (ex) {
      ex.qty += 1;
    } else {
      this.cart.push({ id, name, price, qty: 1 });
    }
    this.renderCurrentTab();
  },

  decrementItem(id) {
    const idx = this.cart.findIndex(i => i.id === id);
    if (idx >= 0) {
      if (this.cart[idx].qty > 1) {
        this.cart[idx].qty -= 1;
      } else {
        this.cart.splice(idx, 1);
      }
      this.renderCurrentTab();
    }
  },

  removeItem(id) {
    this.cart = this.cart.filter(i => i.id !== id);
    this.renderCurrentTab();
  },

  calcChange(total) {
    const input = document.getElementById('caisseEntreeCashGiven');
    const disp = document.getElementById('caisseEntreeChangeDisp');
    if (!input || !disp) return;
    const given = parseInt(input.value || '0', 10);
    const diff = given - total;
    if (given <= 0) disp.innerHTML = 'Monnaie à rendre : 0 F';
    else if (diff < 0) disp.innerHTML = `<span style="color: var(--danger);">⚠️ Manque ${Math.abs(diff).toLocaleString()} F !</span>`;
    else disp.innerHTML = `<span style="color: var(--success);">💵 À RENDRE : ${diff.toLocaleString()} F</span>`;
  },

  async checkout() {
    if (this.cart.length === 0) return;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const regId = this.register.id;

    for (const item of this.cart) {
      let realSaleId = 'sale-ent-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

      const saleObj = {
        cash_register_id: CaissesCore.isUuid(regId) ? regId : null,
        item_name: item.name,
        category: 'entree',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        sold_by: user ? user.id : null
      };

      if (client) {
        try {
          const { data } = await client.from('ticket_sales').insert([saleObj]).select('id');
          if (data && data[0]) realSaleId = data[0].id;
        } catch (e) {
          console.warn('[Checkout Entree DB Warning]', e);
        }
      }

      this.sales.unshift({
        ...saleObj,
        id: realSaleId,
        created_at: new Date().toISOString()
      });
    }

    // Persistance locale
    localStorage.setItem('kermesse_entry_sales', JSON.stringify(this.sales));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente entrées (${this.cart.reduce((s, i) => s + i.qty, 0)} pers.)`,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_ENTREE', 'ticket_sales', null, `Encaissement de ${cartTotal} F en Caisse Entrée`);
    Notify.success(`Billets d'entrée validés ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount) {
    if (!confirm(`Annuler et enlever le billet « ${name} » (${amount} F) ?\n\nLe montant sera retiré de la caisse et le visiteur sera décompté.`)) {
      return;
    }

    const client = SupabaseClient.client;
    // 1. Enregistrer dans la liste noire globale des ventes annulées (garantit la suppression dans le Bilan)
    CaissesCore.addCancelledSaleId(id);

    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        // Ajouter un mouvement de compensation pour réduire la caisse du montant
        if (CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Annulation billet entrée : ${name}`,
            user_id: Auth.getCurrentUser()?.id || null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Sale DB Warning]', e);
      }
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_entry_sales', JSON.stringify(this.sales));

    AuditLogger.log('ANNULATION_VENTE_ENTREE', 'ticket_sales', id, `Annulation vente entrée ${name} (-${amount} F)`);
    Notify.success(`Billet « ${name} » enlevé avec succès. Caisse et bilan actualisés.`);
    this.renderCurrentTab();
  },

  // 1. bis — Onglet Configuration des Billets d'Entrée
  renderConfigTab(container) {
    container.innerHTML = `
      <div style="margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.15rem; color: #065f46;">⚙️ Configuration &amp; Tarifs des Billets d'Entrée</h3>
          <p style="margin: 0; font-size: 0.85rem; color: var(--gray-500);">
            Personnalisez librement les types de billets, leurs tarifs et leurs icônes.
          </p>
        </div>
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-primary btn-sm" style="background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.openAddTicketModal()">
            <span>➕</span> Nouveau Billet d'Entrée
          </button>
          <button class="btn btn-secondary btn-sm" onclick="CaisseEntreeModule.loadDefaultSuggestions()">
            <span>🔄</span> Suggestions par défaut
          </button>
        </div>
      </div>

      ${this.entryCatalog.length === 0 ? `
        <div class="empty-state" style="padding: 2.5rem; background: var(--gray-50); border: 2px dashed var(--gray-300); border-radius: var(--radius-md); text-align: center;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎟️</div>
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--gray-800);">Aucun billet d'entrée configuré</div>
          <div style="font-size: 0.85rem; color: var(--gray-500); margin-bottom: 1.25rem;">
            Cliquez sur le bouton ci-dessous pour créer votre premier billet d'entrée ou charger les suggestions de base.
          </div>
          <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" style="background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.openAddTicketModal()">
              <span>➕</span> Créer un billet d'entrée
            </button>
            <button class="btn btn-secondary" onclick="CaisseEntreeModule.loadDefaultSuggestions()">
              <span>🔄</span> Suggestions par défaut
            </button>
          </div>
        </div>
      ` : `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
          ${this.entryCatalog.map(t => `
            <div class="card" style="border: 2px solid #e2e8f0; border-top: 4px solid #10b981; padding: 1.15rem; display: flex; flex-direction: column; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <span style="font-size: 2.2rem;">${t.icon || '🎟️'}</span>
                  <div style="text-align: right;">
                    <div style="font-size: 1.3rem; font-weight: 800; color: #047857;">
                      ${t.price > 0 ? `${t.price.toLocaleString()} F` : '<span class="badge badge-success">Gratuit</span>'}
                    </div>
                    <div style="font-size: 0.72rem; color: var(--gray-400);">par visiteur</div>
                  </div>
                </div>
                <h4 style="margin: 0 0 0.4rem 0; font-size: 1.05rem; font-weight: 700;">${t.name}</h4>
                <p style="margin: 0 0 1rem 0; font-size: 0.82rem; color: var(--gray-500); line-height: 1.4;">
                  ${t.description || 'Aucune consigne particulière.'}
                </p>
              </div>

              <div style="display: flex; gap: 0.5rem; border-top: 1px solid var(--gray-100); padding-top: 0.75rem;">
                <button class="btn btn-secondary btn-sm" style="flex: 1;" onclick="CaisseEntreeModule.openEditTicketModal('${t.id}')">
                  <span>✏️</span> Modifier
                </button>
                <button class="btn btn-danger btn-sm" onclick="CaisseEntreeModule.deleteTicket('${t.id}')" title="Supprimer ce billet">
                  <span>🗑️</span>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      `}

      <div style="margin-top: 2rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
        <div style="font-size: 0.85rem; color: #065f46;">
          💡 <strong>Prise d'effet immédiate :</strong> Tous les billets configurés ci-dessus sont instantanément disponibles dans l'onglet <strong>Vente Entrées</strong>.
        </div>
        <button class="btn btn-primary btn-sm" style="background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.switchTab('pos')">
          <span>🎟️</span> Aller au terminal de vente
        </button>
      </div>
    `;
  },

  openAddTicketModal() {
    const emojis = ['🎟️', '🎫', '🧒', '🧑', '👨‍👩‍👧‍👦', '🌟', '❤️', '🏷️', '🎪', '🎈', '🍭', '👑'];
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouveau Billet d'Entrée</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="addTicketForm">
            <div class="form-group">
              <label>Nom du billet *</label>
              <input type="text" id="newTicketName" class="form-control" required placeholder="Ex: Entrée Adulte, Tarif Étudiant...">
            </div>

            <div class="form-group">
              <label>Tarif en Francs (${KermesseConfig.currency}) *</label>
              <input type="number" id="newTicketPrice" class="form-control" required min="0" step="50" placeholder="Ex: 500 (mettre 0 si gratuit)">
            </div>

            <div class="form-group">
              <label>Icône / Émoji</label>
              <div style="display: flex; gap: 0.35rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                ${emojis.map(e => `
                  <button type="button" class="btn btn-secondary btn-sm emoji-pick-btn" style="font-size: 1.2rem; padding: 2px 8px;" data-emoji="${e}">${e}</button>
                `).join('')}
              </div>
              <input type="text" id="newTicketIcon" class="form-control" value="🎟️" style="max-width: 120px; font-size: 1.2rem; text-align: center;">
            </div>

            <div class="form-group">
              <label>Description / Public ciblé (optionnel)</label>
              <input type="text" id="newTicketDesc" class="form-control" placeholder="Ex: À partir de 12 ans, justificatif requis...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAddTicketBtn" style="background: #059669; border-color: #047857;">Enregistrer le Billet</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelectorAll('.emoji-pick-btn').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('newTicketIcon').value = btn.dataset.emoji;
      };
    });

    modal.querySelector('#confirmAddTicketBtn').onclick = async () => {
      const name = document.getElementById('newTicketName').value.trim();
      const priceStr = document.getElementById('newTicketPrice').value;
      const icon = document.getElementById('newTicketIcon').value.trim() || '🎟️';
      const desc = document.getElementById('newTicketDesc').value.trim();

      if (!name || priceStr === '') {
        Notify.error('Veuillez renseigner le nom et le tarif.');
        return;
      }
      const price = Math.max(0, parseInt(priceStr, 10) || 0);

      let newId = 'ent-' + Date.now();
      const client = SupabaseClient.client;
      if (client) {
        try {
          const { data, error } = await client.from('tickets_catalog').insert([{
            type: 'entree',
            name: name,
            value_f: price,
            color: icon,
            description: desc,
            is_active: true
          }]).select('id');
          if (!error && data && data[0]) newId = data[0].id;
        } catch (e) {
          console.warn('[Add Ticket DB Warning]', e);
        }
      }

      this.entryCatalog.push({
        id: newId,
        name,
        price,
        icon,
        description: desc
      });

      await CaissesCore.saveEntryCatalog(this.entryCatalog);
      AuditLogger.log('CREATION_BILLET_ENTREE', 'tickets_catalog', newId, `Création billet ${name} (${price} F)`);
      Notify.success(`Billet « ${name} » ajouté au catalogue.`);
      close();
      this.renderCurrentTab();
    };
  },

  openEditTicketModal(ticketId) {
    const ticket = this.entryCatalog.find(t => t.id === ticketId);
    if (!ticket) return;

    const emojis = ['🎟️', '🎫', '🧒', '🧑', '👨‍👩‍👧‍👦', '🌟', '❤️', '🏷️', '🎪', '🎈', '🍭', '👑'];
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier le Billet d'Entrée</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editTicketForm">
            <div class="form-group">
              <label>Nom du billet *</label>
              <input type="text" id="editTicketName" class="form-control" required value="${ticket.name.replace(/"/g, '&quot;')}">
            </div>

            <div class="form-group">
              <label>Tarif en Francs (${KermesseConfig.currency}) *</label>
              <input type="number" id="editTicketPrice" class="form-control" required min="0" step="50" value="${ticket.price}">
            </div>

            <div class="form-group">
              <label>Icône / Émoji</label>
              <div style="display: flex; gap: 0.35rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
                ${emojis.map(e => `
                  <button type="button" class="btn btn-secondary btn-sm emoji-pick-btn" style="font-size: 1.2rem; padding: 2px 8px;" data-emoji="${e}">${e}</button>
                `).join('')}
              </div>
              <input type="text" id="editTicketIcon" class="form-control" value="${ticket.icon || '🎟️'}" style="max-width: 120px; font-size: 1.2rem; text-align: center;">
            </div>

            <div class="form-group">
              <label>Description / Public ciblé (optionnel)</label>
              <input type="text" id="editTicketDesc" class="form-control" value="${(ticket.description || '').replace(/"/g, '&quot;')}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmEditTicketBtn" style="background: #059669; border-color: #047857;">Enregistrer les Modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelectorAll('.emoji-pick-btn').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('editTicketIcon').value = btn.dataset.emoji;
      };
    });

    modal.querySelector('#confirmEditTicketBtn').onclick = async () => {
      const name = document.getElementById('editTicketName').value.trim();
      const priceStr = document.getElementById('editTicketPrice').value;
      const icon = document.getElementById('editTicketIcon').value.trim() || '🎟️';
      const desc = document.getElementById('editTicketDesc').value.trim();

      if (!name || priceStr === '') {
        Notify.error('Veuillez renseigner le nom et le tarif.');
        return;
      }
      const price = Math.max(0, parseInt(priceStr, 10) || 0);

      ticket.name = name;
      ticket.price = price;
      ticket.icon = icon;
      ticket.description = desc;

      const client = SupabaseClient.client;
      if (client && CaissesCore.isUuid(ticketId)) {
        try {
          await client.from('tickets_catalog').update({
            name: name,
            value_f: price,
            color: icon,
            description: desc
          }).eq('id', ticketId);
        } catch (e) {
          console.warn('[Edit Ticket DB Warning]', e);
        }
      }

      // Si le billet était dans le panier en cours, mettre à jour son nom et son prix
      const cartItem = this.cart.find(c => c.id === ticketId);
      if (cartItem) {
        cartItem.name = name;
        cartItem.price = price;
      }

      await CaissesCore.saveEntryCatalog(this.entryCatalog);
      AuditLogger.log('MODIFICATION_BILLET_ENTREE', 'tickets_catalog', ticketId, `Mise à jour billet ${name} (${price} F)`);
      Notify.success(`Billet « ${name} » modifié avec succès.`);
      close();
      this.renderCurrentTab();
    };
  },

  async deleteTicket(ticketId) {
    const ticket = this.entryCatalog.find(t => t.id === ticketId);
    if (!ticket) return;

    if (!confirm(`Supprimer définitivement le billet « ${ticket.name} » du catalogue ?\n\nIl ne sera plus proposé sur l'écran d'accueil.`)) {
      return;
    }

    const client = SupabaseClient.client;
    if (client && CaissesCore.isUuid(ticketId)) {
      try {
        await client.from('tickets_catalog').delete().eq('id', ticketId);
      } catch (e) {
        console.warn('[Delete Ticket DB Warning]', e);
      }
    }

    this.entryCatalog = this.entryCatalog.filter(t => t.id !== ticketId);
    this.cart = this.cart.filter(c => c.id !== ticketId);

    await CaissesCore.saveEntryCatalog(this.entryCatalog);
    AuditLogger.log('SUPPRESSION_BILLET_ENTREE', 'tickets_catalog', ticketId, `Suppression billet ${ticket.name}`);
    Notify.success(`Billet « ${ticket.name} » supprimé.`);
    this.renderCurrentTab();
  },

  async loadDefaultSuggestions() {
    if (this.entryCatalog.length > 0) {
      if (!confirm('Rétablir les 4 tarifs d\'entrée suggérés par défaut ?\n\n(Enfant 200 F, Adulte 500 F, Pass Famille 1 200 F, Donateur 2 000 F)')) {
        return;
      }
    }

    this.entryCatalog = [
      { id: 'ent-enf', name: 'Entrée Enfant (-12 ans)', price: 200, icon: '🧒', description: 'Moins de 12 ans' },
      { id: 'ent-adu', name: 'Entrée Adulte', price: 500, icon: '🧑', description: 'Tarif standard' },
      { id: 'ent-fam', name: 'Pass Famille', price: 1200, icon: '👨‍👩‍👧‍👦', description: 'Valable pour 4 personnes' },
      { id: 'ent-don', name: 'Entrée Donateur & Bienfaiteur', price: 2000, icon: '❤️', description: 'Soutien aux œuvres sociales' }
    ];

    await CaissesCore.saveEntryCatalog(this.entryCatalog);
    Notify.success('Suggestions de base chargées.');
    this.renderCurrentTab();
  },

  // 2. Onglet Dépenses de la Caisse Entrée
  renderExpensesTab(container) {
    const totalExp = this.expenses.reduce((s, e) => s + Math.abs(e.amount_f), 0);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem;">Dépenses payées par la Caisse Entrée</h3>
          <p style="margin: 0; font-size: 0.85rem; color: var(--gray-500);">Toute dépense est déduite du solde théorique de cette caisse.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--danger);">
            Total Sorties : -${totalExp.toLocaleString()} F
          </div>
          <button class="btn btn-primary btn-sm" onclick="CaisseEntreeModule.openAddExpenseModal()">
            <span>➕</span> Nouvelle Dépense
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.expenses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💸</div>
            <div class="empty-title">Aucune dépense enregistrée sur cette caisse</div>
            <div class="empty-desc">Enregistrez les achats d'urgence, badges ou fournitures payés directement avec l'argent de l'accueil.</div>
            <button class="btn btn-primary btn-sm" onclick="CaisseEntreeModule.openAddExpenseModal()">
              <span>➕</span> Enregistrer une dépense
            </button>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Motif / Justification</th>
                <th>Montant</th>
                <th>Enregistré par</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.expenses.map(e => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${e.reason}</strong></td>
                  <td style="font-weight: 700; color: var(--danger); font-size: 1rem;">
                    -${Math.abs(e.amount_f).toLocaleString()} F
                  </td>
                  <td><span class="badge badge-gray">${e.user ? e.user.login : 'Caissier'}</span></td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="CaisseEntreeModule.openEditExpenseModal('${e.id}', ${Math.abs(e.amount_f)}, '${e.reason.replace(/'/g, "\\'")}')" title="Modifier">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="CaisseEntreeModule.deleteExpense('${e.id}', ${Math.abs(e.amount_f)})" title="Supprimer" style="margin-left: 0.25rem;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  openAddExpenseModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouvelle Dépense — Caisse Entrée</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="expEntreeForm">
            <div class="form-group">
              <label>Montant (${KermesseConfig.currency}) *</label>
              <input type="number" id="expEntreeAmount" class="form-control" required min="1" step="50" placeholder="Ex: 2500">
            </div>
            <div class="form-group">
              <label>Motif de la dépense *</label>
              <input type="text" id="expEntreeMotive" class="form-control" required placeholder="Ex: Achat ruban balisage, stylos, badges...">
            </div>
            <div class="form-group">
              <label>Bénéficiaire / Justificatif (optionnel)</label>
              <input type="text" id="expEntreeRef" class="form-control" placeholder="Ex: Ticket caisse épicerie, reçu...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAddExpEntree">Enregistrer la dépense</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmAddExpEntree').onclick = async () => {
      const amt = parseInt(document.getElementById('expEntreeAmount').value, 10);
      const motive = document.getElementById('expEntreeMotive').value.trim();
      const ref = document.getElementById('expEntreeRef').value.trim();

      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Veuillez renseigner un montant valide et un motif.');
        return;
      }

      await CaissesCore.addExpense(this.register.id, this.register.name, amt, motive, ref);
      Notify.success('Dépense enregistrée et déduite de la caisse.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  openEditExpenseModal(id, currentAmount, currentMotive) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier la Dépense</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Montant (${KermesseConfig.currency}) *</label>
            <input type="number" id="editExpAmt" class="form-control" required min="1" step="50" value="${currentAmount}">
          </div>
          <div class="form-group">
            <label>Motif de la dépense *</label>
            <input type="text" id="editExpMot" class="form-control" required value="${currentMotive.replace(/"/g, '&quot;')}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditExpBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditExpBtn').onclick = async () => {
      const amt = parseInt(document.getElementById('editExpAmt').value, 10);
      const motive = document.getElementById('editExpMot').value.trim();
      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Valeurs invalides.');
        return;
      }

      await CaissesCore.editExpense(id, this.register.id, this.register.name, amt, motive);
      Notify.success('Dépense modifiée.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  async deleteExpense(id, amount) {
    if (!confirm(`Supprimer cette dépense de ${amount} F ?`)) return;
    await CaissesCore.deleteExpense(id, this.register.id, this.register.name, amount);
    Notify.success('Dépense supprimée.');
    await this.loadData();
    this.renderCurrentTab();
  },

  // 3. Onglet Journal des Entrées
  renderJournalTab(container) {
    container.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
        <h4 style="margin: 0;">Historique des Billets d'Entrée Encaissés</h4>
      </div>
      <div class="table-responsive">
        ${this.sales.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🧾</div>
            <div class="empty-title">Aucune entrée encaissée pour l'instant</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Billet</th>
                <th>Quantité</th>
                <th>Total Encaissé</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.sales.map(s => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${s.item_name}</strong></td>
                  <td>${s.quantity}</td>
                  <td><strong style="color: var(--success);">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                  <td style="text-align: right;">
                    <button class="btn btn-danger btn-sm" onclick="CaisseEntreeModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Annuler cette vente">🗑️ Enlever</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  // 4. Onglet Contrôle & Clôture
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    const revEntree = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const expTotal = this.expenses.reduce((s, x) => s + Math.abs(x.amount_f), 0);
    const expected = initF + revEntree - expTotal;

    container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div class="card" style="border: 2px solid var(--primary); padding: 1.25rem;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--primary);">
            🔒 Contrôle &amp; Clôture — Caisse Entrée
          </h3>

          <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
              <span>Fond initial de départ :</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong>${initF.toLocaleString()} F</strong>
                <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="CaisseEntreeModule.promptEditInitial(${initF})">Modifier</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--success);">
              <span>+ Recettes Entrées encaissées :</span>
              <strong>+${revEntree.toLocaleString()} F</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--danger);">
              <span>- Dépenses déduites de cette caisse :</span>
              <strong>-${expTotal.toLocaleString()} F</strong>
            </div>
            <hr style="border: none; border-top: 1px solid var(--gray-300); margin: 0.5rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 1.15rem;">
              <span><strong>Montant Théorique Attendu :</strong></span>
              <span style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">
                ${expected.toLocaleString()} F
              </span>
            </div>
          </div>

          ${this.register.status === 'closed' ? `
            <div class="alert-banner info" style="margin-bottom: 1rem;">
              <div>
                🔒 <strong>Caisse Clôturée :</strong><br>
                Montant compté : <strong>${(this.register.counted_amount_f || 0).toLocaleString()} F</strong><br>
                Écart constaté : <strong>${this.register.variance_f > 0 ? '+' : ''}${(this.register.variance_f || 0).toLocaleString()} F</strong>
              </div>
            </div>
            <button class="btn btn-secondary" style="width: 100%;" onclick="CaisseEntreeModule.reopen()">
              🔓 Rouvrir cette caisse
            </button>
          ` : `
            <form onsubmit="event.preventDefault(); CaisseEntreeModule.submitClosure(${expected});">
              <div class="form-group">
                <label>Montant Réellement Compté en Espèces (${KermesseConfig.currency}) *</label>
                <input type="number" id="caisseEntreeCounted" class="form-control" style="font-size: 1.2rem; font-weight: 700;" required oninput="CaisseEntreeModule.calcVariance(${expected})">
              </div>

              <div id="caisseEntreeVarianceBox" style="padding: 0.75rem; border-radius: var(--radius-md); background: var(--gray-100); margin-bottom: 1rem;">
                <span>Écart : </span><strong id="caisseEntreeVarianceDisp">-</strong>
              </div>

              <button class="btn btn-danger" style="width: 100%; font-size: 1rem; font-weight: 800;">
                🔒 Valider la Clôture de la Caisse Entrée
              </button>
            </form>
          `}
        </div>
      </div>
    `;
  },

  async promptEditInitial(current) {
    const val = prompt('Nouveau fond de caisse initial (FCFA) - Laissez 0 si aucun fond :', current);
    if (val === null) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    await CaissesCore.updateInitialAmount(this.register.id, num);
    this.register.initial_amount_f = num;
    Notify.success(`Fond initial fixé à ${num} F.`);
    this.renderCurrentTab();
  },

  calcVariance(expected) {
    const counted = parseInt(document.getElementById('caisseEntreeCounted')?.value || '0', 10);
    const disp = document.getElementById('caisseEntreeVarianceDisp');
    const box = document.getElementById('caisseEntreeVarianceBox');
    if (!disp || !box) return;

    const v = counted - expected;
    if (v === 0) {
      disp.textContent = '0 F (Caisse Juste ✅)';
      disp.style.color = 'var(--success)';
      box.style.background = '#dcfce7';
    } else if (v > 0) {
      disp.textContent = `+${v.toLocaleString()} F (Excédent 📈)`;
      disp.style.color = '#1e40af';
      box.style.background = '#dbeafe';
    } else {
      disp.textContent = `${v.toLocaleString()} F (Déficit ⚠️)`;
      disp.style.color = 'var(--danger)';
      box.style.background = '#fee2e2';
    }
  },

  async submitClosure(expected) {
    const counted = parseInt(document.getElementById('caisseEntreeCounted')?.value || '0', 10);
    if (isNaN(counted)) {
      Notify.error('Veuillez entrer le montant compté.');
      return;
    }

    await CaissesCore.closeRegister(this.register.id, this.register.name, expected, counted);
    Notify.success('Caisse Entrée clôturée avec succès.');
    this.register.status = 'closed';
    this.register.counted_amount_f = counted;
    this.register.variance_f = counted - expected;
    this.renderCurrentTab();
  },

  async reopen() {
    await CaissesCore.reopenRegister(this.register.id, this.register.name);
    Notify.success('Caisse Entrée réouverte.');
    this.register.status = 'open';
    this.renderCurrentTab();
  }
};


// ==============================================================================
// 2. MODULE : CAISSE TICKETS DE JEUX & STANDS (CaisseJeuxModule)
// ==============================================================================
const CaisseJeuxModule = {
  currentTab: 'pos', // 'pos', 'expenses', 'journal', 'closure'
  activeStandFilter: 'all',
  register: null,
  games: [],
  stands: [],
  sales: [],
  expenses: [],
  cart: [],

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Jeux', 'Caisse 2 — Tickets de Jeux & Stands');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🎯</span> Caisse 2 : Vente Tickets de Jeux (Reliée aux Stands)
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Caisse Ouverte' : '🔴 Caisse Clôturée'}
            </span>
          </div>
        </div>

        <div class="card-body">
          <!-- Onglets du module -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('pos')">
              🎯 Vente Tactile des Jeux
            </button>
            <button class="tab-btn ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('expenses')">
              💸 Dépenses de cette Caisse (${this.expenses.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('journal')">
              🧾 Journal des Ventes Jeux (${this.sales.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'closure' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('closure')">
              🔒 Contrôle &amp; Clôture
            </button>
          </div>

          <div id="caisseJeuxTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('mainContent'));
  },

  async loadData() {
    const client = SupabaseClient.client;
    this.sales = [];

    if (client) {
      try {
        const { data: gData } = await client
          .from('games')
          .select('id, name, ticket_price_f, stand_id, is_active, stand:stands(id, name, number, color_name, color_hex)')
          .order('name');
        if (gData) this.games = gData;

        const { data: sData } = await client.from('stands').select('id, name, number, color_name, color_hex').order('number');
        if (sData) this.stands = sData;

        const cancelledIds = CaissesCore.getCancelledSaleIds();
        const { data: vData } = await client
          .from('ticket_sales')
          .select('id, quantity, unit_price_f, total_amount_f, item_name, category, created_at, stand:stands(name, color_name, color_hex), seller:app_users(login)')
          .eq('category', 'jeu')
          .order('created_at', { ascending: false });
        if (vData) {
          this.sales = vData.filter(s => !cancelledIds.includes(s.id));
        }
      } catch (e) {
        console.warn('[CaisseJeux DB Error]', e);
      }
    }

    // Récupération locale de secours
    const stored = localStorage.getItem('kermesse_game_sales');
    if (stored) {
      try {
        const local = JSON.parse(stored);
        const cancelledIds = CaissesCore.getCancelledSaleIds();
        const filteredLocal = local.filter(l => !cancelledIds.includes(l.id));
        this.sales = [...this.sales, ...filteredLocal.filter(l => !this.sales.some(s => s.id === l.id))];
      } catch (e) {}
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseJeuxTabContainer');
    if (!container) return;

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
    else if (this.currentTab === 'closure') this.renderClosureTab(container);
  },

  // 1. Onglet Vente Tactile Jeux
  renderPosTab(container) {
    const activeGames = (this.games || []).filter(g => g.is_active !== false);
    const filteredGames = this.activeStandFilter === 'all'
      ? activeGames
      : activeGames.filter(g => g.stand && g.stand.id === this.activeStandFilter);

    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const totalGameTickets = this.sales.reduce((s, x) => s + (x.quantity || 1), 0);
    const totalGameRevenue = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 340px; gap: 1.25rem;">
        
        <div>
          <!-- Indicateurs caisse jeux -->
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #1e40af;">🎯 Tickets vendus :</span>
              <strong style="color: #1d4ed8; font-size: 1.25rem; margin-left: 6px;">${totalGameTickets.toLocaleString()}</strong>
            </div>
            <div>
              <span style="font-weight: 700; color: #1e40af;">Recette Jeux :</span>
              <strong style="color: #1d4ed8; font-size: 1.25rem; margin-left: 6px;">${totalGameRevenue.toLocaleString()} F</strong>
            </div>
          </div>

          <!-- Filtres rapides par Stand -->
          <div style="display: flex; gap: 0.4rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1rem;">
            <button class="btn btn-sm ${this.activeStandFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" onclick="CaisseJeuxModule.activeStandFilter='all'; CaisseJeuxModule.renderCurrentTab();">
              🎪 Tous les Stands (${activeGames.length})
            </button>
            ${(this.stands || []).map(s => `
              <button class="btn btn-sm ${this.activeStandFilter === s.id ? 'btn-primary' : 'btn-secondary'}" style="${this.activeStandFilter === s.id ? `background: ${s.color_hex}; border-color: ${s.color_hex};` : ''}" onclick="CaisseJeuxModule.activeStandFilter='${s.id}'; CaisseJeuxModule.renderCurrentTab();">
                <span class="color-dot" style="background-color: ${s.color_hex};"></span>
                ${s.color_name} ${s.number}
              </button>
            `).join('')}
          </div>

          <!-- Grille tactile des jeux -->
          ${filteredGames.length === 0 ? `
            <div class="empty-state" style="padding: 2.5rem 1rem;">
              <div class="empty-icon">🎯</div>
              <div class="empty-title">Aucun jeu configuré</div>
              <div class="empty-desc">Créez des jeux dans le Pôle Stands avec leur tarif pour qu'ils apparaissent automatiquement ici.</div>
              <button class="btn btn-primary" onclick="App.navigateTo('games')">
                <span>➕</span> Créer des jeux
              </button>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(195px, 1fr)); gap: 0.75rem;">
              ${filteredGames.map(g => {
                const standColor = g.stand ? g.stand.color_hex : '#64748b';
                const standName = g.stand ? `${g.stand.color_name} ${g.stand.number}` : 'Général';
                const price = g.ticket_price_f || 200;

                const inCart = this.cart.find(i => i.gameId === g.id);
                const qty = inCart ? inCart.qty : 0;

                return `
                  <div class="card" style="border: 2px solid ${qty > 0 ? standColor : `${standColor}40`}; border-top: 5px solid ${standColor}; transition: box-shadow 0.15s; background: ${qty > 0 ? `${standColor}08` : 'white'};">
                    <div class="card-body" style="padding: 0.85rem;">
                      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.35rem;">
                        <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.72rem; padding: 1px 6px;">
                          ${standName}
                        </span>
                        <strong style="color: var(--primary); font-size: 1.05rem;">
                          ${price.toLocaleString()} F
                        </strong>
                      </div>
                      <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.65rem; min-height: 2.2em; line-height: 1.2;">
                        ${g.name}
                      </div>

                      <!-- 2 BOUTONS : AUGMENTER (+) ET DIMINUER (-) -->
                      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--gray-50); padding: 4px 8px; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                        <button class="btn btn-secondary btn-sm" style="width: 36px; height: 36px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="CaisseJeuxModule.decrementGame('${g.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div style="text-align: center;">
                          <span style="font-size: 1.15rem; font-weight: 800; color: ${qty > 0 ? 'var(--primary)' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <div style="font-size: 0.68rem; color: var(--gray-500); line-height: 1;">ticket(s)</div>
                        </div>
                        <button class="btn btn-primary btn-sm" style="width: 36px; height: 36px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="CaisseJeuxModule.incrementGame('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}')" title="Augmenter">
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          <!-- SECTION : DERNIERS TICKETS DE JEUX VALIDÉS (ANNULATION DIRECTE SUR CET ÉCRAN) -->
          <div style="margin-top: 2rem; border-top: 2px dashed var(--gray-200); padding-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="margin: 0; font-size: 1rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.4rem;">
                <span>🧾</span> Derniers tickets de jeux validés
              </h4>
              <span style="font-size: 0.8rem; color: var(--gray-500);">Cliquez sur 🗑️ pour annuler un ticket validé par erreur</span>
            </div>

            ${this.sales.length === 0 ? `
              <p style="color: var(--gray-400); font-size: 0.85rem; font-style: italic;">Aucun ticket de jeu validé pour le moment.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 280px; overflow-y: auto;">
                ${this.sales.slice(0, 8).map(s => {
                  const standName = s.stand ? s.stand.name : 'Stand';
                  const standColor = s.stand ? (s.stand.color_hex || '#3b82f6') : '#3b82f6';

                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                      <div>
                        <div style="font-weight: 700; font-size: 0.9rem;">
                          🎯 ${s.item_name} <span class="badge badge-gray" style="font-size: 0.72rem; margin-left: 4px;">×${s.quantity}</span>
                          <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.7rem; margin-left: 6px;">${standName}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--gray-500);">
                          Validé à ${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                      </div>
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <strong style="color: var(--success); font-size: 1rem;">
                          +${(s.total_amount_f || 0).toLocaleString()} F
                        </strong>
                        <button class="btn btn-danger btn-sm" onclick="CaisseJeuxModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Annuler et enlever ce ticket">
                          <span>🗑️</span> Enlever
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            `}
          </div>

        </div>

        <!-- Panier de vente tactile (Colonne Droite) -->
        <div class="card" style="border: 2px solid var(--primary); box-shadow: var(--shadow-md); position: sticky; top: 1rem;">
          <div class="card-header" style="background: var(--primary); color: white;">
            <div class="card-title" style="color: white; font-size: 1rem;">
              <span>🛒</span> Panier Jeux (${this.cart.reduce((s, i) => s + i.qty, 0)})
            </div>
            ${this.cart.length > 0 ? `
              <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 2px 8px; font-size: 0.75rem;" onclick="CaisseJeuxModule.cart = []; CaisseJeuxModule.renderCurrentTab();">Vider</button>
            ` : ''}
          </div>

          <div class="card-body" style="padding: 1rem;">
            ${this.cart.length === 0 ? `
              <div style="text-align: center; padding: 2rem 0; color: var(--gray-400);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🎯</div>
                <div style="font-weight: 700;">Panier vide</div>
                <div style="font-size: 0.8rem; margin-top: 4px;">Cliquez sur <strong>+</strong> pour choisir le nombre de tickets</div>
              </div>
            ` : `
              <div style="max-height: 220px; overflow-y: auto; margin-bottom: 1rem;">
                ${this.cart.map(item => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--gray-100);">
                    <div style="flex: 1;">
                      <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
                      <div style="font-size: 0.72rem; color: var(--gray-500);">${item.qty} × ${item.price} F (${item.standName})</div>
                    </div>
                    <!-- Stepper dans le panier -->
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseJeuxModule.decrementGame('${item.gameId}')">−</button>
                      <strong style="min-width: 24px; text-align: center; font-size: 0.95rem;">${item.qty}</strong>
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseJeuxModule.incrementGame('${item.gameId}', '${item.name}', ${item.price}, '${item.standName}', '${item.standColor}', '${item.standId}')">+</button>
                      <button class="btn btn-danger btn-sm" style="padding: 2px 6px; font-size: 0.75rem; margin-left: 2px;" onclick="CaisseJeuxModule.removeGame('${item.gameId}')" title="Retirer">✕</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 2px solid var(--gray-200); padding-top: 0.5rem; margin-bottom: 1rem;">
                <span>Total :</span>
                <span style="color: var(--primary);">${cartTotal.toLocaleString()} F</span>
              </div>

              <div class="form-group" style="margin-bottom: 0.75rem;">
                <label style="font-size: 0.8rem;">Espèces remises par le client :</label>
                <input type="number" id="caisseJeuxCashGiven" class="form-control" placeholder="Montant reçu" oninput="CaisseJeuxModule.calcChange(${cartTotal})">
                <div id="caisseJeuxChangeDisp" style="margin-top: 4px; font-weight: 700; font-size: 0.85rem; color: #1e40af;">Monnaie à rendre : 0 F</div>
              </div>

              <button class="btn btn-primary" style="width: 100%; font-size: 1.05rem; font-weight: 800;" onclick="CaisseJeuxModule.checkout()">
                💳 Valider &amp; Encaisser (${cartTotal.toLocaleString()} F)
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  },

  incrementGame(gameId, name, price, standName, standColor, standId) {
    const ex = this.cart.find(i => i.gameId === gameId);
    if (ex) {
      ex.qty += 1;
    } else {
      this.cart.push({ gameId, name, price, standName, standColor, standId, qty: 1 });
    }
    this.renderCurrentTab();
  },

  decrementGame(gameId) {
    const idx = this.cart.findIndex(i => i.gameId === gameId);
    if (idx >= 0) {
      if (this.cart[idx].qty > 1) {
        this.cart[idx].qty -= 1;
      } else {
        this.cart.splice(idx, 1);
      }
      this.renderCurrentTab();
    }
  },

  removeGame(gameId) {
    this.cart = this.cart.filter(i => i.gameId !== gameId);
    this.renderCurrentTab();
  },

  calcChange(total) {
    const input = document.getElementById('caisseJeuxCashGiven');
    const disp = document.getElementById('caisseJeuxChangeDisp');
    if (!input || !disp) return;
    const given = parseInt(input.value || '0', 10);
    const diff = given - total;
    if (given <= 0) disp.innerHTML = 'Monnaie à rendre : 0 F';
    else if (diff < 0) disp.innerHTML = `<span style="color: var(--danger);">⚠️ Manque ${Math.abs(diff).toLocaleString()} F !</span>`;
    else disp.innerHTML = `<span style="color: var(--success);">💵 À RENDRE : ${diff.toLocaleString()} F</span>`;
  },

  async checkout() {
    if (this.cart.length === 0) return;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const regId = this.register.id;

    for (const item of this.cart) {
      let realSaleId = 'sale-game-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

      const saleObj = {
        cash_register_id: CaissesCore.isUuid(regId) ? regId : null,
        stand_id: item.standId || null,
        game_id: item.gameId || null,
        item_name: item.name,
        category: 'jeu',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        sold_by: user ? user.id : null
      };

      if (client) {
        try {
          const { data } = await client.from('ticket_sales').insert([saleObj]).select('id');
          if (data && data[0]) realSaleId = data[0].id;
        } catch (e) {
          console.warn('[Checkout Jeux DB Warning]', e);
        }
      }

      this.sales.unshift({
        ...saleObj,
        id: realSaleId,
        created_at: new Date().toISOString(),
        stand: { name: item.standName, color_hex: item.standColor }
      });
    }

    localStorage.setItem('kermesse_game_sales', JSON.stringify(this.sales));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente tickets jeux (${this.cart.reduce((s, i) => s + i.qty, 0)} tickets)`,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_JEUX', 'ticket_sales', null, `Encaissement de ${cartTotal} F en Caisse Jeux`);
    Notify.success(`Tickets de jeux validés ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount) {
    if (!confirm(`Annuler et enlever la vente de « ${name} » (${amount} F) ?\n\nLe montant sera retiré de la caisse et déduit du bilan du stand.`)) {
      return;
    }

    const client = SupabaseClient.client;
    // 1. Ajouter à la liste noire globale des annulations
    CaissesCore.addCancelledSaleId(id);

    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        if (CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Annulation vente jeu : ${name}`,
            user_id: Auth.getCurrentUser()?.id || null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Game Sale DB Warning]', e);
      }
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_game_sales', JSON.stringify(this.sales));

    AuditLogger.log('SUPPRESSION_VENTE_JEUX', 'ticket_sale', id, `Annulation vente jeu ${name} (-${amount} F)`);
    Notify.success(`Vente de « ${name} » enlevée avec succès.`);
    this.renderCurrentTab();
  },

  // 2. Onglet Dépenses de la Caisse Jeux
  renderExpensesTab(container) {
    const totalExp = this.expenses.reduce((s, e) => s + Math.abs(e.amount_f), 0);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem;">Dépenses payées par la Caisse Jeux</h3>
          <p style="margin: 0; font-size: 0.85rem; color: var(--gray-500);">Achats urgents de matériel pour stands, tickets, consommables.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--danger);">
            Total Sorties : -${totalExp.toLocaleString()} F
          </div>
          <button class="btn btn-primary btn-sm" onclick="CaisseJeuxModule.openAddExpenseModal()">
            <span>➕</span> Nouvelle Dépense
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.expenses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💸</div>
            <div class="empty-title">Aucune dépense enregistrée sur cette caisse</div>
            <div class="empty-desc">Enregistrez les sorties d'argent effectuées avec les recettes des jeux.</div>
            <button class="btn btn-primary btn-sm" onclick="CaisseJeuxModule.openAddExpenseModal()">
              <span>➕</span> Enregistrer une dépense
            </button>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Motif / Justification</th>
                <th>Montant</th>
                <th>Enregistré par</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.expenses.map(e => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${e.reason}</strong></td>
                  <td style="font-weight: 700; color: var(--danger); font-size: 1rem;">
                    -${Math.abs(e.amount_f).toLocaleString()} F
                  </td>
                  <td><span class="badge badge-gray">${e.user ? e.user.login : 'Caissier'}</span></td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="CaisseJeuxModule.openEditExpenseModal('${e.id}', ${Math.abs(e.amount_f)}, '${e.reason.replace(/'/g, "\\'")}')" title="Modifier">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="CaisseJeuxModule.deleteExpense('${e.id}', ${Math.abs(e.amount_f)})" title="Supprimer" style="margin-left: 0.25rem;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  openAddExpenseModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouvelle Dépense — Caisse Jeux</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="expJeuxForm">
            <div class="form-group">
              <label>Montant (${KermesseConfig.currency}) *</label>
              <input type="number" id="expJeuxAmount" class="form-control" required min="1" step="50" placeholder="Ex: 5000">
            </div>
            <div class="form-group">
              <label>Motif de la dépense *</label>
              <input type="text" id="expJeuxMotive" class="form-control" required placeholder="Ex: Achat piles stand tir, ficelle, ballons...">
            </div>
            <div class="form-group">
              <label>Bénéficiaire / Justificatif (optionnel)</label>
              <input type="text" id="expJeuxRef" class="form-control" placeholder="Ex: Facture quincaillerie, reçu...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAddExpJeux">Enregistrer la dépense</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmAddExpJeux').onclick = async () => {
      const amt = parseInt(document.getElementById('expJeuxAmount').value, 10);
      const motive = document.getElementById('expJeuxMotive').value.trim();
      const ref = document.getElementById('expJeuxRef').value.trim();

      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Veuillez renseigner un montant valide et un motif.');
        return;
      }

      await CaissesCore.addExpense(this.register.id, this.register.name, amt, motive, ref);
      Notify.success('Dépense enregistrée et déduite de la caisse jeux.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  openEditExpenseModal(id, currentAmount, currentMotive) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier la Dépense</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Montant (${KermesseConfig.currency}) *</label>
            <input type="number" id="editExpJeuxAmt" class="form-control" required min="1" step="50" value="${currentAmount}">
          </div>
          <div class="form-group">
            <label>Motif de la dépense *</label>
            <input type="text" id="editExpJeuxMot" class="form-control" required value="${currentMotive.replace(/"/g, '&quot;')}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditExpJeuxBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditExpJeuxBtn').onclick = async () => {
      const amt = parseInt(document.getElementById('editExpJeuxAmt').value, 10);
      const motive = document.getElementById('editExpJeuxMot').value.trim();
      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Valeurs invalides.');
        return;
      }

      await CaissesCore.editExpense(id, this.register.id, this.register.name, amt, motive);
      Notify.success('Dépense modifiée.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  async deleteExpense(id, amount) {
    if (!confirm(`Supprimer cette dépense de ${amount} F ?`)) return;
    await CaissesCore.deleteExpense(id, this.register.id, this.register.name, amount);
    Notify.success('Dépense supprimée.');
    await this.loadData();
    this.renderCurrentTab();
  },

  // 3. Onglet Journal des Ventes Jeux
  renderJournalTab(container) {
    container.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0;">Journal des Ventes de Tickets de Jeux</h4>
      </div>
      <div class="table-responsive">
        ${this.sales.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🧾</div>
            <div class="empty-title">Aucun ticket de jeu vendu pour le moment</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Jeu Vendu</th>
                <th>Stand</th>
                <th>Qté</th>
                <th>Prix</th>
                <th>Total Encaissé</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.sales.map(s => {
                const standName = s.stand ? s.stand.name : 'Stand';
                const standColor = s.stand ? (s.stand.color_hex || '#3b82f6') : '#3b82f6';
                return `
                  <tr>
                    <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${s.item_name}</strong></td>
                    <td>
                      <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.75rem;">
                        ${standName}
                      </span>
                    </td>
                    <td>${s.quantity}</td>
                    <td>${s.unit_price_f} F</td>
                    <td><strong style="color: var(--success);">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                    <td style="text-align: right;">
                      <button class="btn btn-danger btn-sm" onclick="CaisseJeuxModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Annuler cette vente">🗑️ Enlever</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  // 4. Onglet Contrôle & Clôture Caisse Jeux
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    const revJeux = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const expTotal = this.expenses.reduce((s, x) => s + Math.abs(x.amount_f), 0);
    const expected = initF + revJeux - expTotal;

    container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div class="card" style="border: 2px solid var(--primary); padding: 1.25rem;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: var(--primary);">
            🔒 Contrôle &amp; Clôture — Caisse Tickets Jeux
          </h3>

          <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
              <span>Fond initial de départ :</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong>${initF.toLocaleString()} F</strong>
                <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="CaisseJeuxModule.promptEditInitial(${initF})">Modifier</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--success);">
              <span>+ Ventes Tickets Jeux :</span>
              <strong>+${revJeux.toLocaleString()} F</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--danger);">
              <span>- Dépenses de cette caisse :</span>
              <strong>-${expTotal.toLocaleString()} F</strong>
            </div>
            <hr style="border: none; border-top: 1px solid var(--gray-300); margin: 0.5rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 1.15rem;">
              <span><strong>Montant Théorique Attendu :</strong></span>
              <span style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">
                ${expected.toLocaleString()} F
              </span>
            </div>
          </div>

          ${this.register.status === 'closed' ? `
            <div class="alert-banner info" style="margin-bottom: 1rem;">
              <div>
                🔒 <strong>Caisse Clôturée :</strong><br>
                Montant compté : <strong>${(this.register.counted_amount_f || 0).toLocaleString()} F</strong><br>
                Écart constaté : <strong>${this.register.variance_f > 0 ? '+' : ''}${(this.register.variance_f || 0).toLocaleString()} F</strong>
              </div>
            </div>
            <button class="btn btn-secondary" style="width: 100%;" onclick="CaisseJeuxModule.reopen()">
              🔓 Rouvrir cette caisse
            </button>
          ` : `
            <form onsubmit="event.preventDefault(); CaisseJeuxModule.submitClosure(${expected});">
              <div class="form-group">
                <label>Montant Réellement Compté dans le tiroir (${KermesseConfig.currency}) *</label>
                <input type="number" id="caisseJeuxCounted" class="form-control" style="font-size: 1.2rem; font-weight: 700;" required oninput="CaisseJeuxModule.calcVariance(${expected})">
              </div>

              <div id="caisseJeuxVarianceBox" style="padding: 0.75rem; border-radius: var(--radius-md); background: var(--gray-100); margin-bottom: 1rem;">
                <span>Écart : </span><strong id="caisseJeuxVarianceDisp">-</strong>
              </div>

              <button class="btn btn-danger" style="width: 100%; font-size: 1rem; font-weight: 800;">
                🔒 Valider la Clôture de la Caisse Jeux
              </button>
            </form>
          `}
        </div>
      </div>
    `;
  },

  async promptEditInitial(current) {
    const val = prompt('Nouveau fond de caisse initial (FCFA) - Laissez 0 si aucun fond :', current);
    if (val === null) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    await CaissesCore.updateInitialAmount(this.register.id, num);
    this.register.initial_amount_f = num;
    Notify.success(`Fond initial fixé à ${num} F.`);
    this.renderCurrentTab();
  },

  calcVariance(expected) {
    const counted = parseInt(document.getElementById('caisseJeuxCounted')?.value || '0', 10);
    const disp = document.getElementById('caisseJeuxVarianceDisp');
    const box = document.getElementById('caisseJeuxVarianceBox');
    if (!disp || !box) return;

    const v = counted - expected;
    if (v === 0) {
      disp.textContent = '0 F (Caisse Juste ✅)';
      disp.style.color = 'var(--success)';
      box.style.background = '#dcfce7';
    } else if (v > 0) {
      disp.textContent = `+${v.toLocaleString()} F (Excédent 📈)`;
      disp.style.color = '#1e40af';
      box.style.background = '#dbeafe';
    } else {
      disp.textContent = `${v.toLocaleString()} F (Déficit ⚠️)`;
      disp.style.color = 'var(--danger)';
      box.style.background = '#fee2e2';
    }
  },

  async submitClosure(expected) {
    const counted = parseInt(document.getElementById('caisseJeuxCounted')?.value || '0', 10);
    if (isNaN(counted)) {
      Notify.error('Veuillez entrer le montant compté.');
      return;
    }

    await CaissesCore.closeRegister(this.register.id, this.register.name, expected, counted);
    Notify.success('Caisse Jeux clôturée avec succès.');
    this.register.status = 'closed';
    this.register.counted_amount_f = counted;
    this.register.variance_f = counted - expected;
    this.renderCurrentTab();
  },

  async reopen() {
    await CaissesCore.reopenRegister(this.register.id, this.register.name);
    Notify.success('Caisse Jeux réouverte.');
    this.register.status = 'open';
    this.renderCurrentTab();
  }
};


// ==============================================================================
// 3. MODULE : CAISSE JETONS & MONNAIE (CaisseJetonsModule)
// ==============================================================================
const CaisseJetonsModule = {
  currentTab: 'change', // 'change', 'expenses', 'movements', 'closure'
  register: null,
  tokens: [],
  expenses: [],
  movements: [],
  tokenValues: [50, 100, 200, 250],

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Jetons', 'Caisse 3 — Change & Jetons');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🪙</span> Caisse 3 : Change &amp; Jetons de Monnaie
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Caisse Ouverte' : '🔴 Caisse Clôturée'}
            </span>
          </div>
        </div>

        <div class="card-body">
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn ${this.currentTab === 'change' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('change')">
              🪙 Émission &amp; Remboursement
            </button>
            <button class="tab-btn ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('expenses')">
              💸 Dépenses de cette Caisse (${this.expenses.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'movements' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('movements')">
              📋 Mouvements de Monnaie
            </button>
            <button class="tab-btn ${this.currentTab === 'closure' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('closure')">
              🔒 Contrôle &amp; Clôture
            </button>
          </div>

          <div id="caisseJetonsTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('mainContent'));
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (client && this.register && CaissesCore.isUuid(this.register.id)) {
      try {
        const { data: tData } = await client.from('token_debts').select('*').eq('cash_register_id', this.register.id);
        if (tData) this.tokens = tData;

        const { data: mData } = await client
          .from('cash_movements')
          .select('id, amount_f, reason, created_at, type')
          .eq('cash_register_id', this.register.id)
          .order('created_at', { ascending: false });
        if (mData) this.movements = mData;
      } catch (e) {}
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseJetonsTabContainer');
    if (!container) return;

    if (this.currentTab === 'change') this.renderChangeTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'movements') this.renderMovementsTab(container);
    else if (this.currentTab === 'closure') this.renderClosureTab(container);
  },

  // 1. Onglet Émission & Remboursement
  renderChangeTab(container) {
    let tokenDebt = 0;
    this.tokens.forEach(t => {
      if (t.status === 'en_circulation') {
        tokenDebt += (t.token_value_f * (t.quantity_given - t.quantity_redeemed));
      }
    });

    container.innerHTML = `
      <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap;">
        <div>
          <span style="font-weight: 700; color: #92400e;">🪙 Dette Jetons en circulation :</span>
          <strong style="color: #b45309; font-size: 1.2rem; margin-left: 6px;">${tokenDebt.toLocaleString()} F</strong>
        </div>
        <div style="font-size: 0.8rem; color: #b45309;">
          Règle : Tout remboursement en espèces exige la remise physique du jeton.
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">
        
        <!-- ÉMISSION DE JETONS -->
        <div class="card" style="border: 2px solid #f59e0b;">
          <div class="card-header" style="background: #fef3c7;">
            <h4 style="margin: 0; color: #b45309;">🪙 Remettre un Jeton (Manque de Monnaie)</h4>
          </div>
          <div class="card-body">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
              En cas d'impossibilité de rendre la monnaie exacte, donnez un jeton au visiteur.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label>Valeur du Jeton</label>
                <select id="jetonIssueVal" class="form-control">
                  ${this.tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité</label>
                <input type="number" id="jetonIssueQty" class="form-control" value="1" min="1">
              </div>
            </div>
            <button class="btn btn-primary" style="width: 100%; background: #d97706; border-color: #b45309;" onclick="CaisseJetonsModule.issueToken()">
              🪙 Enregistrer la remise de jeton
            </button>
          </div>
        </div>

        <!-- REMBOURSEMENT JETONS -->
        <div class="card" style="border: 2px solid #10b981;">
          <div class="card-header" style="background: #dcfce7;">
            <h4 style="margin: 0; color: #15803d;">💵 Rembourser en Espèces (Restitution Jeton)</h4>
          </div>
          <div class="card-body">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem;">
              Le visiteur rapporte son jeton physique pour reprendre son liquide.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label>Jeton rapporté</label>
                <select id="jetonRefundVal" class="form-control">
                  ${this.tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité</label>
                <input type="number" id="jetonRefundQty" class="form-control" value="1" min="1">
              </div>
            </div>
            <button class="btn btn-primary" style="width: 100%; background: #16a34a; border-color: #15803d;" onclick="CaisseJetonsModule.refundToken()">
              💵 Rembourser le liquide &amp; Reprendre le jeton
            </button>
          </div>
        </div>

      </div>
    `;
  },

  async issueToken() {
    const val = parseInt(document.getElementById('jetonIssueVal')?.value, 10);
    const qty = parseInt(document.getElementById('jetonIssueQty')?.value, 10);
    if (isNaN(val) || isNaN(qty) || qty <= 0) return;

    const client = SupabaseClient.client;
    if (client && CaissesCore.isUuid(this.register.id)) {
      try {
        await client.from('token_debts').insert([{
          cash_register_id: this.register.id,
          token_value_f: val,
          quantity_given: qty,
          quantity_redeemed: 0,
          status: 'en_circulation'
        }]);
      } catch (e) {}
    }

    Notify.success(`🪙 ${qty} jeton(s) de ${val} F remis. Dette enregistrée.`);
    await this.loadData();
    this.renderCurrentTab();
  },

  async refundToken() {
    const val = parseInt(document.getElementById('jetonRefundVal')?.value, 10);
    const qty = parseInt(document.getElementById('jetonRefundQty')?.value, 10);
    if (isNaN(val) || isNaN(qty) || qty <= 0) return;

    const totalF = val * qty;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();

    if (client && CaissesCore.isUuid(this.register.id)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: this.register.id,
          type: 'remboursement_jeton',
          amount_f: -totalF,
          reason: `Remboursement de ${qty} jeton(s) de ${val} F`,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    Notify.success(`💵 ${totalF} F remboursés au visiteur. Jeton récupéré.`);
    await this.loadData();
    this.renderCurrentTab();
  },

  // 2. Onglet Dépenses de la Caisse Jetons
  renderExpensesTab(container) {
    const totalExp = this.expenses.reduce((s, e) => s + Math.abs(e.amount_f), 0);

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem;">Dépenses payées par la Caisse Jetons &amp; Monnaie</h3>
          <p style="margin: 0; font-size: 0.85rem; color: var(--gray-500);">Frais de change, achat de petite monnaie ou rouleaux.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--danger);">
            Total Sorties : -${totalExp.toLocaleString()} F
          </div>
          <button class="btn btn-primary btn-sm" onclick="CaisseJetonsModule.openAddExpenseModal()">
            <span>➕</span> Nouvelle Dépense
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.expenses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💸</div>
            <div class="empty-title">Aucune dépense enregistrée sur cette caisse</div>
            <button class="btn btn-primary btn-sm" onclick="CaisseJetonsModule.openAddExpenseModal()">
              <span>➕</span> Enregistrer une dépense
            </button>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Motif / Justification</th>
                <th>Montant</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.expenses.map(e => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${e.reason}</strong></td>
                  <td style="font-weight: 700; color: var(--danger);">-${Math.abs(e.amount_f).toLocaleString()} F</td>
                  <td style="text-align: right;">
                    <button class="btn btn-secondary btn-sm" onclick="CaisseJetonsModule.openEditExpenseModal('${e.id}', ${Math.abs(e.amount_f)}, '${e.reason.replace(/'/g, "\\'")}')">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="CaisseJetonsModule.deleteExpense('${e.id}', ${Math.abs(e.amount_f)})" style="margin-left: 0.25rem;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  openAddExpenseModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouvelle Dépense — Caisse Jetons</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Montant (${KermesseConfig.currency}) *</label>
            <input type="number" id="expJetonsAmt" class="form-control" required min="1" step="50" placeholder="Ex: 1000">
          </div>
          <div class="form-group">
            <label>Motif de la dépense *</label>
            <input type="text" id="expJetonsMot" class="form-control" required placeholder="Ex: Frais de change, rouleau pièces...">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAddExpJetons">Enregistrer la dépense</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmAddExpJetons').onclick = async () => {
      const amt = parseInt(document.getElementById('expJetonsAmt').value, 10);
      const motive = document.getElementById('expJetonsMot').value.trim();
      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Données invalides.');
        return;
      }
      await CaissesCore.addExpense(this.register.id, this.register.name, amt, motive);
      Notify.success('Dépense enregistrée.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  openEditExpenseModal(id, currentAmount, currentMotive) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier la Dépense</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Montant (${KermesseConfig.currency}) *</label>
            <input type="number" id="editExpJetAmt" class="form-control" required min="1" value="${currentAmount}">
          </div>
          <div class="form-group">
            <label>Motif *</label>
            <input type="text" id="editExpJetMot" class="form-control" required value="${currentMotive.replace(/"/g, '&quot;')}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditExpJetBtn">Enregistrer</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;
    modal.querySelector('#saveEditExpJetBtn').onclick = async () => {
      const amt = parseInt(document.getElementById('editExpJetAmt').value, 10);
      const motive = document.getElementById('editExpJetMot').value.trim();
      await CaissesCore.editExpense(id, this.register.id, this.register.name, amt, motive);
      Notify.success('Dépense modifiée.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  async deleteExpense(id, amount) {
    if (!confirm(`Supprimer cette dépense de ${amount} F ?`)) return;
    await CaissesCore.deleteExpense(id, this.register.id, this.register.name, amount);
    Notify.success('Dépense supprimée.');
    await this.loadData();
    this.renderCurrentTab();
  },

  // 3. Onglet Mouvements
  renderMovementsTab(container) {
    container.innerHTML = `
      <div class="table-responsive">
        ${this.movements.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">Aucun mouvement pour le moment</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Type</th>
                <th>Motif</th>
                <th style="text-align: right;">Montant</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.movements.map(m => {
                const isPos = m.amount_f >= 0;
                return `
                  <tr>
                    <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span class="badge ${isPos ? 'badge-success' : 'badge-danger'}">${m.type}</span></td>
                    <td><strong>${m.reason}</strong></td>
                    <td style="text-align: right; font-weight: 700; color: ${isPos ? 'var(--success)' : 'var(--danger)'};">
                      ${isPos ? '+' : ''}${m.amount_f.toLocaleString()} F
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-danger btn-sm" onclick="CaisseJetonsModule.deleteMovement('${m.id}', ${m.amount_f})">🗑️</button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  async deleteMovement(id, amount) {
    if (!confirm(`Supprimer ce mouvement de ${amount} F ?`)) return;
    const client = SupabaseClient.client;
    if (client && CaissesCore.isUuid(id)) {
      try { await client.from('cash_movements').delete().eq('id', id); } catch (e) {}
    }
    Notify.success('Mouvement supprimé.');
    await this.loadData();
    this.renderCurrentTab();
  },

  // 4. Onglet Contrôle & Clôture Caisse Jetons
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    let netMovements = 0;
    this.movements.forEach(m => netMovements += m.amount_f);
    const expected = initF + netMovements;

    container.innerHTML = `
      <div style="max-width: 600px; margin: 0 auto;">
        <div class="card" style="border: 2px solid var(--primary); padding: 1.25rem;">
          <h3 style="margin-top: 0; color: var(--primary);">
            🔒 Contrôle &amp; Clôture — Caisse Jetons &amp; Monnaie
          </h3>

          <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
              <span>Fond initial :</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong>${initF.toLocaleString()} F</strong>
                <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="CaisseJetonsModule.promptEditInitial(${initF})">Modifier</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Flux net de monnaie (entrées - remboursements) :</span>
              <strong>${netMovements > 0 ? '+' : ''}${netMovements.toLocaleString()} F</strong>
            </div>
            <hr style="border: none; border-top: 1px solid var(--gray-300); margin: 0.5rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 1.15rem;">
              <span><strong>Montant Théorique Attendu :</strong></span>
              <span style="font-weight: 800; color: var(--primary); font-size: 1.25rem;">
                ${expected.toLocaleString()} F
              </span>
            </div>
          </div>

          ${this.register.status === 'closed' ? `
            <div class="alert-banner info" style="margin-bottom: 1rem;">
              <div>
                🔒 <strong>Caisse Clôturée :</strong><br>
                Compté : <strong>${(this.register.counted_amount_f || 0).toLocaleString()} F</strong> | 
                Écart : <strong>${(this.register.variance_f || 0).toLocaleString()} F</strong>
              </div>
            </div>
            <button class="btn btn-secondary" style="width: 100%;" onclick="CaisseJetonsModule.reopen()">
              🔓 Rouvrir cette caisse
            </button>
          ` : `
            <form onsubmit="event.preventDefault(); CaisseJetonsModule.submitClosure(${expected});">
              <div class="form-group">
                <label>Montant Réellement Compté (${KermesseConfig.currency}) *</label>
                <input type="number" id="caisseJetonsCounted" class="form-control" style="font-size: 1.2rem; font-weight: 700;" required>
              </div>
              <button class="btn btn-danger" style="width: 100%; font-size: 1rem; font-weight: 800;">
                🔒 Valider la Clôture Caisse Jetons
              </button>
            </form>
          `}
        </div>
      </div>
    `;
  },

  async promptEditInitial(current) {
    const val = prompt('Nouveau fond de caisse initial (FCFA) - Laissez 0 si aucun fond :', current);
    if (val === null) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    await CaissesCore.updateInitialAmount(this.register.id, num);
    this.register.initial_amount_f = num;
    Notify.success(`Fond initial fixé à ${num} F.`);
    this.renderCurrentTab();
  },

  async submitClosure(expected) {
    const counted = parseInt(document.getElementById('caisseJetonsCounted')?.value || '0', 10);
    if (isNaN(counted)) return;
    await CaissesCore.closeRegister(this.register.id, this.register.name, expected, counted);
    Notify.success('Caisse Jetons clôturée.');
    this.register.status = 'closed';
    this.register.counted_amount_f = counted;
    this.register.variance_f = counted - expected;
    this.renderCurrentTab();
  },

  async reopen() {
    await CaissesCore.reopenRegister(this.register.id, this.register.name);
    Notify.success('Caisse Jetons réouverte.');
    this.register.status = 'open';
    this.renderCurrentTab();
  }
};


// ==============================================================================
// 4. MODULE : CAISSE RESTAURATION & BUVETTE (CaisseRestaurationModule)
// Pôle 4 : Restauration
// ==============================================================================
const CaisseRestaurationModule = {
  currentTab: 'pos', // 'pos', 'expenses', 'journal', 'closure'
  activeCategoryFilter: 'all',
  register: null,
  products: [],
  sales: [],
  expenses: [],
  cart: [],
  paymentMethod: 'cash', // 'cash' | 'tokens'

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Restauration', 'Caisse 4 — Restauration & Buvette');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🍔</span> Pôle 4 : Caisse Restauration &amp; Buvette
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Caisse Ouverte' : '🔴 Caisse Clôturée'}
            </span>
          </div>
        </div>

        <div class="card-body">
          <!-- Onglets de la caisse Restauration -->
          <div class="tabs-nav" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--gray-200); margin-bottom: 1.25rem; overflow-x: auto;">
            <button class="tab-btn ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('pos')">
              🍔 Vente Tactile Restauration
            </button>
            <button class="tab-btn ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('expenses')">
              💸 Dépenses de cette Caisse (${this.expenses.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('journal')">
              🧾 Journal des Ventes (${this.sales.length})
            </button>
            <button class="tab-btn ${this.currentTab === 'closure' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('closure')">
              🔒 Contrôle &amp; Clôture
            </button>
          </div>

          <div id="caisseRestaurationTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();
  },

  switchTab(tab) {
    this.currentTab = tab;
    this.render(document.getElementById('mainContent'));
  },

  async loadData() {
    const client = SupabaseClient.client;
    this.sales = [];
    this.products = [];

    // Récupérer les produits alimentaires depuis Supabase
    if (client) {
      try {
        const { data: pData, error } = await client
          .from('food_products')
          .select('*')
          .eq('is_active', true)
          .order('name');
        if (!error && pData) this.products = pData;
      } catch (e) {
        console.warn('[CaisseRestauration Load Products DB]', e);
      }
    }

    // Récupération locale des produits si vide
    if (this.products.length === 0) {
      const stored = localStorage.getItem('kermesse_food_products');
      if (stored) {
        try { this.products = JSON.parse(stored); } catch (e) {}
      }
    }

    // Ventes Restauration
    const cancelledIds = CaissesCore.getCancelledSaleIds();
    if (client) {
      try {
        const { data: vData } = await client
          .from('ticket_sales')
          .select('id, quantity, unit_price_f, total_amount_f, item_name, category, payment_mode, product_id, created_at, seller:app_users(login)')
          .eq('category', 'restauration')
          .order('created_at', { ascending: false });
        if (vData) {
          this.sales = vData.filter(s => !cancelledIds.includes(s.id));
        }
      } catch (e) {
        console.warn('[CaisseRestauration Load Sales DB]', e);
      }
    }

    const storedSales = localStorage.getItem('kermesse_food_sales');
    if (storedSales) {
      try {
        const local = JSON.parse(storedSales);
        const filteredLocal = local.filter(l => !cancelledIds.includes(l.id));
        this.sales = [...this.sales, ...filteredLocal.filter(l => !this.sales.some(s => s.id === l.id))];
      } catch (e) {}
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseRestaurationTabContainer');
    if (!container) return;

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
    else if (this.currentTab === 'closure') this.renderClosureTab(container);
  },

  getProductEmoji(name, category) {
    const n = (name || '').toLowerCase();
    const c = (category || '').toLowerCase();
    if (n.includes('burger') || n.includes('hamb')) return '🍔';
    if (n.includes('hot dog') || n.includes('saucisse')) return '🌭';
    if (n.includes('pizza')) return '🍕';
    if (n.includes('sandwich') || n.includes('pain') || n.includes('panini')) return '🥪';
    if (n.includes('frite')) return '🍟';
    if (n.includes('crêpe') || n.includes('crepe') || n.includes('pancake')) return '🥞';
    if (n.includes('gâteau') || n.includes('gateau') || n.includes('cake')) return '🍰';
    if (n.includes('glace') || n.includes('cornet')) return '🍦';
    if (n.includes('bonbon') || n.includes('sucette')) return '🍭';
    if (n.includes('poulet') || n.includes('chawarma') || n.includes('viande') || n.includes('brochette')) return '🍗';
    if (n.includes('eau')) return '💧';
    if (n.includes('coca') || n.includes('soda') || n.includes('fanta') || n.includes('sprite')) return '🥤';
    if (n.includes('jus') || n.includes('cocktail') || n.includes('bissap')) return '🧃';
    if (n.includes('bière') || n.includes('biere')) return '🍺';
    if (c.includes('boisson')) return '🥤';
    if (c.includes('dessert') || c.includes('sucre')) return '🍰';
    if (c.includes('plat') || c.includes('snack')) return '🍔';
    return '🍽️';
  },

  // 1. Onglet Vente Tactile Restauration
  renderPosTab(container) {
    const totalServi = this.sales.reduce((s, x) => s + (x.quantity || 1), 0);
    const totalRevenue = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);

    const categories = ['all', ...new Set(this.products.map(p => p.category || 'Autre'))];
    const filteredProducts = this.activeCategoryFilter === 'all' 
      ? this.products 
      : this.products.filter(p => (p.category || 'Autre') === this.activeCategoryFilter);

    container.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 350px; gap: 1.25rem;">
        
        <div>
          <!-- Indicateurs Restauration -->
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: var(--radius-md); padding: 0.75rem 1rem; margin-bottom: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <span style="font-weight: 700; color: #9a3412;">🍽️ Articles servis :</span>
              <strong style="color: #c2410c; font-size: 1.25rem; margin-left: 6px;">${totalServi.toLocaleString()}</strong>
            </div>
            <div>
              <span style="font-weight: 700; color: #9a3412;">Recette Restauration :</span>
              <strong style="color: #c2410c; font-size: 1.25rem; margin-left: 6px;">${totalRevenue.toLocaleString()} F</strong>
            </div>
          </div>

          <!-- Filtres par catégorie -->
          ${categories.length > 2 ? `
            <div style="display: flex; gap: 0.4rem; margin-bottom: 1rem; overflow-x: auto; padding-bottom: 4px;">
              ${categories.map(cat => `
                <button class="btn btn-sm ${this.activeCategoryFilter === cat ? 'btn-primary' : 'btn-secondary'}" 
                  style="${this.activeCategoryFilter === cat ? 'background: #ea580c; border-color: #c2410c;' : ''}"
                  onclick="CaisseRestaurationModule.activeCategoryFilter = '${cat.replace(/'/g, "\\'")}'; CaisseRestaurationModule.renderCurrentTab();">
                  ${cat === 'all' ? `🍽️ Tout (${this.products.length})` : cat}
                </button>
              `).join('')}
            </div>
          ` : ''}

          <!-- Grille des produits alimentaires -->
          ${this.products.length === 0 ? `
            <div class="empty-state" style="padding: 2.5rem; background: var(--gray-50); border: 2px dashed var(--gray-300); border-radius: var(--radius-md); text-align: center;">
              <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">🍔</div>
              <div style="font-weight: 800; font-size: 1.15rem; color: var(--gray-800);">Aucun produit alimentaire enregistré</div>
              <div style="font-size: 0.85rem; color: var(--gray-500); max-width: 480px; margin: 0.5rem auto 1.25rem;">
                Cette caisse utilise la liste de nourriture définie dans le Pôle 4. Enregistrez vos boissons, snacks ou repas dans le module <strong>Denrées &amp; Boissons</strong> pour qu'ils s'affichent ici.
              </div>
              <button class="btn btn-primary" style="background: #ea580c; border-color: #c2410c;" onclick="App.navigateTo('stocks')">
                <span>➕</span> Aller dans Denrées &amp; Boissons (Pôle 4)
              </button>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 0.85rem;">
              ${filteredProducts.map(p => {
                const inCart = this.cart.find(i => i.id === p.id);
                const qty = inCart ? inCart.qty : 0;
                const price = p.selling_price_f || 0;
                const stock = p.current_stock !== undefined ? p.current_stock : 999;
                const isOutOfStock = stock <= 0;
                const emoji = this.getProductEmoji(p.name, p.category);

                return `
                  <div class="card" style="border: 2px solid ${qty > 0 ? '#ea580c' : '#e2e8f0'}; border-top: 5px solid ${isOutOfStock ? 'var(--danger)' : '#ea580c'}; transition: box-shadow 0.15s; background: ${qty > 0 ? '#fff7ed' : 'white'}; opacity: ${isOutOfStock ? '0.7' : '1'};">
                    <div class="card-body" style="padding: 1rem;">
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.4rem;">
                        <span style="font-size: 2rem;">${emoji}</span>
                        <div style="text-align: right;">
                          <strong style="font-size: 1.15rem; color: #c2410c;">${price.toLocaleString()} F</strong>
                          <div>
                            ${isOutOfStock ? `
                              <span class="badge badge-danger" style="font-size: 0.68rem;">Épuisé</span>
                            ` : stock <= 10 ? `
                              <span class="badge badge-warning" style="font-size: 0.68rem;">Reste ${stock}</span>
                            ` : `
                              <span class="badge badge-gray" style="font-size: 0.68rem;">Stock: ${stock}</span>
                            `}
                          </div>
                        </div>
                      </div>

                      <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.25rem; min-height: 2.2em; line-height: 1.2;">
                        ${p.name}
                      </div>
                      <div style="font-size: 0.72rem; color: var(--gray-500); margin-bottom: 0.6rem;">
                        ${p.category || 'Restauration'} • ${p.unit || 'portion'}
                      </div>

                      <!-- 2 BOUTONS : AUGMENTER (+) ET DIMINUER (-) -->
                      <div style="display: flex; align-items: center; justify-content: space-between; background: var(--gray-50); padding: 4px 8px; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                        <button class="btn btn-secondary btn-sm" style="width: 38px; height: 38px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center;" onclick="CaisseRestaurationModule.decrementItem('${p.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div style="text-align: center;">
                          <span style="font-size: 1.2rem; font-weight: 800; color: ${qty > 0 ? '#c2410c' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <div style="font-size: 0.7rem; color: var(--gray-500); line-height: 1;">servi(s)</div>
                        </div>
                        <button class="btn btn-primary btn-sm" style="width: 38px; height: 38px; font-size: 1.3rem; font-weight: 900; padding: 0; display: flex; align-items: center; justify-content: center; background: #ea580c; border-color: #c2410c;" onclick="CaisseRestaurationModule.incrementItem('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${price}, ${stock})" ${isOutOfStock ? 'disabled title="Rupture de stock"' : ''} title="Augmenter">
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}

          <!-- SECTION : DERNIÈRES VENTES RESTAURATION VALIDÉES (ANNULATION DIRECTE) -->
          <div style="margin-top: 2rem; border-top: 2px dashed var(--gray-200); padding-top: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h4 style="margin: 0; font-size: 1rem; color: var(--gray-800); display: flex; align-items: center; gap: 0.4rem;">
                <span>🧾</span> Dernières commandes restauration validées
              </h4>
              <span style="font-size: 0.8rem; color: var(--gray-500);">Cliquez sur 🗑️ pour annuler et restituer le stock</span>
            </div>

            ${this.sales.length === 0 ? `
              <p style="color: var(--gray-400); font-size: 0.85rem; font-style: italic;">Aucune commande validée pour le moment.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 280px; overflow-y: auto;">
                ${this.sales.slice(0, 8).map(s => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.85rem; background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                    <div>
                      <div style="font-weight: 700; font-size: 0.9rem;">
                        🍽️ ${s.item_name} <span class="badge badge-gray" style="font-size: 0.72rem; margin-left: 4px;">×${s.quantity}</span>
                        ${s.payment_mode === 'tokens' ? '<span class="badge badge-warning" style="margin-left: 4px; font-size: 0.7rem;">🪙 Jetons</span>' : '<span class="badge badge-success" style="margin-left: 4px; font-size: 0.7rem;">💵 Espèces</span>'}
                      </div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">
                        Validé à ${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      <strong style="color: var(--success); font-size: 1rem;">
                        +${(s.total_amount_f || 0).toLocaleString()} F
                      </strong>
                      <button class="btn btn-danger btn-sm" onclick="CaisseRestaurationModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f}, '${s.product_id || ''}', ${s.quantity})" title="Annuler et remettre en stock" style="display: flex; align-items: center; gap: 4px;">
                        <span>🗑️</span> Enlever
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

        </div>

        <!-- Panier Commande Restauration (Colonne Droite) -->
        <div class="card" style="border: 2px solid #ea580c; box-shadow: var(--shadow-md); position: sticky; top: 1rem;">
          <div class="card-header" style="background: #ea580c; color: white;">
            <div class="card-title" style="color: white; font-size: 1rem;">
              <span>🛒</span> Commande (${this.cart.reduce((s, i) => s + i.qty, 0)})
            </div>
            ${this.cart.length > 0 ? `
              <button class="btn btn-sm" style="background: rgba(255,255,255,0.2); color: white; border: none; padding: 2px 8px; font-size: 0.75rem;" onclick="CaisseRestaurationModule.cart = []; CaisseRestaurationModule.renderCurrentTab();">Vider</button>
            ` : ''}
          </div>

          <div class="card-body" style="padding: 1rem;">
            ${this.cart.length === 0 ? `
              <div style="text-align: center; padding: 2rem 0; color: var(--gray-400);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🍔</div>
                <div style="font-weight: 700;">Aucun article sélectionné</div>
                <div style="font-size: 0.8rem; margin-top: 4px;">Cliquez sur <strong>+</strong> pour ajouter des plats ou boissons</div>
              </div>
            ` : `
              <div style="max-height: 220px; overflow-y: auto; margin-bottom: 0.75rem;">
                ${this.cart.map(item => `
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--gray-100);">
                    <div style="flex: 1;">
                      <div style="font-weight: 700; font-size: 0.88rem;">${item.name}</div>
                      <div style="font-size: 0.75rem; color: var(--gray-500);">${(item.price * item.qty).toLocaleString()} F (${item.price} F / u.)</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.3rem;">
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseRestaurationModule.decrementItem('${item.id}')">−</button>
                      <strong style="min-width: 24px; text-align: center; font-size: 0.95rem;">${item.qty}</strong>
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseRestaurationModule.incrementItem('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price}, ${item.maxStock})">+</button>
                      <button class="btn btn-danger btn-sm" style="padding: 2px 6px; font-size: 0.75rem; margin-left: 2px;" onclick="CaisseRestaurationModule.removeItem('${item.id}')" title="Retirer">✕</button>
                    </div>
                  </div>
                `).join('')}
              </div>

              <div style="display: flex; justify-content: space-between; font-size: 1.15rem; font-weight: 800; border-top: 2px solid var(--gray-200); padding-top: 0.5rem; margin-bottom: 0.75rem;">
                <span>Total Commande :</span>
                <span style="color: #c2410c;">${cartTotal.toLocaleString()} F</span>
              </div>

              <!-- SÉLECTEUR DU MODE DE PAIEMENT : ESPÈCES OU JETONS -->
              <div style="background: var(--gray-50); border: 1px solid var(--gray-200); border-radius: var(--radius-md); padding: 0.65rem; margin-bottom: 0.75rem;">
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-700); display: block; margin-bottom: 0.35rem;">
                  Mode de règlement :
                </label>
                <div style="display: flex; gap: 0.4rem;">
                  <button type="button" class="btn btn-sm" style="flex: 1; font-weight: 700; ${this.paymentMethod === 'cash' ? 'background: #ea580c; color: white;' : 'background: white; border: 1px solid var(--gray-300);'}" onclick="CaisseRestaurationModule.setPaymentMethod('cash')">
                    💵 Espèces (FCFA)
                  </button>
                  <button type="button" class="btn btn-sm" style="flex: 1; font-weight: 700; ${this.paymentMethod === 'tokens' ? 'background: #b45309; color: white;' : 'background: white; border: 1px solid var(--gray-300);'}" onclick="CaisseRestaurationModule.setPaymentMethod('tokens')">
                    🪙 Jetons de Monnaie
                  </button>
                </div>

                ${this.paymentMethod === 'cash' ? `
                  <div style="margin-top: 0.6rem;">
                    <input type="number" id="caisseRestoCashGiven" class="form-control form-control-sm" placeholder="Espèces reçues (FCFA)" oninput="CaisseRestaurationModule.calcChange(${cartTotal})">
                    <div id="caisseRestoChangeDisp" style="margin-top: 4px; font-weight: 700; font-size: 0.8rem; color: #1e40af;">Monnaie à rendre : 0 F</div>
                  </div>
                ` : `
                  <div style="margin-top: 0.6rem; padding: 0.5rem; background: #fef3c7; border: 1px solid #fde68a; border-radius: var(--radius-sm); font-size: 0.78rem; color: #92400e;">
                    <div>🪙 Équivalence en Jetons à réclamer :</div>
                    <strong style="font-size: 0.95rem; color: #b45309;">${cartTotal.toLocaleString()} F en Jetons</strong>
                    <div style="font-size: 0.7rem; color: #78350f; margin-top: 2px;">
                      (Ex: ${Math.ceil(cartTotal / 100)} jetons de 100 F, ou mix 50F / 200F / 250F)
                    </div>
                  </div>
                `}
              </div>

              <button class="btn btn-primary" style="width: 100%; font-size: 1.05rem; font-weight: 800; background: #ea580c; border-color: #c2410c;" onclick="CaisseRestaurationModule.checkout()">
                ⚡ Encaisser &amp; Déstocker (${cartTotal.toLocaleString()} F)
              </button>
            `}
          </div>
        </div>

      </div>
    `;
  },

  setPaymentMethod(method) {
    this.paymentMethod = method;
    this.renderCurrentTab();
  },

  incrementItem(id, name, price, maxStock = 999) {
    const ex = this.cart.find(i => i.id === id);
    if (ex) {
      if (maxStock !== null && maxStock !== undefined && ex.qty >= maxStock) {
        Notify.warning(`Stock maximum atteint pour « ${name} » (${maxStock} dispo).`);
        return;
      }
      ex.qty += 1;
    } else {
      if (maxStock <= 0) {
        Notify.error(`« ${name} » est en rupture de stock.`);
        return;
      }
      this.cart.push({ id, name, price, qty: 1, maxStock });
    }
    this.renderCurrentTab();
  },

  decrementItem(id) {
    const idx = this.cart.findIndex(i => i.id === id);
    if (idx >= 0) {
      if (this.cart[idx].qty > 1) {
        this.cart[idx].qty -= 1;
      } else {
        this.cart.splice(idx, 1);
      }
      this.renderCurrentTab();
    }
  },

  removeItem(id) {
    this.cart = this.cart.filter(i => i.id !== id);
    this.renderCurrentTab();
  },

  calcChange(total) {
    const input = document.getElementById('caisseRestoCashGiven');
    const disp = document.getElementById('caisseRestoChangeDisp');
    if (!input || !disp) return;
    const given = parseInt(input.value || '0', 10);
    const diff = given - total;
    if (given <= 0) disp.innerHTML = 'Monnaie à rendre : 0 F';
    else if (diff < 0) disp.innerHTML = `<span style="color: var(--danger);">⚠️ Manque ${Math.abs(diff).toLocaleString()} F !</span>`;
    else disp.innerHTML = `<span style="color: var(--success);">💵 À RENDRE : ${diff.toLocaleString()} F</span>`;
  },

  async checkout() {
    if (this.cart.length === 0) return;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
    const regId = this.register.id;
    const mode = this.paymentMethod;

    for (const item of this.cart) {
      let realSaleId = 'sale-food-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

      const saleObj = {
        cash_register_id: CaissesCore.isUuid(regId) ? regId : null,
        item_name: item.name,
        category: 'restauration',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        payment_mode: mode,
        product_id: CaissesCore.isUuid(item.id) ? item.id : null,
        sold_by: user ? user.id : null
      };

      if (client) {
        try {
          const { data } = await client.from('ticket_sales').insert([saleObj]).select('id');
          if (data && data[0]) realSaleId = data[0].id;

          // Déstockage automatique dans stock_movements
          if (CaissesCore.isUuid(item.id)) {
            await client.from('stock_movements').insert([{
              product_id: item.id,
              type: 'vente',
              quantity: item.qty,
              reason: `Vente Caisse Restauration (${mode})`,
              user_id: user ? user.id : null
            }]);
          }
        } catch (e) {
          console.warn('[Checkout Resto DB Warning]', e);
        }
      }

      // Mettre à jour le stock localement aussi
      const p = this.products.find(prod => prod.id === item.id);
      if (p && p.current_stock !== undefined) {
        p.current_stock = Math.max(0, p.current_stock - item.qty);
      }

      this.sales.unshift({
        ...saleObj,
        id: realSaleId,
        created_at: new Date().toISOString()
      });
    }

    // Sauvegarde locale
    localStorage.setItem('kermesse_food_sales', JSON.stringify(this.sales));
    localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente Restauration (${mode === 'tokens' ? 'En Jetons' : 'En Espèces'})`,
          tokens_detail: mode === 'tokens' ? { total_tokens_f: cartTotal } : null,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_RESTAURATION', 'ticket_sales', null, `Vente restauration de ${cartTotal} F (${mode})`);
    Notify.success(`Commande validée et stock décompté ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount, productId, quantity) {
    if (!confirm(`Annuler et enlever la commande de « ${name} » (${amount} F) ?\n\nLe montant sera retiré de la caisse et la quantité (${quantity}) sera remise en stock.`)) {
      return;
    }

    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();

    // 1. Ajouter à la liste noire des annulations (pour mise à jour Bilan)
    CaissesCore.addCancelledSaleId(id);

    // 2. Supprimer dans Supabase et réapprovisionner le stock
    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        if (CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Annulation vente restauration : ${name}`,
            user_id: user ? user.id : null
          }]);
        }
        if (CaissesCore.isUuid(productId)) {
          await client.from('stock_movements').insert([{
            product_id: productId,
            type: 'livraison_entree',
            quantity: quantity,
            reason: `Restitution stock suite annulation vente : ${name}`,
            user_id: user ? user.id : null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Resto Sale DB Warning]', e);
      }
    }

    // Remettre le stock localement
    const p = this.products.find(prod => prod.id === productId || prod.name === name);
    if (p && p.current_stock !== undefined) {
      p.current_stock += (quantity || 1);
      localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_food_sales', JSON.stringify(this.sales));

    AuditLogger.log('ANNULATION_VENTE_RESTAURATION', 'ticket_sales', id, `Annulation vente resto ${name} (-${amount} F)`);
    Notify.success(`Commande « ${name} » enlevée. Stock réapprovisionné et bilan synchronisé.`);
    this.renderCurrentTab();
  },

  // 2. Onglet Dépenses de la Caisse Restauration
  renderExpensesTab(container) {
    const totalExp = this.expenses.reduce((s, e) => s + Math.abs(e.amount_f), 0);
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
        <div>
          <h3 style="margin: 0; font-size: 1.1rem;">Dépenses payées par la Caisse Restauration</h3>
          <p style="margin: 0; font-size: 0.85rem; color: var(--gray-500);">Achats urgents : glace, pain, sauces, charbon, gobelets...</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="font-weight: 800; font-size: 1.1rem; color: var(--danger);">
            Total Sorties : -${totalExp.toLocaleString()} F
          </div>
          <button class="btn btn-primary btn-sm" onclick="CaisseRestaurationModule.openAddExpenseModal()">
            <span>➕</span> Nouvelle Dépense
          </button>
        </div>
      </div>

      <div class="table-responsive">
        ${this.expenses.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">💸</div>
            <div class="empty-title">Aucune dépense enregistrée sur cette caisse</div>
            <div class="empty-desc">Enregistrez les sorties d'argent effectuées avec les recettes de la buvette ou du snack.</div>
            <button class="btn btn-primary btn-sm" onclick="CaisseRestaurationModule.openAddExpenseModal()">
              <span>➕</span> Enregistrer une dépense
            </button>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Motif / Justification</th>
                <th>Montant</th>
                <th>Enregistré par</th>
                <th style="text-align: right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.expenses.map(e => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${e.reason}</strong></td>
                  <td style="font-weight: 700; color: var(--danger); font-size: 1rem;">
                    -${Math.abs(e.amount_f).toLocaleString()} F
                  </td>
                  <td><span class="badge badge-gray">${e.user ? e.user.login : 'Caissier'}</span></td>
                  <td style="text-align: right; white-space: nowrap;">
                    <button class="btn btn-secondary btn-sm" onclick="CaisseRestaurationModule.openEditExpenseModal('${e.id}', ${Math.abs(e.amount_f)}, '${e.reason.replace(/'/g, "\\'")}')" title="Modifier">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="CaisseRestaurationModule.deleteExpense('${e.id}', ${Math.abs(e.amount_f)})" title="Supprimer" style="margin-left: 0.25rem;">🗑️</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  openAddExpenseModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Nouvelle Dépense — Caisse Restauration</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="expRestoForm">
            <div class="form-group">
              <label>Montant (${KermesseConfig.currency}) *</label>
              <input type="number" id="expRestoAmount" class="form-control" required min="1" step="50" placeholder="Ex: 3000">
            </div>
            <div class="form-group">
              <label>Motif de la dépense *</label>
              <input type="text" id="expRestoMotive" class="form-control" required placeholder="Ex: Rachat 5 baguettes, sac de glace, épices...">
            </div>
            <div class="form-group">
              <label>Bénéficiaire / Justificatif (optionnel)</label>
              <input type="text" id="expRestoRef" class="form-control" placeholder="Ex: Reçu boulangerie...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmAddExpResto">Enregistrer la dépense</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmAddExpResto').onclick = async () => {
      const amt = parseInt(document.getElementById('expRestoAmount').value, 10);
      const motive = document.getElementById('expRestoMotive').value.trim();
      const ref = document.getElementById('expRestoRef').value.trim();

      if (isNaN(amt) || amt <= 0 || !motive) {
        Notify.error('Données invalides.');
        return;
      }

      await CaissesCore.addExpense(this.register.id, this.register.name, amt, motive, ref);
      Notify.success('Dépense enregistrée et déduite de la caisse.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  openEditExpenseModal(id, currentAmount, currentMotive) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier la Dépense</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label>Montant (${KermesseConfig.currency}) *</label>
            <input type="number" id="editExpRestAmt" class="form-control" required min="1" step="50" value="${currentAmount}">
          </div>
          <div class="form-group">
            <label>Motif *</label>
            <input type="text" id="editExpRestMot" class="form-control" required value="${currentMotive.replace(/"/g, '&quot;')}">
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditExpRestBtn">Enregistrer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditExpRestBtn').onclick = async () => {
      const amt = parseInt(document.getElementById('editExpRestAmt').value, 10);
      const motive = document.getElementById('editExpRestMot').value.trim();
      await CaissesCore.editExpense(id, this.register.id, this.register.name, amt, motive);
      Notify.success('Dépense modifiée.');
      close();
      await this.loadData();
      this.renderCurrentTab();
    };
  },

  async deleteExpense(id, amount) {
    if (!confirm(`Supprimer cette dépense de ${amount} F ?`)) return;
    await CaissesCore.deleteExpense(id, this.register.id, this.register.name, amount);
    Notify.success('Dépense supprimée.');
    await this.loadData();
    this.renderCurrentTab();
  },

  // 3. Onglet Journal des Ventes Restauration
  renderJournalTab(container) {
    container.innerHTML = `
      <div style="margin-bottom: 1rem;">
        <h4 style="margin: 0;">Journal des Ventes — Restauration &amp; Buvette</h4>
      </div>
      <div class="table-responsive">
        ${this.sales.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">🧾</div>
            <div class="empty-title">Aucune commande encaissée pour l'instant</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Heure</th>
                <th>Article / Plat</th>
                <th>Qté</th>
                <th>Prix Unitaire</th>
                <th>Règlement</th>
                <th>Total Encaissé</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.sales.map(s => `
                <tr>
                  <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>${s.item_name}</strong></td>
                  <td>${s.quantity}</td>
                  <td>${(s.unit_price_f || 0).toLocaleString()} F</td>
                  <td>${s.payment_mode === 'tokens' ? '<span class="badge badge-warning">🪙 Jetons</span>' : '<span class="badge badge-success">💵 Espèces</span>'}</td>
                  <td><strong style="color: var(--success);">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                  <td style="text-align: right;">
                    <button class="btn btn-danger btn-sm" onclick="CaisseRestaurationModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f}, '${s.product_id || ''}', ${s.quantity})" title="Annuler et remettre en stock">🗑️ Enlever</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `;
  },

  // 4. Onglet Contrôle & Clôture Caisse Restauration
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    const revTotal = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const revCash = this.sales.filter(s => s.payment_mode !== 'tokens').reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const revTokens = this.sales.filter(s => s.payment_mode === 'tokens').reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const expTotal = this.expenses.reduce((s, x) => s + Math.abs(x.amount_f), 0);
    const expectedCash = initF + revCash - expTotal;

    container.innerHTML = `
      <div style="max-width: 620px; margin: 0 auto;">
        <div class="card" style="border: 2px solid #ea580c; padding: 1.25rem;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; color: #c2410c;">
            🔒 Contrôle &amp; Clôture — Caisse Restauration
          </h3>

          <div style="background: var(--gray-50); padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; align-items: center;">
              <span>Fond de caisse initial :</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <strong>${initF.toLocaleString()} F</strong>
                <button class="btn btn-secondary btn-sm" style="padding: 1px 6px; font-size: 0.75rem;" onclick="CaisseRestaurationModule.promptEditInitial(${initF})">Modifier</button>
              </div>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--success);">
              <span>+ Recettes Espèces encaissées :</span>
              <strong>+${revCash.toLocaleString()} F</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: #b45309;">
              <span>🪙 Recettes encaissées en Jetons :</span>
              <strong>+${revTokens.toLocaleString()} F</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; color: var(--danger);">
              <span>- Dépenses déduites de cette caisse :</span>
              <strong>-${expTotal.toLocaleString()} F</strong>
            </div>
            <hr style="border: none; border-top: 1px solid var(--gray-300); margin: 0.5rem 0;">
            <div style="display: flex; justify-content: space-between; font-size: 1.15rem;">
              <span><strong>Espèces Théoriques Attendues :</strong></span>
              <span style="font-weight: 800; color: #c2410c; font-size: 1.25rem;">
                ${expectedCash.toLocaleString()} F
              </span>
            </div>
          </div>

          ${this.register.status === 'closed' ? `
            <div class="alert-banner info" style="margin-bottom: 1rem;">
              <div>
                🔒 <strong>Caisse Clôturée :</strong><br>
                Espèces comptées : <strong>${(this.register.counted_amount_f || 0).toLocaleString()} F</strong> | 
                Écart : <strong>${(this.register.variance_f || 0).toLocaleString()} F</strong>
              </div>
            </div>
            <button class="btn btn-secondary" style="width: 100%;" onclick="CaisseRestaurationModule.reopen()">
              🔓 Rouvrir cette caisse
            </button>
          ` : `
            <form onsubmit="event.preventDefault(); CaisseRestaurationModule.submitClosure(${expectedCash});">
              <div class="form-group">
                <label>Montant en Espèces Réellement Compté (${KermesseConfig.currency}) *</label>
                <input type="number" id="caisseRestoCounted" class="form-control" style="font-size: 1.2rem; font-weight: 700;" placeholder="Montant dans le tiroir" required>
              </div>
              <div class="form-group">
                <label>Remarques de clôture (optionnel)</label>
                <input type="text" id="caisseRestoNotes" class="form-control" placeholder="Observations, état du stock restant...">
              </div>
              <button class="btn btn-danger" style="width: 100%; font-size: 1rem; font-weight: 800; background: #dc2626;">
                🔒 Valider la Clôture Caisse Restauration
              </button>
            </form>
          `}
        </div>
      </div>
    `;
  },

  async promptEditInitial(current) {
    const val = prompt('Nouveau fond de caisse initial (FCFA) - Laissez 0 si aucun fond :', current);
    if (val === null) return;
    const num = Math.max(0, parseInt(val, 10) || 0);
    await CaissesCore.updateInitialAmount(this.register.id, num);
    this.register.initial_amount_f = num;
    Notify.success(`Fond initial fixé à ${num} F.`);
    this.renderCurrentTab();
  },

  async submitClosure(expected) {
    const counted = parseInt(document.getElementById('caisseRestoCounted')?.value || '0', 10);
    const notes = document.getElementById('caisseRestoNotes')?.value || '';
    if (isNaN(counted)) return;

    await CaissesCore.closeRegister(this.register.id, this.register.name, expected, counted, notes);
    Notify.success('Caisse Restauration clôturée.');
    this.register.status = 'closed';
    this.register.counted_amount_f = counted;
    this.register.variance_f = counted - expected;
    this.renderCurrentTab();
  },

  async reopen() {
    await CaissesCore.reopenRegister(this.register.id, this.register.name);
    Notify.success('Caisse Restauration réouverte.');
    this.register.status = 'open';
    this.renderCurrentTab();
  }
};


// ==============================================================================
// 5. MODULE : BILAN FINANCIER GLOBAL KERMESSE (CaisseBilanModule)
// ==============================================================================
const CaisseBilanModule = {
  sales: [],
  expenses: [],
  registers: [],
  registers: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📊</span> Pôle 2 : Bilan Financier Consolidé de la Kermesse
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="CaisseBilanModule.render(document.getElementById('mainContent'))">
              <span>🔄</span> Actualiser
            </button>
          </div>
        </div>
        <div class="card-body" id="bilanContentContainer">
          <div style="text-align: center; padding: 2rem;">Chargement du bilan consolidé...</div>
        </div>
      </div>
    `;

    await this.loadData();
    this.renderSummary();
  },

  async loadData() {
    const client = SupabaseClient.client;
    this.sales = [];
    this.registers = [];
    this.expenses = [];

    const cancelledIds = CaissesCore.getCancelledSaleIds();

    if (client) {
      try {
        const { data: s } = await client
          .from('ticket_sales')
          .select('id, quantity, total_amount_f, category, item_name, stand:stands(name, color_name, color_hex)');
        if (s && s.length > 0) {
          this.sales = s.filter(item => !cancelledIds.includes(item.id));
        }

        const { data: r } = await client.from('cash_registers').select('*').order('name');
        if (r) this.registers = r;

        const { data: e } = await client.from('cash_movements').select('*').eq('type', 'depense_autorisee');
        if (e) this.expenses = e;
      } catch (e) {
        console.warn('[Bilan DB Error]', e);
      }
    }

    // Récupération locale de secours si Supabase vide ou hors ligne
    const storedEntree = localStorage.getItem('kermesse_entry_sales');
    const storedJeux = localStorage.getItem('kermesse_game_sales');
    const storedFood = localStorage.getItem('kermesse_food_sales');
    let localCombined = [];
    try { if (storedEntree) localCombined = [...localCombined, ...JSON.parse(storedEntree)]; } catch (e) {}
    try { if (storedJeux) localCombined = [...localCombined, ...JSON.parse(storedJeux)]; } catch (e) {}
    try { if (storedFood) localCombined = [...localCombined, ...JSON.parse(storedFood)]; } catch (e) {}

    // Filtrer les ventes annulées du localCombined
    localCombined = localCombined.filter(l => !cancelledIds.includes(l.id));

    if (this.sales.length === 0) {
      this.sales = localCombined;
    } else {
      const unSynced = localCombined.filter(l => !this.sales.some(s => s.id === l.id) && !cancelledIds.includes(l.id));
      this.sales = [...this.sales, ...unSynced];
    }
  },

  renderSummary() {
    const container = document.getElementById('bilanContentContainer');
    if (!container) return;

    let revEntree = 0;
    let revJeux = 0;
    let revResto = 0;
    const standTotals = {};

    this.sales.forEach(s => {
      const amt = s.total_amount_f || 0;
      if (s.category === 'entree') {
        revEntree += amt;
      } else if (s.category === 'restauration') {
        revResto += amt;
      } else {
        revJeux += amt;
        const stName = s.stand ? s.stand.name : 'Stand Non Spécifié';
        standTotals[stName] = (standTotals[stName] || 0) + amt;
      }
    });

    const totalDépenses = this.expenses.reduce((sum, e) => sum + Math.abs(e.amount_f), 0);
    const totalRecettes = revEntree + revJeux + revResto;
    const beneficeNet = totalRecettes - totalDépenses;

    container.innerHTML = `
      <div style="max-width: 860px; margin: 0 auto;">
        
        <!-- Cartes synthétiques des 4 Caisses -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          
          <div class="card" style="border: 2px solid #10b981; border-top: 6px solid #10b981;">
            <div class="card-body" style="padding: 1rem;">
              <div style="font-weight: 700; color: #065f46; font-size: 0.95rem;">🎟️ Caisse 1 : Entrée &amp; Accueil</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #047857; margin: 0.35rem 0;">
                ${revEntree.toLocaleString()} F
              </div>
              <div style="font-size: 0.8rem; color: var(--gray-500);">Billets d'entrée encaissés</div>
              <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="App.navigateTo('caisse_entree')">Gérer Caisse 1</button>
            </div>
          </div>

          <div class="card" style="border: 2px solid var(--primary); border-top: 6px solid var(--primary);">
            <div class="card-body" style="padding: 1rem;">
              <div style="font-weight: 700; color: #1e40af; font-size: 0.95rem;">🎯 Caisse 2 : Tickets de Jeux</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #1d4ed8; margin: 0.35rem 0;">
                ${revJeux.toLocaleString()} F
              </div>
              <div style="font-size: 0.8rem; color: var(--gray-500);">Tickets des stands &amp; jeux</div>
              <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="App.navigateTo('caisse_jeux')">Gérer Caisse 2</button>
            </div>
          </div>

          <div class="card" style="border: 2px solid #ec4899; border-top: 6px solid #ec4899;">
            <div class="card-body" style="padding: 1rem;">
              <div style="font-weight: 700; color: #9d174d; font-size: 0.95rem;">🍔 Caisse 4 : Restauration</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #be185d; margin: 0.35rem 0;">
                ${revResto.toLocaleString()} F
              </div>
              <div style="font-size: 0.8rem; color: var(--gray-500);">Plats &amp; boissons vendus</div>
              <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="App.navigateTo('caisse_restauration')">Gérer Caisse Resto</button>
            </div>
          </div>

          <div class="card" style="border: 2px solid #f59e0b; border-top: 6px solid #f59e0b;">
            <div class="card-body" style="padding: 1rem;">
              <div style="font-weight: 700; color: #92400e; font-size: 0.95rem;">🪙 Caisse 3 : Monnaie &amp; Jetons</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #b45309; margin: 0.35rem 0;">
                Actif
              </div>
              <div style="font-size: 0.8rem; color: var(--gray-500);">Change &amp; rachat jetons</div>
              <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="App.navigateTo('caisse_jetons')">Gérer Caisse 3</button>
            </div>
          </div>

        </div>

        <!-- Grand Bilan Consolidé Net -->
        <div style="background: #f8fafc; border: 2px solid var(--gray-300); border-radius: var(--radius-lg); padding: 1.5rem; margin-bottom: 2rem; box-shadow: var(--shadow-md);">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center; border-bottom: 1px solid var(--gray-200); padding-bottom: 1rem; margin-bottom: 1rem;">
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Total Recettes Brutes</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--success); margin-top: 4px;">
                ${totalRecettes.toLocaleString()} F
              </div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Total Dépenses Caisses</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--danger); margin-top: 4px;">
                -${totalDépenses.toLocaleString()} F
              </div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Bénéfice Net Kermesse</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: ${beneficeNet >= 0 ? 'var(--primary)' : 'var(--danger)'}; margin-top: 4px;">
                ${beneficeNet.toLocaleString()} ${KermesseConfig.currency}
              </div>
            </div>
          </div>
          <div style="text-align: center; font-size: 0.85rem; color: var(--gray-500);">
            ❤️ Fonds entièrement dédiés aux œuvres sociales de l'association Love and Charity
          </div>
        </div>

        <!-- Palmarès des Stands les plus rentables -->
        <div class="card" style="border: 2px solid #e2e8f0;">
          <div class="card-header" style="background: var(--gray-50);">
            <div class="card-title" style="font-size: 1rem;">
              <span>🏆</span> Palmarès des Stands (Recettes Tickets Jeux générées)
            </div>
          </div>
          <div class="card-body" style="padding: 1rem;">
            ${Object.keys(standTotals).length === 0 ? `
              <p style="text-align: center; color: var(--gray-500); padding: 1rem 0;">Aucune vente de tickets enregistrée pour l'instant.</p>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                ${Object.entries(standTotals)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, total], idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--gray-50); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">#${idx + 1}</span>
                        <strong>🎪 ${name}</strong>
                      </div>
                      <strong style="color: var(--success); font-size: 1.1rem;">
                        ${total.toLocaleString()} F
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

// Export global pour la plateforme
window.CaissesCore = CaissesCore;
window.CaisseEntreeModule = CaisseEntreeModule;
window.CaisseJeuxModule = CaisseJeuxModule;
window.CaisseJetonsModule = CaisseJetonsModule;
window.CaisseRestaurationModule = CaisseRestaurationModule;
window.CaisseBilanModule = CaisseBilanModule;
