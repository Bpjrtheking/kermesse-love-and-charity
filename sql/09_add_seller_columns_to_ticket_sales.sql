-- ==============================================================================
-- LOVE AND CHARITY (L&C) — TRAÇABILITÉ NOMINATIVE DES CAISSES
-- Fichier : 09_add_seller_columns_to_ticket_sales.sql
-- ==============================================================================
-- Ajoute les colonnes explicites de traçabilité des vendeurs/caissiers sur ticket_sales
-- pour stocker en clair le nom et le login de l'administrateur ayant opéré la vente.

ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS seller_name TEXT;
ALTER TABLE ticket_sales ADD COLUMN IF NOT EXISTS seller_login TEXT;

-- Index pour optimiser les requêtes de filtrage par caissier et par catégorie
CREATE INDEX IF NOT EXISTS idx_ticket_sales_category ON ticket_sales(category);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_sold_by ON ticket_sales(sold_by);
CREATE INDEX IF NOT EXISTS idx_ticket_sales_created_at ON ticket_sales(created_at DESC);

-- Mise à jour des politiques RLS pour s'assurer que les ventes et consultations sont toujours autorisées
ALTER TABLE ticket_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture publique ticket_sales" ON ticket_sales;
CREATE POLICY "Lecture publique ticket_sales" ON ticket_sales FOR SELECT USING (true);

DROP POLICY IF EXISTS "Insertion publique ticket_sales" ON ticket_sales;
CREATE POLICY "Insertion publique ticket_sales" ON ticket_sales FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression autorisee ticket_sales" ON ticket_sales;
CREATE POLICY "Suppression autorisee ticket_sales" ON ticket_sales FOR DELETE USING (true);
