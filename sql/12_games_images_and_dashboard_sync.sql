-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 12_games_images_and_dashboard_sync.sql
-- ==============================================================================
-- 1. Ajout de la colonne image_url pour les jeux et attractions
-- 2. Sécurisation des politiques RLS pour les tables de vente et de jeux
-- ==============================================================================

-- 1. Ajouter la colonne image_url à la table des jeux
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Politiques RLS pour la table games (Lecture et Écriture complètes)
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture publique jeux" ON public.games;
CREATE POLICY "Lecture publique jeux" ON public.games FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion jeux" ON public.games;
CREATE POLICY "Gestion jeux" ON public.games FOR ALL USING (true) WITH CHECK (true);

-- 3. Politiques RLS pour ticket_sales (Lecture et Suppression suite annulations)
ALTER TABLE public.ticket_sales ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture ticket_sales" ON public.ticket_sales;
CREATE POLICY "Lecture ticket_sales" ON public.ticket_sales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion ticket_sales" ON public.ticket_sales;
CREATE POLICY "Gestion ticket_sales" ON public.ticket_sales FOR ALL USING (true) WITH CHECK (true);

-- 4. Politiques RLS pour cash_movements (Dépenses et corrections)
ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture cash_movements" ON public.cash_movements;
CREATE POLICY "Lecture cash_movements" ON public.cash_movements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion cash_movements" ON public.cash_movements;
CREATE POLICY "Gestion cash_movements" ON public.cash_movements FOR ALL USING (true) WITH CHECK (true);
