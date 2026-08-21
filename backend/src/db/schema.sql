-- SupportChat relational schema (PostgreSQL).
--
-- Migrated from the previous MongoDB collections. Every statement is written to
-- be safe to run repeatedly: re-running this file never destroys or duplicates
-- data.
--
-- Identifier convention: primary keys keep the 24-character hexadecimal shape of
-- the old ObjectIds so existing references, tokens and client-side caches stay
-- valid.

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
    'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED'))
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
  'AUTOMATION_RULE_DELETED', 'AUTOMATION_EXECUTED'));
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
