-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 03 : FONCTIONS RPC, TRIGGERS D'IMMUTABILITÉ ET AUTOMATISATIONS
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DÉCLENCHEUR DE PROTECTION DU SUPERADMINISTRATEUR ORIGINAL
-- Permet de modifier son login, nom et mot de passe, mais empêche STRICTEMENT :
-- la suppression, la désactivation et la rétrogradation du statut original.
-- ------------------------------------------------------------------------------
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
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_original_superadmin ON app_users;
CREATE TRIGGER trg_protect_original_superadmin
BEFORE UPDATE OR DELETE ON app_users
FOR EACH ROW
EXECUTE FUNCTION protect_original_superadmin_func();

-- ------------------------------------------------------------------------------
-- 2. DÉCLENCHEUR D'ACTUALISATION AUTOMATIQUE DES STOCKS DE NOURRITURE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_food_stock_func()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('entree', 'retour') THEN
        UPDATE food_products
        SET current_stock = current_stock + NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.product_id;
    ELSIF NEW.type IN ('sortie_stand', 'vente', 'perte', 'casse') THEN
        UPDATE food_products
        SET current_stock = current_stock - NEW.quantity,
            updated_at = NOW()
        WHERE id = NEW.product_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_food_stock ON stock_movements;
CREATE TRIGGER trg_update_food_stock
AFTER INSERT ON stock_movements
FOR EACH ROW
EXECUTE FUNCTION update_food_stock_func();

-- ------------------------------------------------------------------------------
-- 3. DÉCLENCHEUR POUR LES AFFECTATIONS DE LOTS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_gift_stock_func()
RETURNS TRIGGER AS $$
BEGIN
    NEW.current_stand_stock := NEW.allocated_qty - NEW.distributed_qty - NEW.returned_qty;
    
    IF TG_OP = 'INSERT' THEN
        UPDATE gifts_catalog 
        SET central_stock = central_stock - NEW.allocated_qty,
            updated_at = NOW()
        WHERE id = NEW.gift_id;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE gifts_catalog 
        SET central_stock = central_stock - (NEW.allocated_qty - OLD.allocated_qty) + (NEW.returned_qty - OLD.returned_qty),
            updated_at = NOW()
        WHERE id = NEW.gift_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_gift_stock ON gift_stand_allocations;
CREATE TRIGGER trg_sync_gift_stock
BEFORE INSERT OR UPDATE ON gift_stand_allocations
FOR EACH ROW
EXECUTE FUNCTION sync_gift_stock_func();

-- ------------------------------------------------------------------------------
-- 4. FONCTION RPC D'AUTHENTIFICATION PAR LOGIN + MOT DE PASSE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION authenticate_user(
    p_login TEXT,
    p_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user RECORD;
    v_password_matches BOOLEAN;
BEGIN
    SELECT u.*, r.code AS role_code, r.name AS role_name, r.permissions AS role_permissions
    INTO v_user
    FROM app_users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE LOWER(TRIM(u.login)) = LOWER(TRIM(p_login));

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Identifiants incorrects (login introuvable).');
    END IF;

    IF v_user.is_active = FALSE THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce compte a été désactivé par l''administration.');
    END IF;

    v_password_matches := (v_user.password_hash = crypt(p_password, v_user.password_hash));

    IF NOT v_password_matches THEN
        RETURN jsonb_build_object('success', false, 'message', 'Mot de passe incorrect.');
    END IF;

    UPDATE app_users SET last_login = NOW() WHERE id = v_user.id;

    INSERT INTO activity_logs (user_id, login, action, entity_type, entity_id, details)
    VALUES (v_user.id, v_user.login, 'CONNEXION', 'user', v_user.id, 'Connexion réussie à l''application');

    RETURN jsonb_build_object(
        'success', true,
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

-- ------------------------------------------------------------------------------
-- 5. FONCTION RPC DE CHANGEMENT DE MOT DE PASSE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION change_user_password(
    p_user_id UUID,
    p_old_password TEXT,
    p_new_password TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_current_hash TEXT;
    v_login TEXT;
    v_is_valid BOOLEAN;
BEGIN
    IF LENGTH(TRIM(p_new_password)) < 8 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le nouveau mot de passe doit comporter au moins 8 caractères.');
    END IF;

    SELECT password_hash, login INTO v_current_hash, v_login
    FROM app_users WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Utilisateur introuvable.');
    END IF;

    v_is_valid := (v_current_hash = crypt(p_old_password, v_current_hash));
    IF NOT v_is_valid THEN
        RETURN jsonb_build_object('success', false, 'message', 'L''ancien mot de passe est erroné.');
    END IF;

    UPDATE app_users
    SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
        must_change_password = FALSE,
        updated_at = NOW()
    WHERE id = p_user_id;

    INSERT INTO activity_logs (user_id, login, action, entity_type, entity_id, details)
    VALUES (p_user_id, v_login, 'CHANGEMENT_MOT_DE_PASSE', 'user', p_user_id, 'Modification du mot de passe');

    RETURN jsonb_build_object('success', true, 'message', 'Mot de passe mis à jour avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 6. FONCTION RPC POUR METTRE À JOUR LE PROFIL (LOGIN & NOM COMPLET)
-- Permet au SuperAdmin (et aux admins) de personnaliser leur login à tout moment
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_user_profile(
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

-- ------------------------------------------------------------------------------
-- 7. FONCTION RPC POUR CRÉER UN UTILISATEUR (SUPERADMIN OU ADMINISTRATEUR MÉTIER)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_create_app_user(
    p_login TEXT,
    p_password TEXT,
    p_full_name TEXT,
    p_role_code TEXT,
    p_creator_login TEXT DEFAULT 'Admin'
)
RETURNS JSONB AS $$
DECLARE
    v_role_id UUID;
    v_new_id UUID;
    v_clean_login TEXT := TRIM(p_login);
BEGIN
    IF LENGTH(v_clean_login) < 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le login doit comporter au moins 3 caractères.');
    END IF;

    IF EXISTS (SELECT 1 FROM app_users WHERE LOWER(login) = LOWER(v_clean_login)) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce login est déjà utilisé par un autre compte.');
    END IF;

    SELECT id INTO v_role_id FROM roles WHERE code = p_role_code;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Rôle spécifié introuvable : ' || p_role_code);
    END IF;

    INSERT INTO app_users (
        login, password_hash, full_name, role_id, is_active, must_change_password, is_original_superadmin
    ) VALUES (
        v_clean_login, crypt(p_password, gen_salt('bf', 10)), TRIM(p_full_name), v_role_id, TRUE, FALSE, FALSE
    ) RETURNING id INTO v_new_id;

    INSERT INTO activity_logs (login, action, entity_type, entity_id, details)
    VALUES (p_creator_login, 'CREATION_UTILISATEUR', 'user', v_new_id, 'Création du compte utilisateur ' || v_clean_login || ' avec rôle ' || p_role_code);

    RETURN jsonb_build_object('success', true, 'user_id', v_new_id, 'message', 'Utilisateur créé avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ------------------------------------------------------------------------------
-- 8. FONCTION RPC POUR MODIFIER/RÉINITIALISER UN COMPTE PAR LE SUPERADMIN
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_reset_user_credentials(
    p_target_user_id UUID,
    p_new_login TEXT,
    p_new_password TEXT DEFAULT NULL,
    p_new_name TEXT DEFAULT NULL,
    p_new_role_code TEXT DEFAULT NULL,
    p_admin_login TEXT DEFAULT 'SuperAdmin'
)
RETURNS JSONB AS $$
DECLARE
    v_clean_login TEXT := TRIM(p_new_login);
    v_clean_name TEXT := TRIM(p_new_name);
    v_role_id UUID;
    v_is_target_original BOOLEAN;
BEGIN
    SELECT is_original_superadmin INTO v_is_target_original FROM app_users WHERE id = p_target_user_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'Utilisateur introuvable.');
    END IF;

    IF LENGTH(v_clean_login) < 3 THEN
        RETURN jsonb_build_object('success', false, 'message', 'Le login doit comporter au moins 3 caractères.');
    END IF;

    IF EXISTS (SELECT 1 FROM app_users WHERE LOWER(login) = LOWER(v_clean_login) AND id <> p_target_user_id) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Ce login est déjà utilisé par un autre compte.');
    END IF;

    UPDATE app_users
    SET login = v_clean_login,
        full_name = COALESCE(NULLIF(v_clean_name, ''), full_name),
        must_change_password = FALSE,
        updated_at = NOW()
    WHERE id = p_target_user_id;

    -- Mise à jour du mot de passe si renseigné
    IF p_new_password IS NOT NULL AND LENGTH(TRIM(p_new_password)) >= 6 THEN
        UPDATE app_users
        SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
            must_change_password = FALSE
        WHERE id = p_target_user_id;
    END IF;

    -- Mise à jour du rôle si renseigné et non original
    IF p_new_role_code IS NOT NULL AND v_is_target_original = FALSE THEN
        SELECT id INTO v_role_id FROM roles WHERE code = p_new_role_code;
        IF FOUND THEN
            UPDATE app_users SET role_id = v_role_id WHERE id = p_target_user_id;
        END IF;
    END IF;

    INSERT INTO activity_logs (login, action, entity_type, entity_id, details)
    VALUES (p_admin_login, 'MODIFICATION_IDENTIFIANTS', 'user', p_target_user_id, 'Modification des identifiants du compte ' || v_clean_login);

    RETURN jsonb_build_object('success', true, 'message', 'Identifiants mis à jour avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
