/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * GESTIONNAIRE DU MODE HORS-LIGNE & SYNCHRONISATION (OFFLINE MANAGER)
 */

const OfflineManager = {
  QUEUE_KEY: 'lc_offline_queue',
  isOnline: navigator.onLine,

  init() {
    window.addEventListener('online', () => this.handleNetworkChange(true));
    window.addEventListener('offline', () => this.handleNetworkChange(false));
    this.updateStatusBadge();

    // Si on est en ligne au démarrage, vérifier la file
    if (this.isOnline) {
      setTimeout(() => this.syncQueue(), 3000);
    }
  },

  handleNetworkChange(online) {
    this.isOnline = online;
    this.updateStatusBadge();
    if (online) {
      Notify.success('Connexion Internet rétablie. Synchronisation des données...');
      this.syncQueue();
    } else {
      Notify.warning('Perte de connexion Internet. Les opérations seront stockées localement.');
    }
  },

  updateStatusBadge() {
    const badge = document.getElementById('syncBadge');
    if (!badge) return;

    const queue = this.getQueue();
    const count = queue.length;

    if (this.isOnline) {
      badge.className = 'sync-badge online';
      badge.innerHTML = `<span class="sync-dot"></span> En ligne ${count > 0 ? `(${count} en attente)` : ''}`;
    } else {
      badge.className = 'sync-badge offline';
      badge.innerHTML = `<span class="sync-dot"></span> Hors-ligne (${count} en attente)`;
    }
  },

  getQueue() {
    try {
      return JSON.parse(localStorage.getItem(this.QUEUE_KEY) || '[]');
    } catch {
      return [];
    }
  },

  saveQueue(queue) {
    localStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    this.updateStatusBadge();
  },

  queueAction(table, operation, payload) {
    const queue = this.getQueue();
    const item = {
      id: 'offline_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      table,
      operation, // 'insert', 'update'
      payload,
      timestamp: new Date().toISOString(),
      user: Auth.getCurrentUser() ? Auth.getCurrentUser().login : 'Inconnu'
    };

    queue.push(item);
    this.saveQueue(queue);
    console.log(`[L&C OFFLINE] Action mise en file d'attente : ${operation} sur ${table}`);
  },

  async syncQueue() {
    const queue = this.getQueue();
    if (queue.length === 0) return;

    const client = SupabaseClient.client;
    if (!client) return;

    console.log(`[L&C OFFLINE] Début de synchronisation de ${queue.length} éléments...`);
    const remaining = [];

    for (const item of queue) {
      try {
        if (item.operation === 'insert') {
          const { error } = await client.from(item.table).insert([item.payload]);
          if (error) {
            console.error(`[L&C SYNC ERROR] ${item.table}:`, error.message);
            remaining.push(item);
          }
        } else if (item.operation === 'update' && item.payload.id) {
          const { id, ...rest } = item.payload;
          const { error } = await client.from(item.table).update(rest).eq('id', id);
          if (error) {
            console.error(`[L&C SYNC ERROR] ${item.table}:`, error.message);
            remaining.push(item);
          }
        }
      } catch (e) {
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    if (remaining.length === 0) {
      Notify.success('Toutes les opérations hors-ligne ont été synchronisées avec succès.');
    } else {
      Notify.warning(`${remaining.length} opérations en attente de synchronisation.`);
    }
  },

  // Sauvegarde sécurisée : Tente Supabase d'abord, bascule en file locale si réseau absent
  async safeInsert(table, payload) {
    const isOnline = navigator.onLine;
    const client = SupabaseClient.client;

    if (isOnline && client) {
      try {
        const { data, error } = await client.from(table).insert(Array.isArray(payload) ? payload : [payload]).select();
        if (!error) {
          return { success: true, offline: false, data };
        }
        if (error.code && error.code !== 'PGRST301' && !error.message.toLowerCase().includes('fetch')) {
          return { success: false, offline: false, error };
        }
      } catch (err) {
        console.warn(`[L&C OFFLINE] Erreur réseau sur ${table}, bascule hors-ligne`, err);
      }
    }

    // Bascule en file d'attente hors-ligne
    const items = Array.isArray(payload) ? payload : [payload];
    items.forEach(item => this.queueAction(table, 'insert', item));
    return { success: true, offline: true };
  },

  async safeUpdate(table, payload, matchField = 'id', matchValue) {
    const isOnline = navigator.onLine;
    const client = SupabaseClient.client;

    if (isOnline && client) {
      try {
        const { data, error } = await client.from(table).update(payload).eq(matchField, matchValue).select();
        if (!error) {
          return { success: true, offline: false, data };
        }
        if (error.code && error.code !== 'PGRST301' && !error.message.toLowerCase().includes('fetch')) {
          return { success: false, offline: false, error };
        }
      } catch (err) {
        console.warn(`[L&C OFFLINE] Erreur réseau sur ${table}, bascule hors-ligne`, err);
      }
    }

    this.queueAction(table, 'update', { ...payload, [matchField]: matchValue });
    return { success: true, offline: true };
  }
};

window.OfflineManager = OfflineManager;
