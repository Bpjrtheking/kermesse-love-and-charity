-- ==============================================================================
-- LOVE AND CHARITY (L&C) — TÂCHES COLLABORATIVES PAR PÔLE & TRAÇABILITÉ NOMINATIVE
-- Fichier : 10_pole_collaborative_tasks.sql
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
--
-- Ce script :
-- 1. Crée la table `pole_tasks` synchronisée en temps réel pour le travail en équipe.
-- 2. Permet à plusieurs admins d'un même pôle de voir et valider les tâches ensemble.
-- 3. Permet au SuperAdmin d'attribuer des tâches à n'importe quel pôle.
-- 4. Enregistre "qui a fait quoi" : nom complet du créateur et de celui qui valide.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.pole_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pole_code TEXT NOT NULL, -- 'admin_communication', 'admin_finances', 'admin_decoration', 'admin_restauration', 'admin_stands', 'admin_lots', 'admin_benevoles', 'admin_logistique', 'admin_securite', 'all'
    title TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normale', -- 'urgente', 'normale', 'basse'
    due_time TEXT, -- Heure cible (ex: '11:30')
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    created_by_name TEXT NOT NULL, -- 'Mamadou Sy' ou 'Mounir (SuperAdministrateur)'
    created_by_role TEXT, -- 'Responsable Restauration' ou 'SuperAdministrateur'
    completed_by_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
    completed_by_name TEXT, -- 'Fatou Ndiaye'
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes instantanées
CREATE INDEX IF NOT EXISTS idx_pole_tasks_pole ON public.pole_tasks(pole_code);
CREATE INDEX IF NOT EXISTS idx_pole_tasks_created ON public.pole_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pole_tasks_completed ON public.pole_tasks(is_completed);

-- Politiques de sécurité (Row Level Security)
ALTER TABLE public.pole_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture tâches pôle" ON public.pole_tasks;
CREATE POLICY "Lecture tâches pôle" ON public.pole_tasks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Création tâches pôle" ON public.pole_tasks;
CREATE POLICY "Création tâches pôle" ON public.pole_tasks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Mise à jour tâches pôle" ON public.pole_tasks;
CREATE POLICY "Mise à jour tâches pôle" ON public.pole_tasks FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Suppression tâches pôle" ON public.pole_tasks;
CREATE POLICY "Suppression tâches pôle" ON public.pole_tasks FOR DELETE USING (true);

-- Permissions d'exécution
GRANT ALL ON public.pole_tasks TO anon, authenticated, service_role;

-- Rechargement du schéma PostgREST
NOTIFY pgrst, 'reload schema';
