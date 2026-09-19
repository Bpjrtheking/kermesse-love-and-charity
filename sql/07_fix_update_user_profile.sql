-- ==============================================================================
-- LOVE AND CHARITY (L&C) — AUTORISATION DE MODIFICATION DU LOGIN DU SUPERADMIN
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Remplacer la fonction du trigger de protection pour autoriser le changement de login
CREATE OR REPLACE FUNCTION protect_original_superadmin_func()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.is_original_superadmin = TRUE) THEN
        -- Interdire formellement la suppression du compte SuperAdmin original
        IF TG_OP = 'DELETE' THEN
            RAISE EXCEPTION 'Action interdite : Le compte SuperAdministrateur original ne peut jamais être supprimé.';
        END IF;

        IF TG_OP = 'UPDATE' THEN
            -- Le login, le nom complet et le mot de passe sont libres d'être modifiés !
            -- Seules la désactivation et la perte du statut original sont bloquées :
            IF NEW.is_active = FALSE THEN
                RAISE EXCEPTION 'Action interdite : Le compte SuperAdministrateur original ne peut pas être désactivé.';
            END IF;

            IF NEW.is_original_superadmin = FALSE THEN
                RAISE EXCEPTION 'Action interdite : Le statut de SuperAdministrateur original ne peut pas être révoqué.';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Réattacher le déclencheur
DROP TRIGGER IF EXISTS trg_protect_original_superadmin ON app_users;
CREATE TRIGGER trg_protect_original_superadmin
BEFORE UPDATE OR DELETE ON app_users
FOR EACH ROW
EXECUTE FUNCTION protect_original_superadmin_func();

-- 2. Fonction RPC pour modifier le profil
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
        RETURN jsonb_build_object('success', false, 'message', 'Ce login est déjà utilisé par un autre compte.');
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

-- 3. Droits d'exécution pour PostgREST / Supabase
GRANT EXECUTE ON FUNCTION public.update_user_profile(UUID, TEXT, TEXT) TO anon, authenticated, service_role;

-- 4. Recharger immédiatement le cache du schéma PostgREST
NOTIFY pgrst, 'reload schema';
