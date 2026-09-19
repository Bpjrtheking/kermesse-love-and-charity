-- ==============================================================================
-- LOVE AND CHARITY (L&C) — RESTRUCTURATION DES 9 PÔLES & RÔLES OPÉRATIONNELS
-- Fichier : 06_nine_poles_restructure.sql
-- ==============================================================================

-- 1. INSERTION ET MISE À JOUR DES 9 RÔLES ADMINISTRATEURS + SUPERADMIN
INSERT INTO roles (code, name, description, is_system, permissions)
VALUES 
(
    'superadmin', 
    'SuperAdministrateur — Coordination Générale', 
    'Accès global, supervision transversale des 9 pôles, gestion des comptes, finances et consignes',
    TRUE,
    '{"all": true}'::jsonb
),
(
    'admin_communication', 
    'Administrateur — Communication & Affichage', 
    'Pôle 1 : Affiches, flyers, réseaux sociaux, WhatsApp, signalétique, plan kermesse, numérotation stands',
    TRUE,
    '{
        "communication_manage": true,
        "stands_view": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_finances', 
    'Administrateur — Billetterie & Caisses', 
    'Pôle 2 : Tickets entrée/jeux/lots/préventes, séries, caisses centrale & stands, fonds de caisse, écarts et clôtures',
    TRUE,
    '{
        "tickets_manage": true,
        "tickets_sell": true,
        "cash_manage": true,
        "finances_view": true,
        "closures_manage": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_decoration', 
    'Administrateur — Décoration & Organisation', 
    'Pôle 3 : Ambiance festive, matériel déco, aménagement des 10 zones et plan d''implantation',
    TRUE,
    '{
        "decoration_manage": true,
        "locations_manage": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_restauration', 
    'Administrateur — Restauration & Buvette', 
    'Pôle 4 : Stocks denrées & boissons, cuisine, emballages, hygiène, ventes buvette et pertes',
    TRUE,
    '{
        "food_manage": true,
        "stocks_manage": true,
        "cash_manage": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_stands', 
    'Administrateur — Stands & Jeux', 
    'Pôle 5 : Gestion des stands (Couleur+N°), catalogue jeux, règles, prix tickets, dotation et équipes stands',
    TRUE,
    '{
        "stands_manage": true,
        "games_view": true,
        "tickets_sell": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_lots', 
    'Administrateur — Lots & Cadeaux', 
    'Pôle 6 : Catalogue des lots (achats & dons), 4 catégories, dotation aux stands et suivi des distributions',
    TRUE,
    '{
        "gifts_manage": true,
        "gifts_allocate": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_benevoles', 
    'Administrateur — Bénévoles & Planning', 
    'Pôle 7 : Fiches bénévoles, contacts WhatsApp, planning créneaux et détection anti-conflits d''affectation',
    TRUE,
    '{
        "users_manage": true,
        "planning_manage": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_logistique', 
    'Administrateur — Logistique & Installation', 
    'Pôle 8 : Matériel lourd (tentes, tables, sono, électricité), propriétaires, chaîne de prêt et checklists',
    TRUE,
    '{
        "materials_manage": true,
        "loans_manage": true,
        "movements_manage": true,
        "returns_manage": true,
        "messages_view": true
    }'::jsonb
),
(
    'admin_securite', 
    'Administrateur — Accueil, Nettoyage & Sécurité', 
    'Pôle 9 : Accueil & objets trouvés, rondes sanitaires & propreté, sécurité, alertes enfants perdus et registre incidents',
    TRUE,
    '{
        "security_manage": true,
        "incidents_manage": true,
        "cleaning_manage": true,
        "messages_view": true
    }'::jsonb
)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

-- 2. TABLE PÔLE 1 : COMMUNICATION & AFFICHAGE
CREATE TABLE IF NOT EXISTS public.communication_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL, -- 'affiche', 'flyer', 'reseaux_sociaux', 'whatsapp', 'annonce', 'signaletique_panneau', 'plan_kermesse'
    responsible_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'a_faire', -- 'a_faire', 'en_cours', 'termine'
    target_date DATE,
    display_location TEXT,
    materials_needed TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLES PÔLE 3 : DÉCORATION & LES 10 ZONES D'ORGANISATION
CREATE TABLE IF NOT EXISTS public.decor_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    manager_name TEXT,
    status TEXT DEFAULT 'en_attente', -- 'en_attente', 'en_cours', 'installe', 'valide'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertion des 10 zones officielles de la kermesse Love & Charity
INSERT INTO public.decor_zones (code, name, description)
VALUES 
('entree', '1. Zone Entrée', 'Accueil principal des visiteurs, contrôle des flux et signalétique d''accueil'),
('sortie', '2. Zone Sortie', 'Dégagement sécurisé des visiteurs, point retour consigne/bracelets'),
('billetterie', '3. Zone Billetterie & Tickets', 'Vente des billets d''entrée, tickets jeux et jetons'),
('restauration', '4. Zone Restauration & Buvette', 'Espace snack, crêpes, boissons, tables de dégustation et poubelles de tri'),
('jeux', '5. Zone Jeux & Animations', 'Alignement des stands de kermesse numérotés et balisés par couleur'),
('lots', '6. Zone Remise des Lots', 'Comptoir central de retrait des gros lots et tombola'),
('repos', '7. Espace Repos & Familles', 'Chaises, bancs, zone ombragée et espace détente enfants'),
('stockage', '8. Espace Stockage & Logistique', 'Stock central denrées, matériel de secours et fournitures'),
('caisse', '9. Espace Caisse Centrale', 'Zone sécurisée pour dépôts de fonds, coffre et comptabilité'),
('organisation', '10. Espace Direction & Secours', 'QG SuperAdmin, poste de premiers secours et régie sonore')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.decor_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_code TEXT REFERENCES public.decor_zones(code) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'ballons', 'guirlandes', 'banderoles', 'tentes_barnums', 'tables_chaises', 'affiches_ambiance', 'autre'
    qty_needed INTEGER NOT NULL DEFAULT 1,
    qty_available INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'prevu', -- 'prevu', 'en_cours', 'installe', 'demonte'
    responsible_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLE PÔLE 7 : PLANNING BÉNÉVOLES & ANTI-CONFLITS
CREATE TABLE IF NOT EXISTS public.volunteer_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id UUID REFERENCES public.members(id) ON DELETE CASCADE,
    member_name TEXT NOT NULL,
    member_phone TEXT,
    location_or_stand TEXT NOT NULL,
    pole_name TEXT,
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    role_title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'planifie', -- 'planifie', 'present', 'retard', 'absent'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABLES PÔLE 9 : ACCUEIL, NETTOYAGE & SÉCURITÉ
CREATE TABLE IF NOT EXISTS public.lost_and_found (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    description TEXT,
    location_found TEXT,
    found_by TEXT,
    status TEXT NOT NULL DEFAULT 'en_attente', -- 'en_attente', 'restitue'
    returned_to TEXT,
    returned_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cleaning_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_name TEXT NOT NULL,
    checker_name TEXT NOT NULL,
    trash_emptied BOOLEAN DEFAULT TRUE,
    toilets_clean BOOLEAN DEFAULT TRUE,
    soap_paper_ok BOOLEAN DEFAULT TRUE,
    notes TEXT,
    checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. POLITIQUES DE SÉCURITÉ (RLS) OUVERTES
ALTER TABLE public.communication_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decor_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.volunteer_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_and_found ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaning_rounds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture communication_items" ON public.communication_items;
CREATE POLICY "Lecture communication_items" ON public.communication_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture communication_items" ON public.communication_items;
CREATE POLICY "Ecriture communication_items" ON public.communication_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture decor_zones" ON public.decor_zones;
CREATE POLICY "Lecture decor_zones" ON public.decor_zones FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture decor_zones" ON public.decor_zones;
CREATE POLICY "Ecriture decor_zones" ON public.decor_zones FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture decor_items" ON public.decor_items;
CREATE POLICY "Lecture decor_items" ON public.decor_items FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture decor_items" ON public.decor_items;
CREATE POLICY "Ecriture decor_items" ON public.decor_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture volunteer_schedules" ON public.volunteer_schedules;
CREATE POLICY "Lecture volunteer_schedules" ON public.volunteer_schedules FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture volunteer_schedules" ON public.volunteer_schedules;
CREATE POLICY "Ecriture volunteer_schedules" ON public.volunteer_schedules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture lost_and_found" ON public.lost_and_found;
CREATE POLICY "Lecture lost_and_found" ON public.lost_and_found FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture lost_and_found" ON public.lost_and_found;
CREATE POLICY "Ecriture lost_and_found" ON public.lost_and_found FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture cleaning_rounds" ON public.cleaning_rounds;
CREATE POLICY "Lecture cleaning_rounds" ON public.cleaning_rounds FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture cleaning_rounds" ON public.cleaning_rounds;
CREATE POLICY "Ecriture cleaning_rounds" ON public.cleaning_rounds FOR ALL USING (true) WITH CHECK (true);
