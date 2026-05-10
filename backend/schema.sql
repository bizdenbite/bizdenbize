-- ═══════════════════════════════════════════════════
-- BizdenBize — Complete Database Schema
-- Run this in Supabase → SQL Editor → New Query
-- ═══════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────
-- PROFILES (extends Supabase auth.users)
-- ─────────────────────────────────────────────────
CREATE TABLE public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE,
  first_name    TEXT,
  last_name     TEXT,
  bio           TEXT,
  city          TEXT,
  country       TEXT,
  avatar_url    TEXT,
  languages     TEXT[]    DEFAULT '{}',
  interests     TEXT[]    DEFAULT '{}',
  is_verified   BOOLEAN   DEFAULT FALSE,
  is_premium    BOOLEAN   DEFAULT FALSE,
  is_admin      BOOLEAN   DEFAULT FALSE,
  invite_code   TEXT      UNIQUE DEFAULT 'BZB' || upper(substring(gen_random_uuid()::text, 1, 4)),
  invited_by    UUID      REFERENCES public.profiles(id),
  abibot_credits DECIMAL(10,2) DEFAULT 0,
  status        TEXT      DEFAULT 'pending' CHECK (status IN ('pending','approved','suspended')),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- WAITLIST
-- ─────────────────────────────────────────────────
CREATE TABLE public.waitlist (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  first_name    TEXT NOT NULL,
  last_name     TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  city          TEXT,
  country       TEXT,
  connection    TEXT,
  invite_code   TEXT,
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  position      SERIAL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- INVITE CODES
-- ─────────────────────────────────────────────────
CREATE TABLE public.invite_codes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,
  owner_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  used_by       UUID REFERENCES public.profiles(id),
  used_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- POSTS (Community / Mahallem feed)
-- ─────────────────────────────────────────────────
CREATE TABLE public.posts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  image_urls    TEXT[]    DEFAULT '{}',
  city          TEXT,
  country       TEXT,
  scope         TEXT DEFAULT 'city' CHECK (scope IN ('city','country','europe')),
  type          TEXT DEFAULT 'community' CHECK (type IN ('community','recommendation','question','event')),
  likes_count   INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  is_pinned     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- POST LIKES
-- ─────────────────────────────────────────────────
CREATE TABLE public.post_likes (
  post_id       UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

-- ─────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────
CREATE TABLE public.comments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id       UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- CLASSIFIEDS / LISTINGS
-- ─────────────────────────────────────────────────
CREATE TABLE public.listings (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  price         DECIMAL(10,2),
  currency      TEXT DEFAULT 'EUR',
  category      TEXT CHECK (category IN ('vehicle','property','electronics','furniture','clothing','business','other')),
  condition     TEXT CHECK (condition IN ('new','like_new','good','used')),
  image_urls    TEXT[]    DEFAULT '{}',
  city          TEXT,
  country       TEXT,
  is_featured   BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','sold','expired','removed')),
  views         INTEGER DEFAULT 0,
  saves         INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- LISTING SAVES (bookmarks)
-- ─────────────────────────────────────────────────
CREATE TABLE public.listing_saves (
  listing_id    UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (listing_id, user_id)
);

-- ─────────────────────────────────────────────────
-- EVENTS
-- ─────────────────────────────────────────────────
CREATE TABLE public.events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id  UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT DEFAULT 'general',
  location_name TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT,
  latitude      DECIMAL(10,8),
  longitude     DECIMAL(11,8),
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  max_attendees INTEGER,
  is_free       BOOLEAN DEFAULT TRUE,
  price         DECIMAL(10,2),
  image_url     TEXT,
  is_featured   BOOLEAN DEFAULT FALSE,
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','cancelled','completed')),
  rsvp_count    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- EVENT RSVPs
-- ─────────────────────────────────────────────────
CREATE TABLE public.event_rsvps (
  event_id      UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_id, user_id)
);

-- ─────────────────────────────────────────────────
-- BUSINESSES
-- ─────────────────────────────────────────────────
CREATE TABLE public.businesses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id      UUID REFERENCES public.profiles(id),
  name          TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  address       TEXT,
  city          TEXT,
  country       TEXT,
  phone         TEXT,
  email         TEXT,
  website       TEXT,
  hours         JSONB,
  image_url     TEXT,
  logo_url      TEXT,
  is_verified   BOOLEAN DEFAULT FALSE,
  is_featured   BOOLEAN DEFAULT FALSE,
  rating        DECIMAL(3,2) DEFAULT 0,
  review_count  INTEGER DEFAULT 0,
  languages     TEXT[] DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- BUSINESS REVIEWS
-- ─────────────────────────────────────────────────
CREATE TABLE public.business_reviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id   UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating        INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content       TEXT,
  helpful_count INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, author_id)
);

-- ─────────────────────────────────────────────────
-- MESSAGES (DMs)
-- ─────────────────────────────────────────────────
CREATE TABLE public.conversations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  participant_1 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant_2 UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id    UUID REFERENCES public.listings(id),
  last_message  TEXT,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(participant_1, participant_2)
);

CREATE TABLE public.messages (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- ABIBOT SESSIONS
-- ─────────────────────────────────────────────────
CREATE TABLE public.abibot_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category      TEXT NOT NULL,
  language      TEXT DEFAULT 'tr',
  question      TEXT NOT NULL,
  answer        TEXT,
  credits_used  DECIMAL(10,2) NOT NULL,
  escalated     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- CREDIT TRANSACTIONS
-- ─────────────────────────────────────────────────
CREATE TABLE public.credit_transactions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount        DECIMAL(10,2) NOT NULL,
  type          TEXT CHECK (type IN ('purchase','usage','refund','bonus')),
  description   TEXT,
  stripe_payment_id TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────────
-- SUBSCRIPTIONS (Premium)
-- ─────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stripe_sub_id       TEXT UNIQUE,
  stripe_customer_id  TEXT,
  plan                TEXT CHECK (plan IN ('monthly','annual')),
  status              TEXT CHECK (status IN ('active','cancelled','past_due','trialing')),
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════
-- TRIGGERS
-- ═══════════════════════════════════════════════════

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, first_name, last_name)
  VALUES (
    NEW.id,
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 1),
    SPLIT_PART(COALESCE(NEW.raw_user_meta_data->>'full_name', ''), ' ', 2)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at    BEFORE UPDATE ON public.profiles    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_posts_updated_at       BEFORE UPDATE ON public.posts       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_listings_updated_at    BEFORE UPDATE ON public.listings    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_events_updated_at      BEFORE UPDATE ON public.events      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_businesses_updated_at  BEFORE UPDATE ON public.businesses  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-update likes/comments count
CREATE OR REPLACE FUNCTION public.update_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_post_like    AFTER INSERT ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();
CREATE TRIGGER on_post_unlike  AFTER DELETE ON public.post_likes FOR EACH ROW EXECUTE FUNCTION public.update_post_likes_count();

-- Auto-update RSVP count
CREATE OR REPLACE FUNCTION public.update_event_rsvp_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_event_rsvp    AFTER INSERT ON public.event_rsvps FOR EACH ROW EXECUTE FUNCTION public.update_event_rsvp_count();
CREATE TRIGGER on_event_unrsvp  AFTER DELETE ON public.event_rsvps FOR EACH ROW EXECUTE FUNCTION public.update_event_rsvp_count();

-- ═══════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) — GDPR & Privacy
-- ═══════════════════════════════════════════════════

ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.waitlist            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_saves       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_rsvps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.businesses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reviews    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.abibot_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions       ENABLE ROW LEVEL SECURITY;

-- Profiles: approved users can read all; users can only edit their own
CREATE POLICY "Approved users can view profiles"  ON public.profiles FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users can update own profile"      ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"      ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Waitlist: anyone can insert; only admins can read all
CREATE POLICY "Anyone can join waitlist"          ON public.waitlist FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admins can read waitlist"          ON public.waitlist FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = TRUE)
);

-- Posts: approved users can read and create; authors can update/delete their own
CREATE POLICY "Approved users can read posts"     ON public.posts FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Approved users can create posts"   ON public.posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Authors can update own posts"      ON public.posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "Authors can delete own posts"      ON public.posts FOR DELETE USING (auth.uid() = author_id);

-- Listings: anyone logged in can read active listings
CREATE POLICY "Logged in users can read listings" ON public.listings FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'active');
CREATE POLICY "Users can create listings"         ON public.listings FOR INSERT WITH CHECK (auth.uid() = seller_id);
CREATE POLICY "Sellers can update own listings"   ON public.listings FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers can delete own listings"   ON public.listings FOR DELETE USING (auth.uid() = seller_id);

-- Events: anyone logged in can read active events
CREATE POLICY "Logged in users can read events"   ON public.events FOR SELECT USING (auth.uid() IS NOT NULL AND status = 'active');
CREATE POLICY "Users can create events"           ON public.events FOR INSERT WITH CHECK (auth.uid() = organizer_id);
CREATE POLICY "Organizers can update events"      ON public.events FOR UPDATE USING (auth.uid() = organizer_id);

-- Businesses: anyone logged in can read verified businesses
CREATE POLICY "Logged in users can read businesses" ON public.businesses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Owners can update their business"    ON public.businesses FOR UPDATE USING (auth.uid() = owner_id);

-- Conversations: users can only see their own
CREATE POLICY "Users can read own conversations"  ON public.conversations FOR SELECT USING (auth.uid() = participant_1 OR auth.uid() = participant_2);
CREATE POLICY "Users can create conversations"    ON public.conversations FOR INSERT WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- Messages: users can only see messages in their conversations
CREATE POLICY "Users can read messages in their conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid()))
);
CREATE POLICY "Users can send messages"           ON public.messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- AbiBOT sessions: users can only see their own
CREATE POLICY "Users can read own abibot sessions" ON public.abibot_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create abibot sessions"   ON public.abibot_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Credit transactions: users can only see their own
CREATE POLICY "Users can read own transactions"   ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);

-- Subscriptions: users can only see their own
CREATE POLICY "Users can read own subscription"   ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════
-- INDEXES (Performance)
-- ═══════════════════════════════════════════════════
CREATE INDEX idx_posts_author    ON public.posts(author_id);
CREATE INDEX idx_posts_city      ON public.posts(city);
CREATE INDEX idx_posts_created   ON public.posts(created_at DESC);
CREATE INDEX idx_listings_city   ON public.listings(city);
CREATE INDEX idx_listings_cat    ON public.listings(category);
CREATE INDEX idx_listings_status ON public.listings(status);
CREATE INDEX idx_events_city     ON public.events(city);
CREATE INDEX idx_events_starts   ON public.events(starts_at);
CREATE INDEX idx_messages_conv   ON public.messages(conversation_id, created_at);
CREATE INDEX idx_abibot_user     ON public.abibot_sessions(user_id, created_at DESC);
CREATE INDEX idx_waitlist_email  ON public.waitlist(email);
CREATE INDEX idx_waitlist_status ON public.waitlist(status);
