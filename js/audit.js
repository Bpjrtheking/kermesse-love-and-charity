/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE DE TRAÇABILITÉ ABSOLUE & JOURNAL D'ACTIVITÉ (AUDIT)
 * 
 * Enregistre QUI, QUOI, QUAND, OÙ, POUR QUELLE VALEUR dans activity_logs
 */

const AuditLogger = {
  async log(action, entityType, entityId, details, oldValues = null, newValues = null) {
    const user = Auth.getCurrentUser();
    const login = user ? user.login : 'Système';
    const userId = user ? user.id : null;

    const logEntry = {
      user_id: userId,
      login: login,
      action: action.toUpperCase(),
      entity_type: entityType,
      entity_id: entityId || null,
      details: details,
      old_values: oldValues ? JSON.parse(JSON.stringify(oldValues)) : null,
      new_values: newValues ? JSON.parse(JSON.stringify(newValues)) : null,
      created_at: new Date().toISOString()
    };

    console.log(`[L&C AUDIT] ${logEntry.action} par ${login} sur ${entityType}: ${details}`);

    // Si nous sommes en ligne et que Supabase est connecté
    const client = SupabaseClient.client;
    if (navigator.onLine && client) {
      try {
        const { error } = await client.from('activity_logs').insert([logEntry]);
        if (error) {
          console.warn('[L&C AUDIT] Erreur lors de l\'enregistrement distant de l\'audit:', error.message);
          OfflineManager.queueAction('activity_logs', 'insert', logEntry);
        }
      } catch (err) {
        OfflineManager.queueAction('activity_logs', 'insert', logEntry);
      }
    } else {
      // Stocker dans la file d'attente hors-ligne
      OfflineManager.queueAction('activity_logs', 'insert', logEntry);
    }
  }
};

window.AuditLogger = AuditLogger;
