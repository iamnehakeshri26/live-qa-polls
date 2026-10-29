const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "live-qa-polls.db"));

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    host_token TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    voter_token TEXT NOT NULL,
    UNIQUE(session_code, voter_token)
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT NOT NULL,
    display_name TEXT NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0,
    answered INTEGER DEFAULT 0,
    hidden INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS question_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_id INTEGER NOT NULL,
    voter_token TEXT NOT NULL,
    UNIQUE(question_id, voter_token)
  );

  CREATE TABLE IF NOT EXISTS polls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_code TEXT NOT NULL,
    question TEXT NOT NULL,
    active INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    votes INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id INTEGER NOT NULL,
    voter_token TEXT NOT NULL,
    option_id INTEGER NOT NULL,
    UNIQUE(poll_id, voter_token)
  );
`);

module.exports = db;