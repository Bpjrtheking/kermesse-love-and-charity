-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 07_stands_materials_and_bulk_planning.sql
-- ==============================================================================
-- 1. Permettre aux jeux d'exister dans le catalogue avant d'être rattachés à un stand
-- 2. Ajout du champ des matériaux nécessaires pour les jeux et stands
-- 3. Table de suivi des demandes de matériel transmises au Pôle Logistique
-- ==============================================================================

-- 1. RENDRE stand_id OPTIONNEL DANS LA TABLE DES JEUX
ALTER TABLE public.games ALTER COLUMN stand_id DROP NOT NULL;

-- 2. AJOUTER LES COLONNES POUR LES MATÉRIAUX NÉCESSAIRES
ALTER TABLE public.games ADD COLUMN IF NOT EXISTS materials_needed TEXT;
ALTER TABLE public.stands ADD COLUMN IF NOT EXISTS materials_needed TEXT;

-- 3. TABLE POUR LES DEMANDES DE MATÉRIEL TRANSMISES AU PÔLE LOGISTIQUE
CREATE TABLE IF NOT EXISTS public.stand_material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID REFERENCES public.stands(id) ON DELETE SET NULL,
    stand_name TEXT NOT NULL,
    game_name TEXT,
    materials_needed TEXT NOT NULL,
    requested_by_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'a_preparer', -- 'a_preparer', 'en_cours', 'fourni'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sécurité RLS ouverte pour synchronisation fluide
ALTER TABLE public.stand_material_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture stand_material_requests" ON public.stand_material_requests;
CREATE POLICY "Lecture stand_material_requests" ON public.stand_material_requests FOR SELECT USING (true);

DROP POLICY IF EXISTS "Ecriture stand_material_requests" ON public.stand_material_requests;
CREATE POLICY "Ecriture stand_material_requests" ON public.stand_material_requests FOR ALL USING (true) WITH CHECK (true);
