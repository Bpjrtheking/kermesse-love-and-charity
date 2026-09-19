-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 01 : SCHÉMA RELATIONNEL COMPLET
-- ==============================================================================

-- Activation des extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. RÔLES ET PERMISSIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. UTILISATEURS DE L'APPLICATION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    login TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role_id UUID REFERENCES roles(id) ON DELETE RESTRICT,
    is_active BOOLEAN DEFAULT TRUE,
    must_change_password BOOLEAN DEFAULT TRUE,
    is_original_superadmin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. ÉQUIPES (Couleurs configurables)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_name TEXT NOT NULL, -- Ex: Noir, Blanc, Bleu, Rouge, Vert, Jaune
    color_hex TEXT NOT NULL,  -- Ex: #000000, #ffffff, #2563eb, #dc2626
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. EMPLACEMENTS (Lieux de la kermesse)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL, -- Ex: Stock central, Stand Rouge 1, Scène, Cuisine, Entrée, Véhicule
    precision_details TEXT, -- Ex: Salle 2, derrière le bâtiment principal
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. STANDS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INT NOT NULL,
    color_name TEXT NOT NULL, -- Ex: Rouge, Bleu, Vert, Jaune
    color_hex TEXT NOT NULL,  -- Code couleur pour badges et repères
    name TEXT NOT NULL,       -- Ex: "Rouge 1 - Tir à la corde"
    description TEXT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stand_color_number UNIQUE (color_name, number)
);

-- ------------------------------------------------------------------------------
-- 6. MEMBRES (Bénévoles & Organisation)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    primary_role TEXT NOT NULL, -- "Une personne -> une responsabilité principale"
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter la référence du responsable au stand après création de members
ALTER TABLE stands 
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES members(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 7. AFFECTATIONS DÉTAILLÉES DU PERSONNEL PAR STAND
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stand_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_in_stand TEXT NOT NULL, -- 'caissier', 'lots', 'arbitre_jeu', 'surveillance_enfants'
    gender TEXT, -- 'M', 'F' (utile pour surveillance manèges où mixité requise)
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stand_member_role UNIQUE (stand_id, member_id, role_in_stand)
);

-- ------------------------------------------------------------------------------
-- 8. JEUX
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ticket_price_f INT NOT NULL DEFAULT 100, -- Prix en Francs
    rules_summary TEXT,
    prizes_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 9. TYPES DE TICKETS ET JETONS DE MONNAIE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'rectangulaire_jeu', 'triangulaire_lot', 'jeton_monnaie'
    name TEXT NOT NULL,
    value_f INT NOT NULL DEFAULT 0, -- Valeur faciale ou prix de vente
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    color TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 10. CAISSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_registers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    cashier_id UUID REFERENCES members(id) ON DELETE SET NULL,
    opened_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    initial_amount_f INT NOT NULL DEFAULT 0,
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    expected_amount_f INT DEFAULT 0,
    counted_amount_f INT DEFAULT 0,
    variance_f INT DEFAULT 0, -- counted - expected
    status TEXT NOT NULL DEFAULT 'open', -- 'open', 'closed'
    closing_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 11. VENTES DE TICKETS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    ticket_id UUID NOT NULL REFERENCES tickets_catalog(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    unit_price_f INT NOT NULL CHECK (unit_price_f >= 0),
    total_amount_f INT NOT NULL CHECK (total_amount_f >= 0),
    sold_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 12. MOUVEMENTS DE CAISSE (Opérations financières précises)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'vente', 'remboursement_jeton', 'depense_autorisee', 'apport', 'correction'
    amount_f INT NOT NULL, -- Positif pour entrée, négatif pour sortie
    reason TEXT NOT NULL,
    tokens_detail JSONB, -- Ex: {"200": 1, "100": 2}
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 13. SUIVI DE DETTE DES JETONS DE MONNAIE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS token_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    token_value_f INT NOT NULL CHECK (token_value_f IN (50, 100, 200, 250)),
    quantity_given INT NOT NULL DEFAULT 0,
    quantity_redeemed INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'en_circulation', -- 'en_circulation', 'solde'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 14. NOURRITURE & BOISSONS (Catalogue Produits)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS food_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'boisson', 'snack', 'repas', 'ingredient'
    unit TEXT NOT NULL, -- 'bouteille', 'canette', 'portion', 'kg', 'piece'
    selling_price_f INT NOT NULL DEFAULT 0,
    cost_price_f INT DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    current_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 15. MOUVEMENTS DE STOCK NOURRITURE & BOISSONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES food_products(id) ON DELETE RESTRICT,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    type TEXT NOT NULL, -- 'entree', 'sortie_stand', 'vente', 'perte', 'casse', 'retour'
    quantity INT NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 16. LOTS / CADEAUX (Catalogue)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gifts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT, -- 'peluche', 'jouet', 'gadget', 'friandise', 'grand_lot'
    unit_value_f INT DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    central_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 17. AFFECTATIONS & DISTRIBUTIONS DE LOTS PAR STAND
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS gift_stand_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    gift_id UUID NOT NULL REFERENCES gifts_catalog(id) ON DELETE RESTRICT,
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    allocated_qty INT NOT NULL DEFAULT 0,
    distributed_qty INT NOT NULL DEFAULT 0,
    returned_qty INT NOT NULL DEFAULT 0,
    current_stand_stock INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_gift_stand UNIQUE (gift_id, stand_id)
);

-- ------------------------------------------------------------------------------
-- 18. PROPRIÉTAIRES DE MATÉRIEL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'association', 'externe', 'ecole', 'stade', 'autre_organisme', 'autre'
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 19. MATÉRIEL (Inventaire global)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- 'mobilier', 'sonorisation', 'electricite', 'structure_tente', 'jeux_bois', 'autre'
    owner_id UUID REFERENCES material_owners(id) ON DELETE RESTRICT,
    ownership_status TEXT NOT NULL, -- 'a_nous', 'emprunte', 'loue', 'a_identifier'
    condition TEXT NOT NULL DEFAULT 'bon_etat', -- 'neuf', 'bon_etat', 'use', 'endommage', 'casse'
    quantity_total INT NOT NULL DEFAULT 1,
    current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    current_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'disponible', -- 'disponible', 'affecte', 'en_transit', 'perdu', 'endommage'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 20. EMPRUNTS ET LOCATIONS DE MATÉRIEL
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE RESTRICT,
    owner_id UUID NOT NULL REFERENCES material_owners(id) ON DELETE RESTRICT,
    quantity INT NOT NULL CHECK (quantity > 0),
    pickup_location TEXT NOT NULL,
    return_location TEXT NOT NULL,
    pickup_date DATE NOT NULL,
    expected_return_date DATE NOT NULL,
    actual_return_date DATE,
    pickup_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    current_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    departure_condition TEXT NOT NULL DEFAULT 'bon_etat',
    return_condition TEXT,
    rental_cost_f INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours', 'partiel', 'restitue', 'probleme'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 21. MOUVEMENTS DE MATÉRIEL (Traçabilité des transferts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    quantity INT NOT NULL CHECK (quantity > 0),
    from_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    to_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    from_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    to_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 22. PLAN DE RESTITUTION / ITINÉRAIRE DES RETOURS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS returns_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL, -- Membre en charge de la course
    station_order INT NOT NULL DEFAULT 1,                     -- Station 1, Station 2, etc.
    destination_name TEXT NOT NULL,
    destination_address TEXT,
    material_quantity INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'a_faire', -- 'a_faire', 'en_cours', 'restitue', 'probleme'
    actual_return_date TIMESTAMPTZ,
    proof_url TEXT, -- Justificatif ou photo de restitution
    return_condition TEXT,
    notes TEXT,
    validated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 23. PERTES ET DOMMAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL, -- 'materiel', 'lot', 'nourriture'
    item_id UUID NOT NULL,
    status TEXT NOT NULL,    -- 'perdu', 'endommage', 'casse', 'manquant', 'retrouve'
    quantity INT NOT NULL CHECK (quantity > 0),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    responsible_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    estimated_cost_f INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 24. INCIDENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number TEXT UNIQUE NOT NULL, -- Ex: 'INC-001'
    type TEXT NOT NULL, -- 'disparition_argent', 'disparition_nourriture', 'disparition_materiel', 'ticket_suspect', 'probleme_caisse', 'ecart_stock', 'enfant_non_surveille', 'materiel_endommage', 'probleme_parent', 'autre'
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    persons_involved TEXT,
    severity TEXT NOT NULL DEFAULT 'moyen', -- 'faible', 'moyen', 'eleve', 'critique'
    status TEXT NOT NULL DEFAULT 'ouvert',  -- 'ouvert', 'en_cours', 'resolu'
    assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ajouter clé étrangère de damage_reports vers incidents si nécessaire
ALTER TABLE damage_reports 
    ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL;

-- ------------------------------------------------------------------------------
-- 25. DÉPENSES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount_f INT NOT NULL CHECK (amount_f > 0),
    category TEXT NOT NULL, -- 'nourriture', 'materiel', 'logistique', 'animation', 'imprevu', 'autre'
    motive TEXT NOT NULL,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    receipt_ref TEXT,
    status TEXT NOT NULL DEFAULT 'approuve', -- 'en_attente', 'approuve', 'rejete'
    approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 26. INVENTAIRES COMPARATIFS (Théorique vs Réel)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL,  -- 'nourriture', 'lots', 'materiel', 'global'
    phase TEXT NOT NULL, -- 'initial', 'intermediaire', 'final'
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'en_cours', -- 'en_cours', 'valide'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL, -- 'nourriture', 'lot', 'materiel'
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    theoretical_qty INT NOT NULL DEFAULT 0,
    counted_qty INT NOT NULL DEFAULT 0,
    variance_qty INT NOT NULL DEFAULT 0, -- counted - theoretical
    notes TEXT
);

-- ------------------------------------------------------------------------------
-- 27. CLÔTURES DE STANDS (Verrouillage immuable)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stand_closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE RESTRICT,
    closed_at TIMESTAMPTZ DEFAULT NOW(),
    closed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    total_revenue_f INT NOT NULL DEFAULT 0,
    total_expenses_f INT NOT NULL DEFAULT 0,
    tickets_sold_count INT NOT NULL DEFAULT 0,
    lots_distributed_count INT NOT NULL DEFAULT 0,
    cash_variance_f INT NOT NULL DEFAULT 0,
    summary_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_locked BOOLEAN NOT NULL DEFAULT TRUE,
    exception_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 28. JOURNAL D'ACTIVITÉ / AUDIT (Immuable)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    login TEXT NOT NULL,
    action TEXT NOT NULL,       -- 'CONNEXION', 'VENTE_TICKET', 'SORTIE_STOCK', 'AFFECTATION_MATERIEL', 'CLOTURE_CAISSE', etc.
    entity_type TEXT NOT NULL,  -- 'stand', 'cash', 'ticket', 'stock', 'material', 'loan', 'incident', 'user', 'role'
    entity_id UUID,
    details TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour optimiser les performances de recherche et de filtres
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_login ON activity_logs(login);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_stands_number ON stands(number);
CREATE INDEX IF NOT EXISTS idx_members_stand ON members(stand_id);
CREATE INDEX IF NOT EXISTS idx_members_team ON members(team_id);
CREATE INDEX IF NOT EXISTS idx_cash_movements_reg ON cash_movements(cash_register_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_prod ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_loans_expected_return ON loans(expected_return_date);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
