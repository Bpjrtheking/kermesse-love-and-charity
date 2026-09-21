-- ==============================================================================
-- LOVE AND CHARITY (L&C) — PURGE DES ANCIENS RÔLES & HARMONISATION DES 9 PÔLES
-- Fichier : 09_cleanup_official_roles_only.sql
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
--
-- Ce script :
-- 1. Réassigne les utilisateurs des anciens rôles résiduels vers les 9 vrais pôles.
-- 2. Supprime définitivement "admin_food" (nourriture), "admin_material", "admin_stand", etc.
-- 3. Renomme les 9 rôles pour correspondre mot à mot aux 9 pôles officiels.
-- ==============================================================================

DO $$
DECLARE
    v_restauration_id UUID;
    v_logistique_id UUID;
    v_stands_id UUID;
    v_lots_id UUID;
    v_securite_id UUID;
BEGIN
    SELECT id INTO v_restauration_id FROM roles WHERE code = 'admin_restauration';
    SELECT id INTO v_logistique_id FROM roles WHERE code = 'admin_logistique';
    SELECT id INTO v_stands_id FROM roles WHERE code = 'admin_stands';
    SELECT id INTO v_lots_id FROM roles WHERE code = 'admin_lots';
    SELECT id INTO v_securite_id FROM roles WHERE code = 'admin_securite';

    -- Si un utilisateur avait l'ancien rôle "admin_food" -> le basculer sur "admin_restauration"
    IF v_restauration_id IS NOT NULL THEN
        UPDATE app_users SET role_id = v_restauration_id
        WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin_food');
    END IF;

    -- Si un utilisateur avait l'ancien rôle "admin_material" -> le basculer sur "admin_logistique"
    IF v_logistique_id IS NOT NULL THEN
        UPDATE app_users SET role_id = v_logistique_id
        WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin_material');
    END IF;

    -- Si un utilisateur avait l'ancien rôle "admin_stand" -> le basculer sur "admin_stands"
    IF v_stands_id IS NOT NULL THEN
        UPDATE app_users SET role_id = v_stands_id
        WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin_stand');
    END IF;

    -- Si un utilisateur avait l'ancien rôle "admin_gifts" -> le basculer sur "admin_lots"
    IF v_lots_id IS NOT NULL THEN
        UPDATE app_users SET role_id = v_lots_id
        WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin_gifts');
    END IF;

    -- Si un utilisateur avait l'ancien rôle "admin_security" -> le basculer sur "admin_securite"
    IF v_securite_id IS NOT NULL THEN
        UPDATE app_users SET role_id = v_securite_id
        WHERE role_id IN (SELECT id FROM roles WHERE code = 'admin_security');
    END IF;
END $$;

-- 2. Supprimer TOUS les rôles obsolètes qui ne correspondent pas aux 9 pôles officiels
DELETE FROM roles
WHERE code NOT IN (
    'superadmin',
    'admin_communication',
    'admin_finances',
    'admin_decoration',
    'admin_restauration',
    'admin_stands',
    'admin_lots',
    'admin_benevoles',
    'admin_logistique',
    'admin_securite'
);

-- 3. Mettre à jour les intitulés officiels et permissions JSONB strictes des 9 rôles (+ SuperAdmin)
UPDATE roles SET 
    name = '👑 SuperAdministrateur — Coordination Générale', 
    description = 'Accès global, supervision des 9 pôles, gestion des comptes et finances',
    permissions = '{"all": true}'::jsonb
WHERE code = 'superadmin';

UPDATE roles SET 
    name = '📢 Responsable — Communication & Affichage', 
    description = 'Pôle 1 : Affiches, flyers, réseaux sociaux, WhatsApp, signalétique, plan kermesse',
    permissions = '{"communication_manage": true}'::jsonb
WHERE code = 'admin_communication';

UPDATE roles SET 
    name = '🎟️ Responsable — Billetterie / Tickets / Caisse / Comptabilité', 
    description = 'Pôle 2 : Tickets entrée/jeux/lots/préventes, séries, caisses centrale & stands, écarts',
    permissions = '{"tickets_manage": true, "tickets_sell": true, "cash_manage": true, "closures_manage": true, "finances_view": true}'::jsonb
WHERE code = 'admin_finances';

UPDATE roles SET 
    name = '🎨 Responsable — Organisation & Décoration', 
    description = 'Pôle 3 : Ambiance festive, matériel déco, aménagement des zones et plan d''implantation',
    permissions = '{"decoration_manage": true, "locations_manage": true}'::jsonb
WHERE code = 'admin_decoration';

UPDATE roles SET 
    name = '🍔 Responsable — Restauration', 
    description = 'Pôle 4 : Cuisine, boissons, snacks, stocks denrées, hygiène et réapprovisionnements',
    permissions = '{"food_manage": true, "stocks_manage": true}'::jsonb
WHERE code = 'admin_restauration';

UPDATE roles SET 
    name = '🎪 Responsable — Stands & Jeux', 
    description = 'Pôle 5 : Gestion des stands (Couleur+N°), catalogue jeux, règles, prix tickets, équipes stands',
    permissions = '{"stands_manage": true, "games_manage": true}'::jsonb
WHERE code = 'admin_stands';

UPDATE roles SET 
    name = '🎁 Responsable — Lots à gagner', 
    description = 'Pôle 6 : Catalogue des lots (achats & dons), dotations stands et suivi des distributions',
    permissions = '{"gifts_manage": true}'::jsonb
WHERE code = 'admin_lots';

UPDATE roles SET 
    name = '👥 Responsable — Planning & Bénévoles', 
    description = 'Pôle 7 : Fiches bénévoles, contacts WhatsApp, planning créneaux et anti-conflits',
    permissions = '{"planning_manage": true, "users_manage": true}'::jsonb
WHERE code = 'admin_benevoles';

UPDATE roles SET 
    name = '📦 Responsable — Logistique & Installation', 
    description = 'Pôle 8 : Matériel lourd (tentes, tables, sono, électricité), chaîne de prêt et checklists',
    permissions = '{"materials_manage": true, "loans_manage": true, "returns_manage": true}'::jsonb
WHERE code = 'admin_logistique';

UPDATE roles SET 
    name = '🛡️ Responsable — Accueil & Sécurité', 
    description = 'Pôle 9 : Accueil, objets trouvés, rondes sanitaires, urgences et registre incidents',
    permissions = '{"security_manage": true, "incidents_manage": true, "cleaning_manage": true}'::jsonb
WHERE code = 'admin_securite';

NOTIFY pgrst, 'reload schema';
