# Resolve

A personal productivity app: plan your day, track habits, and stay on top of
what matters. Sign in with Google and your data follows you across devices.

> **New to the code?** Read [ARCHITECTURE.md](ARCHITECTURE.md) — it walks through
> how the whole thing fits together, file by file.

## Features

- **Tasks** — add, complete, reorder (drag & drop), edit inline, and nest
  subtasks. Drag a task onto a calendar day to move it there.
- **Habits** — recurring daily / weekly / custom-day habits. Check them off per
  day; delete just one day or from a day onward.
- **Areas** — color-coded labels for tasks and habits, with filtering.
- **Calendar** — each day is tinted red→green by how much you completed.
- **Day & week views**, a live clock, and a persisted dark / light theme.

## Stack

**Frontend** — [Vue 3](https://vuejs.org/) (`<script setup>`),
[Vite](https://vitejs.dev/), [Tailwind CSS v4](https://tailwindcss.com/).
**Backend** — [Express 5](https://expressjs.com/),
[SQLite](https://www.sqlite.org/) via
[better-sqlite3](https://github.com/WiseLibs/better-sqlite3), Google sign-in via
[Passport](https://www.passportjs.org/), sessions signed as JWTs.
**Tooling** — pnpm.

## Project layout

```
resolve/
├─ index.html            # the single HTML page Vite serves
├─ src/                  # the frontend (Vue app)
│  ├─ main.js            # entry point — boots Vue into index.html
│  ├─ App.vue            # root component & page layout
│  ├─ components/        # UI pieces (Calendar, TodoList, TaskSection, …)
│  ├─ store.js           # all app data (tasks, habits, areas) + actions
│  ├─ auth.js            # who is signed in (JWT handling)
│  ├─ api.js             # HTTP calls to the backend
│  ├─ composables.js     # small reusable logic (clock, theme)
│  ├─ utils.js           # shared helpers (dateKey formatting, etc.)
│  └─ style.css          # theme colors, animations
└─ server/               # the backend (Express + SQLite)
   ├─ index.js           # server setup, Google OAuth, /api/sync
   ├─ routes.js          # the task / habit / area API endpoints
   └─ db.js              # SQLite connection + schema
```

## Getting started

You need [Node.js](https://nodejs.org/) and [pnpm](https://pnpm.io/).

```bash
# 1. Install dependencies
pnpm install

# 2. Create your .env from the template, then fill it in
cp .env.example .env

# 3. Run the frontend (port 5173) and backend (port 3000) together
pnpm run dev:all
```

Open http://localhost:5173.

**Google sign-in setup:** signing in needs Google OAuth credentials. Follow the
instructions at the top of [.env.example](.env.example) to create them, then set
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and a random `SESSION_SECRET` in your
`.env`. (In dev, Vite proxies `/api` and `/auth` requests to the backend, so you
only ever visit the `:5173` URL.)

## npm scripts

| Script              | What it does                                                  |
| ------------------- | ------------------------------------------------------------- |
| `pnpm run dev:all`  | Run frontend + backend together (the usual dev command).      |
| `pnpm run dev`      | Frontend only (Vite dev server on :5173).                     |
| `pnpm run dev:server` | Backend only (Express on :3000).                            |
| `pnpm run build`    | Build the frontend into `dist/`.                              |
| `pnpm start`        | Run the backend; it also serves `dist/` if it exists.         |
| `pnpm run preview`  | Preview the production frontend build locally.                |

## Deployment

Deployed on [Railway](https://railway.app/) (see `railway.json` / `Procfile`).
The build runs `pnpm install && pnpm run build`, then `node server/index.js`
starts the server — which serves the built frontend from `dist/` **and** the API
from the same origin. Point `DB_PATH` at a persistent volume so the database
survives restarts, and set the same environment variables as in `.env.example`.
