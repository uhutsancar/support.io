-- GENERATED FILE — do not edit. Source: src/db/migrations/*.sql
-- Regenerate with `npm run db:schema`; CI fails when it is out of date.
--
-- The schema a fresh database ends up with: every migration, in order.
-- Applying it is the job of src/db/migrate.ts, which records each version in
-- schema_migrations; this file is for reading.

-- ===========================================================================
-- 0000_baseline.sql
-- ===========================================================================
-- 0000 — the schema as it stood at commit 0eef74f, before migrations were
-- versioned. Every statement is idempotent, so it is safe on an empty database
-- and on one that already ran the old boot-time schema.sql. Never edit this
-- file: add a new numbered migration instead.
--
-- SupportChat relational schema (PostgreSQL).
--
-- Migrated from the previous MongoDB collections. Every statement is written to
-- be safe to run repeatedly: re-running this file never destroys or duplicates
-- data.
--
-- Identifier convention: primary keys keep the 24-character hexadecimal shape of
-- the old ObjectIds so existing references, tokens and client-side caches stay
-- valid.

-- Substring search (ILIKE '%...%') cannot use a btree index. pg_trgm provides
-- the GIN operator classes the inbox search indexes below rely on. It ships
-- with PostgreSQL's contrib modules and creating it is idempotent.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Stamps updated_at on every change. A transaction may opt out with
--   SET LOCAL app.preserve_updated_at = 'on'
-- which the data migration uses so imported rows keep their original
-- timestamps. Normal application traffic never sets it.
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  IF coalesce(current_setting('app.preserve_updated_at', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attaches the updated_at trigger to a table without failing if it already exists.
CREATE OR REPLACE FUNCTION attach_updated_at(target regclass) RETURNS void AS $$
DECLARE
  tname text := target::text;
BEGIN
  EXECUTE format('DROP TRIGGER IF EXISTS trg_set_updated_at ON %s', tname);
  EXECUTE format('CREATE TRIGGER trg_set_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tname);
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- organizations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS organizations (
  id             varchar(24) PRIMARY KEY,
  name           text NOT NULL,
  owner_user_id  varchar(24),
  plan_type      text NOT NULL DEFAULT 'FREE',
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_plan_type_check CHECK (plan_type IN ('FREE', 'PRO', 'ENTERPRISE'))
);
CREATE INDEX IF NOT EXISTS idx_organizations_owner_user_id ON organizations (owner_user_id);
CREATE INDEX IF NOT EXISTS idx_organizations_is_active ON organizations (is_active);


-- ---------------------------------------------------------------------------
-- users  (account owners / admins that sign up directly)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id               varchar(24) PRIMARY KEY,
  email            text NOT NULL,
  password         text NOT NULL,
  name             text NOT NULL,
  role             text NOT NULL DEFAULT 'agent',
  avatar           text,
  is_active        boolean NOT NULL DEFAULT true,
  is_onboarded     boolean NOT NULL DEFAULT false,
  organization_id  varchar(24) REFERENCES organizations (id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'offline',
  permissions      jsonb NOT NULL DEFAULT '{"canManageTeam":false,"canManageDepartments":false,"canViewAllConversations":false,"canAssignConversations":true,"canDeleteConversations":false}'::jsonb,
  preferences      jsonb NOT NULL DEFAULT '{"autoAcceptAssignments":true,"maxActiveConversations":10,"notificationSound":true}'::jsonb,
  stats            jsonb NOT NULL DEFAULT '{"totalConversations":0,"activeConversations":0,"resolvedConversations":0,"averageResponseTime":0}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_role_check CHECK (role IN ('owner', 'admin', 'manager', 'agent', 'viewer')),
  CONSTRAINT users_status_check CHECK (status IN ('online', 'offline', 'busy', 'away'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users (organization_id);
-- Login always filters on email together with is_active.
CREATE INDEX IF NOT EXISTS idx_users_email_active ON users (email, is_active);

DO $$ BEGIN
  ALTER TABLE organizations
    ADD CONSTRAINT organizations_owner_user_id_fkey
    FOREIGN KEY (owner_user_id) REFERENCES users (id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ---------------------------------------------------------------------------
-- sites
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sites (
  id               varchar(24) PRIMARY KEY,
  name             text NOT NULL,
  domain           text NOT NULL,
  site_key         text NOT NULL,
  user_id          varchar(24) REFERENCES users (id) ON DELETE SET NULL,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  widget_settings  jsonb NOT NULL DEFAULT '{"position":"bottom-right","primaryColor":"#4F46E5","welcomeMessage":"Hi! How can we help you today?","placeholderText":"Type your message...","showOnPages":[],"autoOpen":false,"autoOpenDelay":5000}'::jsonb,
  ai_settings      jsonb NOT NULL DEFAULT '{"enabled":false,"fallbackToHuman":true,"aiModel":"faq-based"}'::jsonb,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_site_key ON sites (site_key);
CREATE INDEX IF NOT EXISTS idx_sites_user_id ON sites (user_id);
CREATE INDEX IF NOT EXISTS idx_sites_organization_id ON sites (organization_id);
-- The widget resolves a site by key and only ever wants active ones.
CREATE INDEX IF NOT EXISTS idx_sites_site_key_active ON sites (site_key, is_active);
CREATE INDEX IF NOT EXISTS idx_sites_domain ON sites (domain);

-- Kurulum doğrulaması. Widget bir sayfada ilk kez ayağa kalktığında buraya
-- kendini bildirir; panel "kurulum bekleniyor / kurulu" durumunu bu alandan
-- okur. Ayrı bir tablo açmak yerine jsonb: alan sayısı azdır ve sorgulanmaz,
-- yalnızca site kaydıyla birlikte okunur.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS installation jsonb NOT NULL DEFAULT '{}'::jsonb;


-- ---------------------------------------------------------------------------
-- teams  (agents created from the admin panel)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id               varchar(24) PRIMARY KEY,
  email            text NOT NULL,
  password         text NOT NULL,
  name             text NOT NULL,
  role             text NOT NULL DEFAULT 'agent',
  avatar           text,
  organization_id  varchar(24) REFERENCES organizations (id) ON DELETE SET NULL,
  is_active        boolean NOT NULL DEFAULT true,
  status           text NOT NULL DEFAULT 'offline',
  skills           text[] NOT NULL DEFAULT '{}',
  max_capacity     integer NOT NULL DEFAULT 10,
  current_load     integer NOT NULL DEFAULT 0,
  permissions      jsonb NOT NULL DEFAULT '{"canManageConversations":true,"canManageDepartments":false,"canManageTeam":false,"canManageSites":false,"canViewAnalytics":true,"canManageFAQs":false}'::jsonb,
  stats            jsonb NOT NULL DEFAULT '{"totalConversations":0,"activeConversations":0,"resolvedConversations":0,"averageResponseTime":0,"satisfactionRate":0}'::jsonb,
  last_active      timestamptz NOT NULL DEFAULT now(),
  phone            text,
  bio              text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teams_role_check CHECK (role IN ('admin', 'manager', 'agent')),
  CONSTRAINT teams_status_check CHECK (status IN ('online', 'offline', 'away', 'busy')),
  CONSTRAINT teams_max_capacity_check CHECK (max_capacity >= 1),
  CONSTRAINT teams_current_load_check CHECK (current_load >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_email ON teams (email);
CREATE INDEX IF NOT EXISTS idx_teams_organization_id ON teams (organization_id);
CREATE INDEX IF NOT EXISTS idx_teams_status ON teams (status);
CREATE INDEX IF NOT EXISTS idx_teams_email_active ON teams (email, is_active);
-- Auto-assignment scans online, active agents inside one organization.
CREATE INDEX IF NOT EXISTS idx_teams_org_active_status ON teams (organization_id, is_active, status);
CREATE INDEX IF NOT EXISTS idx_teams_skills ON teams USING gin (skills);


-- ---------------------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
  id                 varchar(24) PRIMARY KEY,
  name               text NOT NULL,
  description        text NOT NULL DEFAULT '',
  required_skills    text[] NOT NULL DEFAULT '{}',
  site_id            varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  color              text NOT NULL DEFAULT '#3B82F6',
  icon               text NOT NULL DEFAULT U&'\+01F4AC',
  auto_assign_rules  jsonb NOT NULL DEFAULT '{"enabled":false,"strategy":"round-robin"}'::jsonb,
  business_hours     jsonb NOT NULL DEFAULT '{"enabled":false,"timezone":"Europe/Istanbul","schedule":{"monday":{"start":"09:00","end":"18:00","enabled":true},"tuesday":{"start":"09:00","end":"18:00","enabled":true},"wednesday":{"start":"09:00","end":"18:00","enabled":true},"thursday":{"start":"09:00","end":"18:00","enabled":true},"friday":{"start":"09:00","end":"18:00","enabled":true},"saturday":{"start":"09:00","end":"18:00","enabled":false},"sunday":{"start":"09:00","end":"18:00","enabled":false}}}'::jsonb,
  sla                jsonb NOT NULL DEFAULT '{"enabled":true,"firstResponse":{"urgent":5,"high":15,"normal":30,"low":60},"resolution":{"urgent":120,"high":240,"normal":480,"low":1440},"onlyBusinessHours":false}'::jsonb,
  is_active          boolean NOT NULL DEFAULT true,
  stats              jsonb NOT NULL DEFAULT '{"totalConversations":0,"activeConversations":0,"averageResponseTime":0,"slaMetrics":{"firstResponseMet":0,"firstResponseBreached":0,"resolutionMet":0,"resolutionBreached":0,"averageFirstResponseTime":0,"averageResolutionTime":0}}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_departments_site_id ON departments (site_id);
CREATE INDEX IF NOT EXISTS idx_departments_site_active ON departments (site_id, is_active);
-- The widget picks the oldest active department for a site.
CREATE INDEX IF NOT EXISTS idx_departments_site_active_created ON departments (site_id, is_active, created_at);

-- Department membership. `user_id` is deliberately not a foreign key: the
-- application stores either a teams.id or a users.id here (both act as agents).
CREATE TABLE IF NOT EXISTS department_members (
  department_id  varchar(24) NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  user_id        varchar(24) NOT NULL,
  role           text NOT NULL DEFAULT 'agent',
  added_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (department_id, user_id),
  CONSTRAINT department_members_role_check CHECK (role IN ('manager', 'agent'))
);
CREATE INDEX IF NOT EXISTS idx_department_members_user_id ON department_members (user_id);


-- ---------------------------------------------------------------------------
-- users / teams  <->  sites and departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_assigned_sites (
  user_id  varchar(24) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  site_id  varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_user_assigned_sites_site_id ON user_assigned_sites (site_id);

CREATE TABLE IF NOT EXISTS user_departments (
  user_id        varchar(24) NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  department_id  varchar(24) NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'agent',
  PRIMARY KEY (user_id, department_id),
  CONSTRAINT user_departments_role_check CHECK (role IN ('manager', 'agent'))
);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments (department_id);

CREATE TABLE IF NOT EXISTS team_assigned_sites (
  team_id  varchar(24) NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  site_id  varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, site_id)
);
CREATE INDEX IF NOT EXISTS idx_team_assigned_sites_site_id ON team_assigned_sites (site_id);

CREATE TABLE IF NOT EXISTS team_departments (
  team_id        varchar(24) NOT NULL REFERENCES teams (id) ON DELETE CASCADE,
  department_id  varchar(24) NOT NULL REFERENCES departments (id) ON DELETE CASCADE,
  role           text NOT NULL DEFAULT 'agent',
  PRIMARY KEY (team_id, department_id),
  CONSTRAINT team_departments_role_check CHECK (role IN ('manager', 'agent'))
);
CREATE INDEX IF NOT EXISTS idx_team_departments_department_id ON team_departments (department_id);


-- ---------------------------------------------------------------------------
-- conversations
-- ---------------------------------------------------------------------------
-- Sequential ticket numbers previously came from a `counters` document.
CREATE TABLE IF NOT EXISTS counters (
  id   text PRIMARY KEY,
  seq  bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS conversations (
  id                      varchar(24) PRIMARY KEY,
  ticket_number           bigint,
  ticket_id               text,
  site_id                 varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  organization_id         varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  visitor_id              text NOT NULL,
  visitor_name            text NOT NULL DEFAULT 'Visitor',
  visitor_email           text,
  department_id           varchar(24) REFERENCES departments (id) ON DELETE SET NULL,
  -- Agent references are polymorphic (a teams.id or a users.id), so they carry
  -- an index instead of a foreign key.
  assigned_agent_id       varchar(24),
  assigned_at             timestamptz,
  assigned_by_id          varchar(24),
  status                  text NOT NULL DEFAULT 'open',
  priority                text NOT NULL DEFAULT 'normal',
  required_skills         text[] NOT NULL DEFAULT '{}',
  unread_count            integer NOT NULL DEFAULT 0,
  next_sla_check_at       timestamptz,
  auto_reassign_attempts  integer NOT NULL DEFAULT 0,
  last_reassign_at        timestamptz,
  sla                     jsonb NOT NULL DEFAULT '{"firstResponseStatus":"pending","resolutionStatus":"pending","firstResponseTimeRemaining":null,"resolutionTimeRemaining":null,"firstResponseBreachedAt":null,"resolutionBreachedAt":null}'::jsonb,
  channel                 text NOT NULL DEFAULT 'web-chat',
  current_page            text NOT NULL DEFAULT '/',
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  tags                    text[] NOT NULL DEFAULT '{}',
  rating                  jsonb NOT NULL DEFAULT '{"score":null,"feedback":null,"ratedAt":null}'::jsonb,
  last_message_at         timestamptz NOT NULL DEFAULT now(),
  first_response_at       timestamptz,
  resolved_at             timestamptz,
  closed_at               timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_status_check CHECK (status IN ('open', 'assigned', 'pending', 'resolved', 'closed', 'unassigned')),
  CONSTRAINT conversations_priority_check CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  CONSTRAINT conversations_channel_check CHECK (channel IN ('web-chat', 'email', 'whatsapp', 'phone')),
  CONSTRAINT conversations_unread_count_check CHECK (unread_count >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_ticket_number ON conversations (ticket_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversations_ticket_id ON conversations (ticket_id);
CREATE INDEX IF NOT EXISTS idx_conversations_site_id ON conversations (site_id);
CREATE INDEX IF NOT EXISTS idx_conversations_organization_id ON conversations (organization_id);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_id ON conversations (visitor_id);
CREATE INDEX IF NOT EXISTS idx_conversations_department_id ON conversations (department_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations (status);
CREATE INDEX IF NOT EXISTS idx_conversations_next_sla_check_at ON conversations (next_sla_check_at);
-- Admin panel listings: newest conversations of one site / organization.
CREATE INDEX IF NOT EXISTS idx_conversations_site_status_created ON conversations (site_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status_created ON conversations (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_site_dept_status ON conversations (site_id, department_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_status ON conversations (assigned_agent_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_dept_status_lastmsg ON conversations (department_id, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_sla_first_response ON conversations ((sla ->> 'firstResponseStatus'));
CREATE INDEX IF NOT EXISTS idx_conversations_sla_resolution ON conversations ((sla ->> 'resolutionStatus'));
CREATE INDEX IF NOT EXISTS idx_conversations_status_sla_check ON conversations (status, next_sla_check_at);
CREATE INDEX IF NOT EXISTS idx_conversations_org_status_sla_check ON conversations (organization_id, status, next_sla_check_at);
-- The widget reopens the visitor's still-running conversation on every page load.
CREATE INDEX IF NOT EXISTS idx_conversations_site_visitor_status ON conversations (site_id, visitor_id, status);
-- Listings order by recency inside a site.
CREATE INDEX IF NOT EXISTS idx_conversations_site_lastmsg ON conversations (site_id, last_message_at DESC);
-- Inbox listing, exactly matching its ORDER BY (site_id, last_message_at DESC,
-- id DESC). The id tiebreaker is what makes keyset pagination stable, and
-- without it in the index PostgreSQL sorted the whole site: measured on 250k
-- conversations the first page took 95 ms of parallel sequential scan, and
-- 0.2 ms once this index matched.
CREATE INDEX IF NOT EXISTS idx_conversations_site_lastmsg_id ON conversations (site_id, last_message_at DESC, id DESC);
-- Inbox search. Every OR branch needs its own index: PostgreSQL can only
-- combine them with a BitmapOr when none of them forces a sequential scan, so
-- leaving ticket_id out cost the whole optimisation (318 ms vs 0.8 ms).
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_name_trgm ON conversations USING gin (visitor_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_visitor_email_trgm ON conversations USING gin (visitor_email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_conversations_ticket_id_trgm ON conversations USING gin (ticket_id gin_trgm_ops);
-- The inbox filter chips (open / assigned / unassigned counts). Every column
-- the aggregate reads is in the index, so PostgreSQL answers it with an
-- index-only scan and never touches the heap: 132 ms -> 53 ms on 250k rows.
CREATE INDEX IF NOT EXISTS idx_conversations_counts ON conversations (organization_id, site_id, status, assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_conversations_agent_lastmsg ON conversations (assigned_agent_id, last_message_at DESC);
-- Unread badge aggregation skips conversations that have nothing unread.
CREATE INDEX IF NOT EXISTS idx_conversations_org_unread ON conversations (organization_id) WHERE unread_count > 0;

-- Internal notes were an embedded array; `user_id` stays polymorphic.
CREATE TABLE IF NOT EXISTS conversation_internal_notes (
  id               varchar(24) PRIMARY KEY,
  conversation_id  varchar(24) NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  user_id          varchar(24),
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_conversation_internal_notes_conversation ON conversation_internal_notes (conversation_id, created_at);


-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id               varchar(24) PRIMARY KEY,
  conversation_id  varchar(24) NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  sender_type      text NOT NULL,
  sender_id        text NOT NULL,
  sender_name      text NOT NULL,
  content          text NOT NULL,
  message_type     text NOT NULL DEFAULT 'text',
  file_data        jsonb,
  is_read          boolean NOT NULL DEFAULT false,
  read_at          timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT messages_sender_type_check CHECK (sender_type IN ('visitor', 'agent', 'bot')),
  CONSTRAINT messages_message_type_check CHECK (message_type IN ('text', 'image', 'file', 'system'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages (conversation_id, created_at);
-- "Latest message of a conversation" lookups walk this index backwards.
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_desc ON messages (conversation_id, created_at DESC);
-- Searching message bodies from the inbox. Measured on 750k messages: 553 ms
-- without this index, 7 ms with it.
CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);
-- Marking a visitor's messages as read.
CREATE INDEX IF NOT EXISTS idx_messages_unread_visitor ON messages (conversation_id) WHERE is_read = false AND sender_type = 'visitor';


-- ---------------------------------------------------------------------------
-- faqs
-- ---------------------------------------------------------------------------
-- Builds the searchable document for a FAQ row. `array_to_string` is only
-- marked STABLE by PostgreSQL, so the expression is wrapped in an explicitly
-- immutable function to make it usable from a generated column. The 'simple'
-- dictionary is used because the content is Turkish and must not be stemmed
-- with English rules.
CREATE OR REPLACE FUNCTION faq_search_vector(question text, answer text, keywords text[])
RETURNS tsvector AS $$
  SELECT to_tsvector('simple',
    coalesce(question, '') || ' ' ||
    coalesce(answer, '') || ' ' ||
    coalesce(array_to_string(keywords, ' '), ''));
$$ LANGUAGE sql IMMUTABLE;

CREATE TABLE IF NOT EXISTS faqs (
  id             varchar(24) PRIMARY KEY,
  site_id        varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  question       text NOT NULL,
  answer         text NOT NULL,
  category       text NOT NULL DEFAULT 'General',
  keywords       text[] NOT NULL DEFAULT '{}',
  page_specific  text NOT NULL DEFAULT '*',
  is_active      boolean NOT NULL DEFAULT true,
  sort_order     integer NOT NULL DEFAULT 0,
  view_count     integer NOT NULL DEFAULT 0,
  helpful_count  integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Replaces the Mongo text index over question/answer/keywords.
  search_vector  tsvector GENERATED ALWAYS AS (faq_search_vector(question, answer, keywords)) STORED
);
CREATE INDEX IF NOT EXISTS idx_faqs_site_id ON faqs (site_id);
CREATE INDEX IF NOT EXISTS idx_faqs_site_active ON faqs (site_id, is_active);
CREATE INDEX IF NOT EXISTS idx_faqs_site_order ON faqs (site_id, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_faqs_search_vector ON faqs USING gin (search_vector);


-- ---------------------------------------------------------------------------
-- visitors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS visitors (
  id               varchar(24) PRIMARY KEY,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  visitor_id       text NOT NULL,
  ip               text,
  country          text,
  browser          text,
  os               text,
  current_page     text NOT NULL DEFAULT '/',
  referrer         text,
  is_active        boolean NOT NULL DEFAULT true,
  last_active_at   timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitors_site_id ON visitors (site_id);
CREATE INDEX IF NOT EXISTS idx_visitors_organization_id ON visitors (organization_id);
CREATE INDEX IF NOT EXISTS idx_visitors_visitor_id ON visitors (visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitors_last_active_at ON visitors (last_active_at);
-- Socket upserts address a visitor by (site, visitor) on every page view.
CREATE INDEX IF NOT EXISTS idx_visitors_site_visitor ON visitors (site_id, visitor_id);
-- "Currently online" panel.
CREATE INDEX IF NOT EXISTS idx_visitors_site_active_lastactive ON visitors (site_id, is_active, last_active_at DESC);


-- ---------------------------------------------------------------------------
-- widget_configs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS widget_configs (
  id               varchar(24) PRIMARY KEY,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  colors           jsonb NOT NULL DEFAULT '{"primary":"#4F46E5","header":"#4F46E5","background":"#FFFFFF","text":"#1F2937","textSecondary":"#6B7280","border":"#E5E7EB","visitorMessageBg":"#4F46E5","agentMessageBg":"#F3F4F6"}'::jsonb,
  branding         jsonb NOT NULL DEFAULT '{"logo":null,"logoWidth":40,"logoHeight":40,"brandName":"Support","showBrandName":true}'::jsonb,
  button           jsonb NOT NULL DEFAULT '{"position":"bottom-right","size":"medium","icon":"message-circle","showLabel":false,"labelText":"Chat with us","borderRadius":50,"shadow":true,"shadowColor":"rgba(0,0,0,0.15)"}'::jsonb,
  "window"         jsonb NOT NULL DEFAULT '{"width":400,"height":650,"borderRadius":16,"headerHeight":60,"showHeader":true,"showCloseButton":true}'::jsonb,
  messages         jsonb NOT NULL DEFAULT '{"welcomeMessage":"","placeholderText":"Type your message...","showTimestamps":true,"showAvatars":true,"messageBubbleRadius":12}'::jsonb,
  behavior         jsonb NOT NULL DEFAULT '{"autoOpen":false,"autoOpenDelay":5000,"showOnPages":[],"hideOnPages":[],"showUnreadBadge":true,"enableSound":true,"enableNotifications":true}'::jsonb,
  typography       jsonb NOT NULL DEFAULT '{"fontFamily":"-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, sans-serif","fontSize":"medium","fontWeight":"normal"}'::jsonb,
  advanced         jsonb NOT NULL DEFAULT '{"customCSS":null,"zIndex":999999,"animationSpeed":"normal"}'::jsonb,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_widget_configs_site_id ON widget_configs (site_id);
CREATE INDEX IF NOT EXISTS idx_widget_configs_organization_id ON widget_configs (organization_id);
CREATE INDEX IF NOT EXISTS idx_widget_configs_site_active ON widget_configs (site_id, is_active);


-- ---------------------------------------------------------------------------
-- deals  (CRM pipeline)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS deals (
  id               varchar(24) PRIMARY KEY,
  title            text NOT NULL,
  value            numeric NOT NULL DEFAULT 0,
  currency         text NOT NULL DEFAULT 'TRY',
  contact_name     text NOT NULL,
  contact_email    text,
  contact_phone    text,
  stage            text NOT NULL DEFAULT 'new',
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  -- Owner references may point at a users.id or a teams.id.
  assigned_to_id   varchar(24),
  created_by_id    varchar(24) NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  notes            text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deals_stage_check CHECK (stage IN ('new', 'potential', 'quoted', 'negotiation', 'won', 'lost'))
);
CREATE INDEX IF NOT EXISTS idx_deals_organization_id ON deals (organization_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals (stage);
CREATE INDEX IF NOT EXISTS idx_deals_org_stage ON deals (organization_id, stage);
-- Board ordering, and the "highest order in a stage" lookup on insert.
CREATE INDEX IF NOT EXISTS idx_deals_org_stage_order ON deals (organization_id, stage, sort_order DESC);
CREATE INDEX IF NOT EXISTS idx_deals_org_order_created ON deals (organization_id, sort_order, created_at DESC);


-- ---------------------------------------------------------------------------
-- audit_logs  (append only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) REFERENCES organizations (id) ON DELETE CASCADE,
  -- user_id / entity_id point at several different tables, so no foreign key.
  user_id          varchar(24),
  action           text NOT NULL,
  entity_type      text,
  entity_id        varchar(24),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address       text,
  user_agent       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT audit_logs_action_check CHECK (action IN (
    'LOGIN_SUCCESS', 'LOGIN_FAILED',
    'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
    'PLAN_CHANGED', 'UPDATE_SLA',
    'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
    'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
    'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
    'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED'))
);

-- The allowed action list grows as new audited operations are added. Widening a
-- CHECK constraint needs an explicit drop first, so this pair runs on every boot
-- and leaves an already-current database unchanged.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED'));
CREATE INDEX IF NOT EXISTS idx_audit_logs_organization_id ON audit_logs (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs (action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs (organization_id, created_at DESC);
-- Filtering by action inside one organization is the usual admin-panel query.
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action_created ON audit_logs (organization_id, action, created_at DESC);

-- Audit records were immutable in the previous model; the database enforces it now.
CREATE OR REPLACE FUNCTION audit_logs_block_update() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Audit records are immutable and cannot be modified';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON audit_logs;
CREATE TRIGGER trg_audit_logs_immutable BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_update();


-- ---------------------------------------------------------------------------
-- team chat
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_chats (
  id             varchar(24) PRIMARY KEY,
  chat_id        text NOT NULL,
  chat_type      text NOT NULL,
  group_name     text,
  -- Participants can be users or teams, so these columns stay reference-free.
  created_by_id  varchar(24),
  last_message   jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_chats_chat_type_check CHECK (chat_type IN ('direct', 'group'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_team_chats_chat_id ON team_chats (chat_id);

CREATE TABLE IF NOT EXISTS team_chat_participants (
  team_chat_id    varchar(24) NOT NULL REFERENCES team_chats (id) ON DELETE CASCADE,
  participant_id  varchar(24) NOT NULL,
  PRIMARY KEY (team_chat_id, participant_id)
);
-- "Which chats am I in" drives the chat list.
CREATE INDEX IF NOT EXISTS idx_team_chat_participants_participant ON team_chat_participants (participant_id);

CREATE TABLE IF NOT EXISTS team_messages (
  id            varchar(24) PRIMARY KEY,
  chat_id       text NOT NULL,
  chat_type     text NOT NULL,
  sender_id     varchar(24) NOT NULL,
  sender_name   text NOT NULL,
  content       text NOT NULL,
  message_type  text NOT NULL DEFAULT 'text',
  group_name    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_messages_chat_type_check CHECK (chat_type IN ('direct', 'group')),
  CONSTRAINT team_messages_message_type_check CHECK (message_type IN ('text', 'system'))
);
CREATE INDEX IF NOT EXISTS idx_team_messages_chat_created ON team_messages (chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_team_messages_chat_created_desc ON team_messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_messages_sender_id ON team_messages (sender_id);

CREATE TABLE IF NOT EXISTS team_message_read_by (
  team_message_id  varchar(24) NOT NULL REFERENCES team_messages (id) ON DELETE CASCADE,
  reader_id        varchar(24) NOT NULL,
  PRIMARY KEY (team_message_id, reader_id)
);
CREATE INDEX IF NOT EXISTS idx_team_message_read_by_reader ON team_message_read_by (reader_id);

CREATE TABLE IF NOT EXISTS team_message_participants (
  team_message_id  varchar(24) NOT NULL REFERENCES team_messages (id) ON DELETE CASCADE,
  participant_id   varchar(24) NOT NULL,
  PRIMARY KEY (team_message_id, participant_id)
);


-- ---------------------------------------------------------------------------
-- automation
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS automation_rules (
  id                  varchar(24) PRIMARY KEY,
  site_id             varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  name                text NOT NULL,
  is_active           boolean NOT NULL DEFAULT true,
  priority            integer NOT NULL DEFAULT 0,
  trigger_type        text NOT NULL,
  -- Conditions and actions are always read and written as a whole document.
  conditions          jsonb NOT NULL DEFAULT '[]'::jsonb,
  condition_operator  text NOT NULL DEFAULT 'AND',
  actions             jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics             jsonb NOT NULL DEFAULT '{"executionsCount":0,"successCount":0,"failureCount":0}'::jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_rules_trigger_type_check CHECK (trigger_type IN ('message_received', 'conversation_created', 'visitor_event', 'schedule'))
);
CREATE INDEX IF NOT EXISTS idx_automation_rules_site_id ON automation_rules (site_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_lookup ON automation_rules (site_id, trigger_type, is_active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_automation_rules_site_priority ON automation_rules (site_id, priority DESC, created_at DESC);

CREATE TABLE IF NOT EXISTS automation_logs (
  id                 varchar(24) PRIMARY KEY,
  rule_id            varchar(24) NOT NULL REFERENCES automation_rules (id) ON DELETE CASCADE,
  site_id            varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  trigger_type       text NOT NULL,
  target_id          varchar(24),
  status             text NOT NULL,
  error_details      text,
  execution_time_ms  integer,
  executed_at        timestamptz NOT NULL DEFAULT now(),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT automation_logs_status_check CHECK (status IN ('success', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_automation_logs_rule_id ON automation_logs (rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_site_id ON automation_logs (site_id);
-- Supports the 30 day retention sweep that replaces the old TTL index.
CREATE INDEX IF NOT EXISTS idx_automation_logs_executed_at ON automation_logs (executed_at);


-- ---------------------------------------------------------------------------
-- proactive engagement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proactive_rules (
  id                 varchar(24) PRIMARY KEY,
  site_id            varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  name               text NOT NULL,
  is_active          boolean NOT NULL DEFAULT true,
  trigger_condition  jsonb NOT NULL DEFAULT '{"urlMatch":"any","timeThresholdSeconds":0,"scrollPercentage":0}'::jsonb,
  audience_context   jsonb NOT NULL DEFAULT '{"deviceType":"all"}'::jsonb,
  action             jsonb NOT NULL DEFAULT '{}'::jsonb,
  frequency_control  jsonb NOT NULL DEFAULT '{"triggerOncePerVisitor":true,"cooldownMinutes":1440}'::jsonb,
  metrics            jsonb NOT NULL DEFAULT '{"triggersCount":0,"conversionsCount":0}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proactive_rules_site_id ON proactive_rules (site_id);
CREATE INDEX IF NOT EXISTS idx_proactive_rules_site_created ON proactive_rules (site_id, created_at DESC);
-- The tracking endpoint filters by site, active flag and the nested event type.
CREATE INDEX IF NOT EXISTS idx_proactive_rules_lookup
  ON proactive_rules (site_id, is_active, ((trigger_condition ->> 'eventType')));

CREATE TABLE IF NOT EXISTS proactive_trigger_logs (
  id            varchar(24) PRIMARY KEY,
  rule_id       varchar(24) NOT NULL REFERENCES proactive_rules (id) ON DELETE CASCADE,
  site_id       varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  visitor_id    text NOT NULL,
  triggered_at  timestamptz NOT NULL DEFAULT now(),
  converted     boolean NOT NULL DEFAULT false,
  converted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_logs_rule_id ON proactive_trigger_logs (rule_id);
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_logs_site_id ON proactive_trigger_logs (site_id);
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_logs_visitor_id ON proactive_trigger_logs (visitor_id);
-- Frequency control reads the newest log for a (rule, visitor) pair.
CREATE INDEX IF NOT EXISTS idx_proactive_trigger_logs_rule_visitor ON proactive_trigger_logs (rule_id, visitor_id, triggered_at DESC);

CREATE TABLE IF NOT EXISTS event_logs (
  id          varchar(24) PRIMARY KEY,
  site_id     varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  visitor_id  text NOT NULL,
  session_id  text,
  event_type  text NOT NULL,
  event_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  url         text,
  referrer    text,
  user_agent  text,
  "timestamp" timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT event_logs_event_type_check CHECK (event_type IN (
    'page_view', 'time_on_page', 'scroll_depth', 'inactivity', 'exit_intent',
    'click', 'custom_event', 'form_start', 'form_submit'))
);
CREATE INDEX IF NOT EXISTS idx_event_logs_site_id ON event_logs (site_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_visitor_id ON event_logs (visitor_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_session_id ON event_logs (session_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_event_type ON event_logs (event_type);
-- Supports the 30 day retention sweep that replaces the old TTL index.
CREATE INDEX IF NOT EXISTS idx_event_logs_timestamp ON event_logs ("timestamp");


-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
SELECT attach_updated_at(t) FROM (VALUES
  ('organizations'::regclass), ('users'), ('sites'), ('teams'), ('departments'),
  ('conversations'), ('messages'), ('faqs'), ('visitors'), ('widget_configs'),
  ('deals'), ('team_chats'), ('team_messages'), ('automation_rules'),
  ('automation_logs'), ('proactive_rules'), ('proactive_trigger_logs'), ('event_logs')
) AS v(t);


-- ---------------------------------------------------------------------------
-- self-hosted AI assistant
-- ---------------------------------------------------------------------------
-- Site AI settings move to the shape the assistant reads. `mode` is who may
-- answer on the site's behalf: nobody (off), agents with a copilot (copilot),
-- or the assistant itself (auto). Sites that had AI switched on become
-- copilot; no site becomes auto without someone choosing it. Rows already in
-- the new shape are left alone, so this runs on every boot harmlessly.
UPDATE sites SET ai_settings = jsonb_build_object(
  'mode', CASE WHEN coalesce((ai_settings->>'enabled')::boolean, false) THEN 'copilot' ELSE 'off' END,
  'answerLength', 'short', 'tone', 'professional', 'maxBotReplies', 8,
  'blockedTerms', '[]'::jsonb, 'botName', NULL, 'handoffMessage', NULL)
WHERE NOT (ai_settings ? 'mode');
ALTER TABLE sites ALTER COLUMN ai_settings SET DEFAULT
  '{"mode":"off","answerLength":"short","tone":"professional","maxBotReplies":8,"blockedTerms":[],"botName":null,"handoffMessage":null}'::jsonb;

-- The shop's side of identity verification and order lookup. Both secrets are
-- stored sealed (AES-256-GCM, see config/secretBox.ts), never in the clear.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS integrations jsonb NOT NULL DEFAULT
  '{"identitySecret":null,"orderLookup":{"enabled":false,"url":null,"signingSecret":null}}'::jsonb;

-- Who answers the visitor right now. "Assigned" is not the same thing: a
-- conversation can be assigned to an agent while the assistant answers it.
-- The version increases on every change of hands, so an answer the model was
-- still writing when an agent took over is recognised as stale and dropped.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS response_owner text NOT NULL DEFAULT 'human';
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_control_version integer NOT NULL DEFAULT 0;
DO $$ BEGIN
  ALTER TABLE conversations
    ADD CONSTRAINT conversations_response_owner_check CHECK (response_owner IN ('ai', 'human'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- The widget's own id for a message it sent. A resend after a dropped
-- connection carries the same id, and the unique index is what stops it
-- becoming a second message and a second automatic answer.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS client_message_id text;
-- Why the assistant said what it said: decision, sources, prompt version,
-- duration. Never the prompt or the model's raw output.
ALTER TABLE messages ADD COLUMN IF NOT EXISTS ai_metadata jsonb;
CREATE UNIQUE INDEX IF NOT EXISTS uq_messages_client_id
  ON messages (conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;

-- ===========================================================================
-- 0001_site_allowed_origins.sql
-- ===========================================================================
-- 0001 — the origins a site's widget may run on.
--
-- The widget endpoints and the /widget socket used to answer any origin: a
-- site key, which is public by nature (it sits in the page source), was the
-- only credential. Each site now lists the exact origins (scheme://host[:port])
-- its widget may be embedded on, and a widget session is issued and used only
-- from one of them.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS allowed_origins text[] NOT NULL DEFAULT '{}';

-- Existing sites are seeded from their single `domain` value: the domain
-- itself and its www. twin, over https unless the domain was written with an
-- explicit http:// scheme. Bare IPs and localhost get only themselves.
WITH parsed AS (
  SELECT
    id,
    lower(regexp_replace(regexp_replace(btrim(domain), '^[a-z][a-z0-9+.-]*://', '', 'i'), '[/?#].*$', '')) AS host,
    CASE WHEN btrim(domain) ~* '^http://' THEN 'http' ELSE 'https' END AS scheme
  FROM sites
  WHERE allowed_origins = '{}'
)
UPDATE sites AS s
SET allowed_origins = CASE
  WHEN p.host = '' OR p.host ~ '[^a-z0-9.:\-\[\]]' THEN '{}'::text[]
  WHEN p.host ~ '^www\.' THEN ARRAY[p.scheme || '://' || p.host, p.scheme || '://' || substr(p.host, 5)]
  WHEN p.host ~ '^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?$' THEN ARRAY[p.scheme || '://' || p.host]
  ELSE ARRAY[p.scheme || '://' || p.host, p.scheme || '://www.' || p.host]
END
FROM parsed AS p
WHERE s.id = p.id;

-- ===========================================================================
-- 0002_auth_tokens_email_verification.sql
-- ===========================================================================
-- 0002 — e-mail verification, password reset, and sessions that can end.
--
-- auth_tokens holds one-time links sent by e-mail. Only a SHA-256 of the
-- token is stored: a database leak must not hand out working reset links.
--
-- session_version is signed into every session (`sv`). Raising it ends every
-- session of that account at once — what a password reset needs, since the
-- reason for a reset is often that someone else has the password.

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

-- Accounts that exist already predate verification; they are not locked out
-- of the widget by a rule that did not exist when they signed up.
UPDATE users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
UPDATE teams SET email_verified_at = created_at WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS auth_tokens (
  id            varchar(24) PRIMARY KEY,
  -- A users.id or a teams.id, as account_type says; polymorphic, so no FK.
  account_id    varchar(24) NOT NULL,
  account_type  text NOT NULL,
  purpose       text NOT NULL,
  token_hash    text NOT NULL,
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_tokens_account_type_check CHECK (account_type IN ('user', 'team')),
  CONSTRAINT auth_tokens_purpose_check CHECK (purpose IN ('verify', 'reset'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_auth_tokens_hash ON auth_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_auth_tokens_account ON auth_tokens (account_type, account_id, purpose);
-- The retention sweep deletes expired rows.
CREATE INDEX IF NOT EXISTS idx_auth_tokens_expires_at ON auth_tokens (expires_at);

-- New audited actions. A CHECK cannot be widened in place.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET'));

-- ===========================================================================
-- 0003_invitations.sql
-- ===========================================================================
-- 0003 — inviting agents instead of creating them with a password.
--
-- An admin used to create an agent by typing the agent's e-mail and a
-- password for them. Now the admin sends an invitation; the agent opens the
-- link, chooses their own password, and only then does a `teams` row exist.
-- As with auth_tokens, only a SHA-256 of the invitation token is stored.
CREATE TABLE IF NOT EXISTS invitations (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  email            text NOT NULL,
  role             text NOT NULL,
  -- Site ids the agent will be restricted to; empty means every site.
  assigned_sites   text[] NOT NULL DEFAULT '{}',
  token_hash       text NOT NULL,
  expires_at       timestamptz NOT NULL,
  accepted_at      timestamptz,
  revoked_at       timestamptz,
  -- A users.id or teams.id; polymorphic, so no FK.
  invited_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invitations_role_check CHECK (role IN ('admin', 'manager', 'agent'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_token_hash ON invitations (token_hash);
CREATE INDEX IF NOT EXISTS idx_invitations_org_created ON invitations (organization_id, created_at DESC);
-- One open invitation per address per organization; re-inviting revokes the
-- previous one first.
CREATE UNIQUE INDEX IF NOT EXISTS uq_invitations_open_email
  ON invitations (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  'SITE_AI_SETTINGS_UPDATED', 'SITE_INTEGRATION_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED'));

-- ===========================================================================
-- 0004_usage_monthly.sql
-- ===========================================================================
-- 0004 — what each organization used, per calendar month (UTC).
--
-- The conversation quota is enforced against this row, by the same UPSERT
-- that counts the new conversation (services/entitlements.ts): the row is
-- only incremented while it is under the plan's limit, so two conversations
-- opening at the same moment cannot both take the last slot.
CREATE TABLE IF NOT EXISTS organization_usage_monthly (
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  period           char(7) NOT NULL,
  conversations    integer NOT NULL DEFAULT 0,
  messages         integer NOT NULL DEFAULT 0,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id, period),
  CONSTRAINT organization_usage_monthly_period_check CHECK (period ~ '^\d{4}-\d{2}$')
);

-- ===========================================================================
-- 0005_gemini_assistant_replaces_ai.sql
-- ===========================================================================
-- 0005 — the self-hosted AI is gone; a small FAQ assistant on Gemini replaces it.
--
-- What the old assistant needed — per-site AI settings (mode, tone, blocked
-- terms...), an order-lookup integration, an ownership version and per-message
-- AI metadata — is dropped. What the new one needs is a switch per site, who
-- answers a conversation right now, and a short note on its own messages.

-- Sites: one switch for the assistant, one for the keyword FAQ reply (off by
-- default: an automatic answer must be something the site chose).
ALTER TABLE sites ADD COLUMN IF NOT EXISTS assistant_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS faq_auto_reply boolean NOT NULL DEFAULT false;
ALTER TABLE sites DROP COLUMN IF EXISTS ai_settings;

-- Integrations keep identity verification only; the order lookup went with
-- the old assistant.
UPDATE sites SET integrations = jsonb_build_object('identitySecret', integrations -> 'identitySecret');
ALTER TABLE sites ALTER COLUMN integrations SET DEFAULT '{"identitySecret":null}'::jsonb;

-- Who answers the visitor right now: the assistant or a person.
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_response_owner_check;
UPDATE conversations SET response_owner = 'human' WHERE response_owner <> 'human';
ALTER TABLE conversations ADD CONSTRAINT conversations_response_owner_check
  CHECK (response_owner IN ('assistant', 'human'));
ALTER TABLE conversations DROP COLUMN IF EXISTS ai_control_version;

-- On the assistant's own messages: which FAQ entries it used, or why it
-- handed over. Never the prompt, never the model's raw output.
ALTER TABLE messages DROP COLUMN IF EXISTS ai_metadata;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS assistant jsonb;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED'));

-- ===========================================================================
-- 0006_subscriptions_billing_events.sql
-- ===========================================================================
-- 0006 — paid plans through Paddle (plan §9).
--
-- `subscriptions` is what Paddle last told us about an organization's
-- subscription; the plan the server enforces is derived from it
-- (services/billing.ts#effectivePlan), so a cancelled subscription keeps its
-- plan until the paid period ends and a failed payment gets a grace period,
-- without a webhook having to arrive at that exact moment.
--
-- `billing_events` makes webhook delivery idempotent: Paddle retries, and an
-- event id that is already here is answered 200 without being applied again.
-- Only a hash of the payload is kept, not the payload (data minimisation).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                        varchar(24) PRIMARY KEY,
  organization_id           varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  provider                  text NOT NULL DEFAULT 'paddle',
  provider_customer_id      text,
  provider_subscription_id  text NOT NULL,
  plan_type                 text NOT NULL,
  status                    text NOT NULL,
  current_period_end        timestamptz,
  cancel_at_period_end      boolean NOT NULL DEFAULT false,
  -- When the subscription went past_due; the grace period counts from here.
  past_due_since            timestamptz,
  -- occurred_at of the newest event applied; an older event never undoes it.
  last_event_at             timestamptz NOT NULL,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_provider_check CHECK (provider IN ('paddle')),
  CONSTRAINT subscriptions_plan_type_check CHECK (plan_type IN ('FREE', 'PRO', 'ENTERPRISE')),
  CONSTRAINT subscriptions_status_check
    CHECK (status IN ('active', 'trialing', 'past_due', 'paused', 'canceled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_organization ON subscriptions (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_provider_id
  ON subscriptions (provider, provider_subscription_id);

CREATE TABLE IF NOT EXISTS billing_events (
  provider_event_id  text PRIMARY KEY,
  event_type         text NOT NULL,
  occurred_at        timestamptz NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  payload_hash       text NOT NULL,
  organization_id    varchar(24) REFERENCES organizations (id) ON DELETE SET NULL,
  status             text NOT NULL DEFAULT 'received',
  CONSTRAINT billing_events_status_check
    CHECK (status IN ('received', 'processed', 'ignored', 'stale'))
);
CREATE INDEX IF NOT EXISTS idx_billing_events_org
  ON billing_events (organization_id, occurred_at DESC);

-- ===========================================================================
-- 0007_assistant_usage.sql
-- ===========================================================================
-- 0007 — AI assistant answers per organization and month.
--
-- Each plan includes a number of assistant answers a month
-- (domain/plans.ts). The answer is counted by the same kind of conditional
-- UPSERT as conversations (services/entitlements.ts), so two answers at the
-- same moment cannot both take the last one.
ALTER TABLE organization_usage_monthly
  ADD COLUMN IF NOT EXISTS assistant_replies integer NOT NULL DEFAULT 0;

-- ===========================================================================
-- 0008_audit_site_actions.sql
-- ===========================================================================
-- Audit trail: sites, the chat bubble's settings and conversation assignment
-- (plan (6) §21). Only the action list widens; no row changes.

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED'));

-- ===========================================================================
-- 0009_account_security.sql
-- ===========================================================================
-- 0009 — account security (plan v10 SEC-03, SEC-04, SEC-05, SEC-06).
--
-- auth_tokens gains a third purpose, `email_change`: the link sent to a new
-- address before it replaces the old one. The new address travels in
-- `payload`, so the token row says what it confirms. A verification link
-- also records the password hash it was issued for (payload.pw): a link
-- mailed for one sign-up attempt cannot verify an account whose password
-- someone else has set since.
ALTER TABLE auth_tokens ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE auth_tokens DROP CONSTRAINT IF EXISTS auth_tokens_purpose_check;
ALTER TABLE auth_tokens ADD CONSTRAINT auth_tokens_purpose_check
  CHECK (purpose IN ('verify', 'reset', 'email_change'));

-- Two-step sign-in with an authenticator app (TOTP, RFC 6238). The secret
-- is sealed (config/secretBox.ts) before it is stored; recovery codes are
-- kept only as keyed hashes; totp_last_step refuses a code that was already
-- used once, within its own 30-second window or a later one.
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step bigint;
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_secret_enc text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_enabled_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS totp_last_step bigint;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS recovery_codes jsonb NOT NULL DEFAULT '[]'::jsonb;

-- billing_exempt: the plan is the one set by hand (scripts/updatePlan.ts
-- --exempt) and no subscription event moves it — the platform owner's own
-- workspace, beta customers. enforce_2fa: every member must sign in with a
-- second step (an Enterprise setting).
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS billing_exempt boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS enforce_2fa boolean NOT NULL DEFAULT false;

-- Audited actions added by this release and the ones right after it. Only
-- the list widens; no row changes.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED',
  -- account security
  'PASSWORD_CHANGED', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGED',
  'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  -- visitors and retention
  'VISITOR_BLOCKED', 'VISITOR_UNBLOCKED', 'VISITOR_DATA_DELETED',
  'RETENTION_PURGE', 'RETENTION_SETTINGS_UPDATED',
  -- assistant
  'ASSISTANT_ENABLED', 'ASSISTANT_KILL_SWITCH',
  -- integrations and plan
  'API_KEY_CREATED', 'API_KEY_REVOKED',
  'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED',
  'SITE_SUSPENDED', 'SITE_REACTIVATED',
  'TRIAL_STARTED', 'TRIAL_ENDED',
  'SAVED_REPLY_CREATED', 'SAVED_REPLY_UPDATED', 'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED'));

-- ===========================================================================
-- 0010_trial.sql
-- ===========================================================================
-- 0010 — free trial of the paid plan (plan v10 PRD-15).
--
-- A new workspace gets Pro for TRIAL_DAYS (14) without a card. Nothing is
-- written when it ends: the plan in force is computed from the clock
-- (services/entitlements.ts#getPlan), exactly like a cancelled subscription
-- that runs out. The two timestamps only remember which mails went out.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_reminder_sent_at timestamptz;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS trial_ended_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_organizations_trial_ends_at
  ON organizations (trial_ends_at) WHERE trial_ends_at IS NOT NULL;

-- ===========================================================================
-- 0011_conversation_features.sql
-- ===========================================================================
-- 0011 — what the inbox needs before launch (plan v10 PRD-01…08, SEC-09,
-- SEC-17, BIL-04).

-- A site's chat behaviour beyond the bubble's look: missed-chat mails, the
-- offline form, e-mailed replies, the pre-chat form and its consent box,
-- satisfaction ratings, transcripts, spam mode. One jsonb, read with the site;
-- the defaults live in services/chatSettings.ts.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS chat_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Set when a plan downgrade leaves more sites than the plan allows (BIL-04):
-- the widget stays silent and the panel shows the site read-only.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS suspended_at timestamptz;

-- Conversations: what the visitor left in the forms, and the mails sent.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_phone text;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS prechat jsonb NOT NULL DEFAULT '{}'::jsonb;
-- When the visitor ticked the site's privacy notice box (PRD-05).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_consent_at timestamptz;
-- When the "unanswered chat" mail went out for it (PRD-01); once only.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS missed_notified_at timestamptz;
-- The visitor asked not to get e-mailed replies for this conversation.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS email_replies_opt_out boolean NOT NULL DEFAULT false;
-- When a satisfaction request was mailed (PRD-04).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS csat_requested_at timestamptz;
-- Hidden from the open inbox until then (PRD-07).
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS snoozed_until timestamptz;
-- Set on the conversation that was merged into another one.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS merged_into_id varchar(24);

CREATE INDEX IF NOT EXISTS idx_conversations_missed_due
  ON conversations (created_at)
  WHERE missed_notified_at IS NULL AND first_response_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_snoozed
  ON conversations (snoozed_until)
  WHERE snoozed_until IS NOT NULL;

-- Unanswered-chat notices waiting to be mailed, one row per person and site:
-- the first goes out at once, the ones within the next ten minutes (or the
-- hour, for an hourly digest) go out together (PRD-01).
CREATE TABLE IF NOT EXISTS missed_chat_notices (
  account_type   text NOT NULL,
  account_id     varchar(24) NOT NULL,
  site_id        varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  pending        jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_sent_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_type, account_id, site_id),
  CONSTRAINT missed_chat_notices_account_type_check CHECK (account_type IN ('user', 'team'))
);

-- Saved replies an agent drops in with "/" (PRD-03). site_id NULL: every site
-- of the organization.
CREATE TABLE IF NOT EXISTS saved_replies (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) REFERENCES sites (id) ON DELETE CASCADE,
  shortcut         text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  created_by       varchar(24),
  usage_count      integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT saved_replies_shortcut_check CHECK (shortcut ~ '^[a-z0-9][a-z0-9_-]{0,31}$')
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_saved_replies_shortcut ON saved_replies (organization_id, shortcut);

-- The organization's list of conversation tags, with a colour (PRD-07).
-- conversations.tags keeps the names.
CREATE TABLE IF NOT EXISTS conversation_tag_catalog (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name             text NOT NULL,
  color            text NOT NULL DEFAULT '#6366F1',
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_conversation_tag_catalog_name
  ON conversation_tag_catalog (organization_id, lower(name));

-- Visitors an agent blocked (SEC-09): by visitor id and by a hash of the IP,
-- for 30 days unless lifted earlier.
CREATE TABLE IF NOT EXISTS visitor_blocks (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  visitor_id       text,
  ip_hash          text,
  reason           text,
  blocked_by       varchar(24),
  expires_at       timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_visitor_blocks_site_visitor ON visitor_blocks (site_id, visitor_id);
CREATE INDEX IF NOT EXISTS idx_visitor_blocks_site_ip ON visitor_blocks (site_id, ip_hash);

-- How long conversations are kept (SEC-17): NULL means the plan's default.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS retention_days integer;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_retention_days_check;
ALTER TABLE organizations ADD CONSTRAINT organizations_retention_days_check
  CHECK (retention_days IS NULL OR retention_days BETWEEN 30 AND 1830);

-- The set-up mails a new owner gets (PRD-08): which went out, and when the
-- widget was first seen on a page.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS activation jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ===========================================================================
-- 0012_notifications.sql
-- ===========================================================================
-- 0012 — notifications (plan v10 PRD-01, PRD-02, PRD-09).

-- Team accounts get the preferences users already have: how they hear about
-- unanswered chats, which events raise a desktop notification, the language
-- their mails go out in.
ALTER TABLE teams ADD COLUMN IF NOT EXISTS preferences jsonb NOT NULL DEFAULT '{}'::jsonb;

-- The last time an agent's reply went to the visitor by e-mail (PRD-01): only
-- replies written after it, while the visitor is away, are mailed next.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS visitor_reply_mailed_at timestamptz;

-- Web Push subscriptions of the panel (PRD-09): one per browser an agent
-- allowed. The endpoint is the push service's address; the keys encrypt.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id            varchar(24) PRIMARY KEY,
  account_type  text NOT NULL,
  account_id    varchar(24) NOT NULL,
  organization_id varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  endpoint      text NOT NULL,
  p256dh        text NOT NULL,
  auth          text NOT NULL,
  user_agent    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_used_at  timestamptz,
  CONSTRAINT push_subscriptions_account_type_check CHECK (account_type IN ('user', 'team'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_push_subscriptions_endpoint ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_account ON push_subscriptions (account_type, account_id);

-- ===========================================================================
-- 0013_assistant_feedback.sql
-- ===========================================================================
-- 0013 — An agent marks an assistant answer as wrong (plan v10 AI-06).
--
-- One row per answer flagged: who, when and an optional note. Read for the
-- assistant's quality report (P2); the conversation going away takes it
-- with it. The answer itself also carries `flagged` in messages.assistant,
-- so the inbox shows it without a join.

CREATE TABLE IF NOT EXISTS assistant_feedback (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  conversation_id  varchar(24) NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  message_id       varchar(24) NOT NULL REFERENCES messages (id) ON DELETE CASCADE,
  user_id          varchar(24),
  verdict          text NOT NULL DEFAULT 'wrong',
  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assistant_feedback_verdict_check CHECK (verdict IN ('wrong')),
  CONSTRAINT assistant_feedback_message_unique UNIQUE (message_id)
);
CREATE INDEX IF NOT EXISTS idx_assistant_feedback_org_created
  ON assistant_feedback (organization_id, created_at DESC);

-- ===========================================================================
-- 0014_assistant_and_retention_indexes.sql
-- ===========================================================================
-- 0014 — Two indexes the new reports and the nightly purge need (plan v10
-- OBS-07, SEC-17, PERF-03).
--
-- The assistant's own messages, by time: the assistant overview, org:stats
-- and the weekly report count them for the last 7-30 days. Without it every
-- one of those reads the whole messages table.
--
-- A conversation's last activity per organization: the nightly retention
-- purge looks up conversations whose last message is older than the
-- workspace's window, organization by organization.
--
-- Plain CREATE INDEX (migrations run in a transaction). At launch the
-- tables are small; on a large table this would be a CONCURRENTLY build by
-- hand first (docs/production-runbook.md).

CREATE INDEX IF NOT EXISTS idx_messages_assistant_created
  ON messages (created_at)
  WHERE sender_id = 'assistant';

CREATE INDEX IF NOT EXISTS idx_conversations_org_last_activity
  ON conversations (organization_id, (coalesce(last_message_at, created_at)));

-- ===========================================================================
-- 0015_plan_overage.sql
-- ===========================================================================
-- 0015 — Over the plan after a downgrade (plan v10 BIL-04, KARAR-BIL-1).
--
-- Nothing is deleted when a workspace moves to a smaller plan. Sites over
-- the new limit are suspended (sites.suspended_at, since 0011): their widget
-- answers like a switched-off site, their conversations stay readable. Team
-- members over the seat limit keep signing in and reading, but cannot write
-- or change anything until the owner picks who keeps a seat or upgrades.

ALTER TABLE users ADD COLUMN IF NOT EXISTS seat_suspended_at timestamptz;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS seat_suspended_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_sites_org_suspended
  ON sites (organization_id) WHERE suspended_at IS NOT NULL;

-- Audit trail: seats taken away and given back. Only the action list widens.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED',
  -- account security
  'PASSWORD_CHANGED', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGED',
  'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  -- visitors and retention
  'VISITOR_BLOCKED', 'VISITOR_UNBLOCKED', 'VISITOR_DATA_DELETED',
  'RETENTION_PURGE', 'RETENTION_SETTINGS_UPDATED',
  -- assistant
  'ASSISTANT_ENABLED', 'ASSISTANT_KILL_SWITCH',
  -- integrations and plan
  'API_KEY_CREATED', 'API_KEY_REVOKED',
  'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED',
  'SITE_SUSPENDED', 'SITE_REACTIVATED',
  'TRIAL_STARTED', 'TRIAL_ENDED',
  'SAVED_REPLY_CREATED', 'SAVED_REPLY_UPDATED', 'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED',
  -- over the plan after a downgrade (0015)
  'SEAT_SUSPENDED', 'SEAT_RESTORED'));

-- ===========================================================================
-- 0016_site_block.sql
-- ===========================================================================
-- 0016 — a site switched off by the platform (plan v10 LEG-05).
--
-- `site:disable` used to set sites.is_active = false, which the owner can
-- turn back on from the panel: a phishing or fraud site was off only until
-- its owner noticed. blocked_at is the platform's own switch — set and
-- cleared only by the support command, never by the panel or by the plan
-- limits (BIL-04). The reason is for the support trail; the owner sees only
-- that the site was blocked and whom to write to.
ALTER TABLE sites ADD COLUMN IF NOT EXISTS blocked_at timestamptz;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS blocked_reason text;

-- ===========================================================================
-- 0017_inbox_search_and_tags.sql
-- ===========================================================================
-- 0017 — the inbox's word search and its tag filter (plan v10 PRD-07).
--
-- Message text is searched by words with Turkish stemming as well as by
-- substring: "siparişim" finds a message that says "siparişimi", which the
-- trigram index alone (idx_messages_content_trgm, 0000) does not. The
-- expression is the one db/inboxQueries.ts writes, so the planner uses it.
--
-- Conversations are filtered by tag (conversations.tags, a text array).
--
-- Plain CREATE INDEX (migrations run in a transaction). At launch the tables
-- are small; on a large table this would be a CONCURRENTLY build by hand
-- first (docs/production-runbook.md).

CREATE INDEX IF NOT EXISTS idx_messages_content_fts
  ON messages USING gin (to_tsvector('turkish'::regconfig, coalesce(content, '')));

CREATE INDEX IF NOT EXISTS idx_conversations_tags
  ON conversations USING gin (tags);

-- ===========================================================================
-- 0018_help_center.sql
-- ===========================================================================
-- 0018 — a public help center per site (plan v10 PRD-10).
--
-- The site's active FAQ entries, published at /help/<help_slug> when the
-- owner turns it on. The address is chosen once and is unique on the
-- platform, upper or lower case alike. help_center holds the switches:
--   { enabled: boolean, noindex: boolean, title: string | null }
ALTER TABLE sites ADD COLUMN IF NOT EXISTS help_slug text;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS help_center jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE sites DROP CONSTRAINT IF EXISTS sites_help_slug_check;
ALTER TABLE sites ADD CONSTRAINT sites_help_slug_check
  CHECK (help_slug IS NULL OR help_slug ~ '^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$');
CREATE UNIQUE INDEX IF NOT EXISTS uq_sites_help_slug ON sites (lower(help_slug))
  WHERE help_slug IS NOT NULL;

-- ===========================================================================
-- 0019_integrations.sql
-- ===========================================================================
-- 0019 — notifications to Slack and Telegram, and outgoing webhooks (plan v10
-- PRD-11).
--
-- An integration belongs to a workspace and, optionally, to one site
-- (site_id NULL: every site). Its address and keys — the Slack URL, the
-- Telegram bot token, the webhook's signing secret — are sealed together in
-- `config` (config/secretBox.ts) and never leave the server in the clear
-- again; the panel sees a masked form.
--
-- Each event becomes a delivery row: tried at once, then again with growing
-- waits for up to 24 hours. The payload, which carries visitor data, is
-- dropped as soon as the delivery succeeds or is given up; the row stays as
-- the delivery log for 30 days (services/dataRetention.ts).

CREATE TABLE IF NOT EXISTS integrations (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) REFERENCES sites (id) ON DELETE CASCADE,
  kind             text NOT NULL,
  name             text NOT NULL,
  events           text[] NOT NULL DEFAULT '{}',
  config           text NOT NULL,
  hint             text,
  is_active        boolean NOT NULL DEFAULT true,
  created_by       varchar(24),
  last_status      text,
  last_delivery_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT integrations_kind_check CHECK (kind IN ('webhook', 'slack', 'telegram'))
);
CREATE INDEX IF NOT EXISTS idx_integrations_org ON integrations (organization_id);

CREATE TABLE IF NOT EXISTS integration_deliveries (
  id               varchar(24) PRIMARY KEY,
  integration_id   varchar(24) NOT NULL REFERENCES integrations (id) ON DELETE CASCADE,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  event            text NOT NULL,
  payload          jsonb,
  status           text NOT NULL DEFAULT 'pending',
  attempts         integer NOT NULL DEFAULT 0,
  next_attempt_at  timestamptz NOT NULL DEFAULT now(),
  last_status_code integer,
  last_error       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz,
  CONSTRAINT integration_deliveries_status_check CHECK (status IN ('pending', 'delivered', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_due
  ON integration_deliveries (next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_log
  ON integration_deliveries (integration_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_deliveries_created
  ON integration_deliveries (created_at);

-- ===========================================================================
-- 0020_api_keys.sql
-- ===========================================================================
-- 0020 — the workspace's keys for the public API (plan v10 PRD-12).
--
-- A key is shown once, when it is made; only its SHA-256 is kept (the key is
-- 40 random characters, so a plain hash is as strong as a slow one would
-- be), with its first characters to recognise it in the panel. A revoked key
-- stays as a row, so the log keeps saying who used what.
CREATE TABLE IF NOT EXISTS api_keys (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name             text NOT NULL,
  prefix           text NOT NULL,
  key_hash         text NOT NULL,
  scopes           text[] NOT NULL DEFAULT '{read}',
  created_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  last_used_at     timestamptz,
  revoked_at       timestamptz,
  CONSTRAINT api_keys_scopes_check CHECK (scopes <@ ARRAY['read', 'write']::text[] AND cardinality(scopes) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_api_keys_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys (organization_id);

-- ===========================================================================
-- 0021_google_sign_in.sql
-- ===========================================================================
-- 0021 — sign-in with Google (plan v10 PRD-14).
--
-- An account is tied to a Google account by Google's own subject id (`sub`),
-- which never changes; the address is kept only to show which Google account
-- is connected. An account is found by its `sub` and never by its address:
-- someone who controls a Google account with the same address does not get
-- into an existing account unless its owner connected it while signed in.
-- A Google account opens one account at most, in either table; the indexes
-- hold that within a table and services/googleSignIn.ts across the two.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_email text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS google_sub text;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS google_email text;
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_google_sub ON users (google_sub)
  WHERE google_sub IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_teams_google_sub ON teams (google_sub)
  WHERE google_sub IS NOT NULL;

-- Audit trail: a Google account connected or disconnected. Only the action
-- list widens.
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED',
  -- account security
  'PASSWORD_CHANGED', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGED',
  'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  -- visitors and retention
  'VISITOR_BLOCKED', 'VISITOR_UNBLOCKED', 'VISITOR_DATA_DELETED',
  'RETENTION_PURGE', 'RETENTION_SETTINGS_UPDATED',
  -- assistant
  'ASSISTANT_ENABLED', 'ASSISTANT_KILL_SWITCH',
  -- integrations and plan
  'API_KEY_CREATED', 'API_KEY_REVOKED',
  'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED',
  'SITE_SUSPENDED', 'SITE_REACTIVATED',
  'TRIAL_STARTED', 'TRIAL_ENDED',
  'SAVED_REPLY_CREATED', 'SAVED_REPLY_UPDATED', 'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED',
  -- over the plan after a downgrade (0015)
  'SEAT_SUSPENDED', 'SEAT_RESTORED',
  -- sign-in with Google (0021)
  'GOOGLE_LINKED', 'GOOGLE_UNLINKED'));

-- ===========================================================================
-- 0022_reports.sql
-- ===========================================================================
-- 0022 — reports (plan v10 PRD-22): the weekly summary mail and report files.
--
-- The weekly mail goes out once per week and workspace; this column says when
-- it last did, so a sweep that runs every hour sends it only once. A report
-- downloaded as a file carries visitors' names and addresses, so each
-- download is audited; only the action list widens.
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS weekly_report_sent_at timestamptz;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (
  'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_FAILED_LOCKED',
  'CREATE_AGENT', 'DELETE_AGENT', 'UPDATE_AGENT_ROLE',
  'PLAN_CHANGED', 'UPDATE_SLA',
  'TICKET_CLOSED', 'TICKET_REOPENED', 'SLA_BREACH',
  'AUTOMATION_RULE_CREATED', 'AUTOMATION_RULE_UPDATED',
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED',
  -- Kept so the history written before 0005 stays valid.
  'SITE_AI_SETTINGS_UPDATED',
  'SITE_INTEGRATION_UPDATED', 'SITE_ASSISTANT_UPDATED',
  'EMAIL_VERIFIED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET',
  'INVITATION_SENT', 'INVITATION_REVOKED', 'INVITATION_ACCEPTED',
  'SITE_CREATED', 'SITE_UPDATED', 'SITE_DELETED',
  'WIDGET_SETTINGS_UPDATED', 'CONVERSATION_ASSIGNED',
  -- account security
  'PASSWORD_CHANGED', 'EMAIL_CHANGE_REQUESTED', 'EMAIL_CHANGED',
  'MFA_ENABLED', 'MFA_DISABLED', 'MFA_RECOVERY_USED', 'SESSIONS_REVOKED',
  'SECURITY_SETTINGS_UPDATED',
  -- visitors and retention
  'VISITOR_BLOCKED', 'VISITOR_UNBLOCKED', 'VISITOR_DATA_DELETED',
  'RETENTION_PURGE', 'RETENTION_SETTINGS_UPDATED',
  -- assistant
  'ASSISTANT_ENABLED', 'ASSISTANT_KILL_SWITCH',
  -- integrations and plan
  'API_KEY_CREATED', 'API_KEY_REVOKED',
  'WEBHOOK_CREATED', 'WEBHOOK_UPDATED', 'WEBHOOK_DELETED',
  'SITE_SUSPENDED', 'SITE_REACTIVATED',
  'TRIAL_STARTED', 'TRIAL_ENDED',
  'SAVED_REPLY_CREATED', 'SAVED_REPLY_UPDATED', 'SAVED_REPLY_DELETED',
  'CONVERSATIONS_MERGED',
  -- over the plan after a downgrade (0015)
  'SEAT_SUSPENDED', 'SEAT_RESTORED',
  -- sign-in with Google (0021)
  'GOOGLE_LINKED', 'GOOGLE_UNLINKED',
  -- a report downloaded as a file (0022)
  'REPORT_EXPORTED'));

-- ===========================================================================
-- 0023_knowledge.sql
-- ===========================================================================
-- 0023 — what the assistant may answer from besides the FAQ (plan v10
-- PRD-21, AI-08): pages of the site itself and PDF documents the business
-- uploads. Only their text is kept, cut into passages the assistant searches
-- with PostgreSQL's full-text search — no vector database (plan §21). A PDF
-- is not stored; its text is.
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id               varchar(24) PRIMARY KEY,
  organization_id  varchar(24) NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  site_id          varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  kind             text NOT NULL,
  -- The page's address; null for a PDF.
  url              text,
  title            text NOT NULL,
  status           text NOT NULL DEFAULT 'pending',
  -- Why the last fetch or read failed, in a word the panel translates.
  error            text,
  chars            integer NOT NULL DEFAULT 0,
  created_by       varchar(24),
  created_at       timestamptz NOT NULL DEFAULT now(),
  refreshed_at     timestamptz,
  CONSTRAINT knowledge_sources_kind_check CHECK (kind IN ('page', 'pdf')),
  CONSTRAINT knowledge_sources_status_check CHECK (status IN ('pending', 'ready', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_site ON knowledge_sources (site_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_sources_org ON knowledge_sources (organization_id);
-- A page is added once per site.
CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_sources_site_url ON knowledge_sources (site_id, url)
  WHERE url IS NOT NULL;

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id          varchar(24) PRIMARY KEY,
  source_id   varchar(24) NOT NULL REFERENCES knowledge_sources (id) ON DELETE CASCADE,
  site_id     varchar(24) NOT NULL REFERENCES sites (id) ON DELETE CASCADE,
  position    integer NOT NULL,
  content     text NOT NULL,
  -- 'simple': the text is mostly Turkish, and the search matches word
  -- prefixes instead of trusting a stemmer (services/helpCenter.ts#prefixQuery).
  search      tsvector GENERATED ALWAYS AS (to_tsvector('simple'::regconfig, content)) STORED
);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search ON knowledge_chunks USING gin (search);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON knowledge_chunks (source_id, position);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_site ON knowledge_chunks (site_id);
