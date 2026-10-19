-- Playground comments, readable and writable only with Alan's invite link.
-- One current link per project; resetting it locks out the old one.

CREATE TABLE playground_invites (
  slug        TEXT PRIMARY KEY,         -- the project's file name
  token       TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL
);

CREATE TABLE playground_comments (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL,
  name        TEXT NOT NULL,
  body        TEXT NOT NULL,
  created_at  TEXT NOT NULL
);
CREATE INDEX playground_comments_by_slug ON playground_comments (slug, created_at);
