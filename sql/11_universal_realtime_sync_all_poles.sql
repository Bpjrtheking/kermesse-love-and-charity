-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 11 : ACTIVATION UNIVERSELLE DU TEMPS RÉEL (SUPABASE REALTIME) TOUS PÔLES
-- ==============================================================================

-- 0. SÉCURISATION DU SCHÉMA POUR LES JEUX, STANDS ET MATÉRIAUX
DO $$
BEGIN
  -- Permettre la création de jeux flexibles (sans stand obligatoire au départ)
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'games' AND column_name = 'stand_id') THEN
    ALTER TABLE games ALTER COLUMN stand_id DROP NOT NULL;
  END IF;

  -- Ajout des colonnes optionnelles si absentes
  ALTER TABLE IF EXISTS games ADD COLUMN IF NOT EXISTS materials_needed TEXT;
  ALTER TABLE IF EXISTS games ADD COLUMN IF NOT EXISTS image_url TEXT;
  ALTER TABLE IF EXISTS stands ADD COLUMN IF NOT EXISTS materials_needed TEXT;

  -- Table des demandes de matériel exprimées par les stands/jeux vers la logistique
  CREATE TABLE IF NOT EXISTS stand_material_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stand_id UUID REFERENCES stands(id) ON DELETE SET NULL,
    stand_name TEXT NOT NULL,
    game_name TEXT,
    materials_needed TEXT NOT NULL,
    requested_by_name TEXT,
    status TEXT DEFAULT 'a_preparer', -- 'a_preparer', 'en_cours', 'fourni'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
END $$;

-- 1. ACTIVATION ROW LEVEL SECURITY ET POLICIES OUVERTES MULTI-ADMINS SUR TOUTES LES TABLES DU SYSTÈME
DO $$
DECLARE
  t TEXT;
  tables_list TEXT[] := ARRAY[
    'ticket_sales',
    'cash_movements',
    'token_debts',
    'tickets_catalog',
    'food_products',
    'stands',
    'games',
    'stand_material_requests',
    'stand_staff',
    'locations',
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'returns_plan',
    'incidents',
    'inventories',
    'inventory_items',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users',
    'roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_list LOOP
    BEGIN
      EXECUTE format('ALTER TABLE IF EXISTS %I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS "Gestion ouverte %I" ON %I;', t, t);
      EXECUTE format('CREATE POLICY "Gestion ouverte %I" ON %I FOR ALL USING (true) WITH CHECK (true);', t, t);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore si la table n'existe pas encore
    END;
  END LOOP;
END $$;

-- 2. PUBLICATION SUPABASE REALTIME MULTI-APPAREILS SUR TOUTES LES TABLES (DIFFUSION WEBSOCKET STYLE WHATSAPP)
DO $$
DECLARE
  t TEXT;
  tables_list TEXT[] := ARRAY[
    'ticket_sales',
    'cash_movements',
    'token_debts',
    'tickets_catalog',
    'food_products',
    'stands',
    'games',
    'stand_material_requests',
    'stand_staff',
    'locations',
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'returns_plan',
    'incidents',
    'inventories',
    'inventory_items',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users',
    'roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_list LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', t);
    EXCEPTION WHEN OTHERS THEN
      NULL; -- Ignore si la table est déjà dans la publication
    END;
  END LOOP;
END $$;

-- 3. REPLICA IDENTITY FULL POUR DIFFUSER L'ENSEMBLE DES COLONNES LORS DES MODIFICATIONS/SUPPRESSIONS
DO $$
DECLARE
  t TEXT;
  tables_list TEXT[] := ARRAY[
    'ticket_sales',
    'cash_movements',
    'token_debts',
    'tickets_catalog',
    'food_products',
    'stands',
    'games',
    'stand_material_requests',
    'stand_staff',
    'locations',
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'returns_plan',
    'incidents',
    'inventories',
    'inventory_items',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users',
    'roles'
  ];
BEGIN
  FOREACH t IN ARRAY tables_list LOOP
    BEGIN
      EXECUTE format('ALTER TABLE IF EXISTS %I REPLICA IDENTITY FULL;', t);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END $$;
