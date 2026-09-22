-- ==============================================================================
-- LOVE AND CHARITY (L&C) — TABLE DE SYNCHRONISATION DES BLOCS-NOTES & SUPERVISION
-- Fichier : 11_admin_notes_supervision.sql
-- Exécutez ce script dans Supabase (SQL Editor -> New Query -> Run)
--
-- Ce script :
-- 1. Crée la table `admin_notes` pour la synchronisation sécurisée des mémos.
-- 2. Permet à chaque administrateur de retrouver ses notes sur n'importe quel appareil.
-- 3. Permet au SuperAdministrateur de consulter l'ensemble des notes en lecture seule.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.admin_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE,
    user_login TEXT NOT NULL,
    user_name TEXT NOT NULL, -- Nom complet de l'auteur (ex: 'Mamadou Sy')
    user_role TEXT NOT NULL, -- Code du pôle (ex: 'admin_restauration')
    title TEXT NOT NULL DEFAULT 'Note sans titre',
    category TEXT NOT NULL DEFAULT 'memo', -- 'memo', 'achats', 'caisse', 'contacts', 'checklist'
    content TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour requêtes et filtres instantanés
CREATE INDEX IF NOT EXISTS idx_admin_notes_user ON public.admin_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_notes_login ON public.admin_notes(user_login);
CREATE INDEX IF NOT EXISTS idx_admin_notes_role ON public.admin_notes(user_role);
CREATE INDEX IF NOT EXISTS idx_admin_notes_updated ON public.admin_notes(updated_at DESC);

-- Politiques de sécurité (Row Level Security)
ALTER TABLE public.admin_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture notes" ON public.admin_notes;
CREATE POLICY "Lecture notes" ON public.admin_notes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insertion notes" ON public.admin_notes;
CREATE POLICY "Insertion notes" ON public.admin_notes FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Modification notes" ON public.admin_notes;
CREATE POLICY "Modification notes" ON public.admin_notes FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Suppression notes" ON public.admin_notes;
CREATE POLICY "Suppression notes" ON public.admin_notes FOR DELETE USING (true);

-- Permissions d'accès
GRANT ALL ON public.admin_notes TO anon, authenticated, service_role;

-- Rechargement immédiat de l'API Supabase
NOTIFY pgrst, 'reload schema';
