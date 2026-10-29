const express = require("express");
const cors = require("cors");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const db = require("./database.cjs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(cors());
app.use(express.json({ limit: "20kb" }));

const PORT = process.env.PORT || 3001;

function makeToken() {
  return crypto.randomBytes(24).toString("hex");
}

function makeCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function validText(value, max = 300) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= max;
}

function getSession(code) {
  return db.prepare("SELECT * FROM sessions WHERE code = ?").get(code);
}

function requireHost(req, res, next) {
  const session = getSession(req.params.code);
  if (!session) return res.status(404).json({ error: "Session not found" });

  if (!req.headers["x-host-token"] ||
      req.headers["x-host-token"] !== session.host_token) {
    return res.status(403).json({ error: "Host authorization required" });
  }

  req.session = session;
  next();
}

function requireParticipant(req, res, next) {
  const token = req.headers["x-participant-token"];
  if (!token) return res.status(401).json({ error: "Join the session first" });

  const participant = db.prepare(
    "SELECT * FROM participants WHERE session_code = ? AND voter_token = ?"
  ).get(req.params.code, token);

  if (!participant) {
    return res.status(401).json({ error: "Invalid participant token" });
  }

  req.participant = participant;
  next();
}

function sessionData(code) {
  const session = getSession(code);
  if (!session) return null;

  const questions = db.prepare(`
    SELECT id, session_code, display_name, text, votes, answered, hidden, created_at
    FROM questions
    WHERE session_code = ?
    ORDER BY votes DESC, id ASC
  `).all(code);

  const polls = db.prepare(`
    SELECT * FROM polls WHERE session_code = ? ORDER BY id DESC
  `).all(code).map(poll => ({
    ...poll,
    options: db.prepare(
      "SELECT id, text, votes FROM poll_options WHERE poll_id = ?"
    ).all(poll.id)
  }));

  return {
    session: { code: session.code, title: session.title },
    questions,
    polls
  };
}

function broadcast(code) {
  io.to(code).emit("session:update", sessionData(code));
}

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/sessions", (req, res) => {
  if (!validText(req.body.title, 100)) {
    return res.status(400).json({ error: "Session title is required (max 100 characters)" });
  }

  let code;
  do {
    code = makeCode();
  } while (getSession(code));

  const hostToken = makeToken();

  db.prepare(
    "INSERT INTO sessions (code, title, host_token) VALUES (?, ?, ?)"
  ).run(code, req.body.title.trim(), hostToken);

  res.status(201).json({ code, title: req.body.title.trim(), hostToken });
});

app.post("/api/sessions/:code/join", (req, res) => {
  const code = req.params.code.toUpperCase();
  const session = getSession(code);

  if (!session) return res.status(404).json({ error: "Session not found" });

  if (!validText(req.body.displayName, 40)) {
    return res.status(400).json({ error: "Display name is required (max 40 characters)" });
  }

  const voterToken = makeToken();

  db.prepare(
    "INSERT INTO participants (session_code, display_name, voter_token) VALUES (?, ?, ?)"
  ).run(code, req.body.displayName.trim(), voterToken);

  res.status(201).json({
    code,
    displayName: req.body.displayName.trim(),
    participantToken: voterToken
  });
});

app.get("/api/sessions/:code", (req, res) => {
  const data = sessionData(req.params.code.toUpperCase());
  if (!data) return res.status(404).json({ error: "Session not found" });

  data.questions = data.questions.filter(question => !question.hidden);
  res.json(data);
});

app.post("/api/sessions/:code/questions", requireParticipant, (req, res) => {
  if (!validText(req.body.text, 500)) {
    return res.status(400).json({ error: "Question is required (max 500 characters)" });
  }

  const result = db.prepare(`
    INSERT INTO questions (session_code, display_name, text)
    VALUES (?, ?, ?)
  `).run(
    req.params.code.toUpperCase(),
    req.participant.display_name,
    req.body.text.trim()
  );

  broadcast(req.params.code.toUpperCase());
  res.status(201).json({ id: Number(result.lastInsertRowid) });
});

app.post("/api/sessions/:code/questions/:id/vote", requireParticipant, (req, res) => {
  const question = db.prepare(
    "SELECT * FROM questions WHERE id = ? AND session_code = ?"
  ).get(req.params.id, req.params.code.toUpperCase());

  if (!question || question.hidden) {
    return res.status(404).json({ error: "Question not found" });
  }

  try {
    db.prepare(
      "INSERT INTO question_votes (question_id, voter_token) VALUES (?, ?)"
    ).run(question.id, req.participant.voter_token);

    db.prepare("UPDATE questions SET votes = votes + 1 WHERE id = ?").run(question.id);
  } catch {
    return res.status(409).json({ error: "You have already voted for this question" });
  }

  broadcast(req.params.code.toUpperCase());
  res.json({ success: true });
});

app.patch("/api/sessions/:code/questions/:id", requireHost, (req, res) => {
  const question = db.prepare(
    "SELECT * FROM questions WHERE id = ? AND session_code = ?"
  ).get(req.params.id, req.params.code.toUpperCase());

  if (!question) return res.status(404).json({ error: "Question not found" });

  const answered = req.body.answered;
  const hidden = req.body.hidden;

  if (answered !== undefined && typeof answered !== "boolean") {
    return res.status(400).json({ error: "answered must be true or false" });
  }
  if (hidden !== undefined && typeof hidden !== "boolean") {
    return res.status(400).json({ error: "hidden must be true or false" });
  }

  if (answered !== undefined) {
    db.prepare("UPDATE questions SET answered = ? WHERE id = ?")
      .run(answered ? 1 : 0, question.id);
  }
  if (hidden !== undefined) {
    db.prepare("UPDATE questions SET hidden = ? WHERE id = ?")
      .run(hidden ? 1 : 0, question.id);
  }

  broadcast(req.params.code.toUpperCase());
  res.json({ success: true });
});

app.post("/api/sessions/:code/polls", requireHost, (req, res) => {
  const question = req.body.question;
  const options = req.body.options;

  if (!validText(question, 300)) {
    return res.status(400).json({ error: "Poll question is required (max 300 characters)" });
  }
  if (!Array.isArray(options) || options.length < 2 || options.length > 6 ||
      options.some(option => !validText(option, 100)) ||
      new Set(options.map(option => option.trim().toLowerCase())).size !== options.length) {
    return res.status(400).json({ error: "Provide 2–6 distinct, non-empty options (max 100 characters each)" });
  }

  const createPoll = db.transaction(() => {
    const result = db.prepare(
      "INSERT INTO polls (session_code, question, active) VALUES (?, ?, 1)"
    ).run(req.params.code.toUpperCase(), question.trim());

    const pollId = Number(result.lastInsertRowid);
    const insertOption = db.prepare(
      "INSERT INTO poll_options (poll_id, text) VALUES (?, ?)"
    );

    for (const option of options) insertOption.run(pollId, option.trim());
    return pollId;
  });

  const pollId = createPoll();
  broadcast(req.params.code.toUpperCase());
  res.status(201).json({ id: pollId });
});

app.post("/api/sessions/:code/polls/:id/vote", requireParticipant, (req, res) => {
  const poll = db.prepare(
    "SELECT * FROM polls WHERE id = ? AND session_code = ? AND active = 1"
  ).get(req.params.id, req.params.code.toUpperCase());

  if (!poll) return res.status(404).json({ error: "Active poll not found" });

  const option = db.prepare(
    "SELECT * FROM poll_options WHERE id = ? AND poll_id = ?"
  ).get(req.body.optionId, poll.id);

  if (!option) return res.status(400).json({ error: "Choose a valid poll option" });

  try {
    db.prepare(
      "INSERT INTO poll_votes (poll_id, voter_token, option_id) VALUES (?, ?, ?)"
    ).run(poll.id, req.participant.voter_token, option.id);

    db.prepare("UPDATE poll_options SET votes = votes + 1 WHERE id = ?").run(option.id);
  } catch {
    return res.status(409).json({ error: "You have already voted in this poll" });
  }

  broadcast(req.params.code.toUpperCase());
  res.json({ success: true });
});

app.get("/api/sessions/:code/presenter", requireHost, (req, res) => {
  const data = sessionData(req.params.code.toUpperCase());
  data.questions = data.questions.filter(question => !question.hidden);
  data.questions.sort((a, b) => b.votes - a.votes);
  data.topQuestion = data.questions[0] || null;
  data.activePoll = data.polls.find(poll => poll.active === 1) || null;
  res.json(data);
});

io.on("connection", socket => {
  socket.on("session:join", code => {
    if (typeof code !== "string" || !getSession(code.toUpperCase())) return;
    socket.join(code.toUpperCase());
    socket.emit("session:update", sessionData(code.toUpperCase()));
  });
});
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`LiveConnect API running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, db };