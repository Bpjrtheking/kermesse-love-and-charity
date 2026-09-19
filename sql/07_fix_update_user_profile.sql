-- ==============================================================================
-- LOVE AND CHARITY (L&C) — CORRECTIF FONCTION UPDATE_USER_PROFILE
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
-- Permet au SuperAdmin et aux utilisateurs de mettre à jour leur identifiant (login)
-- et leur nom sans erreur de cache de schéma.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_user_profile(
    p_user_id UUID,
    p_new_login TEXT,
    p_new_name TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_clean_login TEXT := TRIM(p_new_login);
    v_clean_name TEXT := TRIM(p_new_name);
    v_user RECORD;
BEGIN
    IF LENGTH(v_clean_login) < 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le login doit comporter au moins 3 caractères.');
    END IF;

    IF EXISTS (SELECT 1 FROM app_users WHERE LOWER(login) = LOWER(v_clean_login) AND id <> p_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce login est déjà utilisé par un autre utilisateur.');
    END IF;

    UPDATE app_users
    SET login = v_clean_login,
        full_name = v_clean_name,
        updated_at = NOW()
    WHERE id = p_user_id;

    SELECT u.*, r.code AS role_code, r.name AS role_name, r.permissions AS role_permissions
    INTO v_user
    FROM app_users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.id = p_user_id;

    INSERT INTO activity_logs (user_id, login, action, entity_type, entity_id, details)
    VALUES (p_user_id, v_clean_login, 'MODIFICATION_PROFIL', 'user', p_user_id, 'Mise à jour du profil : login=' || v_clean_login || ', nom=' || v_clean_name);

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Profil mis à jour avec succès.',
        'user', jsonb_build_object(
            'id', v_user.id,
            'login', v_user.login,
            'full_name', v_user.full_name,
            'role_id', v_user.role_id,
            'role_code', v_user.role_code,
            'role_name', v_user.role_name,
            'permissions', v_user.role_permissions,
            'must_change_password', v_user.must_change_password,
            'is_original_superadmin', v_user.is_original_superadmin
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attribution des permissions d'exécution pour PostgREST / Supabase
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- Recharger immédiatement le cache du schéma PostgREST dans Supabase
NOTIFY pgrst, 'reload schema';
