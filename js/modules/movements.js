/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : MOUVEMENTS DE MATÉRIEL (CHAÎNE DE TRAÇABILITÉ)
 * 
 * Suivre le parcours d'un matériel :
 * Ex: École ABC ➔ Mamadou récupère 100 chaises ➔ Stock central ➔ 50 vers Stand Rouge, 30 vers Stand Bleu, 20 vers Zone Repas.
 * Enregistre : Ancien lieu, Nouveau lieu, Ancien responsable, Nouveau responsable, Horodatage, Auteur.
 */

const MovementsModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🔄</span> Suivi des Mouvements & Transferts de Matériel
          </div>
          <div class="card-actions">
            <button class="btn btn-primary btn-sm" onclick="MovementsModule.openTransferModal()">
              <span>🚚</span> Effectuer un Transfert
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="table-responsive" id="movementsTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🔄</div>
              <div class="empty-title">Aucun transfert de matériel enregistré</div>
              <div class="empty-desc">Enregistrez chaque déplacement de chaises, tables ou sonos entre le stock central, les stands et les zones de la kermesse.</div>
              <button class="btn btn-primary" onclick="MovementsModule.openTransferModal()">
                <span>🚚</span> Effectuer le premier transfert
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
      const { data: movements, error } = await client
        .from('material_movements')
        .select(`
          id, quantity, notes, created_at,
          material:materials(name),
          from_loc:locations!material_movements_from_location_id_fkey(name),
          to_loc:locations!material_movements_to_location_id_fkey(name),
          from_resp:members!material_movements_from_responsible_id_fkey(first_name, last_name),
          to_resp:members!material_movements_to_responsible_id_fkey(first_name, last_name),
          author:app_users(login)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.renderTable(movements || []);
    } catch (e) {
      console.error('[MovementsModule Error]', e);
    }
  },

  renderTable(movements) {
    const container = document.getElementById('movementsTableContainer');
    if (!container) return;

    if (!movements || movements.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔄</div>
          <div class="empty-title">Aucun transfert de matériel enregistré</div>
          <div class="empty-desc">Enregistrez chaque déplacement de chaises, tables ou sonos entre le stock central, les stands et les zones de la kermesse.</div>
          <button class="btn btn-primary" onclick="MovementsModule.openTransferModal()">
            <span>🚚</span> Effectuer le premier transfert
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Date & Heure</th>
            <th>Matériel & Quantité</th>
            <th>Origine ➔ Destination</th>
            <th>Passage de Témoin (Responsables)</th>
            <th>Motif / Notes</th>
            <th>Enregistré Par</th>
          </tr>
        </thead>
        <tbody>
          ${movements.map(m => `
            <tr>
              <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                ${new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td>
                <strong>${m.material ? m.material.name : 'Matériel'}</strong>
                <div><span class="badge badge-gray">${m.quantity} unité(s)</span></div>
              </td>
              <td>
                <span class="badge badge-gray">${m.from_loc ? m.from_loc.name : 'Départ'}</span>
                ➔
                <span class="badge badge-primary">${m.to_loc ? m.to_loc.name : 'Arrivée'}</span>
              </td>
              <td style="font-size: 0.85rem;">
                ${m.from_resp ? `${m.from_resp.first_name} ${m.from_resp.last_name}` : '-'}
                ➔
                <strong>${m.to_resp ? `${m.to_resp.first_name} ${m.to_resp.last_name}` : '-'}</strong>
              </td>
              <td>${m.notes || '-'}</td>
              <td>${m.author ? m.author.login : '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openTransferModal() {
    const client = SupabaseClient.client;
    let materials = [];
    let locations = [];
    let members = [];

    if (client) {
      const { data: mat } = await client.from('materials').select('id, name, current_location_id, current_responsible_id');
      const { data: loc } = await client.from('locations').select('id, name');
      const { data: mem } = await client.from('members').select('id, first_name, last_name');
      materials = mat || [];
      locations = loc || [];
      members = mem || [];
    }

    if (materials.length === 0) {
      Notify.warning('Aucun matériel disponible à transférer.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Transférer du Matériel</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="transferMatForm">
            <div class="form-row">
              <div class="form-group">
                <label>Matériel à déplacer *</label>
                <select id="trMaterial" class="form-control">
                  ${materials.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Quantité transférée *</label>
                <input type="number" id="trQty" class="form-control" value="10" min="1" required>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Emplacement de départ</label>
                <select id="trFromLoc" class="form-control">
                  <option value="">Lieu actuel ou indéfini</option>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Nouvel emplacement *</label>
                <select id="trToLoc" class="form-control" required>
                  ${locations.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label>Ancien responsable</label>
                <select id="trFromResp" class="form-control">
                  <option value="">Aucun</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Nouveau responsable de garde *</label>
                <select id="trToResp" class="form-control">
                  <option value="">Sélectionner un bénévole...</option>
                  ${members.map(m => `<option value="${m.id}">${m.first_name} ${m.last_name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group">
              <label>Motif / Précisions</label>
              <input type="text" id="trNotes" class="form-control" placeholder="Ex: Installation des tables pour le stand repas">
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-primary" id="saveTransferBtn">Valider le transfert</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#saveTransferBtn').onclick = async () => {
      const matId = document.getElementById('trMaterial').value;
      const qty = parseInt(document.getElementById('trQty').value, 10);
      const fromLoc = document.getElementById('trFromLoc').value || null;
      const toLoc = document.getElementById('trToLoc').value || null;
      const fromResp = document.getElementById('trFromResp').value || null;
      const toResp = document.getElementById('trToResp').value || null;
      const notes = document.getElementById('trNotes').value.trim();
      const user = Auth.getCurrentUser();

      if (isNaN(qty) || qty <= 0 || !toLoc) {
        Notify.error('Veuillez renseigner la quantité et le lieu de destination.');
        return;
      }

      if (client) {
        const { error } = await client.from('material_movements').insert([{
          material_id: matId,
          quantity: qty,
          from_location_id: fromLoc,
          to_location_id: toLoc,
          from_responsible_id: fromResp,
          to_responsible_id: toResp,
          notes,
          user_id: user ? user.id : null
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        // Mettre à jour l'emplacement et le responsable actuel du matériel
        await client.from('materials').update({
          current_location_id: toLoc,
          current_responsible_id: toResp || fromResp
        }).eq('id', matId);

        AuditLogger.log('MOUVEMENT_MATERIEL', 'material', matId, `Transfert de ${qty} unité(s) vers ${toLoc} sous responsabilité de ${toResp || 'Inconnu'}`);
        Notify.success('Transfert de matériel enregistré.');
        close();
        MovementsModule.render(document.getElementById('mainContent'));
      }
    };
  }
};

window.MovementsModule = MovementsModule;
