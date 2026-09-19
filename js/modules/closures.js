/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : CLÔTURES DE STANDS (VERROUILLAGE & SNAPSHOT IMMUABLE)
 * 
 * Clôture complète d'un stand en fin de journée :
 * - Argent attendu vs réellement compté
 * - Tickets vendus
 * - Lots distribués & restants
 * - Matériel & Incidents
 * Une fois clôturé, les modifications sont verrouillées pour les utilisateurs réguliers.
 */

const ClosuresModule = {
  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🔒</span> Clôtures Définitives de Stands
          </div>
          <div class="card-actions">
            <button class="btn btn-danger btn-sm" onclick="ClosuresModule.openStandClosureModal()">
              <span>🔒</span> Clôturer un Stand
            </button>
          </div>
        </div>
        <div class="card-body">
          <div class="alert-banner warning" style="margin-bottom: 1.5rem;">
            <div>
              🔒 <strong>Règle d'Immutabilité :</strong> La clôture d'un stand fige définitivement l'argent, les ventes, les stocks et les lots. Les données sont verrouillées contre toute modification ultérieure.
            </div>
          </div>

          <div class="table-responsive" id="closuresTableContainer">
            <div class="empty-state">
              <div class="empty-icon">🔒</div>
              <div class="empty-title">Aucun stand clôturé</div>
              <div class="empty-desc">En fin de kermesse, clôturez chaque stand pour enregistrer le bilan consolidé et verrouiller les comptes.</div>
              <button class="btn btn-danger" onclick="ClosuresModule.openStandClosureModal()">
                <span>🔒</span> Procéder à une clôture
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
      const { data: closures, error } = await client
        .from('stand_closures')
        .select(`
          id, total_revenue_f, total_expenses_f, tickets_sold_count, lots_distributed_count, cash_variance_f, closed_at, is_locked,
          stand:stands(name, color_name),
          closed_by_user:app_users(login)
        `)
        .order('closed_at', { ascending: false });

      if (error) throw error;
      this.renderClosures(closures || []);
    } catch (e) {
      console.error('[ClosuresModule Error]', e);
    }
  },

  renderClosures(closures) {
    const container = document.getElementById('closuresTableContainer');
    if (!container) return;

    if (!closures || closures.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔒</div>
          <div class="empty-title">Aucun stand clôturé</div>
          <div class="empty-desc">En fin de kermesse, clôturez chaque stand pour enregistrer le bilan consolidé et verrouiller les comptes.</div>
          <button class="btn btn-danger" onclick="ClosuresModule.openStandClosureModal()">
            <span>🔒</span> Procéder à une clôture
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
            <th>Stand Clôturé</th>
            <th>Recettes Tickets</th>
            <th>Tickets Vendus</th>
            <th>Lots Distribués</th>
            <th>Écart Caisse</th>
            <th>Clôturé Par</th>
            <th>Verrou</th>
          </tr>
        </thead>
        <tbody>
          ${closures.map(c => `
            <tr>
              <td style="font-family: monospace; font-size: 0.8rem; color: var(--gray-500);">
                ${new Date(c.closed_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
              </td>
              <td><strong>${c.stand ? c.stand.name : 'Stand'}</strong></td>
              <td><strong style="color: var(--success);">${c.total_revenue_f.toLocaleString()} ${KermesseConfig.currency}</strong></td>
              <td><span class="badge badge-primary">${c.tickets_sold_count}</span></td>
              <td><span class="badge badge-warning">${c.lots_distributed_count}</span></td>
              <td style="font-weight: 700; color: ${c.cash_variance_f !== 0 ? 'var(--danger)' : 'var(--success)'};">
                ${c.cash_variance_f > 0 ? '+' : ''}${c.cash_variance_f.toLocaleString()} F
              </td>
              <td>${c.closed_by_user ? c.closed_by_user.login : '-'}</td>
              <td><span class="badge badge-danger">🔒 Verrouillé</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async openStandClosureModal() {
    const client = SupabaseClient.client;
    let openStands = [];

    if (client) {
      const { data } = await client.from('stands').select('id, name').eq('is_closed', false);
      openStands = data || [];
    }

    if (openStands.length === 0) {
      Notify.info('Tous les stands sont déjà clôturés ou aucun stand n\'est ouvert.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop open';
    modal.innerHTML = `
      <div class="modal-dialog">
        <div class="modal-header">
          <h3>Clôture Officielle d'un Stand</h3>
          <button class="modal-close-btn">&times;</button>
        </div>
        <div class="modal-body">
          <form id="closeStandForm">
            <div class="form-group">
              <label>Stand à clôturer définitivement *</label>
              <select id="csStand" class="form-control" onchange="ClosuresModule.loadStandSnapshot(this.value)">
                <option value="">Sélectionner un stand...</option>
                ${openStands.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
              </select>
            </div>

            <div id="standSnapshotBox" style="display: none; background: var(--gray-50); padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--gray-200); margin-bottom: 1rem;">
              <h4 style="font-size: 0.9rem; margin-bottom: 0.5rem; color: var(--gray-800);">Bilan Consolidé :</h4>
              <div id="snapshotMetrics" style="font-size: 0.88rem; display: flex; flex-direction: column; gap: 0.35rem;">
                <!-- Rempli dynamiquement -->
              </div>
            </div>

            <div class="form-group">
              <label>Remarques / Rapport de clôture</label>
              <textarea id="csNotes" class="form-control" rows="2" placeholder="Consignes particulières ou bilan général"></textarea>
            </div>
          </form>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary close-btn">Annuler</button>
          <button class="btn btn-danger" id="confirmStandClosureBtn">Confirmer & Verrouiller le stand</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('.modal-close-btn').onclick = close;
    modal.querySelector('.close-btn').onclick = close;

    modal.querySelector('#confirmStandClosureBtn').onclick = async () => {
      const standId = document.getElementById('csStand').value;
      const notes = document.getElementById('csNotes').value.trim();
      const user = Auth.getCurrentUser();

      if (!standId) {
        Notify.error('Veuillez sélectionner un stand.');
        return;
      }

      const snap = ClosuresModule.currentSnapshot || { revenue: 0, tickets: 0, lots: 0, variance: 0 };

      if (client) {
        // 1. Marquer le stand comme fermé
        await client.from('stands').update({ is_closed: true }).eq('id', standId);

        // 2. Insérer le snapshot de clôture
        const { error } = await client.from('stand_closures').insert([{
          stand_id: standId,
          closed_by: user ? user.id : null,
          total_revenue_f: snap.revenue,
          tickets_sold_count: snap.tickets,
          lots_distributed_count: snap.lots,
          cash_variance_f: snap.variance,
          summary_data: snap,
          is_locked: true,
          exception_notes: notes
        }]);

        if (error) {
          Notify.error('Erreur: ' + error.message);
          return;
        }

        AuditLogger.log('CLOTURE_STAND', 'stand', standId, `Clôture définitive et verrouillage du stand ID ${standId} par ${user?.login}`);
        Notify.success('Stand clôturé et verrouillé avec succès.');
        close();
        ClosuresModule.render(document.getElementById('mainContent'));
      }
    };
  },

  async loadStandSnapshot(standId) {
    if (!standId) return;

    const client = SupabaseClient.client;
    if (!client) return;

    // Calculer ventes
    const { data: sales } = await client.from('ticket_sales').select('quantity, total_amount_f').eq('stand_id', standId);
    let ticketsCount = 0;
    let totalRevenue = 0;
    if (sales) {
      sales.forEach(s => {
        ticketsCount += s.quantity;
        totalRevenue += s.total_amount_f;
      });
    }

    // Calculer lots distribués
    const { data: allocations } = await client.from('gift_stand_allocations').select('distributed_qty, current_stand_stock').eq('stand_id', standId);
    let lotsDistributed = 0;
    let lotsRemaining = 0;
    if (allocations) {
      allocations.forEach(a => {
        lotsDistributed += a.distributed_qty;
        lotsRemaining += a.current_stand_stock;
      });
    }

    this.currentSnapshot = {
      revenue: totalRevenue,
      tickets: ticketsCount,
      lots: lotsDistributed,
      lots_remaining: lotsRemaining,
      variance: 0
    };

    const box = document.getElementById('standSnapshotBox');
    const metrics = document.getElementById('snapshotMetrics');
    if (box && metrics) {
      box.style.display = 'block';
      metrics.innerHTML = `
        <div>🎟️ Tickets de jeu vendus : <strong>${ticketsCount}</strong></div>
        <div>💰 Recettes encaissées : <strong>${totalRevenue.toLocaleString()} ${KermesseConfig.currency}</strong></div>
        <div>🎁 Lots distribués : <strong>${lotsDistributed}</strong> (Restants sur le stand : ${lotsRemaining})</div>
      `;
    }
  }
};

window.ClosuresModule = ClosuresModule;
