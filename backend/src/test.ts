import { calculateBooking } from "./algorithms/bookingQuote.js";
import { checkForCycle } from "./algorithms/cycleCheck.js";
import { calculateRewatchOrder } from "./algorithms/rewatchOrder.js";

console.log("Running algorithm tests\n");

let passed = 0;
let total = 0;

function assert(description: string, condition: boolean, detail = "") {
  total++;
  if (condition) {
    passed++;
    console.log(`PASS  ${description}`);
  } else {
    console.error(`FAIL  ${description}`);
    if (detail) console.error(`   ${detail}`);
  }
}

// Test 1: Bundles [1, 3, 4], group 6 -> 2 bundles: 3 × 2
const q1 = calculateBooking(1, 6, [1, 3, 4]);
assert(
  "Bundles [1, 3, 4], group 6 -> exactly 2 bundles of size 3",
  q1.possible === true &&
    q1.totalBundles === 2 &&
    q1.bundles?.length === 1 &&
    q1.bundles[0].size === 3 &&
    q1.bundles[0].count === 2,
);

// Test 2: Bundles [2, 5], group 11 -> 4 bundles: 5 × 1, 2 × 3
const q2 = calculateBooking(2, 11, [2, 5]);
assert(
  "Bundles [2, 5], group 11 -> 4 bundles (5 × 1, 2 × 3)",
  q2.possible === true &&
    q2.totalBundles === 4 &&
    q2.bundles?.find((b) => b.size === 5)?.count === 1 &&
    q2.bundles?.find((b) => b.size === 2)?.count === 3,
);

// Test 3: Bundles [6, 9, 20], group 44 -> 4 bundles: 20 × 1, 9 × 2, 6 × 1
const q3 = calculateBooking(3, 44, [6, 9, 20]);
assert(
  "Bundles [6, 9, 20], group 44 -> 4 bundles (20 × 1, 9 × 2, 6 × 1)",
  q3.possible === true &&
    q3.totalBundles === 4 &&
    q3.bundles?.find((b) => b.size === 20)?.count === 1 &&
    q3.bundles?.find((b) => b.size === 9)?.count === 2 &&
    q3.bundles?.find((b) => b.size === 6)?.count === 1,
);

// Test 4: Bundles [4, 6], group 7 -> Not possible
const q4 = calculateBooking(4, 7, [4, 6]);
assert(
  "Bundles [4, 6], group 7 -> Not possible",
  q4.possible === false && q4.message !== undefined,
);


// Feature 1b Tests: Rewatch Order

const mockMovies = [
  { id: 1, title: "Iron Man", runtimeMinutes: 126, watched: true },
  {
    id: 2,
    title: "Captain America: The First Avenger",
    runtimeMinutes: 124,
    watched: true,
  },
  { id: 3, title: "The Avengers", runtimeMinutes: 143, watched: false },
  {
    id: 4,
    title: "Captain America: Civil War",
    runtimeMinutes: 147,
    watched: false,
  },
  { id: 5, title: "Thor: Ragnarok", runtimeMinutes: 130, watched: false },
  {
    id: 6,
    title: "Avengers: Infinity War",
    runtimeMinutes: 149,
    watched: false,
  },
  { id: 7, title: "Avengers: Endgame", runtimeMinutes: 181, watched: false },
  { id: 8, title: "Avengers: Doomsday", runtimeMinutes: 180, watched: false },
];

const mockPrereqs = [
  { movieId: 3, prerequisiteId: 1 },
  { movieId: 3, prerequisiteId: 2 },
  { movieId: 4, prerequisiteId: 3 },
  { movieId: 6, prerequisiteId: 4 },
  { movieId: 6, prerequisiteId: 5 },
  { movieId: 7, prerequisiteId: 6 },
  { movieId: 8, prerequisiteId: 7 },
];

// Test 5: Rewatch order for Thor: Ragnarok -> Empty list
const ragnarokPlan = calculateRewatchOrder(
  { id: 5, title: "Thor: Ragnarok" },
  mockMovies,
  mockPrereqs,
);
assert(
  "Rewatch order for Thor: Ragnarok -> Empty list",
  ragnarokPlan.movies.length === 0 && ragnarokPlan.totalCount === 0,
);

// Test 6: Rewatch order for Captain America: Civil War -> Iron Man, First Avenger, The Avengers
const civilWarPlan = calculateRewatchOrder(
  { id: 4, title: "Captain America: Civil War" },
  mockMovies,
  mockPrereqs,
);
const civilWarTitles = civilWarPlan.movies.map((m) => m.title);
assert(
  "Rewatch order for Civil War -> Iron Man, The First Avenger, The Avengers",
  civilWarTitles.join(" | ") === "Iron Man | Captain America: The First Avenger | The Avengers",
  `got: ${civilWarTitles.join(" | ")}`,
);

// Test 7: Rewatch order for Avengers: Doomsday -> All 7 other movies
const doomsdayPlan = calculateRewatchOrder(
  { id: 8, title: "Avengers: Doomsday" },
  mockMovies,
  mockPrereqs,
);
assert(
  "Rewatch order for Avengers: Doomsday -> exactly 7 movies",
  doomsdayPlan.totalCount === 7,
);

// Every movie must appear after all of its prerequisites.
const position = new Map(doomsdayPlan.movies.map((m, i) => [m.id, i]));
assert(
  "Rewatch order for Avengers: Doomsday -> every movie comes after its prerequisites",
  mockPrereqs
    .filter((e) => position.has(e.movieId))
    .every((e) => position.get(e.prerequisiteId)! < position.get(e.movieId)!),
);

assert(
  "Rewatch order for Avengers: Doomsday -> 2 watched, 750 minutes left",
  doomsdayPlan.watchedCount === 2 && doomsdayPlan.remainingRuntimeMinutes === 750,
);


// Feature 1a Tests: Circular Dependency Detection

const titlesMap = new Map(mockMovies.map((m) => [m.id, m.title]));

// Test 8: Make Endgame (id: 7) a prerequisite of Iron Man (id: 1) -> 409 CIRCULAR_DEPENDENCY
// Currently: 1 -> 3 -> 4 -> 6 -> 7
// If 1 gets prereq [7]: cycle!
const cycleTest1 = checkForCycle(1, [7], mockPrereqs, titlesMap);
assert(
  "Making Endgame a prerequisite of Iron Man detects circular dependency",
  cycleTest1.hasCycle === true &&
    (cycleTest1.message?.includes("Iron Man") ?? false),
);

// Test 9: Valid prerequisite change (e.g. Iron Man gets Thor: Ragnarok) -> No cycle
const validChange = checkForCycle(1, [5], mockPrereqs, titlesMap);
assert(
  "Adding independent prerequisite (Thor: Ragnarok) does not create cycle",
  validChange.hasCycle === false,
);

const selfCycle = checkForCycle(1, [1], mockPrereqs, titlesMap);
assert("A movie cannot be its own prerequisite", selfCycle.hasCycle === true);

// Greedy (largest first) would give 25 + 1 + 1 + 1 + 1 + 1 = 6 bundles; the best is 10 × 3 = 3 bundles.
const q5 = calculateBooking(5, 30, [1, 10, 25]);
assert(
  "Bundles [1, 10, 25], group 30 -> 3 bundles (beats greedy)",
  q5.possible === true && q5.totalBundles === 3 && q5.bundles?.[0].size === 10,
);

console.log(`\n=========================================`);
console.log(`Summary: ${passed} / ${total} tests passed.`);
console.log(`=========================================\n`);

if (passed !== total) {
  process.exit(1);
}
