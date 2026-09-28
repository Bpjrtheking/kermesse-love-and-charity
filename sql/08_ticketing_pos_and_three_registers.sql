-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 08_ticketing_pos_and_three_registers.sql
-- ==============================================================================
-- 1. Adaptation de la table ticket_sales pour lier directement les ventes aux jeux et stands
-- 2. Création des 3 Caisses Officielles (+ Restauration optionnelle) avec solde initial à 0 F
-- ==============================================================================

-- 1. PERMETTRE LA VENTE DIRECTE DE TICKETS DE JEUX DANS ticket_sales
ALTER TABLE public.ticket_sales ALTER COLUMN ticket_id DROP NOT NULL;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS game_id UUID REFERENCES public.games(id) ON DELETE SET NULL;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE public.ticket_sales ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'jeu'; -- 'entree', 'jeu', 'jeton', 'restauration'

-- 2. INSERTION DES 3 CAISSES OFFICIELLES (SOLDE INITIAL À 0 F — AUCUNE FAUSSE DONNÉE)
INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 1 — Entrée & Accueil Visiteurs', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 1%');

INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 2 — Vente Tickets Jeux & Stands', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 2%');

INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 3 — Change & Jetons de Monnaie', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 3%');

INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 4 — Restauration & Buvette (Optionnelle)', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 4%');
