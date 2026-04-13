/**
 * Home OS — konfigurace Supabase
 *
 * NASTAVENÍ:
 * 1. Jděte na https://supabase.com → nový projekt (např. "home-os")
 * 2. Project Settings → API → zkopírujte URL a anon key
 * 3. Vyplňte níže SUPABASE_URL a SUPABASE_ANON_KEY
 * 4. Spusťte celý SQL blok níže v Supabase → SQL Editor
 *
 * ═══════════════════════════════════════════════════════
 * SQL PRO VYTVOŘENÍ TABULEK — spusťte v Supabase SQL Editoru
 * ═══════════════════════════════════════════════════════
 *
 * -- Členové rodiny
 * CREATE TABLE family_members (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   role TEXT DEFAULT 'člen',
 *   birth_date DATE,
 *   color TEXT DEFAULT '#6366f1',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Události (kalendář, narozeniny, výročí, kroužky…)
 * CREATE TABLE family_events (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   title TEXT NOT NULL,
 *   date DATE NOT NULL,
 *   type TEXT DEFAULT 'jiné',
 *   recurring BOOLEAN DEFAULT FALSE,
 *   member_id UUID REFERENCES family_members(id) ON DELETE SET NULL,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Finanční transakce
 * CREATE TABLE finance_transactions (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   date DATE NOT NULL,
 *   amount NUMERIC(10,2) NOT NULL,
 *   type TEXT NOT NULL CHECK (type IN ('příjem', 'výdaj')),
 *   category TEXT NOT NULL,
 *   description TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Cíle spoření
 * CREATE TABLE finance_goals (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   target NUMERIC(10,2) NOT NULL,
 *   current NUMERIC(10,2) DEFAULT 0,
 *   deadline DATE,
 *   color TEXT DEFAULT '#6366f1',
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Nemovitosti (pronájem)
 * CREATE TABLE rental_properties (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   address TEXT,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Nájemníci
 * CREATE TABLE rental_tenants (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   property_id UUID REFERENCES rental_properties(id) ON DELETE CASCADE,
 *   name TEXT NOT NULL,
 *   phone TEXT,
 *   email TEXT,
 *   rent_amount NUMERIC(10,2),
 *   contract_start DATE,
 *   contract_end DATE,
 *   deposit NUMERIC(10,2),
 *   notes TEXT,
 *   active BOOLEAN DEFAULT TRUE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Platby nájmu
 * CREATE TABLE rental_payments (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   tenant_id UUID REFERENCES rental_tenants(id) ON DELETE CASCADE,
 *   month TEXT NOT NULL,
 *   amount NUMERIC(10,2),
 *   paid BOOLEAN DEFAULT FALSE,
 *   paid_date DATE,
 *   notes TEXT,
 *   UNIQUE(tenant_id, month)
 * );
 *
 * -- Opravy
 * CREATE TABLE rental_repairs (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   property_id UUID REFERENCES rental_properties(id) ON DELETE CASCADE,
 *   description TEXT NOT NULL,
 *   date DATE,
 *   cost NUMERIC(10,2),
 *   status TEXT DEFAULT 'otevřeno',
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Auta
 * CREATE TABLE cars (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   plate TEXT,
 *   stk_date DATE,
 *   insurance_date DATE,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Servisní záznamy
 * CREATE TABLE car_services (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   car_id UUID REFERENCES cars(id) ON DELETE CASCADE,
 *   date DATE NOT NULL,
 *   description TEXT NOT NULL,
 *   mileage INTEGER,
 *   cost NUMERIC(10,2),
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Záruky spotřebičů
 * CREATE TABLE warranties (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   purchase_date DATE,
 *   warranty_end DATE,
 *   store TEXT,
 *   price NUMERIC(10,2),
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- Nákupní seznam
 * CREATE TABLE shopping_list (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   item TEXT NOT NULL,
 *   quantity TEXT,
 *   done BOOLEAN DEFAULT FALSE,
 *   added_by TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * -- RLS (Row Level Security) — přístup pouze pro přihlášené uživatele
 * ALTER TABLE family_members ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE family_events ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE finance_goals ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rental_properties ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rental_tenants ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rental_payments ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE rental_repairs ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE cars ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE car_services ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE warranties ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "family" ON family_members FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON family_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON finance_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON finance_goals FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON rental_properties FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON rental_tenants FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON rental_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON rental_repairs FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON cars FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON car_services FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON warranties FOR ALL TO authenticated USING (true) WITH CHECK (true);
 * CREATE POLICY "family" ON shopping_list FOR ALL TO authenticated USING (true) WITH CHECK (true);
 */

const SUPABASE_URL  = 'https://nxwwtlkitgsqoebbdxyb.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54d3d0bGtpdGdzcW9lYmJkeHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ3MDQyNjYsImV4cCI6MjA5MDI4MDI2Nn0.pMHSdcHpFQFl5E2Gj_st-U4igFmf8dseRRu495m_DPk';

// Fallback pro případ, že klíče nejsou ještě nastaveny
const _url  = SUPABASE_URL.startsWith('http') ? SUPABASE_URL  : 'https://placeholder.supabase.co';
const _anon = SUPABASE_ANON.startsWith('eyJ')  ? SUPABASE_ANON : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTkxNTU2MTYwMH0.aaa';

// Přiřadit přes window tak, aby bylo dostupné ve všech skriptech
window.db = window.supabase.createClient(_url, _anon);
