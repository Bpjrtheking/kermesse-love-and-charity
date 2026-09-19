/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * CLIENT SUPABASE & COUCHE D'ABSTRACTION DES DONNÉES
 */

const SupabaseClient = {
  instance: null,

  init() {
    if (!KermesseConfig.isSupabaseConfigured()) {
      console.warn('[L&C Supabase] Les identifiants Supabase ne sont pas encore configurés.');
      return null;
    }

    try {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        this.instance = window.supabase.createClient(
          KermesseConfig.supabaseUrl,
          KermesseConfig.supabaseAnonKey,
          {
            auth: {
              persistSession: true,
              autoRefreshToken: true
            }
          }
        );
        console.log('[L&C Supabase] Client initialisé avec succès.');
        return this.instance;
      } else {
        console.error('[L&C Supabase] Le SDK Supabase n\'est pas encore chargé dans window.supabase.');
        return null;
      }
    } catch (e) {
      console.error('[L&C Supabase] Erreur d\'initialisation:', e);
      return null;
    }
  },

  get client() {
    if (!this.instance) {
      this.init();
    }
    return this.instance;
  },

  async testConnection() {
    if (!KermesseConfig.isSupabaseConfigured()) {
      return { success: false, message: 'URL ou clé Supabase manquante.' };
    }

    const c = this.client;
    if (!c) {
      return { success: false, message: 'Impossible d\'initialiser le client Supabase.' };
    }

    try {
      const { data, error } = await c.from('roles').select('id, code').limit(1);
      if (error) {
        return { success: false, message: error.message };
      }
      return { success: true, message: 'Connexion à Supabase réussie !' };
    } catch (err) {
      return { success: false, message: err.message || 'Erreur réseau vers Supabase.' };
    }
  }
};

window.SupabaseClient = SupabaseClient;
