/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : CAISSES (CONTRÔLE FINANCIER, GESTION, MODIFICATION & SUPPRESSION)
 * 
 * Suivi strict et traçabilité des fonds de caisse :
 * - Caisse 1 : Entrée & Accueil Visiteurs
 * - Caisse 2 : Vente Tickets Jeux & Stands
 * - Caisse 3 : Change & Jetons de Monnaie
 * - Caisse 4 : Restauration & Buvette (Optionnelle)
 * - Fond initial configurable (peut être 0 F ou vide)
 * - Actions complètes : Mouvements, Modifier, Clôturer, Supprimer
 * - Calcul automatique des écarts à la fermeture
 */

const CashModule = {
  registers: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>💵</span> Pôle 2 : Gestion des Caisses &amp; Contrôle des Écarts
          </div>
          <div class="card-actions" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="CashModule.initOfficialRegisters()">
              <span>⚡</span> Initialiser les Caisses (0 F)
            </button>
            <button class="btn btn-primary btn-sm" onclick="CashModule.openRegisterModal()">
              <span>➕</span> Ouvrir une Caisse
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner info" style="margin-bottom: 1.25rem;">
            <div>
              💡 <strong>Gestion et Contrôle des Caisses :</strong> 
              Créez vos caisses selon vos besoins réels. Le solde initial est libre (peut être <strong>0 F</strong>). 
              Vous pouvez à tout moment <strong>modifier</strong> les paramètres d'une caisse, <strong>gérer ou supprimer ses mouvements</strong>, ou <strong>supprimer</strong> une caisse erronée.
            </div>
          </div>

          <div class="table-responsive" id="cashRegistersTableContainer">
            <div class="empty-state">
              <div class="empty-icon">💵</div>
              <div class="empty-title">Chargement des caisses...</div>
            </div>
          </div>
        </div>
      </div>
    `;

    await this.loadData();
  },

  async loadData() {
    const client = SupabaseClient.client;

    try {
      if (client) {
        const { data: registers, error } = await client
          .from('cash_registers')
          .select(`
            id, name, initial_amount_f, opened_at, closed_at, expected_amount_f, counted_amount_f, variance_f, status, stand_id, cashier_id,
            stand:stands(id, name, color_name, color_hex),
            cashier:members(id, first_name, last_name)
          `)
          .order('name', { ascending: true });

        if (!error && registers) {
          this.registers = registers;
        }
      }
    } catch (e) {
      console.warn('[CashModule Error]', e);
    }

    // Récupération locale de secours et nettoyage des vieux placeholders factices
    if (!this.registers || this.registers.length === 0) {
      const stored = localStorage.getItem('kermesse_cash_registers');
      if (stored) {
        try {
          let parsed = JSON.parse(stored);
          // Filtrer les faux placeholders 'reg-1', 'reg-2' avec 20000 F qui auraient été injectés
          parsed = parsed.filter(r => !(typeof r.id === 'string' && r.id.startsWith('reg-') && r.initial_amount_f === 20000 && !r.created_at && !r.opened_by));
          if (parsed.length > 0) {
            this.registers = parsed;
          } else {
            this.registers = [];
            localStorage.removeItem('kermesse_cash_registers');
          }
        } catch (e) {
          this.registers = [];
        }
      } else {
        this.registers = [];
      }
    }

    this.renderRegisters(this.registers);
  },

  async initOfficialRegisters() {
    const officialNames = [
      'Caisse 1 — Entrée & Accueil Visiteurs',
      'Caisse 2 — Vente Tickets Jeux & Stands',
      'Caisse 3 — Change & Jetons de Monnaie',
      'Caisse 4 — Restauration & Buvette (Optionnelle)'
    ];

    const client = SupabaseClient.client;
    let added = 0;

    for (const name of officialNames) {
      const exists = this.registers.some(r => r.name.toLowerCase().includes(name.substring(0, 8).toLowerCase()));
      if (!exists) {
        let newId = 'reg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4);

        if (client) {
          try {
            const { data } = await client.from('cash_registers').insert([{
              name,
              initial_amount_f: 0, // Solde initial à 0 F (aucun montant fictif)
              status: 'open'
            }]).select();
            if (data && data[0]) newId = data[0].id;
          } catch (e) {}
        }

        const newReg = {
          id: newId,
          name,
          initial_amount_f: 0,
          status: 'open',
          opened_at: new Date().toISOString()
        };

        this.registers.push(newReg);
        added++;
      }
    }

    localStorage.setItem('kermesse_cash_registers', JSON.stringify(this.registers));
    if (added > 0) {
      Notify.success(`${added} caisse(s) officielle(s) initialisée(s) avec un solde initial de 0 F.`);
    } else {
      Notify.info('Les caisses officielles sont déjà présentes.');
    }
    this.renderRegisters(this.registers);
  },

  renderRegisters(registers) {
    const container = document.getElementById('cashRegistersTableContainer');
    if (!container) return;

    if (!registers || registers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💵</div>
          <div class="empty-title">Aucune caisse enregistrée</div>
          <div class="empty-desc">Créez votre première caisse ou initialisez les caisses officielles sans solde de départ (0 F).</div>
          <div style="display: flex; gap: 0.5rem; justify-content: center; margin-top: 1rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="CashModule.openRegisterModal()">
              <span>➕</span> Ouvrir une Caisse
            </button>
            <button class="btn btn-secondary" onclick="CashModule.initOfficialRegisters()">
              <span>⚡</span> Initialiser les Caisses Officielles (0 F)
            </button>
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom de Caisse</th>
            <th>Type / Rôle</th>
            <th>Caissier Attitré</th>
            <th>Fond Initial</th>
            <th>Statut</th>
            <th>Comptage &amp; Écart</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${registers.map(r => {
            const isOpen = r.status === 'open';

            let roleBadge = '<span class="badge badge-gray">Caisse Stand</span>';
            if (r.name.includes('Caisse 1')) roleBadge = '<span class="badge badge-success">🎟️ Caisse 1 : Entrée</span>';
            if (r.name.includes('Caisse 2')) roleBadge = '<span class="badge badge-primary">🎯 Caisse 2 : Jeux</span>';
            if (r.name.includes('Caisse 3')) roleBadge = '<span class="badge badge-warning">🪙 Caisse 3 : Monnaie &amp; Jetons</span>';
            if (r.name.includes('Caisse 4')) roleBadge = '<span class="badge" style="background: #fef3c7; color: #b45309;">🍔 Caisse 4 : Restauration</span>';

            const cashierName = r.cashier 
              ? `${r.cashier.first_name} ${r.cashier.last_name}` 
              : '<span style="color: var(--gray-400);">Non assigné</span>';

            const initF = r.initial_amount_f || 0;

            return `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td>${roleBadge}</td>
                <td><strong>${cashierName}</strong></td>
                <td>${initF > 0 ? `${initF.toLocaleString()} ${KermesseConfig.currency}` : '<span style="color: var(--gray-500);">0 F (aucun)</span>'}</td>
                <td>
                  ${isOpen ? '<span class="badge badge-success">Ouverte</span>' : '<span class="badge badge-gray">Clôturée</span>'}
                </td>
                <td>
                  ${!isOpen ? `
                    <div>Compté : <strong>${(r.counted_amount_f || 0).toLocaleString()} F</strong></div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: ${r.variance_f < 0 ? 'var(--danger)' : (r.variance_f > 0 ? 'var(--success)' : 'var(--gray-500)')};">
                      Écart : ${r.variance_f > 0 ? '+' : ''}${(r.variance_f || 0).toLocaleString()} ${KermesseConfig.currency}
                    </div>
                  ` : '<span style="color: var(--info); font-size: 0.8rem;">En cours d\'opération</span>'}
                </td>
                <td style="text-align: right; white-space: nowrap;">
                  <button class="btn btn-secondary btn-sm" onclick="CashModule.openMovementsModal('${r.id}', '${r.name.replace(/'/g, "\\'")}')" title="Voir les mouvements de cette caisse">📋 Mouvements</button>
                  <button class="btn btn-secondary btn-sm" onclick="CashModule.openEditRegisterModal('${r.id}')" title="Modifier cette caisse" style="margin-left: 0.3rem;">✏️ Modifier</button>
                  ${isOpen ? `
                    <button class="btn btn-primary btn-sm" onclick="CashModule.openCloseRegisterModal('${r.id}', '${r.name.replace(/'/g, "\\'")}', ${initF})" title="Clôturer cette caisse" style="margin-left: 0.3rem;">🔒 Clôturer</button>
                  ` : ''}
                  <button class="btn btn-danger btn-sm" onclick="CashModule.deleteRegister('${r.id}', '${r.name.replace(/'/g, "\\'")}')" title="Supprimer cette caisse" style="margin-left: 0.3rem;">🗑️</button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  async openRegisterModal() {
    const client = SupabaseClient.client;
    let stands = [];
    let members = [];

    if (client) {
      try {
        const { data: s } = await client.from('stands').select('id, name');
        const { data: m } = await client.from('members').select('id, first_name, last_name');
        stands = s || [];
        members = m || [];
      } catch (e) {}
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Ouverture d'une Caisse</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="openRegisterForm">
            <div class="form-group">
              <label>Nom ou Désignation de la Caisse *</label>
              <select id="regPresetSelect" class="form-control" onchange="
                if (this.value) document.getElementById('regName').value = this.value;
              ">
                <option value="">-- Choisir un modèle ou saisir librement --</option>
                <option value="Caisse 1 — Entrée &amp; Accueil Visiteurs">🎟️ Caisse 1 — Entrée &amp; Accueil Visiteurs</option>
                <option value="Caisse 2 — Vente Tickets Jeux &amp; Stands">🎯 Caisse 2 — Vente Tickets Jeux &amp; Stands</option>
                <option value="Caisse 3 — Change &amp; Jetons de Monnaie">🪙 Caisse 3 — Change &amp; Jetons de Monnaie</option>
                <option value="Caisse 4 — Restauration &amp; Buvette (Optionnelle)">🍔 Caisse 4 — Restauration &amp; Buvette</option>
              </select>
              <input type="text" id="regName" class="form-control" style="margin-top: 6px;" required placeholder="Ex: Caisse 2 — Vente Tickets Jeux">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand rattaché (optionnel)</label>
                <select id="regStand" class="form-control">
                  <option value="">Caisse Centrale / Entrée</option>
                  ${stands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Caissier responsable</label>
                <select id="regCashier" class="form-control">
                  <option value="">Choisir le caissier...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Fond de Caisse Initial (${KermesseConfig.currency})</label>
              <input type="number" id="regInitial" class="form-control" value="0" min="0" step="100" placeholder="0 (aucun solde initial)">
              <div class="form-hint">Laissez 0 F s'il n'y a pas de fond de monnaie de départ.</div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmOpenRegBtn">Ouvrir la caisse</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmOpenRegBtn').onclick = async () => {
      const name = document.getElementById('regName').value.trim();
      const standId = document.getElementById('regStand').value || null;
      const cashierId = document.getElementById('regCashier').value || null;
      const initialRaw = document.getElementById('regInitial').value;
      const initial = initialRaw === '' || isNaN(parseInt(initialRaw, 10)) ? 0 : Math.max(0, parseInt(initialRaw, 10));
      const user = Auth.getCurrentUser();

      if (!name) {
        Notify.error('Veuillez renseigner le nom de la caisse.');
        return;
      }

      const client = SupabaseClient.client;
      let newId = 'reg-' + Date.now();

      if (client) {
        const { data, error } = await client.from('cash_registers').insert([{
          name,
          stand_id: standId,
          cashier_id: cashierId,
          initial_amount_f: initial,
          opened_by: user ? user.id : null,
          status: 'open'
        }]).select();

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }
        if (data && data[0]) newId = data[0].id;
      }

      const newReg = {
        id: newId,
        name,
        stand_id: standId,
        cashier_id: cashierId,
        initial_amount_f: initial,
        status: 'open',
        opened_at: new Date().toISOString()
      };

      CashModule.registers.push(newReg);
      localStorage.setItem('kermesse_cash_registers', JSON.stringify(CashModule.registers));

      AuditLogger.log('OUVERTURE_CAISSE', 'cash_register', newId, `Ouverture de la caisse ${name} avec un fond initial de ${initial} F`);
      Notify.success(`Caisse ${name} ouverte avec succès.`);
      close();
      CashModule.render(document.getElementById('mainContent'));
    };
  },

  async openEditRegisterModal(regId) {
    const reg = this.registers.find(r => r.id === regId);
    if (!reg) return;

    const client = SupabaseClient.client;
    let stands = [];
    let members = [];

    if (client) {
      try {
        const { data: s } = await client.from('stands').select('id, name');
        const { data: m } = await client.from('members').select('id, first_name, last_name');
        stands = s || [];
        members = m || [];
      } catch (e) {}
    }

    const currentStandId = reg.stand_id || (reg.stand ? reg.stand.id : '');
    const currentCashierId = reg.cashier_id || (reg.cashier ? reg.cashier.id : '');

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier la Caisse</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editRegisterForm">
            <div class="form-group">
              <label>Nom ou Désignation de la Caisse *</label>
              <input type="text" id="editRegName" class="form-control" value="${reg.name.replace(/"/g, '&quot;')}" required>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand rattaché (optionnel)</label>
                <select id="editRegStand" class="form-control">
                  <option value="">Caisse Centrale / Entrée</option>
                  ${stands.map(s => `<option value="${s.id}" ${currentStandId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Caissier responsable</label>
                <select id="editRegCashier" class="form-control">
                  <option value="">Choisir le caissier...</option>
                  ${members.map(m => `<option value="${m.id}" ${currentCashierId === m.id ? 'selected' : ''}>${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Fond de Caisse Initial (${KermesseConfig.currency})</label>
                <input type="number" id="editRegInitial" class="form-control" value="${reg.initial_amount_f || 0}" min="0" step="100">
                <div class="form-hint">Peut être 0 F ou tout autre montant de monnaie.</div>
              </div>
              <div class="form-group">
                <label>Statut de la Caisse</label>
                <select id="editRegStatus" class="form-control">
                  <option value="open" ${reg.status === 'open' ? 'selected' : ''}>🟢 Ouverte (En opération)</option>
                  <option value="closed" ${reg.status === 'closed' ? 'selected' : ''}>🔴 Clôturée</option>
                </select>
              </div>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="confirmEditRegBtn">Enregistrer les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmEditRegBtn').onclick = async () => {
      const name = document.getElementById('editRegName').value.trim();
      const standId = document.getElementById('editRegStand').value || null;
      const cashierId = document.getElementById('editRegCashier').value || null;
      const initialRaw = document.getElementById('editRegInitial').value;
      const initial = initialRaw === '' || isNaN(parseInt(initialRaw, 10)) ? 0 : Math.max(0, parseInt(initialRaw, 10));
      const status = document.getElementById('editRegStatus').value;

      if (!name) {
        Notify.error('Le nom de la caisse ne peut pas être vide.');
        return;
      }

      if (client) {
        try {
          const { error } = await client.from('cash_registers').update({
            name,
            stand_id: standId,
            cashier_id: cashierId,
            initial_amount_f: initial,
            status
          }).eq('id', regId);

          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
        } catch (e) {
          console.warn('[Edit Register DB Error]', e);
        }
      }

      // Mise à jour locale
      reg.name = name;
      reg.stand_id = standId;
      reg.cashier_id = cashierId;
      reg.initial_amount_f = initial;
      reg.status = status;

      const sObj = stands.find(s => s.id === standId);
      if (sObj) reg.stand = sObj; else delete reg.stand;
      const mObj = members.find(m => m.id === cashierId);
      if (mObj) reg.cashier = mObj; else delete reg.cashier;

      localStorage.setItem('kermesse_cash_registers', JSON.stringify(CashModule.registers));
      AuditLogger.log('MODIFICATION_CAISSE', 'cash_register', regId, `Modification de la caisse ${name} (Fond: ${initial} F, Statut: ${status})`);
      Notify.success(`Caisse « ${name} » modifiée avec succès.`);
      close();
      CashModule.render(document.getElementById('mainContent'));
    };
  },

  async deleteRegister(regId, regName) {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer définitivement la caisse « ${regName} » ?\n\n⚠️ Toutes les opérations et mouvements financiers de cette caisse seront également nettoyés.`)) {
      return;
    }

    const client = SupabaseClient.client;
    if (client) {
      try {
        // 1. Supprimer mouvements associés
        await client.from('cash_movements').delete().eq('cash_register_id', regId);
        // 2. Supprimer dettes de jetons associées
        await client.from('token_debts').delete().eq('cash_register_id', regId);
        // 3. Dissocier les ventes de tickets rattachées pour éviter les contraintes
        await client.from('ticket_sales').delete().eq('cash_register_id', regId);
        // 4. Supprimer la caisse
        const { error } = await client.from('cash_registers').delete().eq('id', regId);
        if (error) {
          console.warn('[Delete Register Error]', error);
        }
      } catch (e) {
        console.warn('[Delete Register Exception]', e);
      }
    }

    // Mise à jour locale
    CashModule.registers = CashModule.registers.filter(r => r.id !== regId);
    localStorage.setItem('kermesse_cash_registers', JSON.stringify(CashModule.registers));

    AuditLogger.log('SUPPRESSION_CAISSE', 'cash_register', regId, `Suppression de la caisse ${regName}`);
    Notify.success(`Caisse « ${regName} » supprimée.`);
    CashModule.render(document.getElementById('mainContent'));
  },

  async openMovementsModal(regId, regName) {
    const client = SupabaseClient.client;
    let movements = [];

    if (client) {
      try {
        const { data } = await client
          .from('cash_movements')
          .select('id, type, amount_f, reason, created_at, user:app_users(login)')
          .eq('cash_register_id', regId)
          .order('created_at', { ascending: false });
        movements = data || [];
      } catch (e) {}
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 720px;">
        <div class="modal-header">
          <h3>Mouvements Financiers : ${regName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName.replace(/'/g, "\\'")}', 'apport')">
              <span>➕</span> Apport de Monnaie
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName.replace(/'/g, "\\'")}', 'depense_autorisee')">
              <span>💸</span> Dépense Autorisée
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName.replace(/'/g, "\\'")}', 'remboursement_jeton')">
              <span>🪙</span> Sortie Remboursement Jeton
            </button>
          </div>

          <div style="max-height: 320px; overflow-y: auto;">
            ${movements.length > 0 ? `
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Motif</th>
                    <th style="text-align: right;">Montant</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${movements.map(m => {
                    const isPositive = m.amount_f >= 0;
                    return `
                      <tr>
                        <td style="font-size: 0.8rem; color: var(--gray-500);">${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td><span class="badge ${isPositive ? 'badge-success' : 'badge-danger'}">${m.type}</span></td>
                        <td>${m.reason}</td>
                        <td style="text-align: right; font-weight: 700; color: ${isPositive ? 'var(--success)' : 'var(--danger)'};">
                          ${isPositive ? '+' : ''}${m.amount_f.toLocaleString()} F
                        </td>
                        <td style="text-align: right; white-space: nowrap;">
                          <button class="btn btn-secondary btn-sm" onclick="CashModule.openEditMovementModal('${m.id}', '${regId}', '${regName.replace(/'/g, "\\'")}', ${m.amount_f}, '${(m.reason || '').replace(/'/g, "\\'")}', '${m.type}')" title="Modifier ce mouvement">✏️</button>
                          <button class="btn btn-danger btn-sm" onclick="CashModule.deleteMovement('${m.id}', '${regId}', '${regName.replace(/'/g, "\\'")}', ${m.amount_f})" title="Supprimer ce mouvement" style="margin-left: 0.25rem;">🗑️</button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : '<p style="color: var(--gray-500); text-align: center; padding: 1.5rem 0;">Aucun mouvement enregistré pour cette caisse.</p>'}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Fermer</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;
  },

  addCashMovementModal(regId, regName, type) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.style.zIndex = '1100';

    let title = 'Nouveau Mouvement de Caisse';
    let isNegative = true;
    if (type === 'apport') { title = 'Apport de Monnaie / Espèces'; isNegative = false; }
    if (type === 'remboursement_jeton') { title = 'Remboursement contre Jeton de Monnaie'; }
    if (type === 'depense_autorisee') { title = 'Dépense Autorisée en Caisse'; }

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="cashMvtForm">
            <div class="form-group">
              <label>Montant (${KermesseConfig.currency}) *</label>
              <input type="number" id="mvtAmount" class="form-control" required min="1" step="50" placeholder="Ex: 5000">
            </div>
            <div class="form-group">
              <label>Motif / Justification *</label>
              <input type="text" id="mvtReason" class="form-control" required placeholder="Ex: Achat d'urgence pain/glace, Remise monnaie...">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveMvtBtn">Enregistrer le mouvement</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveMvtBtn').onclick = async () => {
      const amountRaw = parseInt(document.getElementById('mvtAmount').value, 10);
      const reason = document.getElementById('mvtReason').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(amountRaw) || amountRaw <= 0 || !reason) {
        Notify.error('Veuillez spécifier un montant valide et un motif.');
        return;
      }

      const finalAmount = isNegative ? -Math.abs(amountRaw) : Math.abs(amountRaw);
      const client = SupabaseClient.client;

      if (client) {
        const { error } = await client.from('cash_movements').insert([{
          cash_register_id: regId,
          type,
          amount_f: finalAmount,
          reason,
          user_id: user ? user.id : null
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('MOUVEMENT_CAISSE', 'cash_register', regId, `${type} de ${finalAmount} F sur ${regName} (${reason})`);
        Notify.success('Mouvement de caisse enregistré.');
        close();
        document.querySelectorAll('.modal-backdrop.open').forEach(m => m.remove());
        CashModule.openMovementsModal(regId, regName);
      }
    };
  },

  openEditMovementModal(mvtId, regId, regName, currentAmount, currentReason, currentType) {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.style.zIndex = '1200';

    const absAmount = Math.abs(currentAmount);

    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Modifier le Mouvement de Caisse</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="editMvtForm">
            <div class="form-group">
              <label>Type d'opération</label>
              <select id="editMvtType" class="form-control">
                <option value="apport" ${currentType === 'apport' ? 'selected' : ''}>➕ Apport de Monnaie / Espèces (+)</option>
                <option value="depense_autorisee" ${currentType === 'depense_autorisee' ? 'selected' : ''}>💸 Dépense Autorisée (-)</option>
                <option value="remboursement_jeton" ${currentType === 'remboursement_jeton' ? 'selected' : ''}>🪙 Sortie Remboursement Jeton (-)</option>
                <option value="vente" ${currentType === 'vente' ? 'selected' : ''}>🎟️ Vente (+)</option>
                <option value="correction" ${currentType === 'correction' ? 'selected' : ''}>⚙️ Correction / Ajustement</option>
              </select>
            </div>
            <div class="form-group">
              <label>Montant (${KermesseConfig.currency}) *</label>
              <input type="number" id="editMvtAmount" class="form-control" required min="1" step="50" value="${absAmount}">
            </div>
            <div class="form-group">
              <label>Motif / Justification *</label>
              <input type="text" id="editMvtReason" class="form-control" required value="${(currentReason || '').replace(/"/g, '&quot;')}">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveEditMvtBtn">Enregistrer les modifications</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveEditMvtBtn').onclick = async () => {
      const amountRaw = parseInt(document.getElementById('editMvtAmount').value, 10);
      const reason = document.getElementById('editMvtReason').value.trim();
      const type = document.getElementById('editMvtType').value;

      if (isNaN(amountRaw) || amountRaw <= 0 || !reason) {
        Notify.error('Veuillez spécifier un montant valide et un motif.');
        return;
      }

      const isSub = (type === 'depense_autorisee' || type === 'remboursement_jeton');
      const finalAmount = isSub ? -Math.abs(amountRaw) : Math.abs(amountRaw);

      const client = SupabaseClient.client;
      if (client) {
        try {
          const { error } = await client.from('cash_movements').update({
            type,
            amount_f: finalAmount,
            reason
          }).eq('id', mvtId);

          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
        } catch (e) {
          console.warn('[Edit Movement Error]', e);
        }
      }

      AuditLogger.log('MODIFICATION_MOUVEMENT', 'cash_movement', mvtId, `Modification mouvement sur ${regName} : ${type} de ${finalAmount} F (${reason})`);
      Notify.success('Mouvement mis à jour avec succès.');
      close();
      document.querySelectorAll('.modal-backdrop.open').forEach(m => m.remove());
      CashModule.openMovementsModal(regId, regName);
    };
  },

  async deleteMovement(mvtId, regId, regName, amount) {
    if (!confirm(`Voulez-vous supprimer définitivement ce mouvement de ${amount} F ?`)) return;

    const client = SupabaseClient.client;
    if (client) {
      try {
        const { error } = await client.from('cash_movements').delete().eq('id', mvtId);
        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }
      } catch (e) {
        console.warn('[Delete Movement Error]', e);
      }
    }

    AuditLogger.log('SUPPRESSION_MOUVEMENT', 'cash_movement', mvtId, `Suppression mouvement de ${amount} F sur ${regName}`);
    Notify.success('Mouvement supprimé.');
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.remove());
    CashModule.openMovementsModal(regId, regName);
  },

  async openCloseRegisterModal(regId, regName, initialAmount) {
    const client = SupabaseClient.client;
    let sumMovements = 0;

    if (client) {
      try {
        const { data: movements } = await client
          .from('cash_movements')
          .select('amount_f')
          .eq('cash_register_id', regId);

        if (movements) {
          movements.forEach(m => sumMovements += m.amount_f);
        }
      } catch (e) {}
    }

    const expectedAmount = (initialAmount || 0) + sumMovements;

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Clôture de Caisse : ${regName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div style="background: var(--gray-50); padding: 1.25rem; border-radius: var(--radius-md); margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Fond initial :</span>
              <strong>${(initialAmount || 0).toLocaleString()} ${KermesseConfig.currency}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Flux net (recettes - sorties) :</span>
              <strong>${sumMovements > 0 ? '+' : ''}${sumMovements.toLocaleString()} ${KermesseConfig.currency}</strong>
            </div>
            <hr style="margin: 0.5rem 0; border: none; border-top: 1px solid var(--gray-300);">
            <div style="display: flex; justify-content: space-between; font-size: 1.05rem;">
              <span><strong>Montant Théorique Attendu :</strong></span>
              <span style="color: var(--primary); font-weight: 800; font-size: 1.2rem;">
                ${expectedAmount.toLocaleString()} ${KermesseConfig.currency}
              </span>
            </div>
          </div>

          <form id="closeRegForm">
            <div class="form-group">
              <label>Montant Réellement Compté dans le tiroir (${KermesseConfig.currency}) *</label>
              <input type="number" id="countedAmount" class="form-control" style="font-size: 1.2rem; font-weight: 700;" required oninput="CashModule.calcVariance(${expectedAmount})">
            </div>

            <div style="margin-bottom: 1.25rem; padding: 0.75rem; border-radius: var(--radius-md); background: var(--gray-100);" id="varianceDisplayBox">
              <span>Écart constaté : </span>
              <strong id="varianceDisplay">-</strong>
            </div>

            <div class="form-group">
              <label>Remarques / Justification de clôture</label>
              <textarea id="closingNotes" class="form-control" rows="2" placeholder="Justification en cas d'écart ou remarques"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-danger" id="confirmCloseRegBtn">Valider &amp; Clôturer la caisse</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmCloseRegBtn').onclick = async () => {
      const countedRaw = document.getElementById('countedAmount').value;
      const counted = parseInt(countedRaw, 10);
      const notes = document.getElementById('closingNotes').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(counted)) {
        Notify.error('Veuillez renseigner le montant réellement compté.');
        return;
      }

      const variance = counted - expectedAmount;

      if (client) {
        try {
          const { error } = await client
            .from('cash_registers')
            .update({
              counted_amount_f: counted,
              expected_amount_f: expectedAmount,
              variance_f: variance,
              status: 'closed',
              closed_at: new Date().toISOString(),
              closed_by: user ? user.id : null,
              closing_notes: notes
            })
            .eq('id', regId);

          if (error) {
            Notify.error('Erreur: ' + error.message);
            return;
          }
        } catch (e) {
          console.warn('[Close Register DB Error]', e);
        }
      }

      // Mise à jour locale
      const reg = CashModule.registers.find(r => r.id === regId);
      if (reg) {
        reg.status = 'closed';
        reg.counted_amount_f = counted;
        reg.expected_amount_f = expectedAmount;
        reg.variance_f = variance;
        reg.closed_at = new Date().toISOString();
        reg.closing_notes = notes;
        localStorage.setItem('kermesse_cash_registers', JSON.stringify(CashModule.registers));
      }

      AuditLogger.log('CLOTURE_CAISSE', 'cash_register', regId, `Clôture de ${regName} : Attendu ${expectedAmount} F, Compté ${counted} F, Écart ${variance} F`);
      Notify.success(`Caisse ${regName} clôturée avec succès.`);
      close();
      CashModule.render(document.getElementById('mainContent'));
    };
  },

  calcVariance(expected) {
    const counted = parseInt(document.getElementById('countedAmount').value, 10);
    const disp = document.getElementById('varianceDisplay');
    const box = document.getElementById('varianceDisplayBox');

    if (isNaN(counted)) {
      disp.textContent = '-';
      box.style.background = 'var(--gray-100)';
      return;
    }

    const variance = counted - expected;
    if (variance === 0) {
      disp.textContent = '0 F (Caisse Parfaite ✅)';
      disp.style.color = 'var(--success)';
      box.style.background = 'var(--success-light, #dcfce7)';
    } else if (variance > 0) {
      disp.textContent = `+${variance.toLocaleString()} F (Excédent de caisse 📈)`;
      disp.style.color = '#1e40af';
      box.style.background = '#dbeafe';
    } else {
      disp.textContent = `${variance.toLocaleString()} F (Déficit de caisse ⚠️)`;
      disp.style.color = 'var(--danger)';
      box.style.background = 'var(--danger-light, #fee2e2)';
    }
  }
};

window.CashModule = CashModule;
