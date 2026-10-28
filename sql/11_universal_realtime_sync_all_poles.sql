-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 11 : ACTIVATION UNIVERSELLE DU TEMPS RÉEL (SUPABASE REALTIME) TOUS PÔLES
-- ==============================================================================

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
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'incidents',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users'
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

-- 2. PUBLICATION SUPABASE REALTIME MULTI-APPAREILS SUR TOUTES LES TABLES
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
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'incidents',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users'
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
    'gifts_catalog',
    'gift_stand_allocations',
    'members',
    'teams',
    'volunteer_schedules',
    'materials',
    'loans',
    'material_movements',
    'incidents',
    'communication_items',
    'pole_tasks',
    'admin_notes',
    'kermesse_messages',
    'transaction_cancellations',
    'activity_logs',
    'app_users'
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
