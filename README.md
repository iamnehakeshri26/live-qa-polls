# LiveConnect — Live Q&A and Polls

LiveConnect is a full-stack web application that enables event hosts to interact with their audience through live questions, upvoting, and single-choice polls.

## Features

- **Create Sessions:** Hosts can create an event and share a unique session code.
- **Join Sessions:** Audience members can join using the session code and their display name.
- **Live Q&A:** Audience members can submit questions.
- **Question Upvoting:** Participants can upvote questions to help prioritize the discussion.
- **Question Moderation:** Hosts can mark questions as answered or hide them.
- **Live Polls:** Hosts can create polls with multiple options, and participants can vote.
- **Real-Time Updates:** Socket.IO supports session updates.
- **Data Persistence:** SQLite stores session, participant, question, vote, and poll data.
- **Automated Tests:** Vitest and Supertest test the backend API.

## Technology Stack

- Frontend: React, Vite, CSS
- Backend: Node.js, Express
- Database: SQLite using better-sqlite3
- Real-time communication: Socket.IO
- Testing: Vitest and Supertest

## Prerequisites

- Node.js and npm

## Installation

Clone or download the project and open its directory in a terminal.

Install dependencies:

```bash
npm install
```

## Running the Application

Start the backend server in one terminal:

```bash
npm run server
```

The API runs at:

`http://localhost:3001`

Start the frontend in another terminal:

```bash
npm run dev
```

Open the local URL printed by Vite in your browser.

## Running Tests

Run the automated test suite:

```bash
npm test
```

Build the frontend for production:

```bash
npm run build
```

## Data Model

The SQLite database contains the following tables:

- **sessions:** Session code, title, and host authentication information.
- **participants:** Audience members associated with sessions.
- **questions:** Questions submitted by audience members.
- **question_votes:** Records question upvotes.
- **polls:** Poll questions associated with sessions.
- **poll_options:** Available choices for each poll.
- **poll_votes:** Records audience poll votes.

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API status |
| POST | `/api/sessions` | Create a session |
| POST | `/api/sessions/:code/join` | Join a session |
| GET | `/api/sessions/:code` | Retrieve session data |
| POST | `/api/sessions/:code/questions` | Submit a question |
| POST | `/api/sessions/:code/questions/:id/vote` | Upvote a question |
| PATCH | `/api/sessions/:code/questions/:id` | Moderate a question |
| POST | `/api/sessions/:code/polls` | Create a poll |
| POST | `/api/sessions/:code/polls/:id/vote` | Vote in a poll |
| GET | `/api/sessions/:code/presenter` | Retrieve presenter data |

## AI Assistance

AI assistance was used to help with implementation, debugging, API integration, testing, and documentation. The application was also manually tested in the browser.