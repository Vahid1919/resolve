# How Resolve works

A guided tour for someone reading this code for the first time. It assumes a
little JavaScript but explains the Vue, Express, and database parts as it goes.

---

## 1. The big picture

Resolve has two halves that talk to each other over HTTP:

```
   ┌─────────────────────────┐         HTTP          ┌──────────────────────────┐
   │   FRONTEND (the app)     │  ── /api/... ───────▶ │   BACKEND (the server)    │
   │   Vue 3, runs in the     │                       │   Express, runs in Node   │
   │   browser                │ ◀──── JSON ────────── │   + SQLite database file  │
   └─────────────────────────┘                       └──────────────────────────┘
        src/                                               server/
```

- The **frontend** (`src/`) is what the user sees and clicks. It keeps a copy of
  all the data in memory and renders it.
- The **backend** (`server/`) stores the real data in a SQLite file and decides
  who's allowed to read/write it.
- They communicate in **JSON** over HTTP. The frontend never touches the
  database directly; it asks the server.

In development you run both at once (`pnpm run dev:all`): the frontend on port
5173 and the backend on 3000. In production a single server does both — it
serves the built frontend files *and* answers the API.

---

## 2. The data-flow story (follow one click)

Say the user checks off a task. Here's the whole journey:

```
 1. User clicks the ✓ button            TaskSection.vue
 2. Calls archiveTask(dateKey, id)       store.js
 3. Store moves the task from the
    "active" list to the "completed"
    list IN MEMORY  → screen updates     store.js  (reactive state)
 4. Store calls api.completeTask(id)      api.js
 5. api.js sends POST /api/tasks/:id/
    complete with the auth token          ── HTTP ──▶
 6. requireAuth checks the token          server/index.js
 7. The route runs an UPDATE query        server/routes.js
 8. SQLite saves done = 1                 server/db.js
```

The key idea is in **step 3 vs step 4**: the screen updates *immediately* (step
3), and the server is told *afterwards* (step 4). This is called an **optimistic
update** — see §4.

---

## 3. Starting up & loading data

When the page loads, `src/main.js` boots the Vue app into `index.html`, and
`App.vue` runs its startup logic:

```
 App.vue onMounted()
   → loadUser()        (auth.js)   work out who is signed in, from the saved token
   → syncAll()         (store.js)  if signed in, GET /api/sync once
       └─ the server returns EVERYTHING for this user in one JSON response,
          already shaped to match the store's state, which copies it straight in.
```

So after one request, the frontend has all the user's areas, tasks (active +
completed), habit definitions, completions, and exceptions in memory. From then
on it only sends small updates as the user makes changes.

---

## 4. Key concepts

### Reactive state (Vue)

The store (`src/store.js`) holds data in Vue `reactive(...)` objects. "Reactive"
means: when the data changes, any component displaying it re-renders
automatically — you never manually update the DOM. The store always *mutates*
these objects in place (`push`, `splice`, `Object.assign`) and never reassigns
them, because reassigning would break that automatic link.

Components get the store's data and actions by calling `useStore()`:

```js
const { getTasks, addTask, areaColor } = useStore()
```

### Optimistic updates

Almost every action follows the same pattern (see `addTask` in `store.js` for
the canonical example):

1. Update the in-memory state right away — using a **temporary id** for new
   items — so the UI responds instantly.
2. Send the change to the server in the background.
3. When the server replies, swap the temporary id for the real database id.
4. If the request fails, undo step 1.

This is why the app feels instant even though there's a network round-trip.

### The `dateKey` convention

A day is identified everywhere by a string like `"2026-05-29"` (`YYYY-MM-DD`),
called a **dateKey**. It's used as the key in objects like
`tasksByDate["2026-05-29"]`. Strings are used (instead of `Date` objects)
because they're unambiguous, sort correctly, and make perfect object keys. The
conversions live in `src/utils.js` (`toDateKey`, `parseDateKey`, `prevDateKey`).

### Areas

An "area" is just a color-coded label (e.g. "Work", "Health"). Tasks and habits
store an `areaId`. Deleting an area clears that id off everything that used it.

### Habits are rules, not rows-per-day

A habit is stored once as a **definition** with a recurrence rule (daily /
weekly / specific weekdays) and a start date. The app computes which days it
applies to on the fly (`isApplicable` in `store.js`). Two side maps record
per-day exceptions: `habitCompletions` (checked off) and `habitExceptions`
(skipped just that day).

---

## 5. Authentication (how login works)

Resolve uses **Google sign-in**, and then a **JWT** (a signed token) for every
request after that.

```
 1. Click "Sign in with Google"   AuthScreen.vue → signInWithGoogle() (auth.js)
 2. Browser goes to /auth/google  server redirects to Google
 3. User approves at Google       Google redirects back to /auth/google/callback
 4. Server creates/updates the
    user, signs a JWT, and
    redirects to the frontend
    with  ?token=<jwt>             server/index.js
 5. Frontend reads the token from
    the URL, saves it in
    localStorage                  auth.js (loadUser)
 6. Every API call sends it as
    "Authorization: Bearer <jwt>" api.js
 7. requireAuth verifies it on
    the server                    server/index.js
```

Why a token in the URL instead of a session cookie? Cross-domain cookies are
unreliable in some browsers; a JWT in `localStorage` works everywhere. The token
is signed with `SESSION_SECRET`, so the server can trust it without storing
anything. If a token is missing/expired, the server replies `401`, and `api.js`
automatically logs the user out.

---

## 6. File-by-file map

### Frontend (`src/`)

| File | Responsibility |
| --- | --- |
| `main.js` | Entry point — mounts the Vue app into `index.html`. |
| `App.vue` | Root component: login gate, header, and the Calendar + TodoList layout. Runs startup (`loadUser` → `syncAll`). |
| `components/AuthScreen.vue` | The login screen (one Google button). |
| `components/Calendar.vue` | Month grid; pick a day, drag tasks onto days, completion-colored cells. |
| `components/TodoList.vue` | The selected day's panel: day/week views, area filter, toast, right-click area menu. |
| `components/TaskSection.vue` | The Tasks block: add form, inline edit, drag-reorder, subtasks. |
| `components/HabitSection.vue` | The Habits block: add form (cadence), check off, delete options. |
| `components/SettingsPanel.vue` | Theme toggle and area management. |
| `store.js` | **All app data + actions** for tasks, habits, areas; plus `syncAll`, the calendar color, and `useStore()`. |
| `auth.js` | Frontend auth: read/decode the JWT, expose the current `user`. |
| `api.js` | One function per backend endpoint; attaches the auth token. |
| `composables.js` | `useClock()` (live time) and `useTheme()` (dark/light). |
| `utils.js` | Shared helpers: dateKey conversions and a random `sample`. |
| `style.css` | CSS-variable theme (dark/light), animations, transitions. |

### Backend (`server/`)

| File | Responsibility |
| --- | --- |
| `index.js` | Server setup, CORS/session, Google OAuth, `requireAuth`, `/api/me`, `/api/sync`, serving the built frontend. |
| `routes.js` | Every data endpoint, grouped: tasks, habits, areas. |
| `db.js` | Opens the SQLite file and creates the tables (`initDb`). |

---

## 7. The database

One SQLite file (`server/resolve.db`). Every table except `users` has a
`user_id` column tying its rows to a user, and queries always filter on it so
users can't see each other's data.

| Table | Holds |
| --- | --- |
| `users` | One row per signed-in Google account. |
| `areas` | Color-coded labels. |
| `tasks` | Tasks; `done` flags completed ones, `date_key` is the day, `sort_order` the position, `parent_id` makes subtasks. |
| `habit_defs` | Habit definitions (the recurrence rules). |
| `habit_completions` | Which habit was checked off on which day. |
| `habit_exceptions` | Which habit was skipped on which day. |

---

## 8. Want to trace a feature?

Pick the button in a `components/*.vue` file → find the store function it calls
in `store.js` → see which `api.*` call it makes in `api.js` → find that endpoint
in `server/routes.js` → see the SQL it runs against the tables in `server/db.js`.
That chain is the whole app.
