/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * CONFIGURATION OFFICIELLE CONNECTÉE À SUPABASE
 */

const KermesseConfig = {
  appName: 'Love and Charity (L&C)',
  appSubTitle: 'Gestion et Contrôle de Kermesse',
  currency: 'F', // Francs

  // Identifiants officiels Supabase du projet Love and Charity
  supabaseUrl: 'https://msfyqwxizvesljlsdxqb.supabase.co',
  supabaseAnonKey: 'sb_publishable_RLL5pJIeZirttav5iXHfug_1muFCw2e',

  isSupabaseConfigured() {
    return Boolean(this.supabaseUrl && this.supabaseAnonKey);
  }
};

window.KermesseConfig = KermesseConfig;
