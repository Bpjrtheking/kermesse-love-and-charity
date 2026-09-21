-- ==============================================================================
-- LOVE AND CHARITY (L&C) — AUTORISATION & PROCÉDURE DE SUPPRESSION DE COMPTES
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
--
-- RÉSOUD DÉFINITIVEMENT :
-- 1. Le déclencheur trg_protect_original_superadmin qui bloquait silencieusement
--    la suppression en renvoyant NEW (qui est NULL lors d'un DELETE).
-- 2. La politique RLS de suppression sur app_users.
-- 3. La fonction RPC admin_delete_app_user avec détachement sécurisé des liaisons.
-- ==============================================================================

-- 1. Corriger le déclencheur de protection pour autoriser la suppression des comptes (sauf l'originel)
CREATE OR REPLACE FUNCTION protect_original_superadmin_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_original_superadmin = TRUE) THEN
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Action interdite : Le compte SuperAdministrateur original ne peut jamais être supprimé.';
        END IF;

        IF TG_OP = 'UPDATE' THEN
            IF NEW.is_active = FALSE THEN
                RAISE EXCEPTION 'Action interdite : Le compte SuperAdministrateur original ne peut pas être désactivé.';
            END IF;

            IF NEW.is_original_superadmin = FALSE THEN
                RAISE EXCEPTION 'Action interdite : Le statut de SuperAdministrateur original ne peut pas être révoqué.';
            END IF;
        END IF;
    END IF;

    -- En PostgreSQL, un déclencheur BEFORE DELETE DOIT retourner OLD pour valider la suppression.
    -- Retourner NEW (qui vaut NULL lors d'un DELETE) annule silencieusement la suppression !
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_original_superadmin ON app_users;
CREATE TRIGGER trg_protect_original_superadmin
BEFORE UPDATE OR DELETE ON app_users
FOR EACH ROW
EXECUTE FUNCTION protect_original_superadmin_func();

-- 2. Ajouter / Mettre à jour la politique RLS de suppression sur la table app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Suppression utilisateurs" ON app_users;
CREATE POLICY "Suppression utilisateurs" ON app_users FOR DELETE USING (true);

-- 3. Fonction RPC sécurisée pour supprimer un compte avec nettoyage complet des liaisons
CREATE OR REPLACE FUNCTION admin_delete_app_user(
    p_target_user_id UUID,
    p_admin_login TEXT DEFAULT 'SuperAdmin'
)
RETURNS JSONB AS $$
DECLARE
    v_target RECORD;
BEGIN
    SELECT * INTO v_target FROM app_users WHERE id = p_target_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Utilisateur introuvable.');
    END IF;

    IF v_target.is_original_superadmin = TRUE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Action interdite : Le compte SuperAdministrateur original ne peut jamais être supprimé.');
    END IF;

    -- Détacher les liaisons éventuelles vers app_users(id) avant suppression
    -- A. Membres de l'équipe (détacher le compte utilisateur sans supprimer la fiche membre)
    BEGIN
        UPDATE members SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- B. Messages internes de kermesse
    BEGIN
        DELETE FROM kermesse_messages WHERE sender_id = p_target_user_id OR recipient_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- C. Planning bénévoles
    BEGIN
        UPDATE volunteer_schedules SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- D. Caisses et Ventes de tickets
    BEGIN
        UPDATE cash_registers SET opened_by = NULL WHERE opened_by = p_target_user_id;
        UPDATE cash_registers SET closed_by = NULL WHERE closed_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE ticket_sales SET sold_by = NULL WHERE sold_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- E. Incidents et inventaires
    BEGIN
        UPDATE security_incidents SET reported_by = NULL WHERE reported_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE lost_and_found SET reported_by = NULL WHERE reported_by = p_target_user_id;
        UPDATE lost_and_found SET closed_by = NULL WHERE closed_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE damage_reports SET reported_by = NULL WHERE reported_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE cleaning_rounds SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE decor_items SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- F. Journal d'audit (détacher la clé étrangère pour préserver l'intégrité de l'historique)
    BEGIN
        UPDATE activity_logs SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- G. Supprimer définitivement l'utilisateur de la table app_users
    DELETE FROM app_users WHERE id = p_target_user_id;

    -- H. Consigner la suppression dans le journal d'activité
    BEGIN
        INSERT INTO activity_logs (login, action, entity_type, entity_id, details)
        VALUES (p_admin_login, 'SUPPRESSION_UTILISATEUR', 'user', p_target_user_id, 'Suppression définitive du compte ' || v_target.login);
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Compte supprimé avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Accorder les droits d'exécution pour Supabase
GRANT EXECUTE ON FUNCTION admin_delete_app_user(UUID, TEXT) TO anon, authenticated, service_role;

-- 5. Recharger immédiatement le schéma PostgREST
NOTIFY pgrst, 'reload schema';
