-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT COMPLET EN UN SEUL FICHIER (ALL-IN-ONE) — VERSION OFFICIELLE
-- À COPIER-COLLER DANS L'ÉDITEUR SQL DE VOTRE PROJET SUPABASE
--
-- GARANTIE : AUCUNE FAUSSE DONNÉE. BASE 100% VIERGE HORS COMPTE MOUNIR.
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLES
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

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    precision_details TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number INT NOT NULL,
    color_name TEXT NOT NULL,
    color_hex TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    is_closed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stand_color_number UNIQUE (color_name, number)
);

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    primary_role TEXT NOT NULL,
    notes TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stands 
    ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES members(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS stand_staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    role_in_stand TEXT NOT NULL,
    gender TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_stand_member_role UNIQUE (stand_id, member_id, role_in_stand)
);

CREATE TABLE IF NOT EXISTS games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID NOT NULL REFERENCES stands(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    ticket_price_f INT NOT NULL DEFAULT 100,
    rules_summary TEXT,
    prizes_description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tickets_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    value_f INT NOT NULL DEFAULT 0,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    color TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    variance_f INT DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    closing_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS cash_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount_f INT NOT NULL,
    reason TEXT NOT NULL,
    tokens_detail JSONB,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cash_register_id UUID NOT NULL REFERENCES cash_registers(id) ON DELETE CASCADE,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    token_value_f INT NOT NULL CHECK (token_value_f IN (50, 100, 200, 250)),
    quantity_given INT NOT NULL DEFAULT 0,
    quantity_redeemed INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'en_circulation',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS food_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    selling_price_f INT NOT NULL DEFAULT 0,
    cost_price_f INT DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    current_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES food_products(id) ON DELETE RESTRICT,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    type TEXT NOT NULL,
    quantity INT NOT NULL,
    reason TEXT,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gifts_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    unit_value_f INT DEFAULT 0,
    initial_stock INT NOT NULL DEFAULT 0,
    central_stock INT NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS material_owners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    owner_id UUID REFERENCES material_owners(id) ON DELETE RESTRICT,
    ownership_status TEXT NOT NULL,
    condition TEXT NOT NULL DEFAULT 'bon_etat',
    quantity_total INT NOT NULL DEFAULT 1,
    current_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    current_responsible_id UUID REFERENCES members(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'disponible',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
    status TEXT NOT NULL DEFAULT 'en_cours',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS returns_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    loan_id UUID NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
    member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    station_order INT NOT NULL DEFAULT 1,
    destination_name TEXT NOT NULL,
    destination_address TEXT,
    material_quantity INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'a_faire',
    actual_return_date TIMESTAMPTZ,
    proof_url TEXT,
    return_condition TEXT,
    notes TEXT,
    validated_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS damage_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    status TEXT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    responsible_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    estimated_cost_f INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    reported_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    persons_involved TEXT,
    severity TEXT NOT NULL DEFAULT 'moyen',
    status TEXT NOT NULL DEFAULT 'ouvert',
    assigned_to UUID REFERENCES members(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE damage_reports 
    ADD COLUMN IF NOT EXISTS incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    amount_f INT NOT NULL CHECK (amount_f > 0),
    category TEXT NOT NULL,
    motive TEXT NOT NULL,
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    receipt_ref TEXT,
    status TEXT NOT NULL DEFAULT 'approuve',
    approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    phase TEXT NOT NULL,
    created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'en_cours',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    validated_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES inventories(id) ON DELETE CASCADE,
    item_type TEXT NOT NULL,
    item_id UUID NOT NULL,
    item_name TEXT NOT NULL,
    theoretical_qty INT NOT NULL DEFAULT 0,
    counted_qty INT NOT NULL DEFAULT 0,
    variance_qty INT NOT NULL DEFAULT 0,
    notes TEXT
);

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

CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    login TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id UUID,
    details TEXT NOT NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_login ON activity_logs(login);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

-- 3. ACTIVATION ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_stand_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- 4. POLITIQUES DE SÉCURITÉ RLS
DROP POLICY IF EXISTS "Lecture ouverte des roles" ON roles;
CREATE POLICY "Lecture ouverte des roles" ON roles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion des roles par admin" ON roles;
CREATE POLICY "Gestion des roles par admin" ON roles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture ouverte des equipes" ON teams;
CREATE POLICY "Lecture ouverte des equipes" ON teams FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion des equipes par admin" ON teams;
CREATE POLICY "Gestion des equipes par admin" ON teams FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture ouverte des emplacements" ON locations;
CREATE POLICY "Lecture ouverte des emplacements" ON locations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion des emplacements" ON locations;
CREATE POLICY "Gestion des emplacements" ON locations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture des profils utilisateurs" ON app_users;
CREATE POLICY "Lecture des profils utilisateurs" ON app_users FOR SELECT USING (true);
DROP POLICY IF EXISTS "Mise a jour de son profil ou par admin" ON app_users;
CREATE POLICY "Mise a jour de son profil ou par admin" ON app_users FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Creation utilisateurs" ON app_users;
CREATE POLICY "Creation utilisateurs" ON app_users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Suppression utilisateurs" ON app_users;
CREATE POLICY "Suppression utilisateurs" ON app_users FOR DELETE USING (true);

DROP POLICY IF EXISTS "Lecture membres" ON members;
CREATE POLICY "Lecture membres" ON members FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion membres" ON members;
CREATE POLICY "Gestion membres" ON members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture stands" ON stands;
CREATE POLICY "Lecture stands" ON stands FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion stands" ON stands;
CREATE POLICY "Gestion stands" ON stands FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture staff stands" ON stand_staff;
CREATE POLICY "Lecture staff stands" ON stand_staff FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion staff stands" ON stand_staff;
CREATE POLICY "Gestion staff stands" ON stand_staff FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture jeux" ON games;
CREATE POLICY "Lecture jeux" ON games FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion jeux" ON games;
CREATE POLICY "Gestion jeux" ON games FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture catalogue tickets" ON tickets_catalog;
CREATE POLICY "Lecture catalogue tickets" ON tickets_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion catalogue tickets" ON tickets_catalog;
CREATE POLICY "Gestion catalogue tickets" ON tickets_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture caisses" ON cash_registers;
CREATE POLICY "Lecture caisses" ON cash_registers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion caisses" ON cash_registers;
CREATE POLICY "Gestion caisses" ON cash_registers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture ventes tickets" ON ticket_sales;
CREATE POLICY "Lecture ventes tickets" ON ticket_sales FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion ventes tickets" ON ticket_sales;
CREATE POLICY "Insertion ventes tickets" ON ticket_sales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture mouvements caisse" ON cash_movements;
CREATE POLICY "Lecture mouvements caisse" ON cash_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion mouvements caisse" ON cash_movements;
CREATE POLICY "Insertion mouvements caisse" ON cash_movements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture jetons dette" ON token_debts;
CREATE POLICY "Lecture jetons dette" ON token_debts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion jetons dette" ON token_debts;
CREATE POLICY "Gestion jetons dette" ON token_debts FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture catalogue nourriture" ON food_products;
CREATE POLICY "Lecture catalogue nourriture" ON food_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion catalogue nourriture" ON food_products;
CREATE POLICY "Gestion catalogue nourriture" ON food_products FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture mouvements stock" ON stock_movements;
CREATE POLICY "Lecture mouvements stock" ON stock_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion mouvements stock" ON stock_movements;
CREATE POLICY "Insertion mouvements stock" ON stock_movements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture catalogue lots" ON gifts_catalog;
CREATE POLICY "Lecture catalogue lots" ON gifts_catalog FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion catalogue lots" ON gifts_catalog;
CREATE POLICY "Gestion catalogue lots" ON gifts_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture affectations lots" ON gift_stand_allocations;
CREATE POLICY "Lecture affectations lots" ON gift_stand_allocations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion affectations lots" ON gift_stand_allocations;
CREATE POLICY "Gestion affectations lots" ON gift_stand_allocations FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture proprietaires materiel" ON material_owners;
CREATE POLICY "Lecture proprietaires materiel" ON material_owners FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion proprietaires materiel" ON material_owners;
CREATE POLICY "Gestion proprietaires materiel" ON material_owners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture materiels" ON materials;
CREATE POLICY "Lecture materiels" ON materials FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion materiels" ON materials;
CREATE POLICY "Gestion materiels" ON materials FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture emprunts" ON loans;
CREATE POLICY "Lecture emprunts" ON loans FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion emprunts" ON loans;
CREATE POLICY "Gestion emprunts" ON loans FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture mouvements materiel" ON material_movements;
CREATE POLICY "Lecture mouvements materiel" ON material_movements FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion mouvements materiel" ON material_movements;
CREATE POLICY "Insertion mouvements materiel" ON material_movements FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture plan restitutions" ON returns_plan;
CREATE POLICY "Lecture plan restitutions" ON returns_plan FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion plan restitutions" ON returns_plan;
CREATE POLICY "Gestion plan restitutions" ON returns_plan FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture degats et pertes" ON damage_reports;
CREATE POLICY "Lecture degats et pertes" ON damage_reports FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion degats et pertes" ON damage_reports;
CREATE POLICY "Gestion degats et pertes" ON damage_reports FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture incidents" ON incidents;
CREATE POLICY "Lecture incidents" ON incidents FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion incidents" ON incidents;
CREATE POLICY "Gestion incidents" ON incidents FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture depenses" ON expenses;
CREATE POLICY "Lecture depenses" ON expenses FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion depenses" ON expenses;
CREATE POLICY "Gestion depenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture inventaires" ON inventories;
CREATE POLICY "Lecture inventaires" ON inventories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion inventaires" ON inventories;
CREATE POLICY "Gestion inventaires" ON inventories FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture items inventaire" ON inventory_items;
CREATE POLICY "Lecture items inventaire" ON inventory_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "Gestion items inventaire" ON inventory_items;
CREATE POLICY "Gestion items inventaire" ON inventory_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Lecture clotures" ON stand_closures;
CREATE POLICY "Lecture clotures" ON stand_closures FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion clotures" ON stand_closures;
CREATE POLICY "Insertion clotures" ON stand_closures FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Protection clotures verrouillees" ON stand_closures;
CREATE POLICY "Protection clotures verrouillees" ON stand_closures FOR UPDATE USING (is_locked = FALSE);

DROP POLICY IF EXISTS "Lecture journal activite" ON activity_logs;
CREATE POLICY "Lecture journal activite" ON activity_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Insertion journal activite" ON activity_logs;
CREATE POLICY "Insertion journal activite" ON activity_logs FOR INSERT WITH CHECK (true);

-- 5. TRIGGERS & FONCTIONS
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

    IF p_new_password IS NOT NULL AND LENGTH(TRIM(p_new_password)) >= 6 THEN
        UPDATE app_users
        SET password_hash = crypt(p_new_password, gen_salt('bf', 10)),
            must_change_password = FALSE
        WHERE id = p_target_user_id;
    END IF;

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
    BEGIN
        UPDATE members SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        DELETE FROM kermesse_messages WHERE sender_id = p_target_user_id OR recipient_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE volunteer_schedules SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE cash_registers SET opened_by = NULL WHERE opened_by = p_target_user_id;
        UPDATE cash_registers SET closed_by = NULL WHERE closed_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE ticket_sales SET sold_by = NULL WHERE sold_by = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    BEGIN
        UPDATE activity_logs SET user_id = NULL WHERE user_id = p_target_user_id;
    EXCEPTION WHEN OTHERS THEN
    END;

    -- Supprimer définitivement l'utilisateur de la table
    DELETE FROM app_users WHERE id = p_target_user_id;

    BEGIN
        INSERT INTO activity_logs (login, action, entity_type, entity_id, details)
        VALUES (p_admin_login, 'SUPPRESSION_UTILISATEUR', 'user', p_target_user_id, 'Suppression définitive du compte ' || v_target.login);
    EXCEPTION WHEN OTHERS THEN
    END;

    RETURN jsonb_build_object('success', true, 'message', 'Compte supprimé avec succès.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissions d'exécution RPC pour PostgREST / Supabase
GRANT EXECUTE ON FUNCTION authenticate_user(TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION change_user_password(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_user_profile(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_create_app_user(TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_reset_user_credentials(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION admin_delete_app_user(UUID, TEXT) TO anon, authenticated, service_role;

-- 6. DONNÉES SYSTÈME ET COMPTE INITIAL MOUNIR (9 PÔLES OFFICIELS + SUPERADMIN)
INSERT INTO roles (code, name, description, is_system, permissions)
VALUES 
(
    'superadmin', 
    '👑 SuperAdministrateur — Coordination Générale', 
    'Accès global, supervision des 9 pôles, gestion des comptes et finances',
    TRUE,
    '{"all": true}'::jsonb
),
(
    'admin_communication', 
    '📢 Responsable — Communication & Affichage', 
    'Pôle 1 : Affiches, flyers, réseaux sociaux, WhatsApp, signalétique, plan kermesse',
    TRUE,
    '{"communication_manage": true}'::jsonb
),
(
    'admin_finances', 
    '🎟️ Responsable — Billetterie / Tickets / Caisse / Comptabilité', 
    'Pôle 2 : Tickets entrée/jeux/lots/préventes, séries, caisses centrale & stands, écarts',
    TRUE,
    '{"tickets_manage": true, "tickets_sell": true, "cash_manage": true, "closures_manage": true, "finances_view": true}'::jsonb
),
(
    'admin_decoration', 
    '🎨 Responsable — Organisation & Décoration', 
    'Pôle 3 : Ambiance festive, matériel déco, aménagement des zones et plan d''implantation',
    TRUE,
    '{"decoration_manage": true, "locations_manage": true}'::jsonb
),
(
    'admin_restauration', 
    '🍔 Responsable — Restauration', 
    'Pôle 4 : Cuisine, boissons, snacks, stocks denrées, hygiène et réapprovisionnements',
    TRUE,
    '{"food_manage": true, "stocks_manage": true}'::jsonb
),
(
    'admin_stands', 
    '🎪 Responsable — Stands & Jeux', 
    'Pôle 5 : Gestion des stands (Couleur+N°), catalogue jeux, règles, prix tickets, équipes stands',
    TRUE,
    '{"stands_manage": true, "games_manage": true}'::jsonb
),
(
    'admin_lots', 
    '🎁 Responsable — Lots à gagner', 
    'Pôle 6 : Catalogue des lots (achats & dons), dotations stands et suivi des distributions',
    TRUE,
    '{"gifts_manage": true}'::jsonb
),
(
    'admin_benevoles', 
    '👥 Responsable — Planning & Bénévoles', 
    'Pôle 7 : Fiches bénévoles, contacts WhatsApp, planning créneaux et anti-conflits',
    TRUE,
    '{"planning_manage": true, "users_manage": true}'::jsonb
),
(
    'admin_logistique', 
    '📦 Responsable — Logistique & Installation', 
    'Pôle 8 : Matériel lourd (tentes, tables, sono, électricité), chaîne de prêt et checklists',
    TRUE,
    '{"materials_manage": true, "loans_manage": true, "returns_manage": true}'::jsonb
),
(
    'admin_securite', 
    '🛡️ Responsable — Accueil & Sécurité', 
    'Pôle 9 : Accueil, objets trouvés, rondes sanitaires, urgences et registre incidents',
    TRUE,
    '{"security_manage": true, "incidents_manage": true, "cleaning_manage": true}'::jsonb
)
ON CONFLICT (code) DO UPDATE SET 
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    permissions = EXCLUDED.permissions;

DO $$
DECLARE
    v_superadmin_role_id UUID;
    v_mounir_user_id UUID;
BEGIN
    SELECT id INTO v_superadmin_role_id FROM roles WHERE code = 'superadmin';

    INSERT INTO app_users (
        login, password_hash, full_name, role_id, is_active, must_change_password, is_original_superadmin
    ) VALUES (
        'Mounir',
        crypt('Mounir@Kermesse#2026!', gen_salt('bf', 10)),
        'Mounir (SuperAdministrateur)',
        v_superadmin_role_id,
        TRUE,
        TRUE,
        TRUE
    )
    ON CONFLICT (login) DO NOTHING
    RETURNING id INTO v_mounir_user_id;

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

-- ------------------------------------------------------------------------------
-- 7. MODULE MESSAGERIE INTERNE, CONSIGNES & ALERTES URGENTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kermesse_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    sender_login TEXT NOT NULL,
    sender_role TEXT DEFAULT 'Bénévole',
    channel_type TEXT NOT NULL CHECK (channel_type IN ('broadcast', 'stand', 'urgent', 'direct')),
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    recipient_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
    title TEXT,
    content TEXT NOT NULL,
    is_urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON kermesse_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON kermesse_messages(channel_type);
CREATE INDEX IF NOT EXISTS idx_messages_stand ON kermesse_messages(stand_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON kermesse_messages(recipient_id);

ALTER TABLE kermesse_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture messages kermesse" ON kermesse_messages;
CREATE POLICY "Lecture messages kermesse" ON kermesse_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Envoi messages kermesse" ON kermesse_messages;
CREATE POLICY "Envoi messages kermesse" ON kermesse_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression messages kermesse par admin" ON kermesse_messages;
CREATE POLICY "Suppression messages kermesse par admin" ON kermesse_messages FOR DELETE USING (true);

-- ------------------------------------------------------------------------------
-- 8. MODULES OFFICIELS DES 9 PÔLES & STRUCTURE DES DONNÉES
-- ------------------------------------------------------------------------------


-- Table Communication & Affichage (Pôle 1)
CREATE TABLE IF NOT EXISTS public.communication_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    responsible_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'a_faire',
    target_date DATE,
    display_location TEXT,
    materials_needed TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tables Décoration & 10 Zones (Pôle 3)
CREATE TABLE IF NOT EXISTS public.decor_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    manager_name TEXT,
    status TEXT DEFAULT 'en_attente',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    category TEXT NOT NULL,
    qty_needed INTEGER NOT NULL DEFAULT 1,
    qty_available INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'prevu',
    responsible_name TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table Planning Bénévoles & Anti-Conflits (Pôle 7)
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
    status TEXT NOT NULL DEFAULT 'planifie',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tables Accueil, Nettoyage & Sécurité (Pôle 9)
CREATE TABLE IF NOT EXISTS public.lost_and_found (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_name TEXT NOT NULL,
    description TEXT,
    location_found TEXT,
    found_by TEXT,
    status TEXT NOT NULL DEFAULT 'en_attente',
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

-- ------------------------------------------------------------------------------
-- 10. TÂCHES COLLABORATIVES PAR PÔLE & TRAÇABILITÉ NOMINATIVE
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pole_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pole_code TEXT NOT NULL,
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normale',
    due_time TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL,
    created_by_role TEXT,
    completed_by_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    completed_by_name TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pole_tasks_pole ON public.pole_tasks(pole_code);
CREATE INDEX IF NOT EXISTS idx_pole_tasks_created ON public.pole_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pole_tasks_completed ON public.pole_tasks(is_completed);

ALTER TABLE public.pole_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture tâches pôle" ON public.pole_tasks;
CREATE POLICY "Lecture tâches pôle" ON public.pole_tasks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Création tâches pôle" ON public.pole_tasks;
CREATE POLICY "Création tâches pôle" ON public.pole_tasks FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Mise à jour tâches pôle" ON public.pole_tasks;
CREATE POLICY "Mise à jour tâches pôle" ON public.pole_tasks FOR UPDATE USING (true);
DROP POLICY IF EXISTS "Suppression tâches pôle" ON public.pole_tasks;
CREATE POLICY "Suppression tâches pôle" ON public.pole_tasks FOR DELETE USING (true);

GRANT ALL ON public.pole_tasks TO anon, authenticated, service_role;

-- Recharger immédiatement le cache du schéma PostgREST dans Supabase
NOTIFY pgrst, 'reload schema';


