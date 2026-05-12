-- ═══════════════════════════════════════════════════
-- BizdenBize — Expert Review System
-- Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════

-- ─────────────────────────────────────────────────
-- EXPERTS table
-- ─────────────────────────────────────────────────
CREATE TABLE public.experts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  categories      TEXT[] DEFAULT '{}',  -- legal, medical, tax, visa, housing, employment, school, insurance
  title           TEXT,                 -- e.g. "Rechtsanwalt", "Steuerberater"
  bio             TEXT,
  languages       TEXT[] DEFAULT '{}',
  rating          DECIMAL(3,2) DEFAULT 0,
  response_count  INTEGER DEFAULT 0,
  avg_response_hours INTEGER DEFAULT 24,
  is_active       BOOLEAN DEFAULT TRUE,
  is_verified     BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- EXPERT REVIEWS table
-- ─────────────────────────────────────────────────
CREATE TABLE public.expert_reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expert_id       UUID REFERENCES public.experts(id),
  category        TEXT NOT NULL,
  language        TEXT DEFAULT 'tr',
  question        TEXT NOT NULL,
  abibot_answer   TEXT,
  expert_response TEXT,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','assigned','in_review','answered','closed')),
  credits_charged DECIMAL(10,2) DEFAULT 0,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  rating_comment  TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  assigned_at     TIMESTAMPTZ,
  answered_at     TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────
-- NOTIFICATIONS table
-- ─────────────────────────────────────────────────
CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- expert_answered, expert_assigned, new_review_request, credit_added
  title       TEXT NOT NULL,
  body        TEXT,
  link        TEXT,
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- RLS Policies
-- ─────────────────────────────────────────────────
ALTER TABLE public.experts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expert_reviews  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications   ENABLE ROW LEVEL SECURITY;

-- Experts: anyone logged in can view active experts
CREATE POLICY "View active experts" ON public.experts
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Experts: only admins can insert/update
CREATE POLICY "Admins manage experts" ON public.experts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Expert reviews: users see their own, experts see assigned to them, admins see all
CREATE POLICY "Users see own reviews" ON public.expert_reviews
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.experts e WHERE e.profile_id = auth.uid() AND e.id = expert_id) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

CREATE POLICY "Users create reviews" ON public.expert_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Experts and admins update reviews" ON public.expert_reviews
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.experts e WHERE e.profile_id = auth.uid() AND e.id = expert_id) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
  );

-- Notifications: users see their own only
CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System creates notifications" ON public.notifications
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "Users mark read" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────
-- INDEXES
-- ─────────────────────────────────────────────────
CREATE INDEX idx_expert_reviews_user     ON public.expert_reviews(user_id, created_at DESC);
CREATE INDEX idx_expert_reviews_expert   ON public.expert_reviews(expert_id, status);
CREATE INDEX idx_expert_reviews_status   ON public.expert_reviews(status);
CREATE INDEX idx_notifications_user      ON public.notifications(user_id, is_read, created_at DESC);

-- ─────────────────────────────────────────────────
-- Insert yourself as first expert (all categories)
-- ─────────────────────────────────────────────────
INSERT INTO public.experts (profile_id, categories, title, bio, languages, is_active, is_verified)
VALUES (
  '3e96d976-5c3a-4270-af88-6172f1751f9a',
  ARRAY['legal','visa','medical','tax','housing','employment','school','insurance'],
  'Platform Uzmanı',
  'BizdenBize kurucu uzmanı. Avrupa''daki Türk topluluğuna hukuki, mali ve vize konularında destek.',
  ARRAY['tr','de','en','fr','nl'],
  TRUE,
  TRUE
);
