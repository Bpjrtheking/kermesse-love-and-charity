-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 04 : INITIALISATION DES RÔLES SYSTÈME ET DU COMPTE ORIGINAL MOUNIR
--
-- RÈGLE STRICTE : AUCUNE FAUSSE DONNÉE (ZÉRO FAUX MEMBRE, ZÉRO FAUX STAND,
-- ZÉRO FAUX PRODUIT, ZÉRO FAUX MATÉRIEL, ZÉRO FAUX INCIDENT).
-- LA BASE EST INTÉGRALEMENT VIERGE À L'EXCEPTION DU COMPTE SUPERADMIN ORIGINAL.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. INSERTION DES RÔLES SYSTÈME PAR DÉFAUT
-- ------------------------------------------------------------------------------
INSERT INTO roles (code, name, description, is_system, permissions)
VALUES 
(
    'superadmin', 
    'SuperAdministrateur', 
    'Accès global, gestion complète du système, des utilisateurs, finances et clôtures',
    TRUE,
    '{
        "all": true,
        "users_manage": true,
        "stands_manage": true,
        "cash_manage": true,
        "tickets_manage": true,
        "stocks_manage": true,
        "materials_manage": true,
        "loans_manage": true,
        "returns_manage": true,
        "incidents_manage": true,
        "finances_view": true,
        "closures_manage": true,
        "history_view": true,
        "reports_view": true,
        "settings_manage": true
    }'::jsonb
),
(
    'admin_tickets', 
    'Administrateur — Gestion des tickets', 
    'Vente de tickets, catalogue des billets de jeu et de lots, suivi des jetons',
    TRUE,
    '{
        "tickets_manage": true,
        "tickets_sell": true,
        "tokens_manage": true,
        "cash_view": false,
        "history_view": true
    }'::jsonb
),
(
    'admin_cash', 
    'Administrateur — Gestion de caisse', 
    'Ouverture et clôture de caisse, encaissement, remise de jetons, comptage et calcul des écarts',
    TRUE,
    '{
        "cash_manage": true,
        "cash_open_close": true,
        "cash_movements": true,
        "tickets_sell": true,
        "tokens_manage": true,
        "history_view": true
    }'::jsonb
),
(
    'admin_stand', 
    'Administrateur — Responsable de stand', 
    'Vue globale sur son stand, son équipe, ses jeux, ses lots, son stock et ses incidents',
    TRUE,
    '{
        "stand_view_own": true,
        "stand_staff_view": true,
        "games_view": true,
        "tickets_sell": true,
        "gifts_distribute": true,
        "incidents_report": true,
        "history_view": true
    }'::jsonb
),
(
    'admin_food', 
    'Administrateur — Gestion nourriture', 
    'Suivi des stocks de denrées, entrées, sorties vers les stands, ventes, pertes et écarts',
    TRUE,
    '{
        "food_manage": true,
        "food_stock_movements": true,
        "food_inventory": true,
        "incidents_report": true,
        "history_view": true
    }'::jsonb
),
(
    'admin_material', 
    'Administrateur — Gestion matériel & logistique', 
    'Inventaire matériel, propriétaires, emprunts, mouvements entre emplacements, plan de restitution',
    TRUE,
    '{
        "materials_manage": true,
        "loans_manage": true,
        "movements_manage": true,
        "locations_manage": true,
        "returns_plan_manage": true,
        "damages_report": true,
        "history_view": true
    }'::jsonb
),
(
    'admin_gifts', 
    'Administrateur — Gestion des lots & cadeaux', 
    'Catalogue des cadeaux, dotations vers les stands, distributions, retours et suivi des écarts',
    TRUE,
    '{
        "gifts_manage": true,
        "gifts_allocate": true,
        "gifts_inventory": true,
        "incidents_report": true,
        "history_view": true
    }'::jsonb
)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

-- ------------------------------------------------------------------------------
-- 2. CRÉATION DE L'UNIQUE COMPTE INITIAL : LE SUPERADMINISTRATEUR ORIGINAL MOUNIR
-- Login : Mounir
-- Mot de passe initial : Mounir@Kermesse#2026! (temporaire, changement forcé au 1er login)
-- ------------------------------------------------------------------------------
DO $$
DECLARE
    v_superadmin_role_id UUID;
    v_mounir_user_id UUID;
BEGIN
    SELECT id INTO v_superadmin_role_id FROM roles WHERE code = 'superadmin';

    -- Insertion ou mise à jour de Mounir sans toucher son statut s'il existe déjà
    INSERT INTO app_users (
        login,
        password_hash,
        full_name,
        role_id,
        is_active,
        must_change_password,
        is_original_superadmin
    ) VALUES (
        'Mounir',
        crypt('Mounir@Kermesse#2026!', gen_salt('bf', 10)),
        'Mounir (SuperAdministrateur)',
        v_superadmin_role_id,
        TRUE,
        TRUE, -- Obligation de changer le mot de passe dès la 1ère connexion
        TRUE  -- Protégé de manière absolue contre toute suppression/rétrogradation
    )
    ON CONFLICT (login) DO NOTHING
    RETURNING id INTO v_mounir_user_id;

    -- Journalisation de l'initialisation système
    IF v_mounir_user_id IS NOT NULL THEN
        INSERT INTO activity_logs (user_id, login, action, entity_type, entity_id, details)
        VALUES (
            v_mounir_user_id,
            'Mounir',
            'INITIALISATION_SYSTEME',
            'user',
            v_mounir_user_id,
            'Initialisation du compte SuperAdministrateur original Mounir pour Love and Charity (L&C).'
        );
    END IF;
END $$;
