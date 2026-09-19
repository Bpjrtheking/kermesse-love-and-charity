/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : EMPRUNTS ET LOCATIONS DE MATÉRIEL
 * 
 * Module stratégique :
 * - Suivi précis du matériel emprunté auprès d'écoles, stades ou tiers
 * - Dates d'emprunt et dates impératives de retour
 * - Lieux de récupération et de restitution
 * - État au départ vs État au retour
 * - Alertes automatiques en cas de retard
 */

const LoansModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🤝</span> Gestion des Emprunts & Locations de Matériel
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="LoansModule.openCreateModal()">
              <span>➕</span> Nouvel Emprunt / Location
            </button>
          </div>
        </div>
        <div class="card-body">
          <div id="loansAlertsContainer" style="margin-bottom: 1.25rem;"></div>

          <div class="table-responsive" id="loansTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🤝</div>
              <div class="empty-title">Aucun emprunt en cours</div>
              <div class="empty-desc">Enregistrez les chaises, tentes ou sonos prêtées par les écoles et partenaires avec la date limite de restitution.</div>
              <button class="btn btn-primary" onclick="LoansModule.openCreateModal()">
                <span>➕</span> Enregistrer le premier emprunt
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
      const { data: loans, error } = await client
        .from('loans')
        .select(`
          id, quantity, pickup_location, return_location, pickup_date, expected_return_date, actual_return_date, departure_condition, return_condition, status, rental_cost_f, notes,
          material:materials(id, name),
          owner:material_owners(id, name, contact_person, phone),
          pickup_responsible:members!loans_pickup_responsible_id_fkey(id, first_name, last_name),
          current_responsible:members!loans_current_responsible_id_fkey(id, first_name, last_name)
        `)
        .order('expected_return_date', { ascending: true });

      if (error) throw error;
      this.renderTable(loans || []);
    } catch (e) {
      console.error('[LoansModule Error]', e);
    }
  },

  renderTable(loans) {
    const container = document.getElementById('loansTableContainer');
    const alertsBox = document.getElementById('loansAlertsContainer');
    if (!container) return;

    if (!loans || loans.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🤝</div>
          <div class="empty-title">Aucun emprunt en cours</div>
          <div class="empty-desc">Enregistrez les chaises, tentes ou sonos prêtées par les écoles et partenaires avec la date limite de restitution.</div>
          <button class="btn btn-primary" onclick="LoansModule.openCreateModal()">
            <span>➕</span> Enregistrer le premier emprunt
          </button>
        </div>
      `;
      if (alertsBox) alertsBox.innerHTML = '';
      return;
    }

    // Détection de retards
    const today = new Date().toISOString().split('T')[0];
    const overdue = loans.filter(l => l.status === 'en_cours' && l.expected_return_date < today);
    if (alertsBox && overdue.length > 0) {
      alertsBox.innerHTML = `
        <div class="alert-banner danger">
          <div>🚨 <strong>Date limite dépassée :</strong> ${overdue.length} emprunt(s) devaient déjà être restitués à leurs propriétaires !</div>
          <button class="btn btn-secondary btn-sm" onclick="App.navigateTo('returns')">Générer l'Itinéraire de Restitution</button>
        </div>
      `;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Matériel & Quantité</th>
            <th>Propriétaire & Contact</th>
            <th>Lieu Restitution</th>
            <th>Date Emprunt</th>
            <th>Retour Prévu</th>
            <th>Responsable Actuel</th>
            <th>Statut</th>
            <th style="text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${loans.map(l => {
            const isLate = l.status === 'en_cours' && l.expected_return_date < today;

            return `
              <tr>
                <td>
                  <strong>${l.material ? l.material.name : 'Matériel'}</strong>
                  <div><span class="badge badge-gray">${l.quantity} unité(s)</span></div>
                </td>
                <td>
                  <strong>${l.owner ? l.owner.name : 'Inconnu'}</strong>
                  <div style="font-size: 0.78rem; color: var(--gray-500);">
                    ${l.owner ? `${l.owner.contact_person || ''} ${l.owner.phone ? `(${l.owner.phone})` : ''}` : ''}
                  </div>
                </td>
                <td>${l.return_location}</td>
                <td>${new Date(l.pickup_date).toLocaleDateString('fr-FR')}</td>
                <td>
                  <span class="${isLate ? 'badge badge-danger' : ''}">
                    ${new Date(l.expected_return_date).toLocaleDateString('fr-FR')} ${isLate ? '⚠️ RETARD' : ''}
                  </span>
                </td>
                <td>${l.current_responsible ? `👤 ${l.current_responsible.first_name} ${l.current_responsible.last_name}` : '<span style="color: var(--gray-400);">-</span>'}</td>
                <td>
                  <span class="badge ${l.status === 'restitue' ? 'badge-success' : (l.status === 'en_cours' ? 'badge-warning' : 'badge-danger')}">
                    ${l.status}
                  </span>
                </td>
                <td style="text-align: right;">
                  ${l.status !== 'restitue' ? `
                    <button class="btn btn-success btn-sm" onclick="LoansModule.markReturned('${l.id}', '${l.material?.name}', ${l.quantity})">Restituer</button>
                  ` : '<span>✅ Clôturé</span>'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  async openCreateModal() {
    const client = SupabaseClient.client;
    let materials = [];
    let owners = [];
    let members = [];

    if (client) {
      const { data: mat } = await client.from('materials').select('id, name, quantity_total');
      const { data: ow } = await client.from('material_owners').select('id, name, address');
      const { data: mem } = await client.from('members').select('id, first_name, last_name');
      materials = mat || [];
      owners = ow || [];
      members = mem || [];
    }

    if (materials.length === 0 || owners.length === 0) {
      Notify.warning('Veuillez d\'abord enregistrer un matériel et un propriétaire.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog" style="max-width: 650px;">
        <div class="modal-header">
          <h3>Enregistrer un Emprunt ou une Location</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="createLoanForm">
            <div class="form-row">
              <div class="form-group">
                <label>Matériel Emprunté *</label>
                <select id="lnMaterial" class="form-control">
                  ${materials.map(m => `<option value="${m.id}">${m.name} (Dispo: ${m.quantity_total})</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité *</label>
                <input type="number" id="lnQty" class="form-control" value="10" min="1" required>
              </div>
            </div>

            <div class="form-group">
              <label>Propriétaire Prêteur / Loueur *</label>
              <select id="lnOwner" class="form-control" onchange="
                const selected = ${JSON.stringify(owners)}.find(o => o.id === this.value);
                if (selected && selected.address) {
                  document.getElementById('lnReturnLoc').value = selected.name + ' — ' + selected.address;
                  document.getElementById('lnPickupLoc').value = selected.name + ' — ' + selected.address;
                }
              ">
                ${owners.map(o => `<option value="${o.id}">${o.name}</option>`).join('')}
              </select>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Lieu de récupération *</label>
                <input type="text" id="lnPickupLoc" class="form-control" required placeholder="Ex: École ABC — Salle polyvalente">
              </div>
              <div class="form-group">
                <label>Lieu de restitution prévu *</label>
                <input type="text" id="lnReturnLoc" class="form-control" required placeholder="Ex: École ABC — Salle polyvalente">
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Date d'emprunt *</label>
                <input type="date" id="lnPickupDate" class="form-control" value="${new Date().toISOString().split('T')[0]}" required>
              </div>
              <div class="form-group">
                <label>Date de retour impérative *</label>
                <input type="date" id="lnReturnDate" class="form-control" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Responsable de la récupération</label>
                <select id="lnPickupResp" class="form-control">
                  <option value="">Sélectionner un bénévole...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Responsable actuel de la garde</label>
                <select id="lnCurrentResp" class="form-control">
                  <option value="">Sélectionner un bénévole...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>État du matériel au départ</label>
              <input type="text" id="lnCondition" class="form-control" value="Bon état, complet" placeholder="Détails sur l'état au moment du prêt">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveLoanBtn">Enregistrer l'emprunt</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveLoanBtn').onclick = async () => {
      const matId = document.getElementById('lnMaterial').value;
      const qty = parseInt(document.getElementById('lnQty').value, 10);
      const ownerId = document.getElementById('lnOwner').value;
      const pickupLoc = document.getElementById('lnPickupLoc').value.trim();
      const returnLoc = document.getElementById('lnReturnLoc').value.trim();
      const pDate = document.getElementById('lnPickupDate').value;
      const rDate = document.getElementById('lnReturnDate').value;
      const pResp = document.getElementById('lnPickupResp').value || null;
      const cResp = document.getElementById('lnCurrentResp').value || null;
      const cond = document.getElementById('lnCondition').value.trim();

      if (isNaN(qty) || !pickupLoc || !returnLoc || !pDate || !rDate) {
        Notify.error('Veuillez remplir tous les champs obligatoires.');
        return;
      }

      if (client) {
        const { data: newLoan, error } = await client.from('loans').insert([{
          material_id: matId,
          owner_id: ownerId,
          quantity: qty,
          pickup_location: pickupLoc,
          return_location: returnLoc,
          pickup_date: pDate,
          expected_return_date: rDate,
          pickup_responsible_id: pResp,
          current_responsible_id: cResp,
          departure_condition: cond,
          status: 'en_cours'
        }]).select().single();

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        // Créer automatiquement l'étape correspondante dans le plan de restitution !
        await client.from('returns_plan').insert([{
          loan_id: newLoan.id,
          member_id: cResp || pResp,
          destination_name: returnLoc,
          material_quantity: qty,
          status: 'a_faire'
        }]);

        AuditLogger.log('CREATION_EMPRUNT', 'loan', newLoan.id, `Enregistrement d'emprunt de ${qty} unité(s) pour retour le ${rDate}`);
        Notify.success('Emprunt enregistré et ajouté au plan de restitution.');
        close();
        LoansModule.render(document.getElementById('mainContent'));
      }
    };
  },

  markReturned(loanId, materialName, quantity) {
    Notify.confirm(
      'Valider la restitution ?',
      `Confirmez que les ${quantity} unité(s) de ${materialName} ont été rendues à leur propriétaire ?`,
      async () => {
        const client = SupabaseClient.client;
        if (client) {
          await client.from('loans').update({
            status: 'restitue',
            actual_return_date: new Date().toISOString().split('T')[0]
          }).eq('id', loanId);

          await client.from('returns_plan').update({
            status: 'restitue',
            actual_return_date: new Date().toISOString()
          }).eq('loan_id', loanId);

          AuditLogger.log('RESTITUTION_MATERIEL', 'loan', loanId, `Restitution confirmée de ${quantity} ${materialName}`);
          Notify.success('Restitution enregistrée avec succès.');
          LoansModule.render(document.getElementById('mainContent'));
        }
      },
      'Confirmer la restitution'
    );
  }
};

window.LoansModule = LoansModule;
