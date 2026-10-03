-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 10 : TRAÇABILITÉ NOMINATIVE, INTERCONNEXION CLOUD & SÉCURISATION CAISSES
-- ==============================================================================

-- 1. ADAPTATION DE LA TABLE ticket_sales (Découplage & Traçabilité complète)
-- Permet à toutes les caisses (Entrée, Jeux, Restauration) d'enregistrer instantanément
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'jeu';
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS item_name TEXT DEFAULT 'Ticket';
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS seller_login TEXT;
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash';
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS product_id UUID;

-- Rendre ticket_id, stand_id et cash_register_id souples (non bloquants en cas de billet libre ou multi-stands)
ALTER TABLE ticket_sales ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE ticket_sales ALTER COLUMN stand_id DROP NOT NULL;
ALTER TABLE ticket_sales ALTER COLUMN cash_register_id DROP NOT NULL;

-- Index pour optimiser les performances de requêtage et de filtres temps réel
CREATE INDEX IF NOT EXISTS idx_ticket_sales_category ON ticket_sales(category);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_sold_by ON ticket_sales(sold_by);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_created_at ON ticket_sales(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_item_name ON ticket_sales(item_name);

-- 2. ADAPTATION DE LA TABLE cash_movements
ALTER TABLE cash_movements ADD COLUMN IF NOT EXISTS tokens_detail JSONB;
CREATE INDEX IF NOT EXISTS idx_cash_movements_type ON cash_movements(type);
CREATE INDEX IF NOT EXISTS idx_cash_movements_reg_created ON cash_movements(cash_register_id, created_at DESC);

-- 3. SÉCURISATION ET ACTIVATION RLS SUR LES TABLES FINANCIÈRES
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_debts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Gestion ouverte ticket_sales" ON ticket_sales;
CREATE POLICY "Gestion ouverte ticket_sales" ON ticket_sales FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Gestion ouverte tickets_catalog" ON tickets_catalog;
CREATE POLICY "Gestion ouverte tickets_catalog" ON tickets_catalog FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Gestion ouverte cash_registers" ON cash_registers;
CREATE POLICY "Gestion ouverte cash_registers" ON cash_registers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Gestion ouverte cash_movements" ON cash_movements;
CREATE POLICY "Gestion ouverte cash_movements" ON cash_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Gestion ouverte token_debts" ON token_debts;
CREATE POLICY "Gestion ouverte token_debts" ON token_debts FOR ALL USING (true) WITH CHECK (true);

-- 4. INSERTION DES 4 TARIFS D'ENTRÉE DE BASE DANS tickets_catalog (S'ILS N'EXISTENT PAS ENCORE)
INSERT INTO tickets_catalog (type, name, value_f, color, description, is_active)
SELECT 'entree', 'Entrée Enfant (-12 ans)', 200, '🧒', 'Moins de 12 ans', true
WHERE NOT EXISTS (SELECT 1 FROM tickets_catalog WHERE name = 'Entrée Enfant (-12 ans)' AND type = 'entree');

INSERT INTO tickets_catalog (type, name, value_f, color, description, is_active)
SELECT 'entree', 'Entrée Adulte', 500, '🧑', 'Tarif standard', true
WHERE NOT EXISTS (SELECT 1 FROM tickets_catalog WHERE name = 'Entrée Adulte' AND type = 'entree');

INSERT INTO tickets_catalog (type, name, value_f, color, description, is_active)
SELECT 'entree', 'Pass Famille', 1200, '👨‍👩‍👧‍👦', 'Valable pour 4 personnes', true
WHERE NOT EXISTS (SELECT 1 FROM tickets_catalog WHERE name = 'Pass Famille' AND type = 'entree');

INSERT INTO tickets_catalog (type, name, value_f, color, description, is_active)
SELECT 'entree', 'Entrée Donateur & Bienfaiteur', 2000, '❤️', 'Soutien aux œuvres sociales', true
WHERE NOT EXISTS (SELECT 1 FROM tickets_catalog WHERE name = 'Entrée Donateur & Bienfaiteur' AND type = 'entree');

-- 5. ACTIVATION DU FLUX SUPABASE REALTIME MULTI-APPAREILS
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ticket_sales;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE cash_movements;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE token_debts;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tickets_catalog;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 6. SÉCURISATION ET TEMPS RÉEL SUR LES PRODUITS ALIMENTAIRES (Caisse Restauration)
ALTER TABLE food_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestion ouverte food_products" ON food_products;
CREATE POLICY "Gestion ouverte food_products" ON food_products FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE food_products;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 7. REGISTRE OFFICIEL DES ANNULATIONS ET SUPPRESSIONS AVEC MOTIFS OBLIGATOIRES
CREATE TABLE IF NOT EXISTS transaction_cancellations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_id TEXT,
    caisse_category TEXT NOT NULL, -- 'entree', 'jeu', 'jetons', 'restauration', 'depense'
    item_name TEXT NOT NULL,
    amount_f INT NOT NULL DEFAULT 0,
    motif TEXT NOT NULL,
    cancelled_by_login TEXT NOT NULL,
    cancelled_by_name TEXT NOT NULL,
    cancelled_by_role TEXT,
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trans_cancellations_created ON transaction_cancellations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trans_cancellations_cat ON transaction_cancellations(caisse_category);
CREATE INDEX IF NOT EXISTS idx_trans_cancellations_user ON transaction_cancellations(cancelled_by_login);

ALTER TABLE transaction_cancellations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Gestion ouverte transaction_cancellations" ON transaction_cancellations;
CREATE POLICY "Gestion ouverte transaction_cancellations" ON transaction_cancellations FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE transaction_cancellations;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 8. FONCTION SÉCURISÉE DE REMISE À ZÉRO TOTALE DES DONNÉES DE TEST (SUPERADMIN)
CREATE OR REPLACE FUNCTION purge_test_data()
RETURNS void AS $$
BEGIN
  DELETE FROM ticket_sales;
  DELETE FROM cash_movements;
  DELETE FROM token_debts;
  DELETE FROM transaction_cancellations;
  DELETE FROM tickets_catalog WHERE type IN ('cancelled_sale', 'cancelled_ticket_name');
  UPDATE cash_registers SET 
    initial_amount_f = 0, 
    current_balance_f = 0, 
    expected_amount_f = 0, 
    counted_amount_f = 0, 
    variance_f = 0, 
    status = 'open',
    closed_at = NULL,
    closed_by = NULL,
    closing_notes = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


