/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : RESTITUTION DU MATÉRIEL & PLAN D'ITINÉRAIRE
 * 
 * Identification automatique de tout ce qui doit être rendu après la kermesse.
 * Organisation en itinéraires par bénévole (Station 1, Station 2, Station 3...).
 * Statuts : À faire, En cours, Restitué, Problème.
 */

const ReturnsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🚚</span> Plan de Restitution & Itinéraires des Retours
          </div>
          <div class="card-actions">
            <button class="btn btn-secondary btn-sm" onclick="ReturnsModule.generatePlanFromLoans()">
              <span>⚡</span> Synchroniser les Emprunts
            </button>
            <button class="btn btn-primary btn-sm" onclick="ReturnsModule.openAddStationModal()">
              <span>➕</span> Ajouter une Station
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner info" style="margin-bottom: 1.5rem;">
            <div>
              📋 <strong>Organisation des Retours :</strong> Chaque bénévole peut se voir assigner une tournée de restitution par étapes (Station 1, Station 2...). Marquez chaque étape comme <em>Restitué</em> ou <em>Problème</em> en cas d'écart.
            </div>
          </div>

          <div id="returnsItineraryContainer">
            <div class="empty-state">
              <div class="empty-icon">🚚</div>
              <div class="empty-title">Aucune restitution en attente</div>
              <div class="empty-desc">Le plan de restitution se remplit automatiquement à partir des matériels empruntés ou manuellement pour organiser les tournées.</div>
              <button class="btn btn-primary" onclick="ReturnsModule.generatePlanFromLoans()">
                <span>⚡</span> Scanner les emprunts à rendre
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
      const { data: plans, error } = await client
        .from('returns_plan')
        .select(`
          id, station_order, destination_name, destination_address, material_quantity, status, actual_return_date, notes,
          loan:loans(
            id, quantity, expected_return_date,
            material:materials(name),
            owner:material_owners(name, phone, contact_person)
          ),
          responsible:members(id, first_name, last_name, phone)
        `)
        .order('station_order', { ascending: true });

      if (error) throw error;
      this.renderPlans(plans || []);
    } catch (e) {
      console.error('[ReturnsModule Error]', e);
    }
  },

  renderPlans(plans) {
    const container = document.getElementById('returnsItineraryContainer');
    if (!container) return;

    if (!plans || plans.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🚚</div>
          <div class="empty-title">Aucune restitution en attente</div>
          <div class="empty-desc">Le plan de restitution se remplit automatiquement à partir des matériels empruntés ou manuellement pour organiser les tournées.</div>
          <button class="btn btn-primary" onclick="ReturnsModule.generatePlanFromLoans()">
            <span>⚡</span> Scanner les emprunts à rendre
          </button>
        </div>
      `;
      return;
    }

    // Regrouper par bénévole assigné (ex: Abdou -> Station 1, Station 2...)
    const groupedByMember = {};
    plans.forEach(p => {
      const key = p.responsible ? `${p.responsible.first_name} ${p.responsible.last_name}` : 'Non assigné';
      if (!groupedByMember[key]) {
        groupedByMember[key] = {
          member: p.responsible,
          stations: []
        };
      }
      groupedByMember[key].stations.push(p);
    });

    let html = '';
    for (const [memberName, group] of Object.entries(groupedByMember)) {
      html += `
        <div class="card" style="margin-bottom: 1.5rem; border: 1px solid var(--gray-300);">
          <div class="card-header" style="background: var(--gray-50);">
            <div class="card-title" style="font-size: 1rem;">
              <span>👤</span> Itinéraire : <strong>${memberName}</strong>
              ${group.member?.phone ? `<span style="font-size: 0.8rem; color: var(--gray-500); font-weight: normal; margin-left: 0.5rem;">(${group.member.phone})</span>` : ''}
            </div>
            <div>
              <span class="badge badge-gray">${group.stations.length} station(s) de retour</span>
            </div>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="data-table">
              <thead>
                <tr>
                  <th style="width: 110px;">Étape</th>
                  <th>Destination & Contact</th>
                  <th>Matériel à Rendre</th>
                  <th>Quantité</th>
                  <th>Statut</th>
                  <th style="text-align: right;">Action</th>
                </tr>
              </thead>
              <tbody>
                ${group.stations.map((st, idx) => {
                  let statusBadge = '<span class="badge badge-warning">À faire</span>';
                  if (st.status === 'en_cours') statusBadge = '<span class="badge badge-primary">En cours</span>';
                  if (st.status === 'restitue') statusBadge = '<span class="badge badge-success">Restitué</span>';
                  if (st.status === 'probleme') statusBadge = '<span class="badge badge-danger">Problème</span>';

                  const matName = st.loan?.material?.name || 'Matériel';
                  const ownerName = st.loan?.owner?.name || st.destination_name;

                  return `
                    <tr>
                      <td>
                        <span class="badge badge-primary" style="font-size: 0.8rem;">
                          STATION ${st.station_order || idx + 1}
                        </span>
                      </td>
                      <td>
                        <strong>${ownerName}</strong>
                        <div style="font-size: 0.78rem; color: var(--gray-500);">
                          📍 ${st.destination_address || st.destination_name}
                          ${st.loan?.owner?.phone ? `| 📞 ${st.loan.owner.phone}` : ''}
                        </div>
                      </td>
                      <td><strong>${matName}</strong></td>
                      <td><span class="badge badge-gray">${st.material_quantity} unité(s)</span></td>
                      <td>${statusBadge}</td>
                      <td style="text-align: right;">
                        ${st.status !== 'restitue' ? `
                          <button class="btn btn-success btn-sm" onclick="ReturnsModule.updateStationStatus('${st.id}', 'restitue', '${matName}')">
                            Valider retour
                          </button>
                          <button class="btn btn-danger btn-sm" onclick="ReturnsModule.updateStationStatus('${st.id}', 'probleme', '${matName}')" style="margin-left: 0.35rem;">
                            Problème
                          </button>
                        ` : '<span style="color: var(--success); font-weight: 600; font-size: 0.85rem;">✅ Restitué</span>'}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  },

  async generatePlanFromLoans() {
    const client = SupabaseClient.client;
    if (!client) return;

    // Récupérer les emprunts non restitués qui n'ont pas encore d'entrée dans le plan
    const { data: loans } = await client
      .from('loans')
      .select('id, quantity, return_location, current_responsible_id, pickup_responsible_id, status')
      .eq('status', 'en_cours');

    if (!loans || loans.length === 0) {
      Notify.info('Aucun emprunt en cours à scanner.');
      return;
    }

    let addedCount = 0;
    for (const l of loans) {
      const { data: existing } = await client.from('returns_plan').select('id').eq('loan_id', l.id).maybeSingle();
      if (!existing) {
        await client.from('returns_plan').insert([{
          loan_id: l.id,
          member_id: l.current_responsible_id || l.pickup_responsible_id,
          destination_name: l.return_location,
          material_quantity: l.quantity,
          status: 'a_faire'
        }]);
        addedCount++;
      }
    }

    if (addedCount > 0) {
      Notify.success(`${addedCount} étape(s) ajoutée(s) au plan de restitution.`);
    } else {
      Notify.info('Le plan de restitution est déjà à jour.');
    }

    this.render(document.getElementById('mainContent'));
  },

  async updateStationStatus(planId, newStatus, matName) {
    const client = SupabaseClient.client;
    if (!client) return;

    if (newStatus === 'probleme') {
      const reason = prompt('Décrivez le problème constaté lors du retour (ex: matériel cassé, manquant, refusé) :');
      if (!reason) return;

      await client.from('returns_plan').update({
        status: 'probleme',
        notes: reason
      }).eq('id', planId);

      // Créer un incident
      await client.from('incidents').insert([{
        incident_number: 'INC-RET-' + Math.floor(1000 + Math.random() * 9000),
        type: 'disparition_materiel',
        title: `Problème de restitution : ${matName}`,
        description: `Signalé lors de la tournée de retour : ${reason}`,
        severity: 'eleve',
        status: 'ouvert'
      }]);

      Notify.warning('Problème enregistré et incident généré.');
    } else {
      await client.from('returns_plan').update({
        status: 'restitue',
        actual_return_date: new Date().toISOString()
      }).eq('id', planId);

      Notify.success('Restitution validée avec succès.');
    }

    this.render(document.getElementById('mainContent'));
  }
};

window.ReturnsModule = ReturnsModule;
