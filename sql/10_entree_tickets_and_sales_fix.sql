-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 10_entree_tickets_and_sales_fix.sql
-- ==============================================================================
-- 1. Permettre la suppression et modification de ventes de tickets (RLS)
-- 2. Permettre la suppression et modification de mouvements de caisse (RLS)
-- 3. Rendre ticket_id optionnel dans ticket_sales (pour billets d'entrée dynamiques)
-- 4. Ajouter colonnes item_name et category si absentes
-- 5. Autoriser gestion complète de tickets_catalog (CRUD)
-- ==============================================================================

-- 1. Colonnes adaptatives pour ticket_sales
ALTER TABLE public.ticket_sales ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'jeux';

-- 2. Politiques RLS pour ticket_sales (Suppression et Mise à jour autorisées)
DROP POLICY IF EXISTS "Suppression ventes tickets" ON public.ticket_sales;
CREATE POLICY "Suppression ventes tickets" ON public.ticket_sales FOR DELETE USING (true);

DROP POLICY IF EXISTS "Mise a jour ventes tickets" ON public.ticket_sales;
CREATE POLICY "Mise a jour ventes tickets" ON public.ticket_sales FOR UPDATE USING (true) WITH CHECK (true);

-- 3. Politiques RLS pour cash_movements (Suppression et Mise à jour autorisées)
DROP POLICY IF EXISTS "Suppression mouvements caisse" ON public.cash_movements;
CREATE POLICY "Suppression mouvements caisse" ON public.cash_movements FOR DELETE USING (true);

DROP POLICY IF EXISTS "Mise a jour mouvements caisse" ON public.cash_movements;
CREATE POLICY "Mise a jour mouvements caisse" ON public.cash_movements FOR UPDATE USING (true) WITH CHECK (true);

-- 4. Politiques RLS pour tickets_catalog (Suppression et Mise à jour autorisées)
DROP POLICY IF EXISTS "Suppression tickets catalog" ON public.tickets_catalog;
CREATE POLICY "Suppression tickets catalog" ON public.tickets_catalog FOR DELETE USING (true);

DROP POLICY IF EXISTS "Mise a jour tickets catalog" ON public.tickets_catalog;
CREATE POLICY "Mise a jour tickets catalog" ON public.tickets_catalog FOR UPDATE USING (true) WITH CHECK (true);
