import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./App.css";

const API = "http://localhost:3001";

export default function App() {
  const [session, setSession] = useState(null);
  const [joinCode, setJoinCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [sessionTitle, setSessionTitle] = useState("LiveConnect Event");
  const [role, setRole] = useState("host");
  const [hostToken, setHostToken] = useState("");
  const [participantToken, setParticipantToken] = useState("");
  const [questions, setQuestions] = useState([]);
  const [question, setQuestion] = useState("");
  const [polls, setPolls] = useState([]);
  const [pollQuestion, setPollQuestion] = useState("");
  const [options, setOptions] = useState("Yes,No");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session) return;

    const socket = io(API);

    socket.on("connect", () => {
      socket.emit("session:join", session);
    });

    socket.on("session:update", (data) => {
      if (data?.session?.code === session) {
        setQuestions(data.questions || []);
        setPolls(data.polls || []);
      }
    });

    return () => socket.disconnect();
  }, [session]);

  async function apiRequest(path, options = {}) {
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    return data;
  }

  async function createSession(e) {
    e?.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ title: sessionTitle }),
      });

      setSession(data.code);
      setHostToken(data.hostToken);
      setParticipantToken("");
      setRole("host");
      setQuestions([]);
      setPolls([]);
    } catch (err) {
      setError(err.message);
    }
  }

  async function joinSession(e) {
    e?.preventDefault();
    setError("");
    setMessage("");

    if (!joinCode.trim() || !displayName.trim()) {
      setError("Enter a session code and your display name.");
      return;
    }

    try {
      const code = joinCode.trim().toUpperCase();

      const data = await apiRequest(`/api/sessions/${code}/join`, {
        method: "POST",
        body: JSON.stringify({ displayName }),
      });

      const sessionData = await apiRequest(`/api/sessions/${code}`);

      setSession(code);
      setParticipantToken(data.participantToken);
      setHostToken("");
      setRole("audience");
      setQuestions(sessionData.questions || []);
      setPolls(sessionData.polls || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function addQuestion(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!question.trim()) return;

    try {
      await apiRequest(`/api/sessions/${session}/questions`, {
        method: "POST",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify({ text: question }),
      });

      setQuestion("");
      setMessage("Question submitted!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function upvote(id) {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/sessions/${session}/questions/${id}/vote`, {
        method: "POST",
        headers: { "x-participant-token": participantToken },
      });

      setMessage("Your upvote has been recorded.");
    } catch (err) {
      setError(err.message);
    }
  }

  async function updateQuestion(id, changes) {
    setError("");

    try {
      await apiRequest(`/api/sessions/${session}/questions/${id}`, {
        method: "PATCH",
        headers: { "x-host-token": hostToken },
        body: JSON.stringify(changes),
      });
    } catch (err) {
      setError(err.message);
    }
  }

  async function createPoll(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    const pollOptions = options.split(",").map((item) => item.trim());

    try {
      await apiRequest(`/api/sessions/${session}/polls`, {
        method: "POST",
        headers: { "x-host-token": hostToken },
        body: JSON.stringify({
          question: pollQuestion,
          options: pollOptions,
        }),
      });

      setPollQuestion("");
      setMessage("Poll created!");
    } catch (err) {
      setError(err.message);
    }
  }

  async function vote(pollId, optionId) {
    setError("");
    setMessage("");

    try {
      await apiRequest(`/api/sessions/${session}/polls/${pollId}/vote`, {
        method: "POST",
        headers: { "x-participant-token": participantToken },
        body: JSON.stringify({ optionId }),
      });

      setMessage("Your vote has been recorded.");
    } catch (err) {
      setError(err.message);
    }
  }

  function leaveSession() {
    setSession(null);
    setHostToken("");
    setParticipantToken("");
    setQuestions([]);
    setPolls([]);
    setError("");
    setMessage("");
  }

  return (
    <main className="app">
      <header className="topbar">
        <h1>Live<span>Connect</span></h1>
        <p>Live Q&amp;A · Audience Polls</p>
      </header>

      {error && <div className="card" role="alert">{error}</div>}
      {message && <div className="card" role="status">{message}</div>}

      {!session ? (
        <section className="welcome card">
          <p className="eyebrow">INTERACTIVE EVENTS</p>
          <h2>Make every voice count.</h2>
          <p className="muted">
            Host a live session or join an event to ask questions and vote.
          </p>

          <div className="action-grid">
            <form onSubmit={createSession}>
              <input
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                placeholder="Session title"
                maxLength={100}
                required
              />
              <button type="submit">Create a session</button>
            </form>

            <form className="join-box" onSubmit={joinSession}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
                placeholder="Enter session code"
                maxLength={6}
                required
              />
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your display name"
                maxLength={40}
                required
              />
              <button className="secondary" type="submit">Join session</button>
            </form>
          </div>
        </section>
      ) : (
        <>
          <section className="session-banner card">
            <div>
              <p className="eyebrow">
                {role === "host" ? "HOST DASHBOARD" : "AUDIENCE VIEW"}
              </p>
              <h2>Welcome to the session</h2>
              <p className="muted">
                {role === "host"
                  ? "Share this code with your audience."
                  : "You are viewing the session."}
              </p>
            </div>
            <div className="code">
              <small>SESSION CODE</small>
              <strong>{session}</strong>
            </div>
            <button className="secondary" onClick={leaveSession}>Leave</button>
          </section>

          <div className="content-grid">
            <section className="card">
              <h2>💬 Audience Questions</h2>

              {role === "audience" && (
                <form onSubmit={addQuestion}>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a question..."
                    maxLength={500}
                    required
                  />
                  <button type="submit">Submit question</button>
                </form>
              )}

              <div className="question-list">
                {questions.filter((item) => role === "host" || !item.hidden).length === 0 ? (
                  <p className="muted">No questions yet. Start the discussion!</p>
                ) : (
                  [...questions]
                    .filter((item) => role === "host" || !item.hidden)
                    .sort((a, b) => b.votes - a.votes)
                    .map((item) => (
                      <article className="question-item" key={item.id}>
                        <p>{item.text}</p>
                        <small>Asked by {item.display_name}</small>
                        <div className="question-actions">
                          {role === "audience" && (
                            <button
                              className="vote-button"
                              onClick={() => upvote(item.id)}
                            >
                              ▲ {item.votes} Upvotes
                            </button>
                          )}

                          {role === "host" && (
                            <>
                              <span>▲ {item.votes} Upvotes</span>
                              <button
                                className="secondary"
                                onClick={() => updateQuestion(item.id, {
                                  answered: !item.answered,
                                })}
                              >
                                {item.answered ? "Mark unanswered" : "Mark answered"}
                              </button>
                              <button
                                className="secondary"
                                onClick={() => updateQuestion(item.id, {
                                  hidden: !item.hidden,
                                })}
                              >
                                {item.hidden ? "Unhide" : "Hide"}
                              </button>
                            </>
                          )}
                        </div>
                        {item.answered === 1 && <p className="muted">✓ Answered</p>}
                      </article>
                    ))
                )}
              </div>
            </section>

            <section className="card">
              <h2>📊 Live Poll</h2>

              {role === "host" && (
                <form onSubmit={createPoll} className="poll-form">
                  <input
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    placeholder="Poll question"
                    maxLength={300}
                    required
                  />
                  <input
                    value={options}
                    onChange={(e) => setOptions(e.target.value)}
                    placeholder="Option 1, Option 2"
                    required
                  />
                  <button type="submit">Create poll</button>
                </form>
              )}

              {polls.length === 0 ? (
                <p className="muted">No active poll yet.</p>
              ) : (
                polls.map((item) => (
                  <div className="poll-content" key={item.id}>
                    <h3>{item.question}</h3>
                    {item.options.map((option) => (
                      <button
                        key={option.id}
                        className="poll-option"
                        onClick={() => role === "audience" && vote(item.id, option.id)}
                        disabled={role === "host"}
                      >
                        <span>{option.text}</span>
                        <strong>{option.votes} votes</strong>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </section>
          </div>
        </>
      )}

      <footer>LiveConnect · Built for interactive events</footer>
    </main>
  );
}