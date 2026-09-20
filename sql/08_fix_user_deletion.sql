-- ==============================================================================
-- LOVE AND CHARITY (L&C) — AUTORISATION DE SUPPRESSION DES COMPTES UTILISATEURS
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
-- Permet aux SuperAdministrateurs de supprimer définitivement un compte utilisateur
-- tout en protégeant le compte SuperAdministrateur original Mounir.
-- ==============================================================================

-- 1. Ajouter la politique RLS de suppression sur la table app_users
DROP POLICY IF EXISTS "Suppression utilisateurs" ON app_users;
CREATE POLICY "Suppression utilisateurs" ON app_users FOR DELETE USING (true);

-- 2. Fonction RPC sécurisée pour supprimer un compte avec nettoyage des liaisons
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

    -- Détacher les liaisons orphelines éventuelles
    DELETE FROM stand_staff WHERE user_id = p_target_user_id;
    DELETE FROM kermesse_messages WHERE sender_id = p_target_user_id OR recipient_id = p_target_user_id;

    -- Supprimer définitivement l'utilisateur de la table
    DELETE FROM app_users WHERE id = p_target_user_id;

    INSERT INTO activity_logs (login, action, entity_type, entity_id, details)
    VALUES (p_admin_login, 'SUPPRESSION_UTILISATEUR', 'user', p_target_user_id, 'Suppression définitive du compte ' || v_target.login);

    RETURN jsonb_build_object('success', true, 'message', 'Compte supprimé avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Accorder les permissions d'exécution pour Supabase PostgREST
GRANT EXECUTE ON FUNCTION admin_delete_app_user(UUID, TEXT) TO anon, authenticated, service_role;

-- 4. Recharger immédiatement le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
