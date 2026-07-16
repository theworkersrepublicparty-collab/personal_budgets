# Learning notes — how this app actually works

A plain-language companion to the code. The goal here isn't syntax (semicolons,
brackets) — it's the **concepts** underneath, explained against files you can
open in this repo. Read a section, then go open the file it points at and see
the idea in the wild. That back-and-forth is how reading code starts to click.

> How to use this: skim the "Big picture" first. After that the sections stand
> alone — jump to whatever confused you today. Every section ends with a
> **See it in the code** pointer. Nothing here expects prior knowledge.

---

## 1. The big picture: two programs talking to each other

Your app is not one program. It's **two**, running at the same time, talking
over the network (even though it's all on your one computer):

1. **The frontend** ("web", "client") — the part you see. Buttons, tables, the
   calendar. It runs *inside your web browser*. Built with **React**. Lives in
   `src/`.
2. **The backend** ("api", "server") — the part you don't see. It owns your
   data and answers questions like "give me the workouts" or "save this."
   Built with **Express**. Lives in `server/`.

Think of a restaurant:
- The **frontend** is the dining room + waiter — what the customer interacts with.
- The **backend** is the kitchen — where the food (data) actually lives and gets prepared.
- They talk through **tickets** (network requests). The waiter never cooks; the
  kitchen never talks to the customer directly.

Why split them at all? Because one day you want this on an iPhone. The dining
room (React UI) can be wrapped into a phone app, and the "kitchen" gets swapped
for an on-device one — but only if they were separate to begin with. That
separation is the whole reason the app is built this way.

**See it in the code:** `src/App.tsx` (the dining room's layout — the top nav
and which "page" shows) vs `server/index.ts` (the kitchen — every request it
knows how to answer).

---

## 2. Ports and processes (a.k.a. "address already in use :::3001")

A **process** is just "a running program." When you start the backend, that's a
process. Start it twice and you have two processes.

A **port** is a numbered door on your computer that a process listens at, so
network traffic knows where to go. Your machine has thousands of them. This app
uses two:

- **5173** — the frontend (the web page you open in the browser).
- **3001** — the backend API (the kitchen's order window).

Rule: **only one process can listen on a given port at a time.** It's like a
phone number — one line, one owner. If a program is already sitting on 3001 and
a second one tries to grab it, the second one crashes with:

```
Error: listen EADDRINUSE: address already in use :::3001
```

`EADDRINUSE` = "Error: ADDRess IN USE." That's exactly what bit us: I'd started
a test copy of the backend earlier, it was still holding 3001, and when I
started the app normally the *second* backend couldn't get the door.

The fix is always the same idea: find the process squatting on the port and stop
it, then start fresh. (On Windows that's a `Get-NetTCPConnection ... Stop-Process`
dance; the concept is "who's on this port? — kick them off.")

**Takeaway:** "port already in use" is never a code bug. It means a leftover
copy of the program is still running. Close it (or restart the terminal) and go
again.

---

## 3. What `npm run dev` actually does

`npm` is the tool that installs libraries and runs project commands. The
commands are defined in `package.json` under `"scripts"`. Open it and look:

```json
"dev": "concurrently -n api,web ... \"npm:dev:server\" \"npm:dev:web\""
```

- `dev:server` starts the **backend** (Express, on 3001).
- `dev:web` starts the **frontend** (Vite, on 5173).
- `concurrently` just runs *both at once* in one terminal and labels their
  output `[api]` and `[web]` so you can tell who said what.

So "start the app" = "start both halves." If you only started one, half the app
would be dead (e.g. the page loads but nothing saves, because the kitchen is
closed).

**Vite** (the `dev:web` tool) is worth a name-drop: it's the thing that turns
your React code into something the browser understands, *and* it auto-refreshes
the page the instant you save a file. That live-refresh is why frontend work
feels fast.

**See it in the code:** `package.json` → `"scripts"`. `vite.config.ts` is where
5173 and the `/api` proxy (next section) are configured.

---

## 4. How a click becomes saved data (the whole round trip)

This is the most important mental model in the app. Follow one action —
**editing your goal weight** — from click to disk:

1. **You type** a new goal in the Edit Goal box and hit Save. That's React
   (frontend) reacting to your click. → `src/pages/Workouts.tsx`, the `GoalModal`.
2. The frontend updates its **in-memory copy** of the data (fast, instant — this
   is why the screen updates immediately) and then sends a **request** to the
   backend: "here's the new workout document, please store it."
   → `api.saveWorkout(doc)` in `src/lib/api.ts`.
3. That request travels to the backend at `PUT /api/workout`.
   → `server/index.ts`, the `app.put('/api/workout', ...)` handler.
4. The backend writes it into the database file on disk.
   → one row in `budget.db`.
5. The backend replies "ok." Done. Your change is now permanent — it survives
   closing the app, restarting the computer, everything.

The `/api` prefix is the signal. Anything starting with `/api` is a message
*to the kitchen*; everything else is the dining room. During development, Vite
is told "forward any `/api/...` call over to port 3001" — that's the **proxy**
in `vite.config.ts`. It's how the frontend on 5173 reaches the backend on 3001
without you thinking about port numbers.

**Why this matters for you:** when something "doesn't save," you now have a map.
Did the frontend send the request? Did the backend receive it? Did it hit the
database? Each arrow above is a place to look.

---

## 5. REST and the HTTP "verbs" (GET / POST / PUT / PATCH / DELETE)

The frontend and backend talk in **HTTP requests**. Every request has a **verb**
that says what *kind* of thing you're doing. There are only a handful, and they
map to plain English:

| Verb | Means | Example in this app |
|------|-------|---------------------|
| **GET** | "give me" (read, changes nothing) | `GET /api/workout` — fetch your workouts |
| **POST** | "create a new one" | `POST /api/recipes` — add a recipe |
| **PUT** | "replace this whole thing" | `PUT /api/workout` — save the whole workout document |
| **PATCH** | "change part of this" | `PATCH /api/recipes/5` — edit one recipe |
| **DELETE** | "remove it" | `DELETE /api/recipes/5` |

This style — "nouns as web addresses (`/api/workout`), verbs to act on them" —
is called **REST**. It's just a convention, but once you see it, every backend
looks familiar. When you read `server/index.ts`, you're mostly reading a list of
`app.get(...)`, `app.post(...)`, etc. — one per thing the kitchen can do.

Our workout tab is deliberately simple: just **GET** (load everything) and
**PUT** (save everything). Two doors. We'll see why next.

**See it in the code:** `src/lib/api.ts` is the frontend's list of "things I can
ask the kitchen for." `server/index.ts` is the kitchen's list of "requests I
know how to answer." They're two sides of the same menu.

---

## 6. Where your data lives: SQLite and `budget.db`

All your real data — budgets, transactions, properties, recipes, and now
workouts — lives in a **single file** at the project root: **`budget.db`**.

That file is a **SQLite database**. A database is just an organized way to store
data so you can save, search, and update it reliably. SQLite's superpower is
that the *entire database is one ordinary file*. No separate "database server"
to install or run. Copy `budget.db` to a USB stick and you've copied everything
you own in this app.

You'll also see `budget.db-wal` and `budget.db-shm` sitting next to it. Those are
temporary helper files SQLite uses to write safely (WAL = "Write-Ahead Log").
Don't hand-edit or delete them while the app runs; think of them as the
database's scratch paper. They fold back into `budget.db` on their own.

Two important habits this project follows on purpose:
- **Your data (`budget.db`) is never saved into git.** Git is for *code*, shared
  between computers. Your personal numbers stay on your machine only. (It's
  listed in `.gitignore` so it can't be committed by accident.)
- **Backups are just copies of that file** (plus the in-app Excel export). "Where
  are my workouts?" → in `budget.db`.

**See it in the code:** `server/db.ts` — the top of the file literally opens
`budget.db` and sets it up. `CLAUDE.md` explains the "data belongs in SQLite"
rule and why.

---

## 7. Why the workout tab is stored as one big JSON blob (a real design decision)

This is a judgment call we made together, and it's a good example of *thinking
about trade-offs* rather than just "writing code."

Most tabs (like recipes) store data in **tables** — think spreadsheets: one row
per recipe, columns for title, calories, etc. That's great when your data is a
flat list of similar things.

But the workout tab isn't a flat list. It's a **deeply nested tree**:
categories → programs → workouts → set-groups → exercises → individual
reps/weight cells, *plus* a calendar of assignments *plus* a history of logged
sessions. Forcing all that into rigid tables would mean a dozen linked tables
and dozens of endpoints — a huge, fragile surface for a personal app.

**JSON** is the escape hatch. JSON is just text that represents structured data —
lists inside lists, labeled fields — the natural shape for a tree. So we store
the *entire workout tab as one JSON document* in a single database row, and the
backend only needs two doors: **GET** it, **PUT** it back.

Why this is the *right* call here specifically:
- It's still inside `budget.db` (SQLite), so it **still carries to a future
  phone app** — the non-negotiable goal. A JSON blob in SQLite is as portable as
  a table.
- The workout data has **no photos** (unlike recipes, which store image blobs),
  so there's nothing that *needs* special columns.
- It let us port your working draft faithfully instead of rewriting it into
  many tiny pieces.

The trade-off we accepted: you can't easily run a database query like "every
exercise where I lifted over 200 lbs" across a JSON blob the way you could across
a table. For this app, we don't need that — the frontend just loads the whole
document and works with it in memory. **That's the lesson:** the "best" storage
shape depends entirely on the shape of the data and what you'll ask of it.

**See it in the code:** `server/db.ts` (the `workout_state` table — one row, one
`doc` column). `shared/types.ts` (the `WorkoutDoc` type — a written-down map of
what's *inside* that JSON). `server/index.ts` (`GET`/`PUT /api/workout`).

---

## 8. Seeding and migrations (how the app sets itself up)

Two setup concepts run automatically every time the backend starts. Both live in
`server/db.ts` and `server/*-seed.ts`, and both are called at the top of
`server/index.ts`.

- **Migration** = "make sure the database has the right shape." It creates any
  missing tables/columns. It's written to be safe to run every single startup —
  it only adds what isn't already there (`CREATE TABLE IF NOT EXISTS ...`). This
  is how new features (like the `workout_state` table) get added to a database
  that already has your old data, *without wiping anything*.
- **Seeding** = "if this is a brand-new, empty area, put some starter content
  in." Your Body Beast workouts, the starter recipes — those are seeds. Seeding
  checks "is this empty?" first, so it only ever runs **once**. After that,
  they're just your normal, editable rows and the seed file is never consulted
  again.

Key distinction that trips people up: the **seed file is code (in git)**; the
**result of running it is data (in `budget.db`, not git)**. The recipe you see
came from `server/recipe-seed.ts` the first time you ran the app — but once it's
in your database, editing the seed file won't change it. It already "hatched."

**See it in the code:** `server/index.ts` top — `migrate()`,
`seedRecipesIfEmpty()`, `seedWorkoutIfEmpty()`. `server/workout-seed.ts` is the
starter Body Beast program in code form.

---

## 9. The "debounce" save pattern (why fast typing doesn't spam the kitchen)

When you edit a worksheet cell, we *could* send a save request to the backend on
every single keystroke. Type "225" and that's three saves. Multiply across a
whole workout and it's wasteful and slow.

Instead the frontend uses a **debounce**: "wait until the user *stops* changing
things for half a second, then send one save." Every new edit resets the
half-second timer. So a burst of typing becomes a *single* save once you pause.

It's the same trick as an elevator waiting a moment for more people instead of
closing the doors on the first person and running the trip for each one.

There's also a small safety net: if you navigate away while a save is still
"pending" in that half-second window, the frontend flushes it immediately so
nothing is lost.

**See it in the code:** `src/pages/Workouts.tsx` — search for `scheduleSave` and
`mutate`. `mutate` = "change the data + schedule a save." The 500 (milliseconds)
is the half-second wait.

---

## 10. "No browser driver installed" — why testing a UI is its own thing

When I build a change, I like to *prove* it works, not just assume. For the
backend that's easy: I can send it a fake request and check the answer (I did
this for the workout API — asked it to save, then asked for it back, confirmed
it matched).

The **frontend** is harder to prove automatically, because "working" means
*buttons visibly do the right thing in a real browser*. To automate that, you
need a **browser driver** — a robot that opens a real browser, clicks buttons,
and reads the screen (common ones are called Playwright and Puppeteer). This
project doesn't have one installed, and I didn't want to download one without
asking.

So the honest status is: the workout code **compiles cleanly, builds for
production, and the backend half is verified** — but the final "click every
button and watch it behave" pass is the part *you* do by running the app. That's
a normal split, not a gap in the work. (If you ever want push-button UI testing,
adding Playwright is a thing we can do later.)

---

## 11. How to *read* the code: trace one feature end-to-end

Reading a whole file top-to-bottom is exhausting and rarely necessary. The pro
move is to **trace one feature** and ignore everything else. Try this with the
"Move workout" button:

1. **Find where it's shown.** In `src/pages/Workouts.tsx`, search the text
   `Move` (or `MovePanel`). That's the button and the little panel that opens.
2. **Find what it calls.** The panel's Move button calls `moveWorkouts(...)`.
   Search that name — you'll land on the function that actually rearranges the
   data.
3. **Read what that function does** in plain terms: it finds the workout, moves
   it from one program's list to another, and "re-keys" its calendar and history
   so they follow it. You don't need to understand every line — get the *shape*
   of what happens.
4. **Follow the data out.** Every such change goes through `mutate`, which (from
   section 9) updates the screen and schedules the save to the backend.

That's it. You just read a feature. The trick is picking **one thread and
pulling it**, not trying to hold the whole sweater in your head. Do this a few
times and the file stops looking like a wall and starts looking like a set of
labeled drawers.

---

## 12. localStorage vs the database — the two storage boxes (today's mix-up)

There are **two totally different places** this project can keep data, and
confusing them caused a real scare, so it's worth understanding both.

**localStorage** is a tiny storage box **built into your web browser**. Any page
can say "remember this text for me," and the browser keeps it even after you
close the tab or restart the computer — no server, no database, no setup. The
standalone workout *draft* (`workout-draft.html`) used it: it's a single HTML
file with no backend, so "just stash my workouts in the browser" was the quick,
easy choice. Your draft renames and added workouts are sitting in that box right
now.

**The database** (`budget.db`, SQLite — section 6) is the *real* home for data,
managed by the backend on disk.

Why the app uses the database and *not* localStorage — two limits of the browser
box that matter here:

1. **localStorage can't travel.** It lives on that one browser, on this one
   computer. It can't reach another machine and — the dealbreaker — **it can
   never reach a future iPhone/Android app.** SQLite is a *file* you can carry to
   a phone; a browser pocket isn't. Your portability goal is exactly *why* the
   real app stores data in `budget.db`.

2. **Boxes don't share.** The browser gives each "place" its own separate box.
   The draft opened as a local file and the app opened at `localhost:5173` count
   as *different places*, so they get *different* boxes — and a page is not
   allowed to peek into another place's box. That's why the app couldn't just
   reach over and grab the draft's edits: not a bug, a built-in privacy wall.

**Mental model:** localStorage = *quick, private, stuck-in-place* (a sketchpad).
The database = *portable, the real home for data you own*. Moving the workout tab
from the draft into the app was exactly the move from sketchpad to real home —
and the one-time job of copying your sketchpad edits over is a **migration**
(carrying data from an old home to a new one).

**See it in the code:** the draft reads/writes localStorage under the key
`workoutDraft_v1` (`workout-draft.html`, search `localStorage`). The app reads/
writes the database via `GET`/`PUT /api/workout` (`server/index.ts`).

---

## 13. Dark mode — same app, different "skin"

Dark mode looks like a big change but is a small one, and the *why* is a neat
lesson in how web styling works.

Nothing about your data or the page's structure changes in dark mode — it's the
exact same buttons and tables. Only the **colors** swap. The trick is a single
class named `dark` placed on the very top element of the page (`<html>`). When
it's there, dark colors apply; when it's gone, you're back to light. The header
toggle just adds or removes that one class.

How the colors actually swap, without editing every component:

- The app paints itself with a small, repeated set of color "utility classes"
  (`bg-white`, `text-slate-500`, `border-slate-200`, …). We didn't want to hand-
  edit hundreds of spots.
- So in `src/index.css` we wrote rules like `.dark .bg-white { … dark color … }`.
  Read that selector as "a `bg-white` element **that sits inside** a `.dark`
  page." A selector with *two* class names is **more specific** than one with a
  single class, and in CSS the more specific rule wins. So when `.dark` is on,
  our dark version of `bg-white` beats the normal white one — everywhere, at
  once. (Specificity = CSS's tie-breaker: the more targeted selector wins.)
- The dark colors are defined once as **CSS variables** (`--surface`, `--text`,
  …) at the top of that block, and every rule reads from them. Change a variable,
  and every surface using it updates — one dial instead of fifty.
- One bonus line, `color-scheme: dark`, tells the browser to darken the built-in
  bits it controls itself (text boxes, checkboxes, date pickers, scrollbars) so
  we don't have to style each.

And notice **where the choice is stored**: your light/dark preference lives in
the browser's **localStorage** — the same thing that bit us with the workout
draft. But here it's the *right* tool: a theme is a per-device look-and-feel
preference, not data you own, and it's totally fine if it doesn't travel to
another machine. Same tool, opposite verdict — because the *kind of thing* being
stored is different. That contrast is the real lesson: match the storage to what
you're storing.

**See it in the code:** `src/index.css` (the `.dark` block — the whole dark
palette). `index.html` (the little script that sets the theme before first paint
so there's no flash). `src/components/ThemeToggle.tsx` (the toggle button).
`tailwind.config.js` (`darkMode: 'class'` — "dark turns on via a class").

---

## 14. Two backup formats, and why only one can hold a photo

The Backup window now offers **JSON** or **Excel**, and the difference teaches
something real about file formats.

**A spreadsheet is a grid of cells.** A cell holds a number or some text. There
is nowhere in that grid to put a 2MB photograph. That's not a limitation we
chose, it's what the format *is*. So the .xlsx backup was always going to leave
your recipe photos behind.

**A photo is bytes, and JSON is text.** So how does the photo get in? A trick
called **base64**: it re-spells raw binary using only 64 plain characters
(A-Z, a-z, 0-9, plus two more) that are safe to sit inside a text file. Your
photo becomes a long boring string like `iVBORw0KGgoAAAANSUhEUg...`, JSON stores
it happily, and on restore we spell it back into the original bytes. It really
is the *same* photo, not a copy or a re-compression. The cost: base64 needs
about **4 characters for every 3 bytes**, so the file grows by roughly a third.
That's the whole trade: JSON is bigger, but it's complete.

Which is why the app now nudges you toward JSON. `budget.db` was previously the
only thing that held *everything*, and a raw database file is awkward to email
or eyeball. JSON gets you the same completeness in a file you can open in
Notepad.

**The shared-shape idea (worth stealing).** Both formats carry the same tables
with the same names, so the code gathers your data **once** into a neutral shape
and only the last step differs: write a workbook, or write text. Restore works
the same in reverse. That's why adding JSON didn't mean writing a second backup
system, and why the tab-detection logic ("which tabs does this file contain?")
didn't have to be written twice.

**Sniffing beats trusting the name.** When you upload a backup, the app doesn't
believe the `.json` on the end of the filename (you could rename anything). It
peeks at the first couple of bytes: a JSON file starts with `{`, and an .xlsx is
secretly a zip archive, which always starts with the letters `PK`. Content tells
the truth; filenames are just a label.

**See it in the code:** `server/backup.ts` (`collect` gathers once, `buildBackup`
writes either format, `detectFormat` does the sniffing).
`src/components/BackupRestore.tsx` (the format picker).

---

## 15. The bug where "Choose file" went white-on-white

A small bug with a sharp lesson about how the dark-mode trick (section 13) can
leak.

Section 13's whole approach is: the app uses classes like `bg-slate-100`, and
`src/index.css` re-colors them under `.dark`. That works because the class you
write and the class the CSS re-colors are **the same name**.

The "Choose file" button broke that assumption twice over:

1. The style was written as `file:bg-slate-100`. That `file:` prefix doesn't
   produce a `.bg-slate-100` rule at all. It produces a rule aimed at
   `::file-selector-button`, which is the browser's *own* little button living
   inside the file input. Different selector, so the `.dark .bg-slate-100`
   re-color never touched it. The button stayed light.
2. Meanwhile `color-scheme: dark` (the "bonus line" from section 13) was doing
   its job: it told the browser to render its built-in controls dark, which
   turned that button's default text **white**.

White text, light button. Invisible. Two features that are each correct, both
half-applying to the same element. The fix states both the background *and* the
text color for that button explicitly under `.dark`, instead of assuming the
generic remap reached it.

**The transferable lesson:** a clever blanket rule ("re-color these class names
everywhere") is only blanket over things it can actually see. Anything that
renders through a *different* name, especially browser-built-in bits, sits
outside the blanket and has to be handled by hand. When something looks wrong
only in dark mode, ask: is this element painted by my class, or by the browser?

---

## 16. The fingerprint that stops duplicate imports (and the bug where a restore disarmed it)

You import March's statement. Next month you import again and accidentally grab
an overlapping date range. Why doesn't March show up twice?

**Every imported row gets a fingerprint.** As a row comes in from a CSV, the app
squashes three things — its date, its amount, its description — into one short
code called a **hash**. A hash is the same every time for the same input, and
different for anything else. Same row in, same fingerprint out.

The database then keeps a **unique index** on that fingerprint: a standing rule
saying "no two rows in this budget may share one." The import uses `INSERT OR
IGNORE`, so a row whose fingerprint is already on file gets skipped silently.
That's the entire duplicate guard. Notice it never compares rows to each other —
it just lets the database refuse a collision. That's cheap and it scales.

**Hand-typed rows opt out, on purpose.** If you type "Coffee $4" twice in one
day, you probably meant it. So manual entries get a deliberately *random*
fingerprint instead of a content-based one, and the rule can never fire on them.

**Where it went wrong.** The backup file listed the columns a human would want to
read — date, amount, description — and left the fingerprint out, because a sha1
code is noise in a spreadsheet. Reasonable so far. But the fingerprint column
can't be left empty, so on restore the code *invented* one, built from the row's
position in the file.

Your rows all came back correct, so the restore looked perfect. But each one now
carried a position-stamp where a content-fingerprint belonged. The next import
computed real fingerprints, matched nothing, and inserted all 18 rows a second
time — possibly weeks after the restore that actually caused it.

**The lesson worth keeping:** a backup isn't only the data you can see. The
bookkeeping columns are load-bearing too, and dropping one turned a loud,
immediate failure into a silent, delayed one. The tell is that the restore itself
never misbehaved — only the *next* thing did. When a bug seems to have no cause,
look for what quietly stopped being true earlier.

**See it in the code:** `server/ingest.ts` (builds the content fingerprint),
`server/db.ts` (`idx_txn_dedupe`, the unique rule), `server/index.ts` (the random
one for manual rows), `server/backup.ts` (the restore that invents one).

---

## 17. Bundle size, and why Excel costs a phone more than a desktop

Everything the frontend uses gets packed into one big file the browser downloads
before the app can run. That file is the **bundle**. Yours:

```
dist/assets/index-*.js   1,150.08 kB │ gzip: 336.00 kB
```

That's why the build prints a warning about chunks over 500 kB.

A good chunk of that is **Excel support**. Reading and writing .xlsx is genuinely
hard (it's a zip full of XML), so it takes a big library — and the app imports it
in the browser, to peek inside an uploaded backup and see which tabs it holds.
JSON, by contrast, costs *nothing*: `JSON.parse` is built into the language.
Same feature, wildly different price.

On a desktop this is invisible — fast connection, loads once. On a phone it's app
size and memory, on hardware that cares. It gets worse in a phone build: with no
server, the backup logic moves on-device too, so Excel support ends up carried in
two places.

**The fix isn't to drop the feature — it's to defer it.** A normal `import` at
the top of a file says "I need this before anything runs." A **dynamic import**
(`await import('xlsx')`) says "fetch this only if we actually get here." Since
almost nobody opens a spreadsheet on their phone, that one change means the phone
never pays for Excel unless someone uses it, while the desktop keeps it. This is
called **code-splitting**, and it's exactly what that build warning is asking for.

**The general idea:** the cost of a feature isn't only the code you wrote for it.
It's every library that feature drags along, paid by every user — including the
ones who never touch it.

**See it in the code:** `src/components/BackupRestore.tsx` (imports the Excel
library up front), `server/backup.ts` and `server/parse.ts` (the server's copies).

---

## Glossary (quick reference)

- **Frontend / client / "web"** — the part in the browser you see and click. React. `src/`.
- **Backend / server / "api"** — the part that owns data and answers requests. Express. `server/`.
- **React** — the library for building the interactive UI.
- **Express** — the library for building the backend that answers `/api/...` requests.
- **Vite** — the dev tool that runs the frontend and live-refreshes it.
- **Process** — a running program.
- **Port** — a numbered "door" a process listens on. 5173 = frontend, 3001 = backend.
- **EADDRINUSE** — "port already taken" — a leftover copy of the program is still running.
- **HTTP request** — one message from frontend to backend.
- **GET / POST / PUT / PATCH / DELETE** — the "verbs": read / create / replace / edit / remove.
- **REST** — the convention of addressing data as `/api/nouns` and acting with those verbs.
- **API** — the menu of requests the backend understands. Mirrored in `src/lib/api.ts`.
- **Proxy** — the dev-time rule that forwards `/api/...` from the frontend to the backend.
- **SQLite** — the database; the whole thing is the one file `budget.db`.
- **WAL (`.db-wal` / `.db-shm`)** — SQLite's temporary "scratch paper" files. Leave them alone.
- **JSON** — text that represents nested, structured data. How the workout tab is stored.
- **Migration** — startup step that makes sure the database has the right tables. Safe to re-run.
- **Seed** — starter content inserted once, only into an empty area.
- **Debounce** — "wait for a pause, then act once" — how saves are batched while you type.
- **localStorage** — a small storage box built into the browser, per-page and stuck on that one machine. The draft used it; the real app doesn't (it can't reach a phone).
- **Migration (of data)** — a one-time job of carrying data from an old home to a new one (e.g. draft localStorage → the app's database). Different from a *schema* migration (section 8), which just sets up tables.
- **CSS / Tailwind** — CSS is the language that colors and lays out the page. Tailwind is a shortcut system of tiny prebuilt classes (`bg-white`, `text-slate-500`) you drop right onto elements.
- **CSS specificity** — CSS's tie-breaker when two rules clash: the more *specific* selector wins. `.dark .bg-white` (two classes) beats `.bg-white` (one), which is how dark mode overrides light.
- **CSS variable** — a named, reusable value (like `--surface`) you set once and reference everywhere; change it in one place, everything using it updates.
- **Dark mode via `.dark` class** — one class on `<html>` flips the whole app's colors; the header toggle adds/removes it, and the choice is remembered in localStorage.
- **git** — version control for *code* (shared). Your *data* (`budget.db`) is deliberately kept out of it.
- **Browser driver (Playwright/Puppeteer)** — a robot browser for auto-testing the UI. Not installed here.
- **Hash** — a short code computed from some input. Same input always gives the same code, so it works as a fingerprint. Here: date + amount + description → one code per transaction.
- **Unique index** — a database rule that refuses two rows sharing the same value. What actually blocks a duplicate import; the app never compares rows itself.
- **`INSERT OR IGNORE`** — "add this row, but if it would break a unique rule, skip it quietly instead of erroring."
- **Bundle** — the single packed file of frontend code the browser downloads before the app can run. Bigger bundle = slower first load, and it matters far more on a phone.
- **Code-splitting / lazy-loading** — breaking the bundle up so a heavy piece is only fetched if it's actually used. Done with a dynamic `await import('...')` instead of a top-of-file `import`.
