-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 14_add_image_url_to_games.sql
-- ==============================================================================
-- Ajout de la colonne image_url sur la table games (Photos des jeux pour caisses tactiles)
-- ==============================================================================

ALTER TABLE IF EXISTS public.games 
ADD COLUMN IF NOT EXISTS image_url TEXT;

COMMENT ON COLUMN public.games.image_url IS 'Photo ou DataURL de l''attraction affichée sur les caisses tactiles (Caisse 2)';
