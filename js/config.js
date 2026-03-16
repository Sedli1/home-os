/**
 * O2 Sales Toolkit — konfigurace
 *
 * NASTAVENÍ SUPABASE:
 * 1. Jděte na https://supabase.com a vytvořte projekt
 * 2. V Project Settings → API zkopírujte URL a anon key
 * 3. Vyplňte níže
 * 4. Spusťte SQL níže v Supabase SQL Editoru pro vytvoření tabulek
 *
 * SQL PRO VYTVOŘENÍ TABULEK:
 * -----------------------------------------------
 * CREATE TABLE ticket_history (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   customer_name TEXT NOT NULL,
 *   company TEXT,
 *   event_name TEXT NOT NULL,
 *   event_date TEXT,
 *   tickets_count INTEGER DEFAULT 1,
 *   status TEXT DEFAULT 'schváleno',
 *   am TEXT DEFAULT 'Jakub Sedláček',
 *   dedup_key TEXT UNIQUE,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE checklist_state (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   item_key TEXT UNIQUE NOT NULL,
 *   checked BOOLEAN DEFAULT FALSE,
 *   notes TEXT DEFAULT '',
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * CREATE TABLE contacts (
 *   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
 *   name TEXT NOT NULL,
 *   company TEXT,
 *   email TEXT,
 *   phone TEXT,
 *   notes TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW()
 * );
 *
 * ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE checklist_state ENABLE ROW LEVEL SECURITY;
 * ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
 *
 * CREATE POLICY "Allow all" ON ticket_history FOR ALL USING (true) WITH CHECK (true);
 * CREATE POLICY "Allow all" ON checklist_state FOR ALL USING (true) WITH CHECK (true);
 * CREATE POLICY "Allow all" ON contacts FOR ALL USING (true) WITH CHECK (true);
 * -----------------------------------------------
 */

window.APP_CONFIG = {
  SUPABASE_URL: 'YOUR_SUPABASE_URL',        // např. https://abcdefgh.supabase.co
  SUPABASE_ANON_KEY: 'YOUR_SUPABASE_ANON_KEY', // váš anon/public key

  USER_NAME: 'Jakub Sedláček',
  USER_ROLE: 'Account Manager',
  USER_INITIALS: 'JS',

  // Jméno AM pro filtrování lístků z Excelu (case-insensitive contains)
  AM_FILTER: 'jakub',
};
