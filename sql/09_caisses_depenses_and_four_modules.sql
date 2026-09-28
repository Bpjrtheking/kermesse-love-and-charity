-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- Fichier : 09_caisses_depenses_and_four_modules.sql
-- ==============================================================================
-- 1. Ajout de cash_register_id à expenses pour tracer les dépenses par caisse
-- 2. Initialisation propre des 3 caisses avec solde initial à 0 F (sans fausse donnée)
-- ==============================================================================

-- 1. LIER LES DÉPENSES DIRECTEMENT À UNE CAISSE PARTICULIÈRE
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS cash_register_id UUID REFERENCES public.cash_registers(id) ON DELETE SET NULL;

-- 2. CRÉATION DES 3 CAISSES OFFICIELLES AVEC SOLDE INITIAL À 0 F
INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 1 — Entrée & Accueil', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 1%' OR name LIKE '%Entrée%');

INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 2 — Tickets de Jeux & Stands', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 2%' OR name LIKE '%Jeux%');

INSERT INTO public.cash_registers (name, initial_amount_f, status)
SELECT 'Caisse 3 — Change & Jetons', 0, 'open'
WHERE NOT EXISTS (SELECT 1 FROM public.cash_registers WHERE name LIKE '%Caisse 3%' OR name LIKE '%Jetons%');
