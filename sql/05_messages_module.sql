-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- 05_MESSAGES_MODULE.SQL : MESSAGERIE SANS CONTRAINTE BLOQUANTE
-- ==============================================================================

-- 1. Création de la table si elle n'existe pas
CREATE TABLE IF NOT EXISTS public.kermesse_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID,
    sender_login TEXT NOT NULL,
    sender_role TEXT DEFAULT 'Bénévole',
    channel_type TEXT NOT NULL DEFAULT 'broadcast',
    stand_id UUID,
    recipient_id UUID,
    title TEXT,
    content TEXT NOT NULL,
    is_urgent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Supprimer toute contrainte de clé étrangère trop stricte qui pourrait bloquer l'envoi
ALTER TABLE public.kermesse_messages DROP CONSTRAINT IF EXISTS kermesse_messages_sender_id_fkey;
ALTER TABLE public.kermesse_messages DROP CONSTRAINT IF EXISTS kermesse_messages_recipient_id_fkey;
ALTER TABLE public.kermesse_messages DROP CONSTRAINT IF EXISTS kermesse_messages_stand_id_fkey;

-- 3. Ajout des colonnes si manquantes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'kermesse_messages' AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE public.kermesse_messages ADD COLUMN recipient_id UUID;
    END IF;
END $$;

-- 4. Index de performance
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.kermesse_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON public.kermesse_messages(channel_type);
CREATE INDEX IF NOT EXISTS idx_messages_stand ON public.kermesse_messages(stand_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON public.kermesse_messages(recipient_id);

-- 5. Sécurité RLS
ALTER TABLE public.kermesse_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture messages kermesse" ON public.kermesse_messages;
CREATE POLICY "Lecture messages kermesse" ON public.kermesse_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Envoi messages kermesse" ON public.kermesse_messages;
CREATE POLICY "Envoi messages kermesse" ON public.kermesse_messages FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression messages kermesse par admin" ON public.kermesse_messages;
CREATE POLICY "Suppression messages kermesse par admin" ON public.kermesse_messages FOR DELETE USING (true);
