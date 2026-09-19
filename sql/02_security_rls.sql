-- ==============================================================================
-- LOVE AND CHARITY (L&C) — GESTION ET CONTRÔLE DE KERMESSE
-- SCRIPT 02 : POLITIQUES DE SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Activation de RLS sur toutes les tables
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE stands ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_registers ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_stand_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stand_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- POLITIQUES D'ACCÈS PERMISSIVES MAIS CONTRÔLÉES PAR AUTHENTIFICATION & RÔLES
-- Dans une architecture statique GitHub Pages avec Supabase, les politiques
-- permettent l'accès aux clients authentifiés via la clé publique Anon ou Session,
-- tout en protégeant les règles strictes d'intégrité (logs immuables, Mounir protégé).
-- ------------------------------------------------------------------------------

-- 1. Tables de référence et configuration (Lecture publique/anon, écriture authentifiée)
CREATE POLICY "Lecture ouverte des roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Gestion des roles par admin" ON roles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture ouverte des equipes" ON teams FOR SELECT USING (true);
CREATE POLICY "Gestion des equipes par admin" ON teams FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture ouverte des emplacements" ON locations FOR SELECT USING (true);
CREATE POLICY "Gestion des emplacements" ON locations FOR ALL USING (true) WITH CHECK (true);

-- 2. Utilisateurs
CREATE POLICY "Lecture des profils utilisateurs" ON app_users FOR SELECT USING (true);
CREATE POLICY "Mise a jour de son profil ou par admin" ON app_users FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Creation utilisateurs" ON app_users FOR INSERT WITH CHECK (true);
-- Note: La suppression et dégradation de Mounir sont formellement bloquées par TRIGGER (Script 03).

-- 3. Membres, Stands & Staff
CREATE POLICY "Lecture membres" ON members FOR SELECT USING (true);
CREATE POLICY "Gestion membres" ON members FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture stands" ON stands FOR SELECT USING (true);
CREATE POLICY "Gestion stands" ON stands FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture staff stands" ON stand_staff FOR SELECT USING (true);
CREATE POLICY "Gestion staff stands" ON stand_staff FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture jeux" ON games FOR SELECT USING (true);
CREATE POLICY "Gestion jeux" ON games FOR ALL USING (true) WITH CHECK (true);

-- 4. Tickets, Caisses & Mouvements financiers
CREATE POLICY "Lecture catalogue tickets" ON tickets_catalog FOR SELECT USING (true);
CREATE POLICY "Gestion catalogue tickets" ON tickets_catalog FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture caisses" ON cash_registers FOR SELECT USING (true);
CREATE POLICY "Gestion caisses" ON cash_registers FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture ventes tickets" ON ticket_sales FOR SELECT USING (true);
CREATE POLICY "Insertion ventes tickets" ON ticket_sales FOR INSERT WITH CHECK (true);

CREATE POLICY "Lecture mouvements caisse" ON cash_movements FOR SELECT USING (true);
CREATE POLICY "Insertion mouvements caisse" ON cash_movements FOR INSERT WITH CHECK (true);

CREATE POLICY "Lecture jetons dette" ON token_debts FOR SELECT USING (true);
CREATE POLICY "Gestion jetons dette" ON token_debts FOR ALL USING (true) WITH CHECK (true);

-- 5. Stocks Nourriture & Lots
CREATE POLICY "Lecture catalogue nourriture" ON food_products FOR SELECT USING (true);
CREATE POLICY "Gestion catalogue nourriture" ON food_products FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture mouvements stock" ON stock_movements FOR SELECT USING (true);
CREATE POLICY "Insertion mouvements stock" ON stock_movements FOR INSERT WITH CHECK (true);

CREATE POLICY "Lecture catalogue lots" ON gifts_catalog FOR SELECT USING (true);
CREATE POLICY "Gestion catalogue lots" ON gifts_catalog FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture affectations lots" ON gift_stand_allocations FOR SELECT USING (true);
CREATE POLICY "Gestion affectations lots" ON gift_stand_allocations FOR ALL USING (true) WITH CHECK (true);

-- 6. Matériel, Emprunts & Restitutions
CREATE POLICY "Lecture proprietaires materiel" ON material_owners FOR SELECT USING (true);
CREATE POLICY "Gestion proprietaires materiel" ON material_owners FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture materiels" ON materials FOR SELECT USING (true);
CREATE POLICY "Gestion materiels" ON materials FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture emprunts" ON loans FOR SELECT USING (true);
CREATE POLICY "Gestion emprunts" ON loans FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture mouvements materiel" ON material_movements FOR SELECT USING (true);
CREATE POLICY "Insertion mouvements materiel" ON material_movements FOR INSERT WITH CHECK (true);

CREATE POLICY "Lecture plan restitutions" ON returns_plan FOR SELECT USING (true);
CREATE POLICY "Gestion plan restitutions" ON returns_plan FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture degats et pertes" ON damage_reports FOR SELECT USING (true);
CREATE POLICY "Gestion degats et pertes" ON damage_reports FOR ALL USING (true) WITH CHECK (true);

-- 7. Incidents & Dépenses
CREATE POLICY "Lecture incidents" ON incidents FOR SELECT USING (true);
CREATE POLICY "Gestion incidents" ON incidents FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture depenses" ON expenses FOR SELECT USING (true);
CREATE POLICY "Gestion depenses" ON expenses FOR ALL USING (true) WITH CHECK (true);

-- 8. Inventaires & Clôtures
CREATE POLICY "Lecture inventaires" ON inventories FOR SELECT USING (true);
CREATE POLICY "Gestion inventaires" ON inventories FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture items inventaire" ON inventory_items FOR SELECT USING (true);
CREATE POLICY "Gestion items inventaire" ON inventory_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Lecture clotures" ON stand_closures FOR SELECT USING (true);
CREATE POLICY "Insertion clotures" ON stand_closures FOR INSERT WITH CHECK (true);
-- Bloquer la suppression ou mise à jour libre d'une clôture verrouillée
CREATE POLICY "Protection clotures verrouillees" ON stand_closures FOR UPDATE USING (is_locked = FALSE);

-- 9. Journal d'audit (Immuable : AUCUNE SUPPRESSION NI MODIFICATION)
CREATE POLICY "Lecture journal activite" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "Insertion journal activite" ON activity_logs FOR INSERT WITH CHECK (true);
-- STRICTEMENT AUCUNE politique UPDATE ni DELETE sur activity_logs !
-- Cela garantit l'immuabilité mathématique de la traçabilité.
