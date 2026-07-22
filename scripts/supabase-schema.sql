-- ============================================================================
-- VERSEBASE SUPABASE DATABASE MIGRATION SCRIPT
-- Kopiere diesen Code und führe ihn im Supabase SQL Editor aus (https://supabase.com/dashboard/project/trgjhmbnodoarnfmlcqx/sql)
-- ============================================================================

-- 1. Erweiterung der `profiles` Tabelle
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT '#2dd4ff',
  ADD COLUMN IF NOT EXISTS status_state text DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS status_text text,
  ADD COLUMN IF NOT EXISTS role text,
  ADD COLUMN IF NOT EXISTS rsi_handle text,
  ADD COLUMN IF NOT EXISTS rsi_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS discord_tag text,
  ADD COLUMN IF NOT EXISTS org_name text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Erstellen der `friends` Tabelle (Freundschaften)
CREATE TABLE IF NOT EXISTS public.friends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  friend_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, friend_id)
);

-- RLS Policies für `friends`
ALTER TABLE public.friends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können eigene Freunde sehen" ON public.friends
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Nutzer können Freunde hinzufügen" ON public.friends
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Nutzer können Freunde entfernen" ON public.friends
  FOR DELETE USING (auth.uid() = user_id OR auth.uid() = friend_id);

-- 3. Erstellen der `friend_requests` Tabelle (Freundschaftsanfragen)
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);

-- RLS Policies für `friend_requests`
ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer können eingehende und ausgehende Anfragen sehen" ON public.friend_requests
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Nutzer können Anfragen senden" ON public.friend_requests
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Empfänger können Anfragen aktualisieren" ON public.friend_requests
  FOR UPDATE USING (auth.uid() = receiver_id OR auth.uid() = sender_id);

CREATE POLICY "Nutzer können Anfragen löschen" ON public.friend_requests
  FOR DELETE USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- ============================================================================
-- 4. Rollen-System: `user_roles` Tabelle
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at timestamptz DEFAULT now()
);

-- RLS: Jeder eingeloggte Nutzer darf seine eigene Rolle LESEN (noetig fuer
-- den client-seitigen Guard). Nur service_role darf schreiben.
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Nutzer koennen eigene Rolle lesen" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

-- Admin-Eintrag fuer KrysX141 (krysx141@gmail.com).
-- Ersetze die UUID falls noetig — diese Abfrage findet sie automatisch.
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'
FROM auth.users
WHERE email = 'krysx141@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
