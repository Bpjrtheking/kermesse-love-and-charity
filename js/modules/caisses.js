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

  getCancelledTicketNames() {
    try {
      const stored = localStorage.getItem('kermesse_cancelled_ticket_names');
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  async syncCancellationsFromDb() {
    const client = SupabaseClient.client;
    const cancelledIds = this.getCancelledSaleIds();
    const cancelledNames = this.getCancelledTicketNames();
    let purgeBefore = localStorage.getItem('kermesse_purge_all_sales_before') || null;

    if (client) {
      try {
        const { data } = await client
          .from('tickets_catalog')
          .select('name, type, created_at')
          .in('type', ['cancelled_sale', 'cancelled_ticket_name', 'purge_all_sales']);

        if (data && data.length > 0) {
          data.forEach(item => {
            if (item.type === 'cancelled_sale' && item.name && !cancelledIds.includes(item.name)) {
              cancelledIds.push(item.name);
            } else if (item.type === 'cancelled_ticket_name' && item.name && !cancelledNames.includes(item.name)) {
              cancelledNames.push(item.name);
            } else if (item.type === 'purge_all_sales') {
              if (!purgeBefore || item.created_at > purgeBefore) {
                purgeBefore = item.created_at;
              }
            }
          });
          localStorage.setItem('kermesse_cancelled_sale_ids', JSON.stringify(cancelledIds));
          localStorage.setItem('kermesse_cancelled_ticket_names', JSON.stringify(cancelledNames));
          if (purgeBefore) {
            localStorage.setItem('kermesse_purge_all_sales_before', purgeBefore);
          }
        }
      } catch (e) {
        console.warn('[Sync Cancellations Warning]', e);
      }
    }

    return {
      cancelledIds,
      cancelledNames,
      purgeBefore: purgeBefore ? new Date(purgeBefore) : null
    };
  },

  async addCancelledSaleId(id, itemName = '') {
    if (!id) return;
    const ids = this.getCancelledSaleIds();
    if (!ids.includes(id)) {
      ids.push(id);
      localStorage.setItem('kermesse_cancelled_sale_ids', JSON.stringify(ids));
    }
    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('tickets_catalog').insert([{
          type: 'cancelled_sale',
          name: id,
          value_f: 0,
          is_active: false,
          description: itemName || 'Vente annulée'
        }]);
      } catch (e) {}
    }
  },

  async addCancelledTicketName(ticketName) {
    if (!ticketName) return;
    const names = this.getCancelledTicketNames();
    if (!names.includes(ticketName)) {
      names.push(ticketName);
      localStorage.setItem('kermesse_cancelled_ticket_names', JSON.stringify(names));
    }
    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('tickets_catalog').insert([{
          type: 'cancelled_ticket_name',
          name: ticketName,
          value_f: 0,
          is_active: false,
          description: `Ventes associées au billet ${ticketName} supprimées`
        }]);
      } catch (e) {}
    }
  },

  _usersMap: null,
  _usersMapTime: 0,

  async getUsersMap() {
    if (this._usersMap && (Date.now() - this._usersMapTime < 60000)) {
      return this._usersMap;
    }
    const map = {};
    const client = SupabaseClient.client;
    if (client) {
      try {
        const { data } = await client.from('app_users').select('id, login, full_name, role:roles(name)');
        if (data && Array.isArray(data)) {
          data.forEach(u => {
            map[u.id] = {
              id: u.id,
              login: u.login,
              full_name: u.full_name || u.login,
              role_name: (u.role && u.role.name) || 'Admin'
            };
          });
        }
      } catch (e) {}
    }
    this._usersMap = map;
    this._usersMapTime = Date.now();
    return map;
  },

  filterActiveSales(salesList, cancelledIds, ...rest) {
    if (!Array.isArray(salesList)) return [];
    const purgeDate = rest.find(arg => typeof arg === 'string' && (arg.includes('T') || !isNaN(Date.parse(arg)))) || null;
    return salesList.filter(s => {
      if (!s) return false;
      if (cancelledIds && cancelledIds.includes(s.id)) return false;
      if (purgeDate && s.created_at) {
        const sDate = new Date(s.created_at).getTime();
        const pDate = new Date(purgeDate).getTime();
        if (!isNaN(sDate) && !isNaN(pDate) && sDate < (pDate - 5000)) return false;
      }
      return true;
    });
  },

  _catalogTicketsMap: {},
  async getOrCreateCatalogTicket(category, itemName, price) {
    const key = `${category || 'entree'}_${itemName}_${price || 0}`;
    if (this._catalogTicketsMap[key]) {
      return this._catalogTicketsMap[key];
    }
    const client = SupabaseClient.client;
    if (client) {
      try {
        const { data } = await client
          .from('tickets_catalog')
          .select('id')
          .eq('name', itemName)
          .limit(1);
        if (data && data.length > 0 && this.isUuid(data[0].id)) {
          this._catalogTicketsMap[key] = data[0].id;
          return data[0].id;
        }
        // Création automatique si non existant
        const { data: insData } = await client
          .from('tickets_catalog')
          .insert([{
            type: category || 'entree',
            name: itemName,
            value_f: price || 0,
            is_active: true
          }])
          .select('id');
        if (insData && insData[0] && this.isUuid(insData[0].id)) {
          this._catalogTicketsMap[key] = insData[0].id;
          return insData[0].id;
        }
      } catch (e) {}
    }
    return null;
  },

  // Enregistrement unifié et 100% garanti d'une vente (Entrée, Jeux, Restauration)
  async recordSale(saleData) {
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = user ? (user.full_name || user.login) : 'Caissier';
    let regId = saleData.cash_register_id;

    // 1. S'assurer d'avoir un vrai UUID de caisse si Supabase est actif
    if (client && !this.isUuid(regId)) {
      try {
        const reg = await this.getOrCreateRegister(saleData.category || 'Jeux', 'Caisse ' + (saleData.category || ''));
        if (reg && this.isUuid(reg.id)) {
          regId = reg.id;
        }
      } catch (e) {}
    }

    // 2. Résoudre un UUID de ticket valide pour satisfaire la contrainte Supabase tickets_catalog(id)
    let ticketId = saleData.ticket_id;
    if (!this.isUuid(ticketId)) {
      ticketId = await this.getOrCreateCatalogTicket(saleData.category || 'entree', saleData.item_name || 'Ticket', saleData.unit_price_f || 0);
    }

    let realSaleId = 'sale-' + (saleData.category || 'ticket') + '-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);

    // Payload complet avec colonnes de traçabilité nominative
    const richPayload = {
      cash_register_id: this.isUuid(regId) ? regId : null,
      stand_id: this.isUuid(saleData.stand_id) ? saleData.stand_id : null,
      ticket_id: this.isUuid(ticketId) ? ticketId : null,
      item_name: saleData.item_name || 'Ticket',
      category: saleData.category || 'jeux',
      quantity: Math.max(1, parseInt(saleData.quantity, 10) || 1),
      unit_price_f: Math.max(0, parseInt(saleData.unit_price_f, 10) || 0),
      total_amount_f: Math.max(0, parseInt(saleData.total_amount_f, 10) || 0),
      payment_mode: saleData.payment_mode || 'cash',
      sold_by: user ? user.id : null,
      seller_name: sellerFullName,
      seller_login: sellerLogin
    };

    if (client) {
      let inserted = false;

      // Tentative 1 : insertion avec toutes les colonnes modernes enrichies
      try {
        const { data, error } = await client.from('ticket_sales').insert([richPayload]).select('id');
        if (!error && data && data[0]) {
          realSaleId = data[0].id;
          inserted = true;
        }
      } catch (e) {}

      // Tentative 2 : sans seller_name/login si les colonnes ne sont pas encore migrées
      if (!inserted) {
        try {
          const { seller_name, seller_login, ...rest } = richPayload;
          const { data, error } = await client.from('ticket_sales').insert([rest]).select('id');
          if (!error && data && data[0]) {
            realSaleId = data[0].id;
            inserted = true;
          }
        } catch (e) {}
      }

      // Tentative 3 : schéma minimal original (01_schema.sql)
      if (!inserted) {
        try {
          const minimal = {
            cash_register_id: this.isUuid(regId) ? regId : null,
            stand_id: this.isUuid(saleData.stand_id) ? saleData.stand_id : null,
            ticket_id: this.isUuid(ticketId) ? ticketId : null,
            quantity: Math.max(1, parseInt(saleData.quantity, 10) || 1),
            unit_price_f: Math.max(0, parseInt(saleData.unit_price_f, 10) || 0),
            total_amount_f: Math.max(0, parseInt(saleData.total_amount_f, 10) || 0),
            sold_by: user ? user.id : null
          };
          const { data, error } = await client.from('ticket_sales').insert([minimal]).select('id');
          if (!error && data && data[0]) {
            realSaleId = data[0].id;
            inserted = true;
          } else if (error) {
            console.warn('[CaissesCore DB Insert Error]', error);
          }
        } catch (e) {
          console.warn('[CaissesCore Insert Exception]', e);
        }
      }
    }

    // Objet vente complet avec attribution nominative pour la persistance locale et l'affichage
    const completeSale = {
      ...richPayload,
      id: realSaleId,
      created_at: new Date().toISOString(),
      seller_name: sellerFullName,
      seller_login: sellerLogin,
      seller: { login: sellerLogin, full_name: sellerFullName },
      stand: saleData.stand || null
    };

    return completeSale;
  },

  // Chargement fiable des ventes avec résolution nominative du vendeur
  async loadSales(category = null) {
    const client = SupabaseClient.client;
    const sync = await this.syncCancellationsFromDb();
    const cancelledIds = sync.cancelledIds;
    const purgeDate = sync.purgeBefore;
    const usersMap = await this.getUsersMap();

    let sales = [];

    if (client) {
      try {
        let query = client
          .from('ticket_sales')
          .select('id, cash_register_id, stand_id, ticket_id, item_name, category, payment_mode, seller_name, seller_login, quantity, unit_price_f, total_amount_f, sold_by, created_at, stand:stands(id, name, number, color_name, color_hex), ticket:tickets_catalog(id, name, type, color)')
          .order('created_at', { ascending: false });

        if (category) {
          query = query.eq('category', category);
        }

        let { data, error } = await query;

        // Repli gracieux si certaines colonnes (ex: seller_name) n'existent pas encore
        if (error) {
          query = client
            .from('ticket_sales')
            .select('id, cash_register_id, stand_id, ticket_id, quantity, unit_price_f, total_amount_f, sold_by, created_at, stand:stands(id, name, number, color_name, color_hex), ticket:tickets_catalog(id, name, type, color)')
            .order('created_at', { ascending: false });
          const res = await query;
          if (!res.error && res.data) {
            data = res.data;
            error = null;
          }
        }

        if (!error && Array.isArray(data)) {
          sales = data.map(s => {
            const userObj = s.sold_by && usersMap[s.sold_by];
            const sellerLogin = s.seller_login || (userObj && userObj.login) || 'Caissier';
            const sellerFullName = s.seller_name || (userObj && userObj.full_name) || sellerLogin;
            const sellerRole = (userObj && userObj.role_name) || 'Admin';
            const itemName = s.item_name || (s.ticket && s.ticket.name) || 'Ticket';
            const itemCat = s.category || (s.ticket && s.ticket.type) || (category || 'jeu');

            return {
              ...s,
              item_name: itemName,
              category: itemCat,
              seller_login: sellerLogin,
              seller_name: sellerFullName,
              seller_role: sellerRole,
              seller: { login: sellerLogin, full_name: sellerFullName, role_name: sellerRole }
            };
          });

          if (category) {
            sales = sales.filter(s => s.category === category);
          }
          sales = this.filterActiveSales(sales, cancelledIds, purgeDate);
        } else if (error) {
          console.warn('[Load Sales DB Warning]', error);
        }
      } catch (e) {
        console.warn('[Load Sales Exception]', e);
      }
    }

    // Fusion de secours avec les ventes locales pour ne jamais rien perdre
    const targetKeys = category === 'entree' ? ['kermesse_entry_sales'] 
      : (category === 'jeu' ? ['kermesse_game_sales'] 
      : (category === 'restauration' ? ['kermesse_food_sales'] 
      : ['kermesse_entry_sales', 'kermesse_game_sales', 'kermesse_food_sales']));

    targetKeys.forEach(key => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const local = JSON.parse(stored);
          const filteredLocal = this.filterActiveSales(local, cancelledIds, purgeDate);
          filteredLocal.forEach(ls => {
            if (!sales.some(s => s.id === ls.id)) {
              sales.push(ls);
            }
          });
        } catch (e) {}
      }
    });

    // Tri antéchronologique (plus récent en haut)
    sales.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Si on a chargé une catégorie spécifique, on met à jour son cache local dédié
    if (category) {
      const specificKey = category === 'entree' ? 'kermesse_entry_sales' : (category === 'jeu' ? 'kermesse_game_sales' : 'kermesse_food_sales');
      localStorage.setItem(specificKey, JSON.stringify(sales));
    }

    return sales;
  },

  // Abonnement Supabase Realtime multi-tables pour actualisation en direct
  subscribeToSales(callback) {
    const client = SupabaseClient.client;
    if (!client) return null;

    try {
      const channel = client
        .channel('realtime_sales_hub_' + Date.now())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'ticket_sales' }, (payload) => {
          if (typeof callback === 'function') callback(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_movements' }, (payload) => {
          if (typeof callback === 'function') callback(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'token_debts' }, (payload) => {
          if (typeof callback === 'function') callback(payload);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets_catalog' }, (payload) => {
          if (typeof callback === 'function') callback(payload);
        })
        .subscribe();
      return channel;
    } catch (e) {
      console.warn('[Realtime Subscription Warning]', e);
      return null;
    }
  },

  // Réinitialisation complète STRICTEMENT RÉSERVÉE au SuperAdmin avec saisie de confirmation
  async resetAllSalesAndTests() {
    if (!Permissions.isSuperAdmin()) {
      Notify.error("Action strictement interdite : Seul le SuperAdministrateur est autorisé à remettre à zéro les chiffres.");
      return false;
    }

    const check = prompt("🚨 CONFIRMATION CRITIQUE DE DIRECTION GÉNÉRALE\n\nVous êtes sur le point d'effacer DÉFINITIVEMENT toutes les ventes de test (Entrée, Jeux, Restauration).\n\nPour confirmer, tapez le mot « RESET » en majuscules :");
    if (check !== 'RESET') {
      Notify.info("Remise à zéro annulée.");
      return false;
    }

    const nowIso = new Date().toISOString();
    const client = SupabaseClient.client;
    if (client) {
      try {
        await client.from('ticket_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await client.from('cash_movements').delete().in('type', ['vente', 'correction']);
      } catch (e) {
        console.warn('[Reset All Sales DB Warning]', e);
      }
      try {
        await client.from('tickets_catalog').insert([{
          type: 'purge_all_sales',
          name: 'Purge officielle du ' + nowIso,
          value_f: 0,
          is_active: false
        }]);
      } catch (e) {}
    }

    localStorage.setItem('kermesse_purge_all_sales_before', nowIso);
    localStorage.removeItem('kermesse_entry_sales');
    localStorage.removeItem('kermesse_game_sales');
    localStorage.removeItem('kermesse_food_sales');
    localStorage.removeItem('kermesse_cancelled_sale_ids');
    localStorage.removeItem('kermesse_cancelled_ticket_names');

    AuditLogger.log('REMISE_A_ZERO_VENTES', 'ticket_sales', null, 'Remise à zéro des ventes exécutée par le SuperAdmin');
    Notify.success('Toutes les ventes de test ont été effacées avec succès.');
    return true;
  },

  // MOTEUR FINANCIER CENTRALISÉ & CONSOLIDÉ (Utilisé par Caisses, Bilan, Dashboard et Rapports Officiels)
  async calculateConsolidatedFinances() {
    const client = SupabaseClient.client;
    let allSales = await this.loadSales();
    let allRegisters = [];
    let allExpenses = [];

    // 1. Récupération des caisses
    if (client) {
      try {
        const { data: r } = await client.from('cash_registers').select('*').order('name');
        if (r && r.length > 0) allRegisters = r;
      } catch (e) {
        console.warn('[Consolidated Finances DB Registers Warning]', e);
      }
    }
    if (allRegisters.length === 0) {
      try {
        const stored = localStorage.getItem('kermesse_cash_registers');
        if (stored) allRegisters = JSON.parse(stored);
      } catch (e) {}
    }

    // 2. Calculs des recettes par caisse et palmarès stands
    let revEntree = 0;
    let revJeux = 0;
    let revResto = 0;
    let ticketsEntreeCount = 0;
    let ticketsJeuxCount = 0;
    let restoItemsCount = 0;
    const standTotals = {};

    allSales.forEach(s => {
      const amt = s.total_amount_f || 0;
      const qty = s.quantity || 1;

      if (s.category === 'entree') {
        revEntree += amt;
        ticketsEntreeCount += qty;
      } else if (s.category === 'restauration') {
        revResto += amt;
        restoItemsCount += qty;
      } else {
        revJeux += amt;
        ticketsJeuxCount += qty;
        const stName = (s.stand && s.stand.name) ? s.stand.name : 'Stand Non Spécifié';
        const stColor = (s.stand && s.stand.color_hex) ? s.stand.color_hex : '#3b82f6';
        if (!standTotals[stName]) {
          standTotals[stName] = { name: stName, revenue: 0, ticketsCount: 0, colorHex: stColor };
        }
        standTotals[stName].revenue += amt;
        standTotals[stName].ticketsCount += qty;
      }
    });

    const totalRecettes = revEntree + revJeux + revResto;
    const totalTickets = ticketsEntreeCount + ticketsJeuxCount;

    // 4. Récupération et consolidation des Dépenses (sans double comptage)
    // a) Mouvements de caisse autorisés (type = 'depense_autorisee')
    if (client) {
      try {
        const { data: caisseMvts } = await client
          .from('cash_movements')
          .select('id, amount_f, reason, created_at, type, cash_register_id, user:app_users(login)')
          .eq('type', 'depense_autorisee')
          .order('created_at', { ascending: false });

        if (caisseMvts) {
          caisseMvts.forEach(cm => {
            allExpenses.push({
              id: cm.id,
              source: 'Caisse',
              registerId: cm.cash_register_id,
              reason: cm.reason || 'Dépense de caisse',
              amount_f: Math.abs(cm.amount_f),
              created_at: cm.created_at,
              author: cm.user ? cm.user.login : 'Caissier'
            });
          });
        }
      } catch (e) {
        console.warn('[Consolidated Finances Movements Warning]', e);
      }

      // b) Dépenses de la table 'expenses' qui ne proviennent pas d'une caisse (évite tout double comptage)
      try {
        const { data: expTable } = await client
          .from('expenses')
          .select('id, amount_f, motive, category, receipt_ref, status, created_at, cash_register_id, user:app_users!expenses_user_id_fkey(login)')
          .eq('status', 'approuve')
          .order('created_at', { ascending: false });

        if (expTable) {
          expTable.forEach(et => {
            const alreadyExists = allExpenses.some(ae => ae.id === et.id || (et.cash_register_id && ae.registerId === et.cash_register_id && Math.abs(ae.amount_f) === Math.abs(et.amount_f) && ae.reason.includes(et.motive)));
            if (!alreadyExists) {
              allExpenses.push({
                id: et.id,
                source: et.cash_register_id ? 'Caisse' : 'Générale',
                registerId: et.cash_register_id,
                reason: et.motive + (et.receipt_ref ? ` (Réf: ${et.receipt_ref})` : ''),
                amount_f: Math.abs(et.amount_f),
                created_at: et.created_at,
                author: et.user ? et.user.login : 'Comptabilité'
              });
            }
          });
        }
      } catch (e) {
        console.warn('[Consolidated Finances Expenses Table Warning]', e);
      }
    }

    // c) Dépenses locales enregistrées sur les caisses (mode hors-ligne ou non synchronisé)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('kermesse_expenses_')) {
          const regId = key.replace('kermesse_expenses_', '');
          const localExpList = JSON.parse(localStorage.getItem(key) || '[]');
          localExpList.forEach(le => {
            const alreadyExists = allExpenses.some(ae => ae.id === le.id);
            if (!alreadyExists) {
              allExpenses.push({
                id: le.id,
                source: 'Caisse Locale',
                registerId: regId,
                reason: le.reason || 'Dépense locale',
                amount_f: Math.abs(le.amount_f),
                created_at: le.created_at || new Date().toISOString(),
                author: le.user ? le.user.login : 'Caissier'
              });
            }
          });
        }
      }
    } catch (e) {}

    // 5. Consolidation des Avoirs et Jetons en circulation (Caisse 3)
    let tokensIssued = 0;
    let tokensRedeemed = 0;
    if (client) {
      try {
        const { data: tDebts } = await client.from('token_debts').select('token_value_f, quantity_given, quantity_redeemed');
        if (tDebts) {
          tDebts.forEach(td => {
            tokensIssued += (td.quantity_given || 0) * (td.token_value_f || 0);
            tokensRedeemed += (td.quantity_redeemed || 0) * (td.token_value_f || 0);
          });
        }
        const { data: aMvts } = await client
          .from('cash_movements')
          .select('amount_f, type')
          .in('type', ['emission_jeton', 'restitution_jeton', 'remboursement_jeton']);
        if (aMvts) {
          let mvtsIssued = 0;
          let mvtsRedeemed = 0;
          aMvts.forEach(am => {
            if (am.type === 'emission_jeton') mvtsIssued += Math.abs(am.amount_f || 0);
            else mvtsRedeemed += Math.abs(am.amount_f || 0);
          });
          if (mvtsIssued > tokensIssued) tokensIssued = mvtsIssued;
          if (mvtsRedeemed > tokensRedeemed) tokensRedeemed = mvtsRedeemed;
        }
      } catch (e) {
        console.warn('[Consolidated Finances Tokens Warning]', e);
      }
    }
    const netTokenDebt = Math.max(0, tokensIssued - tokensRedeemed);

    const totalExpenses = allExpenses.reduce((sum, e) => sum + Math.abs(e.amount_f), 0);
    const beneficeNet = totalRecettes - totalExpenses;

    return {
      sales: allSales,
      revEntree,
      revJeux,
      revResto,
      totalRecettes,
      ticketsEntreeCount,
      ticketsJeuxCount,
      restoItemsCount,
      totalTickets,
      standTotals,
      expenses: allExpenses,
      totalExpenses,
      beneficeNet,
      registers: allRegisters,
      tokensIssued,
      tokensRedeemed,
      netTokenDebt
    };
  },

  async loadEntryCatalog() {
    const client = SupabaseClient.client;
    let catalog = [];
    let hasDbRecords = false;

    if (client) {
      try {
        const { data, error } = await client
          .from('tickets_catalog')
          .select('id, name, value_f, color, description, is_active')
          .eq('type', 'entree')
          .eq('is_active', true)
          .order('value_f', { ascending: true });

        if (!error && data && data.length > 0) {
          hasDbRecords = true;
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

    // Si la base n'a pas renvoyé d'articles, vérifier le stockage local
    if (!hasDbRecords) {
      const stored = localStorage.getItem('kermesse_entry_catalog');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            catalog = parsed;
          }
        } catch (e) {}
      }
    }

    // Si toujours vide (première initialisation), charger et propager les 4 tarifs d'entrée de référence
    if (catalog.length === 0) {
      catalog = [
        { id: 'ent-enf', name: 'Entrée Enfant (-12 ans)', price: 200, icon: '🧒', description: 'Moins de 12 ans' },
        { id: 'ent-adu', name: 'Entrée Adulte', price: 500, icon: '🧑', description: 'Tarif standard' },
        { id: 'ent-fam', name: 'Pass Famille', price: 1200, icon: '👨‍👩‍👧‍👦', description: 'Valable pour 4 personnes' },
        { id: 'ent-don', name: 'Entrée Donateur & Bienfaiteur', price: 2000, icon: '❤️', description: 'Soutien aux œuvres sociales' }
      ];
      localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));

      // Les inscrire directement dans Supabase pour que tous les autres terminaux en bénéficient
      if (client) {
        try {
          for (const item of catalog) {
            const { data } = await client.from('tickets_catalog').insert([{
              type: 'entree',
              name: item.name,
              value_f: item.price,
              color: item.icon,
              description: item.description,
              is_active: true
            }]).select('id');
            if (data && data[0]) item.id = data[0].id;
          }
          localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
        } catch (e) {}
      }
    } else {
      localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
    }

    return catalog;
  },

  async saveEntryCatalog(catalog) {
    localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
    const client = SupabaseClient.client;
    if (client && Array.isArray(catalog)) {
      try {
        for (const item of catalog) {
          if (this.isUuid(item.id)) {
            await client.from('tickets_catalog').update({
              name: item.name,
              value_f: item.price,
              color: item.icon,
              description: item.description,
              is_active: true
            }).eq('id', item.id);
          } else {
            const { data } = await client.from('tickets_catalog').insert([{
              type: 'entree',
              name: item.name,
              value_f: item.price,
              color: item.icon,
              description: item.description,
              is_active: true
            }]).select('id');
            if (data && data[0]) item.id = data[0].id;
          }
        }
        localStorage.setItem('kermesse_entry_catalog', JSON.stringify(catalog));
      } catch (e) {
        console.warn('[Save Entry Catalog DB Error]', e);
      }
    }
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
    if (!Permissions.isSuperAdmin()) {
      Notify.warning("🔒 Action restreinte : Seul un SuperAdministrateur est habilité à supprimer une dépense de caisse. Veuillez vous adresser au SuperAdmin.");
      return;
    }

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
  currentTab: 'pos', // 'pos', 'config', 'expenses', 'journal'
  register: null,
  sales: [],
  expenses: [],
  cart: [],
  entryCatalog: [],
  _realtimeInit: false,

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Entrée', 'Caisse 1 — Entrée & Accueil');
    await this.loadData();
    this.entryCatalog = await CaissesCore.loadEntryCatalog();

    container.innerHTML = `
      <div class="card">
        <div class="card-header caisse-card-header">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="card-title" style="margin: 0;">
              <span>🎟️</span> Caisse 1 : Entrée &amp; Accueil Visiteurs
            </div>
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Ouverte' : '🔴 Clôturée'}
            </span>
          </div>

          <!-- Navigation des sous-onglets moderne en pills logée dans l'en-tête (sans clôture) -->
          <div class="caisse-subtabs-nav" id="caisseEntreeTabsNav">
            <button class="caisse-subtab-btn entree-theme ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('pos')">
              🎟️ <span>Vente Entrées</span>
            </button>
            <button class="caisse-subtab-btn entree-theme ${this.currentTab === 'config' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('config')">
              ⚙️ <span>Tarifs</span> <span class="subtab-count" data-tab-count="config">${this.entryCatalog.length}</span>
            </button>
            <button class="caisse-subtab-btn entree-theme ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('expenses')">
              💸 <span>Dépenses</span> <span class="subtab-count" data-tab-count="expenses">${this.expenses.length}</span>
            </button>
            <button class="caisse-subtab-btn entree-theme ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseEntreeModule.switchTab('journal')">
              🧾 <span>Journal</span> <span class="subtab-count" data-tab-count="journal">${this.sales.length}</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="caisseEntreeTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();

    // Actualisation temps réel & synchronisation automatique multi-appareils
    if (!this._realtimeInit) {
      this._realtimeInit = true;
      CaissesCore.subscribeToSales(async () => {
        await this.loadData();
        if (this.cart.length === 0) {
          this.renderCurrentTab();
        } else {
          this.updateBadgeCounts();
        }
      });

      // Polling transparent de secours toutes les 4 secondes
      setInterval(async () => {
        const domCheck = document.getElementById('caisseEntreeTabContainer');
        if (domCheck && this.cart.length === 0) {
          await this.loadData();
          this.renderCurrentTab();
        }
      }, 4000);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('caisseEntreeTabContainer');
    if (container) {
      const nav = document.getElementById('caisseEntreeTabsNav');
      if (nav) {
        nav.querySelectorAll('.caisse-subtab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
        });
      }
      this.renderCurrentTab();
    } else {
      const pole = document.getElementById('poleContainer') || document.getElementById('mainContent');
      if (pole) this.render(pole);
    }
  },

  updateBadgeCounts() {
    const nav = document.getElementById('caisseEntreeTabsNav');
    if (!nav) return;
    const cfgBadge = nav.querySelector('[data-tab-count="config"]');
    if (cfgBadge) cfgBadge.textContent = this.entryCatalog.length;
    const expBadge = nav.querySelector('[data-tab-count="expenses"]');
    if (expBadge) expBadge.textContent = this.expenses.length;
    const journalBadge = nav.querySelector('[data-tab-count="journal"]');
    if (journalBadge) journalBadge.textContent = this.sales.length;
  },

  async loadData() {
    this.sales = await CaissesCore.loadSales('entree');
    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
    if (!this.entryCatalog || this.entryCatalog.length === 0) {
      this.entryCatalog = await CaissesCore.loadEntryCatalog();
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseEntreeTabContainer');
    if (!container) return;
    this.updateBadgeCounts();

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'config') this.renderConfigTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
  },

  // 1. Onglet Vente Entrée
  renderPosTab(container) {
    const totalVisitors = this.sales.reduce((s, x) => s + (x.quantity || 1), 0);
    const totalRevenue = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);

    container.innerHTML = `
      <div class="pos-main-layout">
        
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
            <div class="pos-catalog-grid">
              ${this.entryCatalog.map(t => {
                const inCart = this.cart.find(i => i.id === t.id);
                const qty = inCart ? inCart.qty : 0;

                return `
                  <div class="card pos-product-card" style="border: 2px solid ${qty > 0 ? '#10b981' : '#e2e8f0'}; border-top: 5px solid #10b981; background: ${qty > 0 ? '#f0fdf4' : 'white'};">
                    <div class="card-body">
                      <div class="pos-card-top-row">
                        <span class="pos-card-emoji">${t.icon || '🎟️'}</span>
                        <div class="pos-card-price-badge">
                          <div class="pos-card-price-val" style="color: #047857;">${t.price > 0 ? `${t.price.toLocaleString()} F` : 'Gratuit'}</div>
                          <div class="pos-card-price-sub">Billet</div>
                        </div>
                      </div>
                      <div class="pos-card-title">
                        ${t.name}
                      </div>
                      ${t.description ? `<div style="font-size: 0.7rem; color: var(--gray-500); margin-bottom: 0.35rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${t.description}</div>` : ''}

                      <!-- 2 BOUTONS : AUGMENTER (+) ET DIMINUER (-) -->
                      <div class="pos-stepper-box">
                        <button class="btn btn-secondary btn-sm pos-stepper-btn" onclick="CaisseEntreeModule.decrementItem('${t.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div class="pos-stepper-center">
                          <span class="pos-stepper-count" style="color: ${qty > 0 ? '#047857' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <span class="pos-stepper-unit">billet(s)</span>
                        </div>
                        <button class="btn btn-primary btn-sm pos-stepper-btn" style="background: #059669; border-color: #047857;" onclick="CaisseEntreeModule.incrementItem('${t.id}', '${t.name.replace(/'/g, "\\'")}', ${t.price})" title="Augmenter">
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
        <div class="card pos-cart-panel" style="border: 2px solid #10b981; box-shadow: var(--shadow-md);">
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
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--gray-700);">Espèces reçues :</label>
                <div class="quick-cash-chips">
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(${cartTotal})">Exact</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(500)">500 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(1000)">1 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(2000)">2 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(5000)">5 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseEntreeModule.setCashGiven(10000)">10 000 F</button>
                </div>
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

      ${cartTotal > 0 ? `
        <div class="pos-mobile-cart-bar" onclick="document.querySelector('.pos-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="mobile-cart-badge">${this.cart.reduce((s, i) => s + i.qty, 0)}</span>
            <div style="text-align: left; line-height: 1.2;">
              <div style="font-size: 0.7rem; opacity: 0.85;">Total Panier</div>
              <strong style="font-size: 1.05rem;">${cartTotal.toLocaleString()} F</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; font-weight: 800;">
            <span>Encaisser</span>
            <span>↓</span>
          </div>
        </div>
      ` : ''}
    `;
  },

  setCashGiven(amt) {
    const input = document.getElementById('caisseEntreeCashGiven');
    if (input) {
      input.value = amt;
      const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
      this.calcChange(cartTotal);
    }
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
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = user ? (user.full_name || user.login) : 'Caissier';

    for (const item of this.cart) {
      const realSale = await CaissesCore.recordSale({
        cash_register_id: regId,
        ticket_id: item.id,
        item_name: item.name,
        category: 'entree',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty
      });

      this.sales.unshift(realSale);
    }

    // Persistance locale
    localStorage.setItem('kermesse_entry_sales', JSON.stringify(this.sales));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente entrées (${this.cart.reduce((s, i) => s + i.qty, 0)} pers.) par ${sellerFullName} (@${sellerLogin})`,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_ENTREE', 'ticket_sales', null, `Encaissement de ${cartTotal} F en Caisse Entrée par ${sellerFullName} (@${sellerLogin})`);
    Notify.success(`Billets d'entrée validés ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount) {
    const user = Auth.getCurrentUser();
    const isAdmin = Permissions.isSuperAdmin() || Permissions.canAccessPole(2);
    if (!isAdmin) {
      Notify.warning("🔒 Action réservée aux administrateurs du Pôle Billetterie ou au SuperAdmin.");
      return;
    }

    const cancelReason = prompt(`Suppression du billet d'entrée « ${name} » (${(amount || 0).toLocaleString()} F) :\n\nMotif obligatoire de la suppression (ex: Erreur de saisie, visiteur désisté, ticket abîmé) :`);
    if (cancelReason === null) return;
    const motif = cancelReason.trim();
    if (!motif) {
      Notify.warning("Suppression annulée : un motif précis est obligatoire pour la traçabilité administrative.");
      return;
    }

    const adminLabel = user ? `${user.full_name || user.login} (@${user.login})` : 'Admin';

    const client = SupabaseClient.client;
    // 1. Enregistrer dans la liste noire globale des ventes annulées (garantit la suppression dans le Bilan)
    await CaissesCore.addCancelledSaleId(id, name);

    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        // Ajouter un mouvement de compensation pour réduire la caisse du montant
        if (this.register && CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Suppression billet entrée : ${name} (Par ${adminLabel} - Motif : ${motif})`,
            user_id: user?.id || null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Sale DB Warning]', e);
      }
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_entry_sales', JSON.stringify(this.sales));

    AuditLogger.log('ANNULATION_VENTE_ENTREE', 'ticket_sales', id, `Suppression billet entrée « ${name} » (-${amount} F) par ${adminLabel}. Motif : ${motif}`);
    Notify.success(`Billet « ${name} » supprimé. Motif consigné : ${motif}`);
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

    if (!confirm(`Supprimer définitivement le billet « ${ticket.name} » du catalogue ?\n\nIl ne sera plus proposé sur l'écran d'accueil et ses ventes de test seront retirées du bilan.`)) {
      return;
    }

    // 1. Enregistrer le nom du billet dans les exclusions partagées (Garantie 100% cloud multi-appareils)
    await CaissesCore.addCancelledTicketName(ticket.name);

    const client = SupabaseClient.client;
    if (client) {
      try {
        if (CaissesCore.isUuid(ticketId)) {
          await client.from('tickets_catalog').delete().eq('id', ticketId);
        }
        // Supprimer également les ventes passées pour ce billet (nettoie immédiatement le Dashboard et le Bilan)
        await client.from('ticket_sales').delete().eq('item_name', ticket.name);
      } catch (e) {
        console.warn('[Delete Ticket DB Warning]', e);
      }
    }

    // Supprimer également des ventes locales
    this.sales = (this.sales || []).filter(s => s.item_name !== ticket.name);
    localStorage.setItem('kermesse_entry_sales', JSON.stringify(this.sales));

    this.entryCatalog = this.entryCatalog.filter(t => t.id !== ticketId);
    this.cart = this.cart.filter(c => c.id !== ticketId);

    await CaissesCore.saveEntryCatalog(this.entryCatalog);
    AuditLogger.log('SUPPRESSION_BILLET_ENTREE', 'tickets_catalog', ticketId, `Suppression billet ${ticket.name} et nettoyage des ventes associées`);
    Notify.success(`Billet « ${ticket.name} » supprimé et ventes nettoyées.`);
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

  activeSellerFilter: 'all',

  // 3. Onglet Journal des Entrées
  renderJournalTab(container) {
    const sellers = Array.from(new Set(this.sales.map(s => {
      return (s.seller && s.seller.login) || s.seller_login || 'Caissier';
    }))).filter(Boolean);

    const filteredSales = (this.activeSellerFilter && this.activeSellerFilter !== 'all')
      ? this.sales.filter(s => {
          const sLog = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
          return sLog === this.activeSellerFilter;
        })
      : this.sales;

    container.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0;">Historique des Billets d'Entrée Encaissés</h4>
        ${sellers.length > 1 ? `
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.82rem; color: var(--gray-600); font-weight: 600;">Filtrer par vendeur :</span>
            <select class="form-control form-control-sm" style="width: auto; padding: 2px 8px; font-size: 0.82rem;" onchange="CaisseEntreeModule.activeSellerFilter = this.value; CaisseEntreeModule.renderCurrentTab();">
              <option value="all">👥 Tous les caissiers (${this.sales.length})</option>
              ${sellers.map(sel => `<option value="${sel}" ${this.activeSellerFilter === sel ? 'selected' : ''}>👤 ${sel}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>
      <div class="table-responsive">
        ${filteredSales.length === 0 ? `
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
                <th>Vendeur / Caissier</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales.map(s => {
                const sellerName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || s.seller_login || 'Caissier';
                const sellerLogin = (s.seller && s.seller.login) || s.seller_login || 'caissier';
                return `
                  <tr>
                    <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${s.item_name}</strong></td>
                    <td>${s.quantity}</td>
                    <td><strong style="color: var(--success);">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                    <td>
                      <span class="badge badge-gray" title="Responsable individuel : ${sellerName} (@${sellerLogin})" style="font-size: 0.75rem;">
                        👤 ${sellerName}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-danger btn-sm" onclick="CaisseEntreeModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Annuler cette vente">🗑️ Enlever</button>
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

  // 4. Onglet Contrôle & Clôture
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    const revEntree = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const expTotal = this.expenses.reduce((s, x) => s + Math.abs(x.amount_f), 0);
    const expected = initF + revEntree - expTotal;

    // Calcul de la répartition par vendeur
    const sellerStats = {};
    this.sales.forEach(s => {
      const sLogin = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
      const sName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || sLogin;
      if (!sellerStats[sLogin]) {
        sellerStats[sLogin] = { login: sLogin, name: sName, tickets: 0, total: 0 };
      }
      sellerStats[sLogin].tickets += (s.quantity || 1);
      sellerStats[sLogin].total += (s.total_amount_f || 0);
    });
    const sellerList = Object.values(sellerStats);

    container.innerHTML = `
      <div style="max-width: 650px; margin: 0 auto;">
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

          <!-- RÉPARTITION NOMINATIVE PAR VENDEUR -->
          <div style="margin-bottom: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--gray-800); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>👤</span> Répartition nominative des recettes par caissier
            </div>
            ${sellerList.length === 0 ? `
              <div style="font-size: 0.8rem; color: var(--gray-400); font-style: italic;">Aucune vente enregistrée.</div>
            ` : `
              <table style="width: 100%; font-size: 0.82rem; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--gray-200); color: var(--gray-500); text-align: left;">
                    <th style="padding: 4px 0;">Caissier</th>
                    <th style="padding: 4px 0; text-align: center;">Billets</th>
                    <th style="padding: 4px 0; text-align: right;">Total Encaissé</th>
                    <th style="padding: 4px 0; text-align: right;">Part</th>
                  </tr>
                </thead>
                <tbody>
                  ${sellerList.map(s => {
                    const pct = revEntree > 0 ? Math.round((s.total / revEntree) * 100) : 0;
                    return `
                      <tr style="border-bottom: 1px solid var(--gray-100);">
                        <td style="padding: 6px 0;"><strong>${s.name}</strong> <span style="color: var(--gray-400); font-size: 0.75rem;">(@${s.login})</span></td>
                        <td style="padding: 6px 0; text-align: center;">${s.tickets}</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 700; color: var(--success);">${s.total.toLocaleString()} F</td>
                        <td style="padding: 6px 0; text-align: right; color: var(--gray-500);">${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
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
  currentTab: 'pos', // 'pos', 'expenses', 'journal'
  activeStandFilter: 'all',
  register: null,
  games: [],
  stands: [],
  sales: [],
  expenses: [],
  cart: [],
  _realtimeInit: false,

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Jeux', 'Caisse 2 — Tickets de Jeux & Stands');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header caisse-card-header">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="card-title" style="margin: 0;">
              <span>🎯</span> Caisse 2 : Vente Tickets de Jeux (Stands)
            </div>
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Ouverte' : '🔴 Clôturée'}
            </span>
          </div>

          <!-- Navigation des sous-onglets moderne en pills logée dans l'en-tête (sans clôture) -->
          <div class="caisse-subtabs-nav" id="caisseJeuxTabsNav">
            <button class="caisse-subtab-btn jeux-theme ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('pos')">
              🎯 <span>Vente Tactile</span>
            </button>
            <button class="caisse-subtab-btn jeux-theme ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('expenses')">
              💸 <span>Dépenses</span> <span class="subtab-count" data-tab-count="expenses">${this.expenses.length}</span>
            </button>
            <button class="caisse-subtab-btn jeux-theme ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseJeuxModule.switchTab('journal')">
              🧾 <span>Journal</span> <span class="subtab-count" data-tab-count="journal">${this.sales.length}</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="caisseJeuxTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();

    // Actualisation temps réel & synchronisation automatique multi-appareils
    if (!this._realtimeInit) {
      this._realtimeInit = true;
      CaissesCore.subscribeToSales(async () => {
        await this.loadData();
        if (this.cart.length === 0) {
          this.renderCurrentTab();
        } else {
          this.updateBadgeCounts();
        }
      });

      // Polling transparent de secours toutes les 4 secondes
      setInterval(async () => {
        const domCheck = document.getElementById('caisseJeuxTabContainer');
        if (domCheck && this.cart.length === 0) {
          await this.loadData();
          this.renderCurrentTab();
        }
      }, 4000);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('caisseJeuxTabContainer');
    if (container) {
      const nav = document.getElementById('caisseJeuxTabsNav');
      if (nav) {
        nav.querySelectorAll('.caisse-subtab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
        });
      }
      this.renderCurrentTab();
    } else {
      const pole = document.getElementById('poleContainer') || document.getElementById('mainContent');
      if (pole) this.render(pole);
    }
  },

  updateBadgeCounts() {
    const nav = document.getElementById('caisseJeuxTabsNav');
    if (!nav) return;
    const expBadge = nav.querySelector('[data-tab-count="expenses"]');
    if (expBadge) expBadge.textContent = this.expenses.length;
    const journalBadge = nav.querySelector('[data-tab-count="journal"]');
    if (journalBadge) journalBadge.textContent = this.sales.length;
  },

  async loadData() {
    this.sales = await CaissesCore.loadSales('jeu');
    const client = SupabaseClient.client;

    if (client) {
      try {
        let gData = null;
        try {
          const res = await client
            .from('games')
            .select('id, name, ticket_price_f, stand_id, is_active, image_url, stand:stands(id, name, number, color_name, color_hex)')
            .order('name');
          if (!res.error && res.data) gData = res.data;
        } catch (e) {}

        if (!gData) {
          try {
            const fallback = await client
              .from('games')
              .select('id, name, ticket_price_f, stand_id, is_active, stand:stands(id, name, number, color_name, color_hex)')
              .order('name');
            if (fallback.data) gData = fallback.data;
          } catch (e) {}
        }
        if (gData) this.games = gData;

        // Synchroniser avec les images du cache local
        try {
          const cachedGames = JSON.parse(localStorage.getItem('kermesse_games_cache') || '[]');
          this.games.forEach(g => {
            if (!g.image_url) {
              const match = cachedGames.find(cg => cg.id === g.id || cg.name === g.name);
              if (match && match.image_url) g.image_url = match.image_url;
            }
          });
        } catch (e) {}

        const { data: sData } = await client.from('stands').select('id, name, number, color_name, color_hex').order('number');
        if (sData) this.stands = sData;
      } catch (e) {
        console.warn('[CaisseJeux DB Error]', e);
      }
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseJeuxTabContainer');
    if (!container) return;
    this.updateBadgeCounts();

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
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
      <div class="pos-main-layout">
        
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
            <div class="pos-catalog-grid">
              ${filteredGames.map(g => {
                const standColor = g.stand ? g.stand.color_hex : '#64748b';
                const standName = g.stand ? `${g.stand.color_name} ${g.stand.number}` : 'Général';
                const price = g.ticket_price_f || 200;

                const inCart = this.cart.find(i => i.gameId === g.id);
                const qty = inCart ? inCart.qty : 0;

                return `
                  <div class="card pos-product-card" style="border: 2px solid ${qty > 0 ? standColor : `${standColor}40`}; border-top: 5px solid ${standColor}; transition: transform 0.15s, box-shadow 0.15s; background: ${qty > 0 ? `${standColor}08` : 'white'}; overflow: hidden;">
                    
                    <!-- 1. PHOTO DU JEU AU-DESSUS (CLIQUABLE POUR AJOUTER UN TICKET) -->
                    <div style="position: relative; width: 100%; height: 110px; cursor: pointer; background: ${standColor}15; overflow: hidden; display: flex; align-items: center; justify-content: center;" onclick="CaisseJeuxModule.incrementGame('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}')" title="Cliquer sur la photo pour ajouter un ticket">
                      ${g.image_url ? `
                        <img src="${g.image_url}" alt="${g.name}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.2s;" onmouseover="this.style.transform='scale(1.06)'" onmouseout="this.style.transform='scale(1)'">
                      ` : `
                        <div style="font-size: 2.2rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🎯</div>
                      `}
                      ${qty > 0 ? `
                        <div style="position: absolute; top: 6px; right: 6px; background: var(--primary); color: white; border-radius: 999px; padding: 2px 8px; font-weight: 800; font-size: 0.8rem; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 2px solid white;">
                          ×${qty}
                        </div>
                      ` : ''}
                    </div>

                    <!-- 2. DÉTAILS ET NOM DU JEU EN-DESSOUS -->
                    <div class="card-body">
                      <div class="pos-card-top-row">
                        <span class="stand-tag" style="background-color: ${standColor}15; color: ${standColor}; border-color: ${standColor}; font-size: 0.7rem; padding: 1px 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 55%;" title="${standName}">
                          ${standName}
                        </span>
                        <div class="pos-card-price-badge">
                          <div class="pos-card-price-val" style="color: var(--primary); white-space: nowrap;">${price.toLocaleString()} F</div>
                        </div>
                      </div>

                      <div class="pos-card-title" onclick="CaisseJeuxModule.incrementGame('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}')" title="Cliquer pour ajouter un ticket">
                        ${g.name}
                      </div>

                      <!-- 3. DEUX BOUTONS : AUGMENTER (+) ET DIMINUER (-) EN-DESSOUS DU NOM -->
                      <div class="pos-stepper-box">
                        <button class="btn btn-secondary btn-sm pos-stepper-btn" onclick="CaisseJeuxModule.decrementGame('${g.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div class="pos-stepper-center">
                          <span class="pos-stepper-count" style="color: ${qty > 0 ? 'var(--primary)' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <span class="pos-stepper-unit">ticket(s)</span>
                        </div>
                        <button class="btn btn-primary btn-sm pos-stepper-btn" onclick="CaisseJeuxModule.incrementGame('${g.id}', '${g.name.replace(/'/g, "\\'")}', ${price}, '${standName.replace(/'/g, "\\'")}', '${standColor}', '${g.stand ? g.stand.id : ''}')" title="Augmenter">
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
        <div class="card pos-cart-panel" style="border: 2px solid var(--primary); box-shadow: var(--shadow-md);">
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
                <label style="font-size: 0.8rem; font-weight: 700; color: var(--gray-700);">Espèces remises par le client :</label>
                <div class="quick-cash-chips">
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(${cartTotal})">Exact</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(500)">500 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(1000)">1 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(2000)">2 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(5000)">5 000 F</button>
                  <button type="button" class="quick-cash-chip" onclick="CaisseJeuxModule.setCashGiven(10000)">10 000 F</button>
                </div>
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

      ${cartTotal > 0 ? `
        <div class="pos-mobile-cart-bar" onclick="document.querySelector('.pos-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="mobile-cart-badge">${this.cart.reduce((s, i) => s + i.qty, 0)}</span>
            <div style="text-align: left; line-height: 1.2;">
              <div style="font-size: 0.7rem; opacity: 0.85;">Total Panier Jeux</div>
              <strong style="font-size: 1.05rem;">${cartTotal.toLocaleString()} F</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; font-weight: 800;">
            <span>Encaisser</span>
            <span>↓</span>
          </div>
        </div>
      ` : ''}
    `;
  },

  setCashGiven(amt) {
    const input = document.getElementById('caisseJeuxCashGiven');
    if (input) {
      input.value = amt;
      const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
      this.calcChange(cartTotal);
    }
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
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = user ? (user.full_name || user.login) : 'Caissier';

    for (const item of this.cart) {
      const realSale = await CaissesCore.recordSale({
        cash_register_id: regId,
        stand_id: item.standId || null,
        item_name: item.name,
        category: 'jeu',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        stand: { name: item.standName, color_hex: item.standColor }
      });

      this.sales.unshift(realSale);
    }

    localStorage.setItem('kermesse_game_sales', JSON.stringify(this.sales));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente tickets jeux (${this.cart.reduce((s, i) => s + i.qty, 0)} tickets) par ${sellerFullName} (@${sellerLogin})`,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_JEUX', 'ticket_sales', null, `Encaissement de ${cartTotal} F en Caisse Jeux par ${sellerFullName} (@${sellerLogin})`);
    Notify.success(`Tickets de jeux validés ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount) {
    const user = Auth.getCurrentUser();
    const isAdmin = Permissions.isSuperAdmin() || Permissions.canAccessPole(2);
    if (!isAdmin) {
      Notify.warning("🔒 Action réservée aux administrateurs du Pôle Billetterie & Jeux ou au SuperAdmin.");
      return;
    }

    const cancelReason = prompt(`Suppression du ticket de jeu « ${name} » (${(amount || 0).toLocaleString()} F) :\n\nMotif obligatoire de la suppression (ex: Erreur de stand, ticket restitué, remboursement) :`);
    if (cancelReason === null) return;
    const motif = cancelReason.trim();
    if (!motif) {
      Notify.warning("Suppression annulée : un motif précis est obligatoire pour la traçabilité administrative.");
      return;
    }

    const adminLabel = user ? `${user.full_name || user.login} (@${user.login})` : 'Admin';

    const client = SupabaseClient.client;
    // 1. Ajouter à la liste noire globale des annulations
    await CaissesCore.addCancelledSaleId(id, name);

    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        if (this.register && CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Suppression ticket jeu : ${name} (Par ${adminLabel} - Motif : ${motif})`,
            user_id: user?.id || null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Game Sale DB Warning]', e);
      }
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_game_sales', JSON.stringify(this.sales));

    AuditLogger.log('SUPPRESSION_VENTE_JEUX', 'ticket_sale', id, `Suppression ticket jeu « ${name} » (-${amount} F) par ${adminLabel}. Motif : ${motif}`);
    Notify.success(`Ticket de jeu « ${name} » supprimé. Motif consigné : ${motif}`);
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

  activeSellerFilter: 'all',

  // 3. Onglet Journal des Ventes Jeux
  renderJournalTab(container) {
    const sellers = Array.from(new Set(this.sales.map(s => {
      return (s.seller && s.seller.login) || s.seller_login || 'Caissier';
    }))).filter(Boolean);

    const filteredSales = (this.activeSellerFilter && this.activeSellerFilter !== 'all')
      ? this.sales.filter(s => {
          const sLog = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
          return sLog === this.activeSellerFilter;
        })
      : this.sales;

    container.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0;">Journal des Ventes de Tickets de Jeux</h4>
        ${sellers.length > 1 ? `
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.82rem; color: var(--gray-600); font-weight: 600;">Filtrer par vendeur :</span>
            <select class="form-control form-control-sm" style="width: auto; padding: 2px 8px; font-size: 0.82rem;" onchange="CaisseJeuxModule.activeSellerFilter = this.value; CaisseJeuxModule.renderCurrentTab();">
              <option value="all">👥 Tous les caissiers (${this.sales.length})</option>
              ${sellers.map(sel => `<option value="${sel}" ${this.activeSellerFilter === sel ? 'selected' : ''}>👤 ${sel}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>
      <div class="table-responsive">
        ${filteredSales.length === 0 ? `
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
                <th>Vendeur / Caissier</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales.map(s => {
                const standName = s.stand ? s.stand.name : 'Stand';
                const standColor = s.stand ? (s.stand.color_hex || '#3b82f6') : '#3b82f6';
                const sellerName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || s.seller_login || 'Caissier';
                const sellerLogin = (s.seller && s.seller.login) || s.seller_login || 'caissier';
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
                    <td>
                      <span class="badge badge-gray" title="Responsable individuel : ${sellerName} (@${sellerLogin})" style="font-size: 0.75rem;">
                        👤 ${sellerName}
                      </span>
                    </td>
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

    // Calcul de la répartition par vendeur
    const sellerStats = {};
    this.sales.forEach(s => {
      const sLogin = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
      const sName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || sLogin;
      if (!sellerStats[sLogin]) {
        sellerStats[sLogin] = { login: sLogin, name: sName, tickets: 0, total: 0 };
      }
      sellerStats[sLogin].tickets += (s.quantity || 1);
      sellerStats[sLogin].total += (s.total_amount_f || 0);
    });
    const sellerList = Object.values(sellerStats);

    container.innerHTML = `
      <div style="max-width: 650px; margin: 0 auto;">
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

          <!-- RÉPARTITION NOMINATIVE PAR VENDEUR -->
          <div style="margin-bottom: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--gray-800); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>👤</span> Répartition nominative des recettes par caissier
            </div>
            ${sellerList.length === 0 ? `
              <div style="font-size: 0.8rem; color: var(--gray-400); font-style: italic;">Aucune vente enregistrée.</div>
            ` : `
              <table style="width: 100%; font-size: 0.82rem; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--gray-200); color: var(--gray-500); text-align: left;">
                    <th style="padding: 4px 0;">Caissier</th>
                    <th style="padding: 4px 0; text-align: center;">Tickets</th>
                    <th style="padding: 4px 0; text-align: right;">Total Encaissé</th>
                    <th style="padding: 4px 0; text-align: right;">Part</th>
                  </tr>
                </thead>
                <tbody>
                  ${sellerList.map(s => {
                    const pct = revJeux > 0 ? Math.round((s.total / revJeux) * 100) : 0;
                    return `
                      <tr style="border-bottom: 1px solid var(--gray-100);">
                        <td style="padding: 6px 0;"><strong>${s.name}</strong> <span style="color: var(--gray-400); font-size: 0.75rem;">(@${s.login})</span></td>
                        <td style="padding: 6px 0; text-align: center;">${s.tickets}</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 700; color: var(--success);">${s.total.toLocaleString()} F</td>
                        <td style="padding: 6px 0; text-align: right; color: var(--gray-500);">${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
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
// Pôle 2 : Caisse 3 — Change & Jetons (Avoirs Clients & Restitutions)
// ==============================================================================
const CaisseJetonsModule = {
  currentTab: 'change', // 'change', 'expenses', 'movements'
  register: null,
  tokens: [],
  expenses: [],
  movements: [],
  tokenValues: [50, 100, 200, 250],
  _realtimeInit: false,

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Jetons', 'Caisse 3 — Change & Jetons');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header caisse-card-header">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="card-title" style="margin: 0;">
              <span>🪙</span> Caisse 3 : Change &amp; Jetons de Monnaie (Avoirs)
            </div>
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Ouverte' : '🔴 Clôturée'}
            </span>
          </div>

          <!-- Navigation des sous-onglets moderne en pills logée dans l'en-tête (sans clôture) -->
          <div class="caisse-subtabs-nav" id="caisseJetonsTabsNav">
            <button class="caisse-subtab-btn jetons-theme ${this.currentTab === 'change' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('change')">
              🪙 <span>Change &amp; Avoirs</span>
            </button>
            <button class="caisse-subtab-btn jetons-theme ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('expenses')">
              💸 <span>Dépenses</span> <span class="subtab-count" data-tab-count="expenses">${this.expenses.length}</span>
            </button>
            <button class="caisse-subtab-btn jetons-theme ${this.currentTab === 'movements' ? 'active' : ''}" onclick="CaisseJetonsModule.switchTab('movements')">
              📋 <span>Mouvements &amp; Avoirs</span> <span class="subtab-count" data-tab-count="movements">${this.movements.length}</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="caisseJetonsTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();

    // Actualisation temps réel & synchronisation automatique multi-appareils
    if (!this._realtimeInit) {
      this._realtimeInit = true;
      CaissesCore.subscribeToSales(async () => {
        await this.loadData();
        this.renderCurrentTab();
      });

      // Polling transparent de secours toutes les 4 secondes
      setInterval(async () => {
        const domCheck = document.getElementById('caisseJetonsTabContainer');
        if (domCheck) {
          await this.loadData();
          this.renderCurrentTab();
        }
      }, 4000);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('caisseJetonsTabContainer');
    if (container) {
      const nav = document.getElementById('caisseJetonsTabsNav');
      if (nav) {
        nav.querySelectorAll('.caisse-subtab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
        });
      }
      this.renderCurrentTab();
    } else {
      const pole = document.getElementById('poleContainer') || document.getElementById('mainContent');
      if (pole) this.render(pole);
    }
  },

  updateBadgeCounts() {
    const nav = document.getElementById('caisseJetonsTabsNav');
    if (!nav) return;
    const expBadge = nav.querySelector('[data-tab-count="expenses"]');
    if (expBadge) expBadge.textContent = this.expenses.length;
    const mvtBadge = nav.querySelector('[data-tab-count="movements"]');
    if (mvtBadge) mvtBadge.textContent = this.movements.length;
  },

  async loadData() {
    const client = SupabaseClient.client;
    if (client && this.register && CaissesCore.isUuid(this.register.id)) {
      try {
        const { data: tData } = await client
          .from('token_debts')
          .select('*')
          .eq('cash_register_id', this.register.id)
          .order('created_at', { ascending: false });
        if (tData) {
          this.tokens = tData;
          localStorage.setItem('kermesse_jetons_debts', JSON.stringify(tData));
        }
      } catch (e) {
        console.warn('[Token Debts Load Warning]', e);
      }

      try {
        let mData = null;
        try {
          const res = await client
            .from('cash_movements')
            .select('id, amount_f, reason, created_at, type, user_id, tokens_detail, user:app_users!cash_movements_user_id_fkey(login, full_name)')
            .eq('cash_register_id', this.register.id)
            .order('created_at', { ascending: false });
          if (!res.error && res.data) mData = res.data;
        } catch (e1) {}

        if (!mData) {
          const { data: mData2 } = await client
            .from('cash_movements')
            .select('id, amount_f, reason, created_at, type, user_id, tokens_detail')
            .eq('cash_register_id', this.register.id)
            .order('created_at', { ascending: false });
          if (mData2) mData = mData2;
        }

        if (mData) {
          this.movements = mData;
          localStorage.setItem('kermesse_jetons_movements', JSON.stringify(mData));
        }
      } catch (e) {
        console.warn('[Cash Movements Load Warning]', e);
      }
    } else {
      // Fallback local storage
      try {
        const storedT = localStorage.getItem('kermesse_jetons_debts');
        if (storedT) this.tokens = JSON.parse(storedT);
        const storedM = localStorage.getItem('kermesse_jetons_movements');
        if (storedM) this.movements = JSON.parse(storedM);
      } catch (e) {}
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  getAvoirsStats() {
    let totalAvoirsEmis = 0;
    let totalAvoirsDecaisses = 0;

    // Calculer depuis les mouvements
    this.movements.forEach(m => {
      if (m.type === 'emission_jeton' || m.type === 'emission_avoir') {
        totalAvoirsEmis += Math.abs(m.amount_f);
      } else if (m.type === 'restitution_jeton' || m.type === 'remboursement_jeton' || m.type === 'restitution_avoir') {
        totalAvoirsDecaisses += Math.abs(m.amount_f);
      }
    });

    // Comparer avec token_debts au besoin
    let tokenDebtsIssued = 0;
    let tokenDebtsRedeemed = 0;
    this.tokens.forEach(t => {
      tokenDebtsIssued += (t.quantity_given || 0) * (t.token_value_f || 0);
      tokenDebtsRedeemed += (t.quantity_redeemed || 0) * (t.token_value_f || 0);
    });

    if (tokenDebtsIssued > totalAvoirsEmis) totalAvoirsEmis = tokenDebtsIssued;
    if (tokenDebtsRedeemed > totalAvoirsDecaisses) totalAvoirsDecaisses = tokenDebtsRedeemed;

    const netTokenDebt = Math.max(0, totalAvoirsEmis - totalAvoirsDecaisses);

    return { totalAvoirsEmis, totalAvoirsDecaisses, netTokenDebt };
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseJetonsTabContainer');
    if (!container) return;
    this.updateBadgeCounts();

    if (this.currentTab === 'change') this.renderChangeTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'movements') this.renderMovementsTab(container);
  },

  // 1. Onglet Émission & Restitution d'Avoirs (Jetons)
  renderChangeTab(container) {
    const { totalAvoirsEmis, totalAvoirsDecaisses, netTokenDebt } = this.getAvoirsStats();

    container.innerHTML = `
      <!-- Synthèse Avoirs / Jetons en temps réel -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <div style="font-size: 0.8rem; color: #92400e; font-weight: 700;">🪙 Total Avoirs Émis (Jetons)</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: #b45309; margin-top: 3px;">
            +${totalAvoirsEmis.toLocaleString()} F
          </div>
          <div style="font-size: 0.72rem; color: #b45309; opacity: 0.85;">Jetons remis par manque de monnaie</div>
        </div>

        <div style="background: #dcfce7; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">💵 Total Avoirs Décaissés (Honorés)</div>
          <div style="font-size: 1.35rem; font-weight: 800; color: #15803d; margin-top: 3px;">
            -${totalAvoirsDecaisses.toLocaleString()} F
          </div>
          <div style="font-size: 0.72rem; color: #15803d; opacity: 0.85;">Espèces remboursées contre jetons</div>
        </div>

        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.85rem 1rem;">
          <div style="font-size: 0.8rem; color: #1e40af; font-weight: 700;">⚖️ Dette Avoirs Nette en Circulation</div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; margin-top: 3px;">
            ${netTokenDebt.toLocaleString()} F
          </div>
          <div style="font-size: 0.72rem; color: #1e40af; opacity: 0.85;">Engagement dû aux visiteurs</div>
        </div>
      </div>

      <div class="caisse-jetons-actions-grid">
        
        <!-- ÉMISSION D'AVOIR (REMISE DE JETON) -->
        <div class="card" style="border: 2px solid #f59e0b; margin-bottom: 0;">
          <div class="card-header" style="background: #fef3c7; border-bottom: 1px solid #fde68a;">
            <h4 style="margin: 0; color: #b45309; font-size: 0.98rem; font-weight: 800;">
              🪙 Émettre un Avoir Client (Remise de Jeton — Manque de Monnaie)
            </h4>
          </div>
          <div class="card-body" style="padding: 1rem;">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem; line-height: 1.45;">
              En cas d'impossibilité de rendre la monnaie exacte, remettez un jeton physique comme avoir au visiteur.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label style="font-weight: 700; font-size: 0.85rem;">Valeur faciale du Jeton</label>
                <select id="jetonIssueVal" class="form-control" style="font-weight: 700;">
                  ${this.tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label style="font-weight: 700; font-size: 0.85rem;">Quantité</label>
                <input type="number" id="jetonIssueQty" class="form-control" value="1" min="1" style="font-weight: 700;">
              </div>
            </div>
            <button class="btn btn-primary jeton-action-btn" style="background: #d97706; border-color: #b45309;" onclick="CaisseJetonsModule.issueToken()">
              🪙 Enregistrer l'Émission d'Avoir (Remise Jeton)
            </button>
          </div>
        </div>

        <!-- RESTITUTION D'AVOIR (REMBOURSEMENT ESPÈCES) -->
        <div class="card" style="border: 2px solid #10b981; margin-bottom: 0;">
          <div class="card-header" style="background: #dcfce7; border-bottom: 1px solid #bbf7d0;">
            <h4 style="margin: 0; color: #15803d; font-size: 0.98rem; font-weight: 800;">
              💵 Restitution d'Avoir Décaissé (Remboursement Espèces contre Jeton)
            </h4>
          </div>
          <div class="card-body" style="padding: 1rem;">
            <p style="font-size: 0.85rem; color: var(--gray-600); margin-bottom: 1rem; line-height: 1.45;">
              Le visiteur rapporte son jeton physique pour récupérer son argent liquide. Vérifiez le jeton physique.
            </p>
            <div class="form-row">
              <div class="form-group">
                <label style="font-weight: 700; font-size: 0.85rem;">Jeton rapporté</label>
                <select id="jetonRefundVal" class="form-control" style="font-weight: 700;">
                  ${this.tokenValues.map(v => `<option value="${v}">${v} Francs CFA</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label style="font-weight: 700; font-size: 0.85rem;">Quantité</label>
                <input type="number" id="jetonRefundQty" class="form-control" value="1" min="1" style="font-weight: 700;">
              </div>
            </div>
            <button class="btn btn-primary jeton-action-btn" style="background: #16a34a; border-color: #15803d;" onclick="CaisseJetonsModule.refundToken()">
              💵 Décaisser l'Avoir en Espèces &amp; Reprendre le Jeton
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

    const totalF = val * qty;
    const client = SupabaseClient.client;
    const user = Auth.getCurrentUser();
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = (user && (user.full_name || user.login)) || sellerLogin;

    if (client && CaissesCore.isUuid(this.register.id)) {
      try {
        await client.from('token_debts').insert([{
          cash_register_id: this.register.id,
          token_value_f: val,
          quantity_given: qty,
          quantity_redeemed: 0,
          status: 'en_circulation'
        }]);
      } catch (e) {
        console.warn('[Token Debt DB Warning]', e);
      }

      try {
        await client.from('cash_movements').insert([{
          cash_register_id: this.register.id,
          type: 'emission_jeton',
          amount_f: totalF,
          reason: `Avoir émis : Remise de ${qty} jeton(s) de ${val} F par ${sellerFullName} (@${sellerLogin})`,
          user_id: user ? user.id : null,
          tokens_detail: {
            token_value: val,
            quantity: qty,
            total_f: totalF,
            operation: 'emission_avoir',
            seller_name: sellerFullName,
            seller_login: sellerLogin
          }
        }]);
      } catch (e) {
        console.warn('[Cash Movement DB Warning]', e);
      }
    }

    AuditLogger.log('EMISSION_AVOIR_JETON', 'token_debts', null, `Émission d'avoir : ${qty} jeton(s) de ${val} F (${totalF} F) remis par ${sellerFullName} (@${sellerLogin})`);
    Notify.success(`🪙 Avoir émis : ${qty} jeton(s) de ${val} F (${totalF.toLocaleString()} F) remis.`);
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
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = (user && (user.full_name || user.login)) || sellerLogin;

    if (client && CaissesCore.isUuid(this.register.id)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: this.register.id,
          type: 'restitution_jeton',
          amount_f: -totalF,
          reason: `Avoir décaissé : Restitution de ${qty} jeton(s) de ${val} F par ${sellerFullName} (@${sellerLogin})`,
          user_id: user ? user.id : null,
          tokens_detail: {
            token_value: val,
            quantity: qty,
            total_f: totalF,
            operation: 'restitution_avoir',
            seller_name: sellerFullName,
            seller_login: sellerLogin
          }
        }]);
      } catch (e) {
        console.warn('[Cash Movement Refund Warning]', e);
      }
    }

    AuditLogger.log('RESTITUTION_AVOIR_JETON', 'cash_movements', null, `Restitution d'avoir : ${totalF} F remboursés contre ${qty} jeton(s) de ${val} F par ${sellerFullName} (@${sellerLogin})`);
    Notify.success(`💵 Avoir décaissé : ${totalF.toLocaleString()} F remboursés au visiteur. Jeton(s) récupéré(s).`);
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

  // 3. Onglet Mouvements & Journal Complet des Avoirs
  renderMovementsTab(container) {
    const { totalAvoirsEmis, totalAvoirsDecaisses, netTokenDebt } = this.getAvoirsStats();

    container.innerHTML = `
      <!-- Synthèse des Avoirs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.25rem;">
        <div style="background: #fef3c7; border: 1px solid #fde68a; border-radius: var(--radius-md); padding: 0.75rem 1rem;">
          <div style="font-size: 0.8rem; color: #92400e; font-weight: 700;">🪙 Total Avoirs Émis (Jetons)</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #b45309;">+${totalAvoirsEmis.toLocaleString()} F</div>
        </div>
        <div style="background: #dcfce7; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 0.75rem 1rem;">
          <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">💵 Total Avoirs Décaissés (Honorés)</div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #15803d;">-${totalAvoirsDecaisses.toLocaleString()} F</div>
        </div>
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: var(--radius-md); padding: 0.75rem 1rem;">
          <div style="font-size: 0.8rem; color: #1e40af; font-weight: 700;">⚖️ Dette Avoirs Nette en Circulation</div>
          <div style="font-size: 1.25rem; font-weight: 900; color: #2563eb;">${netTokenDebt.toLocaleString()} F</div>
        </div>
      </div>

      <div class="table-responsive">
        ${this.movements.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📋</div>
            <div class="empty-title">Aucun mouvement pour le moment</div>
            <div class="empty-desc">Toutes les émissions et restitutions de jetons apparaîtront ici avec le nom du caissier.</div>
          </div>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Date &amp; Heure</th>
                <th>Type</th>
                <th>Motif &amp; Justification</th>
                <th style="text-align: right;">Montant</th>
                <th>Caissier / Vendeur</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${this.movements.map(m => {
                const isEmission = m.type === 'emission_jeton' || m.type === 'emission_avoir';
                const isRestitution = m.type === 'restitution_jeton' || m.type === 'remboursement_jeton' || m.type === 'restitution_avoir';
                const isPositive = m.amount_f >= 0;

                // Résolution nominative du caissier
                let sellerName = m.tokens_detail?.seller_name || (m.user && (m.user.full_name || m.user.login));
                let sellerLogin = m.tokens_detail?.seller_login || (m.user && m.user.login);

                if (!sellerName && m.reason) {
                  const match = m.reason.match(/par (.+?) \(@(.+?)\)/);
                  if (match) {
                    sellerName = match[1];
                    sellerLogin = match[2];
                  }
                }
                if (!sellerName) sellerName = 'Caissier';
                if (!sellerLogin) sellerLogin = 'caisse';

                let badgeHtml = '';
                if (isEmission) {
                  badgeHtml = '<span class="badge badge-warning" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">🪙 Émission Avoir</span>';
                } else if (isRestitution) {
                  badgeHtml = '<span class="badge badge-success" style="background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0;">💵 Restitution Avoir</span>';
                } else {
                  badgeHtml = `<span class="badge ${isPositive ? 'badge-success' : 'badge-danger'}">${m.type}</span>`;
                }

                return `
                  <tr>
                    <td style="font-size: 0.8rem; color: var(--gray-600); white-space: nowrap;">
                      ${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>
                    <td>${badgeHtml}</td>
                    <td><strong>${m.reason}</strong></td>
                    <td style="text-align: right; font-weight: 700; color: ${isEmission ? '#b45309' : (isPositive ? 'var(--success)' : 'var(--danger)')};">
                      ${isPositive ? '+' : ''}${m.amount_f.toLocaleString()} F
                    </td>
                    <td>
                      <span class="badge badge-gray" title="Responsable individuel : ${sellerName} (@${sellerLogin})" style="font-size: 0.75rem;">
                        👤 ${sellerName}
                      </span>
                    </td>
                    <td style="text-align: right; white-space: nowrap;">
                      <button class="btn btn-danger btn-sm" onclick="CaisseJetonsModule.deleteMovement('${m.id}', ${m.amount_f}, '${(m.reason || '').replace(/'/g, "\\'")}')" title="Annuler ce mouvement avec motif obligatoire" style="padding: 2px 7px; font-size: 0.75rem;">
                        <span>🗑️</span> Enlever
                      </button>
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

  async deleteMovement(id, amount, reason) {
    const user = Auth.getCurrentUser();
    const isAdmin = Permissions.isSuperAdmin() || Permissions.canAccessPole(2);
    if (!isAdmin) {
      Notify.warning("🔒 Action réservée aux administrateurs ou au SuperAdmin.");
      return;
    }

    const cancelReason = prompt(`Suppression du mouvement (${(amount || 0).toLocaleString()} F) :\n\nMotif obligatoire de la suppression (ex: Erreur de saisie, jeton restitué, rectification) :`);
    if (cancelReason === null) return;
    const motif = cancelReason.trim();
    if (!motif) {
      Notify.warning("Suppression annulée : un motif précis est obligatoire pour la traçabilité administrative.");
      return;
    }

    const adminLabel = user ? `${user.full_name || user.login} (@${user.login})` : 'Admin';
    const client = SupabaseClient.client;
    if (client && CaissesCore.isUuid(id)) {
      try {
        await client.from('cash_movements').delete().eq('id', id);
      } catch (e) {
        console.warn('[Delete Movement DB Warning]', e);
      }
    }

    this.movements = this.movements.filter(m => m.id !== id);
    localStorage.setItem('kermesse_jetons_movements', JSON.stringify(this.movements));

    AuditLogger.log('SUPPRESSION_MOUVEMENT_JETON', 'cash_movements', id, `Suppression mouvement jeton/avoir ${amount} F par ${adminLabel}. Motif : ${motif}`);
    Notify.success(`Mouvement supprimé. Motif consigné : ${motif}`);
    await this.loadData();
    this.renderCurrentTab();
  }
};


// ==============================================================================
// 4. MODULE : CAISSE RESTAURATION & BUVETTE (CaisseRestaurationModule)
// Pôle 4 : Restauration
// ==============================================================================
const CaisseRestaurationModule = {
  currentTab: 'pos', // 'pos', 'expenses', 'journal'
  activeCategoryFilter: 'all',
  register: null,
  products: [],
  sales: [],
  expenses: [],
  cart: [],
  paymentMethod: 'cash', // 'cash' | 'tokens'
  _realtimeInit: false,

  async render(container) {
    this.register = await CaissesCore.getOrCreateRegister('Restauration', 'Caisse 4 — Restauration & Buvette');
    await this.loadData();

    container.innerHTML = `
      <div class="card">
        <div class="card-header caisse-card-header">
          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <div class="card-title" style="margin: 0;">
              <span>🍔</span> Pôle 4 : Caisse Restauration &amp; Buvette
            </div>
            <span class="badge ${this.register.status === 'open' ? 'badge-success' : 'badge-gray'}">
              ${this.register.status === 'open' ? '🟢 Ouverte' : '🔴 Clôturée'}
            </span>
          </div>

          <!-- Navigation des sous-onglets moderne en pills logée dans l'en-tête (sans clôture) -->
          <div class="caisse-subtabs-nav" id="caisseRestoTabsNav">
            <button class="caisse-subtab-btn resto-theme ${this.currentTab === 'pos' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('pos')">
              🍔 <span>Vente Tactile</span>
            </button>
            <button class="caisse-subtab-btn resto-theme ${this.currentTab === 'expenses' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('expenses')">
              💸 <span>Dépenses</span> <span class="subtab-count" data-tab-count="expenses">${this.expenses.length}</span>
            </button>
            <button class="caisse-subtab-btn resto-theme ${this.currentTab === 'journal' ? 'active' : ''}" onclick="CaisseRestaurationModule.switchTab('journal')">
              🧾 <span>Journal</span> <span class="subtab-count" data-tab-count="journal">${this.sales.length}</span>
            </button>
          </div>
        </div>

        <div class="card-body">
          <div id="caisseRestaurationTabContainer"></div>
        </div>
      </div>
    `;

    this.renderCurrentTab();

    // Actualisation temps réel & synchronisation automatique multi-appareils
    if (!this._realtimeInit) {
      this._realtimeInit = true;
      CaissesCore.subscribeToSales(async () => {
        await this.loadData();
        if (this.cart.length === 0) {
          this.renderCurrentTab();
        } else {
          this.updateBadgeCounts();
        }
      });

      // Polling transparent de secours toutes les 4 secondes
      setInterval(async () => {
        const domCheck = document.getElementById('caisseRestaurationTabContainer');
        if (domCheck && this.cart.length === 0) {
          await this.loadData();
          this.renderCurrentTab();
        }
      }, 4000);
    }
  },

  switchTab(tab) {
    this.currentTab = tab;
    const container = document.getElementById('caisseRestaurationTabContainer');
    if (container) {
      const nav = document.getElementById('caisseRestoTabsNav');
      if (nav) {
        nav.querySelectorAll('.caisse-subtab-btn').forEach(btn => {
          btn.classList.toggle('active', btn.getAttribute('onclick')?.includes(`'${tab}'`));
        });
      }
      this.renderCurrentTab();
    } else {
      const pole = document.getElementById('poleContainer') || document.getElementById('mainContent');
      if (pole) this.render(pole);
    }
  },

  updateBadgeCounts() {
    const nav = document.getElementById('caisseRestoTabsNav');
    if (!nav) return;
    const expBadge = nav.querySelector('[data-tab-count="expenses"]');
    if (expBadge) expBadge.textContent = this.expenses.length;
    const journalBadge = nav.querySelector('[data-tab-count="journal"]');
    if (journalBadge) journalBadge.textContent = this.sales.length;
  },

  async loadData() {
    this.sales = await CaissesCore.loadSales('restauration');
    const client = SupabaseClient.client;
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

    // Si toujours vide, initialiser avec les produits phares de la kermesse et propager au Cloud
    if (this.products.length === 0) {
      this.products = [
        { id: 'fp-brg', name: 'Burger Maison', selling_price_f: 1500, category: 'Plats & Snacks', is_active: true },
        { id: 'fp-frt', name: 'Portion de Frites', selling_price_f: 500, category: 'Plats & Snacks', is_active: true },
        { id: 'fp-sdw', name: 'Sandwich Poulet / Viande', selling_price_f: 1000, category: 'Plats & Snacks', is_active: true },
        { id: 'fp-sod', name: 'Boisson Gazeuse / Canette', selling_price_f: 500, category: 'Boissons', is_active: true },
        { id: 'fp-jus', name: 'Jus Local Frais (Bissap/Gingembre)', selling_price_f: 500, category: 'Boissons', is_active: true },
        { id: 'fp-eau', name: 'Eau Minérale (50 cl)', selling_price_f: 300, category: 'Boissons', is_active: true },
        { id: 'fp-crp', name: 'Crêpe Sucrée / Chocolat', selling_price_f: 500, category: 'Desserts & Sucreries', is_active: true },
        { id: 'fp-glc', name: 'Glace / Cornet', selling_price_f: 500, category: 'Desserts & Sucreries', is_active: true }
      ];
      localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));

      if (client) {
        try {
          for (const prod of this.products) {
            const { data } = await client.from('food_products').insert([{
              name: prod.name,
              category: prod.category,
              selling_price_f: prod.selling_price_f,
              unit: 'portion',
              is_active: true
            }]).select('id');
            if (data && data[0]) prod.id = data[0].id;
          }
          localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
        } catch (e) {}
      }
    } else {
      localStorage.setItem('kermesse_food_products', JSON.stringify(this.products));
    }

    if (this.register) {
      this.expenses = await CaissesCore.loadExpenses(this.register.id);
    }
  },

  renderCurrentTab() {
    const container = document.getElementById('caisseRestaurationTabContainer');
    if (!container) return;
    this.updateBadgeCounts();

    if (this.currentTab === 'pos') this.renderPosTab(container);
    else if (this.currentTab === 'expenses') this.renderExpensesTab(container);
    else if (this.currentTab === 'journal') this.renderJournalTab(container);
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
      <div class="pos-main-layout">
        
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
            <div class="pos-catalog-grid">
              ${filteredProducts.map(p => {
                const inCart = this.cart.find(i => i.id === p.id);
                const qty = inCart ? inCart.qty : 0;
                const price = p.selling_price_f || 0;
                const emoji = this.getProductEmoji(p.name, p.category);

                return `
                  <div class="card pos-product-card" style="border: 2px solid ${qty > 0 ? '#ea580c' : '#e2e8f0'}; border-top: 5px solid #ea580c; background: ${qty > 0 ? '#fff7ed' : 'white'};">
                    <div class="card-body">
                      <div class="pos-card-top-row">
                        <span class="pos-card-emoji">${emoji}</span>
                        <div class="pos-card-price-badge">
                          <div class="pos-card-price-val" style="color: #c2410c;">${price.toLocaleString()} F</div>
                          <div class="pos-card-price-sub">${p.category || 'Restauration'}</div>
                        </div>
                      </div>

                      <div class="pos-card-title">
                        ${p.name}
                      </div>

                      <!-- 2 BOUTONS : AUGMENTER (+) ET DIMINUER (-) -->
                      <div class="pos-stepper-box">
                        <button class="btn btn-secondary btn-sm pos-stepper-btn" onclick="CaisseRestaurationModule.decrementItem('${p.id}')" ${qty === 0 ? 'disabled style="opacity: 0.3;"' : ''} title="Diminuer">
                          −
                        </button>
                        <div class="pos-stepper-center">
                          <span class="pos-stepper-count" style="color: ${qty > 0 ? '#c2410c' : 'var(--gray-400)'};">
                            ${qty}
                          </span>
                          <span class="pos-stepper-unit">servi(s)</span>
                        </div>
                        <button class="btn btn-primary btn-sm pos-stepper-btn" style="background: #ea580c; border-color: #c2410c;" onclick="CaisseRestaurationModule.incrementItem('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${price})" title="Ajouter">
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
              <span style="font-size: 0.8rem; color: var(--gray-500);">Cliquez sur 🗑️ pour annuler une commande</span>
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
                      <button class="btn btn-danger btn-sm" onclick="CaisseRestaurationModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f}, '${s.product_id || ''}', ${s.quantity})" title="Annuler et enlever de la caisse" style="display: flex; align-items: center; gap: 4px;">
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
        <div class="card pos-cart-panel" style="border: 2px solid #ea580c; box-shadow: var(--shadow-md);">
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
                      <button class="btn btn-secondary btn-sm" style="width: 28px; height: 28px; padding: 0; font-weight: 800;" onclick="CaisseRestaurationModule.incrementItem('${item.id}', '${item.name.replace(/'/g, "\\'")}', ${item.price})">+</button>
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
                    <div class="quick-cash-chips">
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(${cartTotal})">Exact</button>
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(500)">500 F</button>
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(1000)">1 000 F</button>
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(2000)">2 000 F</button>
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(5000)">5 000 F</button>
                      <button type="button" class="quick-cash-chip" onclick="CaisseRestaurationModule.setCashGiven(10000)">10 000 F</button>
                    </div>
                    <input type="number" id="caisseRestoCashGiven" class="form-control" style="font-size: 1.15rem; font-weight: 700; height: 44px;" placeholder="Espèces reçues (FCFA)" oninput="CaisseRestaurationModule.calcChange(${cartTotal})">
                    <div id="caisseRestoChangeDisp" style="margin-top: 4px; font-weight: 700; font-size: 0.85rem; color: #1e40af;">Monnaie à rendre : 0 F</div>
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
                ⚡ Valider la commande (${cartTotal.toLocaleString()} F)
              </button>
            `}
          </div>
        </div>

      </div>

      ${cartTotal > 0 ? `
        <div class="pos-mobile-cart-bar" onclick="document.querySelector('.pos-cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })">
          <div style="display: flex; align-items: center; gap: 0.6rem;">
            <span class="mobile-cart-badge" style="background: #ea580c;">${this.cart.reduce((s, i) => s + i.qty, 0)}</span>
            <div style="text-align: left; line-height: 1.2;">
              <div style="font-size: 0.7rem; opacity: 0.85;">Total Commande</div>
              <strong style="font-size: 1.05rem;">${cartTotal.toLocaleString()} F</strong>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; font-weight: 800;">
            <span>Encaisser</span>
            <span>↓</span>
          </div>
        </div>
      ` : ''}
    `;
  },

  setCashGiven(amt) {
    const input = document.getElementById('caisseRestoCashGiven');
    if (input) {
      input.value = amt;
      const cartTotal = this.cart.reduce((s, i) => s + (i.price * i.qty), 0);
      this.calcChange(cartTotal);
    }
  },

  setPaymentMethod(method) {
    this.paymentMethod = method;
    this.renderCurrentTab();
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
    const sellerLogin = user ? user.login : 'Caissier';
    const sellerFullName = user ? (user.full_name || user.login) : 'Caissier';

    for (const item of this.cart) {
      const realSale = await CaissesCore.recordSale({
        cash_register_id: regId,
        item_name: item.name,
        category: 'restauration',
        quantity: item.qty,
        unit_price_f: item.price,
        total_amount_f: item.price * item.qty,
        payment_mode: mode,
        product_id: CaissesCore.isUuid(item.id) ? item.id : null
      });

      this.sales.unshift(realSale);
    }

    // Sauvegarde locale
    localStorage.setItem('kermesse_food_sales', JSON.stringify(this.sales));

    if (client && CaissesCore.isUuid(regId)) {
      try {
        await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type: 'vente',
          amount_f: cartTotal,
          reason: `Vente Restauration (${mode === 'tokens' ? 'En Jetons' : 'En Espèces'}) par ${sellerFullName} (@${sellerLogin})`,
          tokens_detail: mode === 'tokens' ? { total_tokens_f: cartTotal } : null,
          user_id: user ? user.id : null
        }]);
      } catch (e) {}
    }

    AuditLogger.log('VENTE_RESTAURATION', 'ticket_sales', null, `Vente restauration de ${cartTotal} F (${mode}) par ${sellerFullName} (@${sellerLogin})`);
    Notify.success(`Commande validée ! Total : ${cartTotal.toLocaleString()} F`);
    this.cart = [];
    this.renderCurrentTab();
  },

  async deleteSale(id, name, amount, productId, quantity) {
    const user = Auth.getCurrentUser();
    const isAdmin = Permissions.isSuperAdmin() || Permissions.canAccessPole(4);
    if (!isAdmin) {
      Notify.warning("🔒 Action réservée aux administrateurs du Pôle Restauration ou au SuperAdmin.");
      return;
    }

    const cancelReason = prompt(`Suppression de la commande « ${name} » (${(amount || 0).toLocaleString()} F) :\n\nMotif obligatoire de la suppression (ex: Erreur de saisie, plat indisponible, remboursement) :`);
    if (cancelReason === null) return;
    const motif = cancelReason.trim();
    if (!motif) {
      Notify.warning("Suppression annulée : un motif précis est obligatoire pour la traçabilité administrative.");
      return;
    }

    const adminLabel = user ? `${user.full_name || user.login} (@${user.login})` : 'Admin';

    const client = SupabaseClient.client;

    // 1. Ajouter à la liste noire cloud/locale des annulations (pour mise à jour Bilan)
    await CaissesCore.addCancelledSaleId(id, name);

    // 2. Supprimer dans Supabase
    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
        if (this.register && CaissesCore.isUuid(this.register.id)) {
          await client.from('cash_movements').insert([{
            cash_register_id: this.register.id,
            type: 'correction',
            amount_f: -Math.abs(amount),
            reason: `Suppression vente restauration : ${name} (Par ${adminLabel} - Motif : ${motif})`,
            user_id: user?.id || null
          }]);
        }
      } catch (e) {
        console.warn('[Delete Resto Sale DB Warning]', e);
      }
    }

    this.sales = this.sales.filter(s => s.id !== id);
    localStorage.setItem('kermesse_food_sales', JSON.stringify(this.sales));

    AuditLogger.log('ANNULATION_VENTE_RESTAURATION', 'ticket_sales', id, `Suppression vente resto « ${name} » (-${amount} F) par ${adminLabel}. Motif : ${motif}`);
    Notify.success(`Commande « ${name} » enlevée. Motif consigné : ${motif}`);
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

  activeSellerFilter: 'all',

  // 3. Onglet Journal des Ventes Restauration
  renderJournalTab(container) {
    const sellers = Array.from(new Set(this.sales.map(s => {
      return (s.seller && s.seller.login) || s.seller_login || 'Caissier';
    }))).filter(Boolean);

    const filteredSales = (this.activeSellerFilter && this.activeSellerFilter !== 'all')
      ? this.sales.filter(s => {
          const sLog = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
          return sLog === this.activeSellerFilter;
        })
      : this.sales;

    container.innerHTML = `
      <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
        <h4 style="margin: 0;">Journal des Ventes — Restauration &amp; Buvette</h4>
        ${sellers.length > 1 ? `
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <span style="font-size: 0.82rem; color: var(--gray-600); font-weight: 600;">Filtrer par vendeur :</span>
            <select class="form-control form-control-sm" style="width: auto; padding: 2px 8px; font-size: 0.82rem;" onchange="CaisseRestaurationModule.activeSellerFilter = this.value; CaisseRestaurationModule.renderCurrentTab();">
              <option value="all">👥 Tous les caissiers (${this.sales.length})</option>
              ${sellers.map(sel => `<option value="${sel}" ${this.activeSellerFilter === sel ? 'selected' : ''}>👤 ${sel}</option>`).join('')}
            </select>
          </div>
        ` : ''}
      </div>
      <div class="table-responsive">
        ${filteredSales.length === 0 ? `
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
                <th>Vendeur / Caissier</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${filteredSales.map(s => {
                const sellerName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || s.seller_login || 'Caissier';
                const sellerLogin = (s.seller && s.seller.login) || s.seller_login || 'caissier';
                return `
                  <tr>
                    <td style="font-size: 0.8rem; color: var(--gray-600);">${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><strong>${s.item_name}</strong></td>
                    <td>${s.quantity}</td>
                    <td>${(s.unit_price_f || 0).toLocaleString()} F</td>
                    <td>${s.payment_mode === 'tokens' ? '<span class="badge badge-warning">🪙 Jetons</span>' : '<span class="badge badge-success">💵 Espèces</span>'}</td>
                    <td><strong style="color: var(--success);">${(s.total_amount_f || 0).toLocaleString()} F</strong></td>
                    <td>
                      <span class="badge badge-gray" title="Responsable individuel : ${sellerName} (@${sellerLogin})" style="font-size: 0.75rem;">
                        👤 ${sellerName}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn btn-danger btn-sm" onclick="CaisseRestaurationModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f}, '${s.product_id || ''}', ${s.quantity})" title="Annuler et remettre en stock">🗑️ Enlever</button>
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

  // 4. Onglet Contrôle & Clôture Caisse Restauration
  renderClosureTab(container) {
    const initF = this.register.initial_amount_f || 0;
    const revTotal = this.sales.reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const revCash = this.sales.filter(s => s.payment_mode !== 'tokens').reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const revTokens = this.sales.filter(s => s.payment_mode === 'tokens').reduce((s, x) => s + (x.total_amount_f || 0), 0);
    const expTotal = this.expenses.reduce((s, x) => s + Math.abs(x.amount_f), 0);
    const expectedCash = initF + revCash - expTotal;

    // Calcul de la répartition par vendeur
    const sellerStats = {};
    this.sales.forEach(s => {
      const sLogin = (s.seller && s.seller.login) || s.seller_login || 'Caissier';
      const sName = (s.seller && (s.seller.full_name || s.seller.login)) || s.seller_name || sLogin;
      if (!sellerStats[sLogin]) {
        sellerStats[sLogin] = { login: sLogin, name: sName, items: 0, total: 0 };
      }
      sellerStats[sLogin].items += (s.quantity || 1);
      sellerStats[sLogin].total += (s.total_amount_f || 0);
    });
    const sellerList = Object.values(sellerStats);

    container.innerHTML = `
      <div style="max-width: 650px; margin: 0 auto;">
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

          <!-- RÉPARTITION NOMINATIVE PAR VENDEUR -->
          <div style="margin-bottom: 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: var(--radius-md); padding: 0.85rem;">
            <div style="font-weight: 700; font-size: 0.88rem; color: var(--gray-800); margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>👤</span> Répartition nominative des recettes par caissier
            </div>
            ${sellerList.length === 0 ? `
              <div style="font-size: 0.8rem; color: var(--gray-400); font-style: italic;">Aucune commande enregistrée.</div>
            ` : `
              <table style="width: 100%; font-size: 0.82rem; border-collapse: collapse;">
                <thead>
                  <tr style="border-bottom: 1px solid var(--gray-200); color: var(--gray-500); text-align: left;">
                    <th style="padding: 4px 0;">Caissier</th>
                    <th style="padding: 4px 0; text-align: center;">Articles</th>
                    <th style="padding: 4px 0; text-align: right;">Total Encaissé</th>
                    <th style="padding: 4px 0; text-align: right;">Part</th>
                  </tr>
                </thead>
                <tbody>
                  ${sellerList.map(s => {
                    const pct = revTotal > 0 ? Math.round((s.total / revTotal) * 100) : 0;
                    return `
                      <tr style="border-bottom: 1px solid var(--gray-100);">
                        <td style="padding: 6px 0;"><strong>${s.name}</strong> <span style="color: var(--gray-400); font-size: 0.75rem;">(@${s.login})</span></td>
                        <td style="padding: 6px 0; text-align: center;">${s.items}</td>
                        <td style="padding: 6px 0; text-align: right; font-weight: 700; color: var(--success);">${s.total.toLocaleString()} F</td>
                        <td style="padding: 6px 0; text-align: right; color: var(--gray-500);">${pct}%</td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            `}
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
// 5. MODULE : BILAN FINANCIER GLOBAL KERMESSE (CaisseBilanModule)
// ==============================================================================
const CaisseBilanModule = {
  sales: [],
  expenses: [],
  registers: [],
  finances: null,
  activeCaisseFilter: 'all',
  activeCashierFilter: 'all',
  searchQuery: '',
  _realtimeInit: false,

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>📊</span> Pôle 2 : Bilan Financier Consolidé de la Kermesse
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="CaisseBilanModule.loadData().then(() => CaisseBilanModule.renderSummary())">
              <span>🔄</span> Actualiser en direct
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

    // Actualisation temps réel & synchronisation automatique multi-appareils
    if (!this._realtimeInit) {
      this._realtimeInit = true;
      CaissesCore.subscribeToSales(async () => {
        await this.loadData();
        this.renderSummary();
      });

      // Polling transparent de secours toutes les 4 secondes
      setInterval(async () => {
        const domCheck = document.getElementById('bilanContentContainer');
        if (domCheck) {
          await this.loadData();
          this.renderSummary();
        }
      }, 4000);
    }
  },

  async loadData() {
    this.finances = await CaissesCore.calculateConsolidatedFinances();
    this.sales = this.finances.sales || [];
    this.registers = this.finances.registers || [];
    this.expenses = this.finances.expenses || [];
  },

  async deleteSale(id, name, amount) {
    const user = Auth.getCurrentUser();
    const isAdmin = Permissions.isSuperAdmin() || Permissions.canAccessPole(2);
    if (!isAdmin) {
      Notify.warning("🔒 Action réservée aux administrateurs ou au SuperAdmin.");
      return;
    }

    const cancelReason = prompt(`Suppression de la transaction « ${name} » (${(amount || 0).toLocaleString()} F) :\n\nMotif obligatoire de la suppression (ex: Erreur de saisie, remboursement, ticket abîmé) :`);
    if (cancelReason === null) return;
    const motif = cancelReason.trim();
    if (!motif) {
      Notify.warning("Suppression annulée : un motif explicatif est obligatoire pour la traçabilité administrative.");
      return;
    }

    const adminLabel = user ? `${user.full_name || user.login} (@${user.login})` : 'SuperAdmin';
    const client = SupabaseClient.client;

    await CaissesCore.addCancelledSaleId(id, name);

    if (client) {
      try {
        if (CaissesCore.isUuid(id)) {
          await client.from('ticket_sales').delete().eq('id', id);
        }
      } catch (e) {
        console.warn('[Bilan Delete Sale DB Warning]', e);
      }
    }

    ['kermesse_entry_sales', 'kermesse_game_sales', 'kermesse_food_sales'].forEach(k => {
      try {
        const stored = localStorage.getItem(k);
        if (stored) {
          const list = JSON.parse(stored).filter(s => s.id !== id);
          localStorage.setItem(k, JSON.stringify(list));
        }
      } catch (e) {}
    });

    AuditLogger.log('SUPPRESSION_VENTE_BILAN', 'ticket_sales', id, `Suppression transaction « ${name} » (-${amount} F) par ${adminLabel}. Motif : ${motif}`);
    Notify.success(`Transaction « ${name} » supprimée. Motif consigné : ${motif}`);
    await this.loadData();
    this.renderSummary();
  },

  renderSummary() {
    const container = document.getElementById('bilanContentContainer');
    if (!container || !this.finances) return;

    const { revEntree, revJeux, revResto, totalRecettes, totalExpenses, beneficeNet, standTotals } = this.finances;

    // 1. Statistiques consolidées par caissier
    const cashierStats = {};
    this.sales.forEach(s => {
      const login = s.seller_login || (s.seller && s.seller.login) || 'caissier';
      const name = s.seller_name || (s.seller && (s.seller.full_name || s.seller.login)) || login;
      const role = s.seller_role || (s.seller && s.seller.role_name) || 'Caissier';
      if (!cashierStats[login]) {
        cashierStats[login] = {
          login,
          name,
          role,
          totalSalesCount: 0,
          totalRevenue: 0,
          entreeCount: 0,
          entreeRev: 0,
          jeuxCount: 0,
          jeuxRev: 0,
          restoCount: 0,
          restoRev: 0,
          firstSale: s.created_at,
          lastSale: s.created_at
        };
      }
      const stat = cashierStats[login];
      const qty = s.quantity || 1;
      const amt = s.total_amount_f || 0;
      stat.totalSalesCount += qty;
      stat.totalRevenue += amt;

      if (s.category === 'entree') {
        stat.entreeCount += qty;
        stat.entreeRev += amt;
      } else if (s.category === 'restauration') {
        stat.restoCount += qty;
        stat.restoRev += amt;
      } else {
        stat.jeuxCount += qty;
        stat.jeuxRev += amt;
      }

      if (new Date(s.created_at) < new Date(stat.firstSale)) stat.firstSale = s.created_at;
      if (new Date(s.created_at) > new Date(stat.lastSale)) stat.lastSale = s.created_at;
    });

    const cashierList = Object.values(cashierStats).sort((a, b) => b.totalRevenue - a.totalRevenue);
    const allCashiers = cashierList.map(c => c.login);

    // 2. Ventes filtrées pour le Grand Livre Omniscient
    const filteredSales = this.sales.filter(s => {
      const sCategory = s.category || 'jeux';
      const sLogin = s.seller_login || (s.seller && s.seller.login) || 'caissier';
      const sItem = (s.item_name || '').toLowerCase();

      if (this.activeCaisseFilter !== 'all' && sCategory !== this.activeCaisseFilter) {
        return false;
      }
      if (this.activeCashierFilter !== 'all' && sLogin !== this.activeCashierFilter) {
        return false;
      }
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase().trim();
        if (!sItem.includes(q) && !sLogin.toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });

    const filteredTotalAmount = filteredSales.reduce((acc, s) => acc + (s.total_amount_f || 0), 0);

    container.innerHTML = `
      <div style="max-width: 960px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Cartes synthétiques des 4 Caisses -->
        <div class="pos-bilan-kpi">
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
              <div style="font-weight: 700; color: #92400e; font-size: 0.95rem;">🪙 Caisse 3 : Avoirs &amp; Jetons</div>
              <div style="font-size: 1.5rem; font-weight: 800; color: #b45309; margin: 0.35rem 0;">
                ${(this.finances.netTokenDebt || 0).toLocaleString()} F
              </div>
              <div style="font-size: 0.8rem; color: var(--gray-500);">Dette jetons (${(this.finances.tokensIssued || 0).toLocaleString()} F émis)</div>
              <button class="btn btn-secondary btn-sm" style="width: 100%; margin-top: 0.5rem;" onclick="App.navigateTo('caisse_jetons')">Gérer Caisse 3</button>
            </div>
          </div>
        </div>

        <!-- Grand Bilan Consolidé Net -->
        <div style="background: #f8fafc; border: 2px solid var(--gray-300); border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-md);">
          <div class="pos-bilan-banner">
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Total Recettes Brutes</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--success); margin-top: 4px;">
                ${totalRecettes.toLocaleString()} F
              </div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Total Dépenses Kermesse</div>
              <div style="font-size: 1.4rem; font-weight: 800; color: var(--danger); margin-top: 4px;">
                -${totalExpenses.toLocaleString()} F
              </div>
            </div>
            <div>
              <div style="font-size: 0.85rem; color: var(--gray-600);">Bénéfice Net Kermesse</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: ${beneficeNet >= 0 ? 'var(--primary)' : 'var(--danger)'}; margin-top: 4px;">
                ${beneficeNet.toLocaleString()} ${KermesseConfig.currency}
              </div>
            </div>
          </div>
          <div style="text-align: center; font-size: 0.85rem; color: var(--gray-500); margin-top: 0.5rem;">
            ❤️ Fonds entièrement dédiés aux œuvres sociales de l'association Love and Charity
          </div>
        </div>

        <!-- 👑 SUPERVISION & TRAÇABILITÉ NOMINATIVE OMNISCIENTE DES CAISSIERS -->
        <div class="card" style="border: 2px solid #3b82f6; box-shadow: var(--shadow-md);">
          <div class="card-header" style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: white; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.6rem;">
              <span style="font-size: 1.3rem;">👑</span>
              <div>
                <h4 style="margin: 0; color: white; font-size: 1rem;">Traçabilité Nominative des Caissiers &amp; Vendeurs</h4>
                <div style="font-size: 0.75rem; opacity: 0.9;">Supervision intégrale des encaissements individuels en temps réel</div>
              </div>
            </div>
            <span class="badge" style="background: rgba(255,255,255,0.25); color: white; font-weight: 800;">
              ${cashierList.length} caissier(s) actif(s)
            </span>
          </div>
          <div class="card-body" style="padding: 1rem;">
            ${cashierList.length === 0 ? `
              <p style="text-align: center; color: var(--gray-500); padding: 1rem 0;">Aucune vente enregistrée pour l'instant.</p>
            ` : `
              <div class="table-responsive">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Caissier / Vendeur</th>
                      <th>Rôle / Titre</th>
                      <th style="text-align: center;">Tickets / Articles</th>
                      <th style="text-align: right;">Total Encaissé</th>
                      <th style="text-align: center;">Activité</th>
                      <th>Répartition par Pôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cashierList.map(c => `
                      <tr>
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.5rem;">
                            <span class="portal-avatar" style="width: 32px; height: 32px; font-size: 0.85rem; background: #2563eb;">
                              ${(c.name || c.login || 'C').charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <strong style="color: var(--gray-800);">${c.name}</strong>
                              <div style="font-size: 0.72rem; color: var(--gray-500);">@${c.login}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span class="badge badge-gray" style="font-size: 0.72rem;">${c.role}</span>
                        </td>
                        <td style="text-align: center; font-weight: 700; font-size: 1rem;">
                          ${c.totalSalesCount}
                        </td>
                        <td style="text-align: right;">
                          <strong style="color: var(--success); font-size: 1.05rem;">${c.totalRevenue.toLocaleString()} F</strong>
                        </td>
                        <td style="text-align: center; font-size: 0.75rem; color: var(--gray-600); line-height: 1.3;">
                          <div>1ère : ${new Date(c.firstSale).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
                          <div>Dernière : <strong>${new Date(c.lastSale).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong></div>
                        </td>
                        <td>
                          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                            ${c.entreeRev > 0 ? `<span class="badge badge-success" style="font-size: 0.7rem;">🎟️ ${c.entreeRev.toLocaleString()} F</span>` : ''}
                            ${c.jeuxRev > 0 ? `<span class="badge badge-primary" style="font-size: 0.7rem;">🎯 ${c.jeuxRev.toLocaleString()} F</span>` : ''}
                            ${c.restoRev > 0 ? `<span class="badge badge-warning" style="font-size: 0.7rem;">🍔 ${c.restoRev.toLocaleString()} F</span>` : ''}
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <!-- 📜 GRAND LIVRE OMNISCIENT EN DIRECT DE TOUTES LES VENTES -->
        <div class="card" style="border: 2px solid var(--gray-300);">
          <div class="card-header" style="background: var(--gray-50); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">📜</span>
              <div class="card-title" style="margin: 0; font-size: 1rem;">
                Grand Livre Omniscient en Direct (Toutes Transactions)
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span class="badge badge-success" style="font-size: 0.85rem; padding: 0.35rem 0.65rem;">
                ${filteredSales.length} transaction(s) — Total : ${filteredTotalAmount.toLocaleString()} F
              </span>
            </div>
          </div>
          <div class="card-body" style="padding: 1rem;">
            
            <!-- Barre de Filtres Interactifs -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; margin-bottom: 1.25rem; background: var(--gray-50); padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
              <div>
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-bottom: 3px; display: block;">Filtrer par Caisse :</label>
                <select class="form-control form-control-sm" onchange="CaisseBilanModule.activeCaisseFilter = this.value; CaisseBilanModule.renderSummary();">
                  <option value="all" ${this.activeCaisseFilter === 'all' ? 'selected' : ''}>🌐 Toutes les Caisses</option>
                  <option value="entree" ${this.activeCaisseFilter === 'entree' ? 'selected' : ''}>🎟️ Caisse 1 : Entrée &amp; Accueil</option>
                  <option value="jeu" ${this.activeCaisseFilter === 'jeu' ? 'selected' : ''}>🎯 Caisse 2 : Tickets de Jeux</option>
                  <option value="restauration" ${this.activeCaisseFilter === 'restauration' ? 'selected' : ''}>🍔 Caisse 4 : Restauration &amp; Buvette</option>
                </select>
              </div>

              <div>
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-bottom: 3px; display: block;">Filtrer par Caissier :</label>
                <select class="form-control form-control-sm" onchange="CaisseBilanModule.activeCashierFilter = this.value; CaisseBilanModule.renderSummary();">
                  <option value="all" ${this.activeCashierFilter === 'all' ? 'selected' : ''}>👥 Tous les caissiers</option>
                  ${allCashiers.map(cLog => `
                    <option value="${cLog}" ${this.activeCashierFilter === cLog ? 'selected' : ''}>👤 ${cashierStats[cLog]?.name || cLog} (@${cLog})</option>
                  `).join('')}
                </select>
              </div>

              <div>
                <label style="font-size: 0.78rem; font-weight: 700; color: var(--gray-600); margin-bottom: 3px; display: block;">Recherche rapide :</label>
                <input type="text" class="form-control form-control-sm" placeholder="Rechercher un billet, plat ou vendeur..." value="${this.searchQuery}" oninput="CaisseBilanModule.searchQuery = this.value; CaisseBilanModule.renderSummary();">
              </div>
            </div>

            <!-- Table des ventes -->
            ${filteredSales.length === 0 ? `
              <div class="empty-state" style="padding: 2rem 1rem;">
                <div class="empty-icon">🧾</div>
                <div class="empty-title">Aucune transaction trouvée</div>
                <div class="empty-desc">Aucune vente ne correspond aux critères de filtre sélectionnés.</div>
              </div>
            ` : `
              <div class="table-responsive" style="max-height: 480px; overflow-y: auto;">
                <table class="data-table">
                  <thead style="position: sticky; top: 0; background: white; z-index: 2;">
                    <tr>
                      <th>Date &amp; Heure</th>
                      <th>Caisse / Pôle</th>
                      <th>Billet ou Article</th>
                      <th style="text-align: center;">Qté</th>
                      <th style="text-align: right;">Prix Unit.</th>
                      <th style="text-align: right;">Total Encaissé</th>
                      <th>Caissier / Vendeur</th>
                      <th style="text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredSales.map(s => {
                      const sSellerLogin = s.seller_login || (s.seller && s.seller.login) || 'caissier';
                      const sSellerName = s.seller_name || (s.seller && (s.seller.full_name || s.seller.login)) || sSellerLogin;
                      const isEntree = s.category === 'entree';
                      const isResto = s.category === 'restauration';
                      const caisseBadge = isEntree 
                        ? '<span class="badge badge-success" style="font-size: 0.72rem;">🎟️ Entrée</span>' 
                        : (isResto 
                          ? '<span class="badge badge-warning" style="font-size: 0.72rem;">🍔 Resto</span>' 
                          : '<span class="badge badge-primary" style="font-size: 0.72rem;">🎯 Jeux</span>');

                      return `
                        <tr>
                          <td style="font-size: 0.8rem; color: var(--gray-600); white-space: nowrap;">
                            ${new Date(s.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td>${caisseBadge}</td>
                          <td>
                            <strong>${s.item_name}</strong>
                            ${s.stand ? `<div style="font-size: 0.7rem; color: var(--gray-500);">🎪 ${s.stand.name}</div>` : ''}
                          </td>
                          <td style="text-align: center; font-weight: 700;">${s.quantity}</td>
                          <td style="text-align: right; font-size: 0.82rem; color: var(--gray-600);">${(s.unit_price_f || 0).toLocaleString()} F</td>
                          <td style="text-align: right;">
                            <strong style="color: var(--success); font-size: 0.95rem;">+${(s.total_amount_f || 0).toLocaleString()} F</strong>
                          </td>
                          <td>
                            <div style="font-size: 0.82rem; font-weight: 600; color: var(--gray-800);">👤 ${sSellerName}</div>
                            <div style="font-size: 0.7rem; color: var(--gray-500);">@${sSellerLogin}</div>
                          </td>
                          <td style="text-align: right; white-space: nowrap;">
                            <button class="btn btn-danger btn-sm" onclick="CaisseBilanModule.deleteSale('${s.id}', '${s.item_name.replace(/'/g, "\\'")}', ${s.total_amount_f})" title="Supprimer définitivement cette vente avec motif obligatoire" style="padding: 2px 7px; font-size: 0.75rem;">
                              <span>🗑️</span> Supprimer
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
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
                ${Object.values(standTotals)
                  .sort((a, b) => b.revenue - a.revenue)
                  .map((st, idx) => `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--gray-50); border-radius: var(--radius-md); border: 1px solid var(--gray-200);">
                      <div style="display: flex; align-items: center; gap: 0.75rem;">
                        <span style="font-size: 1.2rem; font-weight: 800; color: var(--primary);">#${idx + 1}</span>
                        <div>
                          <strong>🎪 ${st.name}</strong>
                          <div style="font-size: 0.75rem; color: var(--gray-500);">${st.ticketsCount} ticket(s) de jeux vendu(s)</div>
                        </div>
                      </div>
                      <strong style="color: var(--success); font-size: 1.1rem;">
                        ${st.revenue.toLocaleString()} F
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
