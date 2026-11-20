# Doomsday Ready

My submission for the Blinto Talent Accelerator 2027 (Full Stack Developer Internship) assessment.

It's a small app for planning an MCU rewatch before Avengers: Doomsday comes out. You add movies, say which ones need to be watched before which, and it gives you a watch order. There's also a page for booking a watch party at a cinema that only sells seats in fixed bundle sizes.

## Stack

- Frontend: React + Vite
- Backend: Node.js, Express, TypeScript
- Database: SQL Server 2022, accessed through Prisma
- Docker Compose to run everything together

I wrote the three main algorithms (cycle check, rewatch order, booking quote) myself without any graph or optimization libraries.

## Running it

### With Docker

You only need Docker Desktop.

```bash
cp .env.example .env
docker compose up --build
```

Then open http://localhost:5173. The API is on http://localhost:4000/api.

The first start takes a few minutes because the SQL Server image is big (around 1.5 GB) and it needs about 2 GB of RAM in Docker. When the backend starts it creates the database and tables, adds the check constraints and puts in the sample data (the 8 movies from the assessment and 4 cinemas). If the database already has data it doesn't seed again, so your changes stay after a restart.

If you already have SQL Server running locally on port 1433, set `DB_PORT=1434` in `.env` so the two don't clash.

On an Apple Silicon Mac, turn on "Use Rosetta for x86/amd64 emulation" in Docker Desktop settings, since SQL Server only has an Intel image.

To stop it: `docker compose down`. Add `-v` if you also want to delete the database.

#### If something goes wrong

| Problem | Cause | Fix |
| --- | --- | --- |
| "port is already allocated" | port 1433, 4000 or 5173 is already in use, e.g. by a local SQL Server | set `DB_PORT=1434` in `.env`, or stop whatever is using the port |
| database container keeps restarting | Docker has less than 2 GB of RAM | Docker Desktop → Settings → Resources, and raise the memory |
| first start is very slow | the first download is about 1.5 GB | just wait, later starts are fast |
| posters show initials instead of images | the browser has no internet | that's expected, it's the fallback poster |
| won't start on a Mac | Rosetta is turned off | turn on "Use Rosetta for x86/amd64 emulation" in Docker Desktop |

### Without Docker

You need Node 20+ and a local SQL Server.

```bash
cd backend
cp .env.example .env      # put your SQL Server connection in DATABASE_URL
npm install
npm run db:init           # creates tables + sample data
npm run dev
```

In another terminal:

```bash
cd frontend
npm install
npm run dev
```

If you want to go back to the original sample data at any point: `npm run seed -- --reset` in the backend folder.

## Project layout

```
backend/
  prisma/schema.prisma      tables
  src/algorithms/           cycleCheck, rewatchOrder, bookingQuote
  src/routes/               movies, cinemas
  src/seed.ts               check constraints + sample data
  src/test.ts               tests for the algorithms
frontend/
  src/pages/                Movies, RewatchPlan, Booking
  src/components/Poster.jsx
  src/api/client.js
docker-compose.yml
```

## Database

Four tables:

- `movies`: id, title (unique), releaseYear, runtimeMinutes, watched, posterUrl
- `moviePrerequisites`: movieId, prerequisiteId. One row means "watch prerequisiteId before movieId"
- `cinemas`: id, name (unique)
- `cinemaBundleSizes`: cinemaId, size

I used a separate table for prerequisites because it's many-to-many: a movie can need several movies, and one movie can be needed by several others.

Constraints in the database:

- unique movie title and unique cinema name
- runtime between 1 and 300, release year between 1900 and 2100
- bundle size between 1 and 500
- a movie can't be its own prerequisite (`movieId <> prerequisiteId`)
- the composite primary keys stop the same prerequisite or bundle size being saved twice

Prisma can't define CHECK constraints in the schema, so `seed.ts` adds them with plain SQL if they're missing. Longer loops like A → B → A can't be done with a constraint, so the backend checks for them before saving.

## API

Everything is under `/api`. Errors always look like this:

```json
{ "error": { "code": "CIRCULAR_DEPENDENCY", "message": "..." } }
```

| Status | Code | When |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | missing or invalid input |
| 404 | NOT_FOUND | movie or cinema doesn't exist |
| 409 | DUPLICATE_TITLE | movie title already used |
| 409 | DUPLICATE_NAME | cinema name already used |
| 409 | CIRCULAR_DEPENDENCY | the change would create a loop |

### Movies

`POST /api/movies` creates a movie and returns 201.

```json
{
  "title": "The Avengers",
  "releaseYear": 2012,
  "runtimeMinutes": 143,
  "prerequisiteIds": [1, 2],
  "watched": false,
  "posterUrl": "https://..."
}
```

`prerequisiteIds`, `watched` and `posterUrl` are optional.

`GET /api/movies` returns all movies, each with its prerequisites as `{ id, title }`.

`PATCH /api/movies/:id` updates a movie. Send only the fields you want to change. If you send `prerequisiteIds` it replaces the whole list. Returns 409 if the new list would create a loop.

`DELETE /api/movies/:id` deletes a movie and returns 204. If other movies had it as a prerequisite, it's removed from their lists too.

`GET /api/movies/:id/rewatch-order` returns what to watch before that movie:

```json
{
  "target": { "id": 8, "title": "Avengers: Doomsday" },
  "movies": [
    { "id": 1, "title": "Iron Man", "runtimeMinutes": 126, "watched": true },
    { "id": 2, "title": "Captain America: The First Avenger", "runtimeMinutes": 124, "watched": true },
    { "id": 3, "title": "The Avengers", "runtimeMinutes": 143, "watched": false }
  ],
  "totalCount": 7,
  "watchedCount": 2,
  "remainingRuntimeMinutes": 750
}
```

(I cut the list short here; the real response has all 7.)

### Cinemas

`POST /api/cinemas` creates a cinema and returns 201.

```json
{ "name": "Star Cineplex Bashundhara", "bundleSizes": [6, 9, 20] }
```

`GET /api/cinemas` returns all cinemas with their bundle sizes.

`DELETE /api/cinemas/:id` deletes a cinema (and its bundle sizes) and returns 204.

`GET /api/cinemas/:id/booking?groupSize=44` returns the cheapest way to book, meaning the fewest bundles:

```json
{
  "cinemaId": 1,
  "groupSize": 44,
  "possible": true,
  "totalBundles": 4,
  "bundles": [
    { "size": 20, "count": 1 },
    { "size": 9, "count": 2 },
    { "size": 6, "count": 1 }
  ]
}
```

If no combination adds up exactly:

```json
{
  "cinemaId": 4,
  "groupSize": 7,
  "possible": false,
  "message": "No combination of bundles adds up to exactly 7 seats."
}
```

## How the logic works

### Circular dependency check

Prerequisites form a directed graph, where an edge from A to B means "watch B before A". If movie M gets a new prerequisite list, there's a loop only if M can be reached again by following prerequisites from that list. So before saving I build the graph with the new list in place, run a DFS from M, and if it gets back to M I return 409 along with the path, e.g. `Iron Man → Avengers: Endgame → ... → Iron Man`.

A new movie can't be in a loop since nothing depends on it yet. It runs in O(V + E).

### Rewatch order

This is a topological sort done with DFS. Starting from the target movie I visit its prerequisites recursively and add each movie to the list after all of its own prerequisites are added. A `visited` set makes sure a movie only shows up once even if several movies need it (Iron Man, for example). The target itself isn't included. Then I count the watched ones and add up the runtime of the ones not watched yet. Also O(V + E).

### Booking quote

This is basically the coin change problem with unlimited coins. Always taking the biggest bundle doesn't work. With sizes [1, 3, 4] and 6 people, greedy gives 4 + 1 + 1 (3 bundles) but 3 + 3 is only 2.

So I used dynamic programming:

1. `dp[0] = 0`, everything else starts as infinity
2. for each seat count `s` from 1 up to the group size, try every bundle `b ≤ s` and keep `dp[s] = min(dp[s], dp[s - b] + 1)`, remembering which `b` was used
3. if `dp[groupSize]` is still infinity it's not possible
4. otherwise walk back from `groupSize` using the remembered choices to count each bundle

That's O(G × K). With G up to 10,000 and K up to 10 that's about 100,000 steps, so it's instant.

When two answers use the same number of bundles, it prefers the bigger bundles, because sizes are tried from largest to smallest and a choice is only replaced by a strictly better one. So the same input always gives the same answer.

## Assumptions

The assessment left some things open, so these are the choices I made:

- Titles and cinema names are unique ignoring case and extra spaces ("iron man " counts as a duplicate of "Iron Man"). SQL Server's default collation is case-insensitive, so this holds in the database too.
- Release year must be a whole number from 1900 to 2100.
- `watched` has to be an actual true/false, not a string.
- Prerequisites are sent as movie ids. An unknown id gives a 400, and repeated ids are ignored.
- PATCH with `prerequisiteIds` replaces the list instead of adding to it. This made the edit screen in the frontend much simpler. The field changes and the new list are saved in one transaction.
- Bundle sizes for a cinema must all be different (the assessment says "different bundle sizes"), each 1 to 500, with at most 10 per cinema.
- Group size must be a whole number from 1 to 10,000.
- A booking that isn't possible returns 200 with `possible: false`, because the request itself was fine.
- Deleting a movie that others depend on is allowed. It just gets removed from their prerequisite lists, and the frontend tells you which movies will be affected before you confirm.
- Runtimes in the sample data are approximate.
- Posters for the sample movies come from TMDB. If an image can't load (no internet, for example) the frontend shows a coloured placeholder with the movie's initials instead.

## Tests

```bash
cd backend
npm test
```

These cover the expected results given in the assessment:

| Case | Expected |
| --- | --- |
| Rewatch order for Avengers: Doomsday | all 7 other movies, in a valid order |
| Rewatch order for Captain America: Civil War | Iron Man, The First Avenger, then The Avengers |
| Rewatch order for Thor: Ragnarok | empty |
| Make Endgame a prerequisite of Iron Man | rejected as a loop |
| Bundles [1, 3, 4], group 6 | 2 bundles: 3 × 2 |
| Bundles [2, 5], group 11 | 4 bundles: 5 × 1, 2 × 3 |
| Bundles [6, 9, 20], group 44 | 4 bundles: 20 × 1, 9 × 2, 6 × 1 |
| Bundles [4, 6], group 7 | not possible |

There are also a few extra ones: every movie comes after its prerequisites, the watched count and remaining time are right, a movie can't depend on itself, and a case where greedy would give the wrong answer.

## AI usage

<!-- Fill this in yourself: which tools you used and for what. -->
