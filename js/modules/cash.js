/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : CAISSES (CONTRÔLE FINANCIER, ÉCARTS & CLÔTURE)
 * 
 * Suivi strict et traçabilité des fonds de caisse :
 * - Fond initial
 * - Ventes (+)
 * - Remboursements de jetons (-)
 * - Dépenses autorisées (-)
 * - Montant attendu vs Montant réellement compté
 * - Calcul automatique et journalisation de l'écart
 */

const CashModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>💵</span> Gestion des Caisses & Contrôle des Écarts
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="CashModule.openRegisterModal()">
              <span>🔓</span> Ouvrir une Caisse
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="cashRegistersTableContainer">
            <div class="empty-state">
              <div class="empty-icon">💵</div>
              <div class="empty-title">Aucune caisse enregistrée</div>
              <div class="empty-desc">Ouvrez une caisse avec son fond initial pour un stand et désignez son caissier responsable.</div>
              <button class="btn btn-primary" onclick="CashModule.openRegisterModal()">
                <span>🔓</span> Ouvrir la première caisse
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
      const { data: registers, error } = await client
        .from('cash_registers')
        .select(`
          id, name, initial_amount_f, opened_at, closed_at, expected_amount_f, counted_amount_f, variance_f, status,
          stand:stands(name, color_name, color_hex),
          cashier:members(first_name, last_name)
        `)
        .order('opened_at', { ascending: false });

      if (error) throw error;
      this.renderRegisters(registers || []);
    } catch (e) {
      console.error('[CashModule Error]', e);
    }
  },

  renderRegisters(registers) {
    const container = document.getElementById('cashRegistersTableContainer');
    if (!container) return;

    if (!registers || registers.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">💵</div>
          <div class="empty-title">Aucune caisse enregistrée</div>
          <div class="empty-desc">Ouvrez une caisse avec son fond initial pour un stand et désignez son caissier responsable.</div>
          <button class="btn btn-primary" onclick="CashModule.openRegisterModal()">
            <span>🔓</span> Ouvrir la première caisse
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Nom de Caisse</th>
            <th>Stand</th>
            <th>Caissier Attitré</th>
            <th>Fond Initial</th>
            <th>Statut</th>
            <th>Comptage & Écart</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${registers.map(r => {
            const isOpen = r.status === 'open';

            return `
              <tr>
                <td><strong>${r.name}</strong></td>
                <td>
                  ${r.stand ? `
                    <span class="stand-tag" style="background-color: ${r.stand.color_hex}15; color: ${r.stand.color_hex}; border-color: ${r.stand.color_hex}; font-size: 0.8rem;">
                      ${r.stand.name}
                    </span>
                  ` : '<span style="color: var(--gray-400);">Caisse Générale</span>'}
                </td>
                <td>${r.cashier ? `<strong>${r.cashier.first_name} ${r.cashier.last_name}</strong>` : '<span style="color: var(--gray-400);">Non assigné</span>'}</td>
                <td>${r.initial_amount_f.toLocaleString()} ${KermesseConfig.currency}</td>
                <td>
                  ${isOpen ? '<span class="badge badge-success">Ouverte</span>' : '<span class="badge badge-gray">Clôturée</span>'}
                </td>
                <td>
                  ${!isOpen ? `
                    <div>Compté : <strong>${r.counted_amount_f.toLocaleString()} F</strong></div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: ${r.variance_f < 0 ? 'var(--danger)' : (r.variance_f > 0 ? 'var(--success)' : 'var(--gray-500)')};">
                      Écart : ${r.variance_f > 0 ? '+' : ''}${r.variance_f.toLocaleString()} ${KermesseConfig.currency}
                    </div>
                  ` : '<span style="color: var(--info); font-size: 0.8rem;">En cours d\'opération</span>'}
                </td>
                <td style="text-align: right;">
                  <button class="btn btn-secondary btn-sm" onclick="CashModule.openMovementsModal('${r.id}', '${r.name}')" title="Voir les mouvements">Mouvements</button>
                  ${isOpen ? `
                    <button class="btn btn-primary btn-sm" onclick="CashModule.openCloseRegisterModal('${r.id}', '${r.name}', ${r.initial_amount_f})" style="margin-left: 0.35rem;">Clôturer</button>
                  ` : ''}
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
      const { data: s } = await client.from('stands').select('id, name');
      const { data: m } = await client.from('members').select('id, first_name, last_name');
      stands = s || [];
      members = m || [];
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
              <input type="text" id="regName" class="form-control" required placeholder="Ex: Caisse Stand Rouge 1, Caisse Entrée...">
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Stand rattaché</label>
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
              <label>Fond de Caisse Initial (${KermesseConfig.currency}) *</label>
              <input type="number" id="regInitial" class="form-control" value="20000" min="0" step="500" required>
              <div class="form-hint">Montant en espèces déposé au démarrage pour rendre la monnaie</div>
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
      const initial = parseInt(document.getElementById('regInitial').value, 10);
      const user = Auth.getCurrentUser();

      if (!name || isNaN(initial)) {
        Notify.error('Veuillez remplir le nom et le fond initial.');
        return;
      }

      if (client) {
        const { error } = await client.from('cash_registers').insert([{
          name,
          stand_id: standId,
          cashier_id: cashierId,
          initial_amount_f: initial,
          opened_by: user ? user.id : null,
          status: 'open'
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('OUVERTURE_CAISSE', 'cash_register', null, `Ouverture de la caisse ${name} avec un fond initial de ${initial} F par ${user?.login}`);
        Notify.success(`Caisse ${name} ouverte avec succès.`);
        close();
        CashModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async openMovementsModal(regId, regName) {
    const client = SupabaseClient.client;
    if (!client) return;

    const { data: movements } = await client
      .from('cash_movements')
      .select('id, type, amount_f, reason, created_at, user:app_users(login)')
      .eq('cash_register_id', regId)
      .order('created_at', { ascending: false });

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>Mouvements financiers : ${regName}</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <div style="margin-bottom: 1rem; display: flex; gap: 0.5rem;">
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName}', 'depense_autorisee')">
              <span>➖</span> Dépense
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName}', 'remboursement_jeton')">
              <span>🪙</span> Remboursement Jeton
            </button>
            <button class="btn btn-secondary btn-sm" onclick="CashModule.addCashMovementModal('${regId}', '${regName}', 'apport')">
              <span>➕</span> Apport Monnaie
            </button>
          </div>

          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Type</th>
                  <th>Montant</th>
                  <th>Motif</th>
                  <th>Auteur</th>
                </tr>
              </thead>
              <tbody>
                ${(movements && movements.length > 0) ? movements.map(m => `
                  <tr>
                    <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                      ${new Date(m.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td><span class="badge ${m.amount_f >= 0 ? 'badge-success' : 'badge-danger'}">${m.type}</span></td>
                    <td><strong>${m.amount_f > 0 ? '+' : ''}${m.amount_f.toLocaleString()} F</strong></td>
                    <td>${m.reason}</td>
                    <td>${m.user ? m.user.login : '-'}</td>
                  </tr>
                `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--gray-400);">Aucun mouvement pour le moment.</td></tr>'}
              </tbody>
            </table>
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
              <input type="text" id="mvtReason" class="form-control" required placeholder="Ex: Achat d'urgence pain, Remise 2x200F jetons...">
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

        AuditLogger.log('MOUVEMENT_CAISSE', 'cash_register', regId, `${type} de ${finalAmount} F sur ${regName} (${reason}) par ${user?.login}`);
        Notify.success('Mouvement de caisse enregistré.');
        close();
        document.querySelector('.modal-backdrop.open')?.remove();
        CashModule.openMovementsModal(regId, regName);
      }
    };
  },

  async openCloseRegisterModal(regId, regName, initialAmount) {
    const client = SupabaseClient.client;
    if (!client) return;

    // Calculer le montant attendu à partir des mouvements
    const { data: movements } = await client
      .from('cash_movements')
      .select('amount_f')
      .eq('cash_register_id', regId);

    let sumMovements = 0;
    if (movements) {
      movements.forEach(m => sumMovements += m.amount_f);
    }
    const expectedAmount = initialAmount + sumMovements;

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
              <strong>${initialAmount.toLocaleString()} ${KermesseConfig.currency}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
              <span>Flux net (ventes - sorties) :</span>
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
          <button class="btn btn-danger" id="confirmCloseRegBtn">Valider & Clôturer la caisse</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmCloseRegBtn').onclick = async () => {
      const counted = parseInt(document.getElementById('countedAmount').value, 10);
      const notes = document.getElementById('closingNotes').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(counted)) {
        Notify.error('Veuillez saisir le montant réellement compté.');
        return;
      }

      const variance = counted - expectedAmount;

      const { error } = await client.from('cash_registers').update({
        closed_at: new Date().toISOString(),
        closed_by: user ? user.id : null,
        expected_amount_f: expectedAmount,
        counted_amount_f: counted,
        variance_f: variance,
        status: 'closed',
        closing_notes: notes
      }).eq('id', regId);

      if (error) {
        Notify.error('Erreur: ' + error.message);
        return;
      }

      // Si écart important, générer automatiquement un incident de caisse !
      if (variance !== 0) {
        await client.from('incidents').insert([{
          incident_number: 'INC-CASH-' + Math.floor(1000 + Math.random() * 9000),
          type: 'probleme_caisse',
          title: `Écart de caisse sur ${regName} (${variance > 0 ? '+' : ''}${variance} F)`,
          description: `Lors de la clôture par ${user?.login}, montant attendu: ${expectedAmount} F, montant compté: ${counted} F. Écart: ${variance} F. Remarques: ${notes || 'Aucune'}`,
          severity: Math.abs(variance) > 5000 ? 'eleve' : 'moyen',
          status: 'ouvert',
          reported_by: user ? user.id : null
        }]);
      }

      AuditLogger.log('CLOTURE_CAISSE', 'cash_register', regId, `Clôture de la caisse ${regName}. Attendu: ${expectedAmount} F, Compté: ${counted} F, Écart: ${variance} F`);
      Notify.success(`Caisse ${regName} clôturée avec succès.`);
      close();
      CashModule.render(document.getElementById('mainContent'));
    };
  },

  calcVariance(expected) {
    const countedVal = document.getElementById('countedAmount').value;
    const counted = parseInt(countedVal, 10);
    const box = document.getElementById('varianceDisplay');
    if (isNaN(counted)) {
      box.textContent = '-';
      return;
    }
    const variance = counted - expected;
    box.textContent = `${variance > 0 ? '+' : ''}${variance.toLocaleString()} ${KermesseConfig.currency}`;
    box.style.color = variance < 0 ? 'var(--danger)' : (variance > 0 ? 'var(--success)' : 'var(--gray-800)');
  }
};

window.CashModule = CashModule;
