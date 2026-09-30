-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 15_fix_rls_and_test_data_cleanup.sql
-- ==============================================================================
-- 1. CORRECTION RLS : Autorisation de DELETE et UPDATE sur ticket_sales et cash_movements
--    (Sans ces politiques, Supabase bloquait les annulations de ventes et de billets erronés)
-- 2. Suppression des contraintes bloquantes pour le nettoyage des tickets de test
-- 3. Réinitialisation optionnelle des ventes de test pour repartir de 0 F
-- ==============================================================================

-- 1. POLITIQUES RLS SUR TICKET_SALES
DROP POLICY IF EXISTS "Suppression ventes tickets" ON public.ticket_sales;
CREATE POLICY "Suppression ventes tickets" 
ON public.ticket_sales 
FOR DELETE 
USING (true);

DROP POLICY IF EXISTS "Modification ventes tickets" ON public.ticket_sales;
CREATE POLICY "Modification ventes tickets" 
ON public.ticket_sales 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- 2. POLITIQUES RLS SUR CASH_MOVEMENTS
DROP POLICY IF EXISTS "Suppression mouvements caisse" ON public.cash_movements;
CREATE POLICY "Suppression mouvements caisse" 
ON public.cash_movements 
FOR DELETE 
USING (true);

DROP POLICY IF EXISTS "Modification mouvements caisse" ON public.cash_movements;
CREATE POLICY "Modification mouvements caisse" 
ON public.cash_movements 
FOR UPDATE 
USING (true) 
WITH CHECK (true);

-- 3. POLITIQUES RLS SUR TICKETS_CATALOG
DROP POLICY IF EXISTS "Gestion catalogue tickets" ON public.tickets_catalog;
CREATE POLICY "Gestion catalogue tickets" 
ON public.tickets_catalog 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- 4. RENDRE LA CONTRAINTE DE CLÉ ÉTRANGÈRE SOUPLE LORS DE LA SUPPRESSION D'UN BILLET
-- Si un type de billet est supprimé, permettre de supprimer la vente en CASCADE ou SET NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'ticket_sales_ticket_id_fkey' AND table_name = 'ticket_sales'
    ) THEN
        ALTER TABLE public.ticket_sales DROP CONSTRAINT ticket_sales_ticket_id_fkey;
        ALTER TABLE public.ticket_sales 
        ADD CONSTRAINT ticket_sales_ticket_id_fkey 
        FOREIGN KEY (ticket_id) REFERENCES public.tickets_catalog(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 5. NETTOYAGE DES VENTES DE TEST EXISTANTES (Remise à 0 F du Bilan et du Dashboard)
-- Décommentez les 2 lignes ci-dessous pour vider immédiatement tous les tests passés en base :
-- DELETE FROM public.ticket_sales;
-- DELETE FROM public.cash_movements WHERE type IN ('vente', 'correction');

COMMENT ON POLICY "Suppression ventes tickets" ON public.ticket_sales IS 'Permet l''annulation immédiate d''un billet validé par erreur ou le nettoyage des tests';
