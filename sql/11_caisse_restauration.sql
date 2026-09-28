-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 11_caisse_restauration.sql
-- ==============================================================================
-- 1. Création de la Caisse 4 — Restauration & Buvette (solde initial 0 F)
-- 2. Politiques RLS complètes pour food_products et stock_movements
-- ==============================================================================

-- 1. Créer la Caisse 4 si inexistante
INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 4 — Restauration & Buvette', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 4%' OR name LIKE '%Restauration%');

-- 2. Politiques RLS pour food_products (Lecture et Modification autorisées)
DROP POLICY IF EXISTS "Lecture catalogue nourriture" ON public.food_products;
CREATE POLICY "Lecture catalogue nourriture" ON public.food_products FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion catalogue nourriture" ON public.food_products;
CREATE POLICY "Gestion catalogue nourriture" ON public.food_products FOR ALL USING (true) WITH CHECK (true);

-- 3. Politiques RLS pour stock_movements (Lecture, Insertion et Suppression)
DROP POLICY IF EXISTS "Lecture mouvements stock" ON public.stock_movements;
CREATE POLICY "Lecture mouvements stock" ON public.stock_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion mouvements stock" ON public.stock_movements;
CREATE POLICY "Gestion mouvements stock" ON public.stock_movements FOR ALL USING (true) WITH CHECK (true);

-- 4. Assurer la compatibilité de la table ticket_sales pour la restauration
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS product_id UUID;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'cash';
ALTER TABLE public.ticket_sales DROP CONSTRAINT IF EXISTS ticket_sales_category_check;
