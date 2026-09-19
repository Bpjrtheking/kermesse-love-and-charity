/**
 * LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
 * MODULE : PARAMÈTRES & CONFIGURATION SUPABASE
 * 
 * Gestion des clés de connexion Supabase avec testeur immédiat,
 * paramètres généraux de la kermesse et devise.
 */

const SettingsModule = {
  async render(container) {
    const isConfigured = KermesseConfig.isSupabaseConfigured();

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>⚙️</span> Paramètres & Configuration Système
          </div>
        </div>
        <div class="card-body">
          <!-- Configuration Supabase -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.5rem;">
            1. Connexion Supabase (Base de Données & Authentification)
          </h3>
          <p style="color: var(--gray-600); font-size: 0.88rem; margin-bottom: 1.25rem;">
            Renseignez ici l'URL de votre projet Supabase et votre clé publique Anon (Project Settings ➔ API). Ces paramètres sont mémorisés dans votre navigateur.
          </p>

          <form id="supabaseConfigForm" style="max-width: 650px; margin-bottom: 2rem;">
            <div class="form-group">
              <label>URL du Projet Supabase (Project URL) *</label>
              <input type="url" id="cfgSupabaseUrl" class="form-control" placeholder="https://votre-projet.supabase.co" value="${KermesseConfig.supabaseUrl}">
              <div class="form-hint">Exemple : https://abcdefghijklm.supabase.co</div>
            </div>

            <div class="form-group">
              <label>Clé Publique Anon (Project API anon key) *</label>
              <textarea id="cfgSupabaseKey" class="form-control" rows="3" placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...">${KermesseConfig.supabaseAnonKey}</textarea>
              <div class="form-hint">Utilisez uniquement la clé publique 'anon', jamais la clé secrète 'service_role'.</div>
            </div>

            <div style="display: flex; gap: 0.75rem; align-items: center;">
              <button type="button" class="btn btn-primary" onclick="SettingsModule.saveSupabaseConfig()">
                Enregistrer les identifiants
              </button>
              <button type="button" class="btn btn-secondary" onclick="SettingsModule.testConnection()">
                Tester la connexion
              </button>
              <span id="testStatusDisplay" style="font-size: 0.85rem; font-weight: 600;"></span>
            </div>
          </form>

          <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 2rem 0;">

          <!-- Paramètres Kermesse -->
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--gray-900); margin-bottom: 0.5rem;">
            2. Paramètres de l'Association & de la Kermesse
          </h3>
          <form style="max-width: 650px;">
            <div class="form-group">
              <label>Nom de l'Association</label>
              <input type="text" class="form-control" value="${KermesseConfig.appName}" readonly>
            </div>
            <div class="form-group">
              <label>Symbole de la Monnaie Utilisée</label>
              <input type="text" id="cfgCurrency" class="form-control" value="${KermesseConfig.currency}" placeholder="F, CFA, €...">
            </div>
            <button type="button" class="btn btn-secondary btn-sm" onclick="
              KermesseConfig.currency = document.getElementById('cfgCurrency').value.trim() || 'F';
              Notify.success('Devise mise à jour : ' + KermesseConfig.currency);
            ">
              Mettre à jour la devise
            </button>
          </form>

          <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 2rem 0;">

          <!-- Guide SQL -->
          <div class="alert-banner info">
            <div>
              📖 <strong>Initialisation de la base :</strong> Rendez-vous dans l'Éditeur SQL de votre tableau de bord Supabase, copiez et exécutez le script <code>sql/schema_complete_all_in_one.sql</code>. La base sera initialisée avec le compte Mounir et sans aucune fausse donnée.
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async saveSupabaseConfig() {
    const url = document.getElementById('cfgSupabaseUrl').value.trim();
    const key = document.getElementById('cfgSupabaseKey').value.trim();

    if (!url || !key) {
      Notify.error('Veuillez remplir l\'URL et la clé Anon.');
      return;
    }

    KermesseConfig.setSupabaseConfig(url, key);
    SupabaseClient.init();
    Notify.success('Identifiants Supabase enregistrés avec succès !');

    this.testConnection();
  },

  async testConnection() {
    const display = document.getElementById('testStatusDisplay');
    if (display) {
      display.style.color = 'var(--info)';
      display.textContent = 'Test de connexion en cours...';
    }

    const result = await SupabaseClient.testConnection();
    if (display) {
      if (result.success) {
        display.style.color = 'var(--success)';
        display.textContent = '✅ Connexion Supabase établie avec succès !';
        Notify.success('Connexion à Supabase validée.');
      } else {
        display.style.color = 'var(--danger)';
        display.textContent = '❌ Échec : ' + result.message;
        Notify.error('Erreur Supabase : ' + result.message);
      }
    }
  }
};

window.SettingsModule = SettingsModule;
