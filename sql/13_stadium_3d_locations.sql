-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 13_stadium_3d_locations.sql
-- ==============================================================================
-- 1. Création de la table stadium_placements (Positions 3D des éléments du Stade de Mbao)
-- 2. Politiques RLS complètes pour lecture et écriture sans restriction
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.stadium_placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL DEFAULT 'stand',
    source_id TEXT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'stands',
    icon TEXT DEFAULT '🎪',
    color TEXT DEFAULT '#dc2626',
    pos_x NUMERIC DEFAULT 0,
    pos_y NUMERIC DEFAULT 0,
    pos_z NUMERIC DEFAULT 0,
    rotation_y NUMERIC DEFAULT 0,
    scale_x NUMERIC DEFAULT 1,
    scale_y NUMERIC DEFAULT 1,
    scale_z NUMERIC DEFAULT 1,
    is_placed BOOLEAN DEFAULT false,
    zone_code TEXT DEFAULT 'jeux',
    custom_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide par source ou type
CREATE INDEX IF NOT EXISTS idx_stadium_source_id ON public.stadium_placements(source_id);
CREATE INDEX IF NOT EXISTS idx_stadium_category ON public.stadium_placements(category);

-- Politiques RLS complètes
ALTER TABLE public.stadium_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture stadium_placements" ON public.stadium_placements;
CREATE POLICY "Lecture stadium_placements" ON public.stadium_placements FOR SELECT USING (true);

DROP POLICY IF EXISTS "Gestion stadium_placements" ON public.stadium_placements;
CREATE POLICY "Gestion stadium_placements" ON public.stadium_placements FOR ALL USING (true) WITH CHECK (true);
