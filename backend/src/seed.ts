import prisma from "./lib/prisma.js";

// Prisma can't describe CHECK constraints in the schema, so they are added here.
// Each one is only created if it doesn't exist yet, so this is safe to run many times.
const checkConstraints = [
  { name: "CK_movies_runtime", table: "movies", rule: "runtimeMinutes BETWEEN 1 AND 300" },
  { name: "CK_movies_releaseYear", table: "movies", rule: "releaseYear BETWEEN 1900 AND 2100" },
  { name: "CK_prerequisites_not_self", table: "moviePrerequisites", rule: "movieId <> prerequisiteId" },
  { name: "CK_bundle_size", table: "cinemaBundleSizes", rule: "size BETWEEN 1 AND 500" },
];

async function addCheckConstraints() {
  for (const c of checkConstraints) {
    await prisma.$executeRawUnsafe(`
      IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = '${c.name}')
        ALTER TABLE ${c.table} ADD CONSTRAINT ${c.name} CHECK (${c.rule})
    `);
  }
}

// Official posters, served by TMDB (themoviedb.org).
const TMDB = "https://image.tmdb.org/t/p/w500";
const posters: Record<string, string> = {
  "Iron Man": `${TMDB}/78lPtwv72eTNqFW9COBYI0dWDJa.jpg`,
  "Captain America: The First Avenger": `${TMDB}/vSNxAJTlD0r02V9sPYpOjqDZXUK.jpg`,
  "The Avengers": `${TMDB}/RYMX2wcKCBAr24UyPD7xwmjaTn.jpg`,
  "Captain America: Civil War": `${TMDB}/rAGiXaUfPzY7CDEyNKUofk3Kw2e.jpg`,
  "Thor: Ragnarok": `${TMDB}/rzRwTcFvttcN1ZpX2xv4j3tSdJu.jpg`,
  "Avengers: Infinity War": `${TMDB}/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg`,
  "Avengers: Endgame": `${TMDB}/jtDv3lCnST0fZRvdYFwR5CVwK2x.jpg`,
  "Avengers: Doomsday": `${TMDB}/1zqWkLwC1zLBBBtIWzmkmWeMWnT.jpg`,
};

// Gives the sample movies their poster if they don't have one yet (for databases seeded before posters existed).
async function addMissingPosters() {
  for (const [title, posterUrl] of Object.entries(posters)) {
    await prisma.movies.updateMany({ where: { title, posterUrl: null }, data: { posterUrl } });
  }
}

async function createMovie(title: string, releaseYear: number, runtimeMinutes: number, watched: boolean, prereqIds: number[] = []) {
  const movie = await prisma.movies.create({
    data: {
      title,
      releaseYear,
      runtimeMinutes,
      watched,
      posterUrl: posters[title] ?? null,
      prerequisites: { create: prereqIds.map((id) => ({ prerequisiteId: id })) },
    },
  });
  return movie.id;
}

async function createCinema(name: string, sizes: number[]) {
  await prisma.cinemas.create({
    data: { name, bundleSizes: { create: sizes.map((size) => ({ size })) } },
  });
}

async function main() {
  await addCheckConstraints();

  const reset = process.argv.includes("--reset");
  const movieCount = await prisma.movies.count();

  if (movieCount > 0 && !reset) {
    await addMissingPosters();
    console.log("Database already has data, skipping seed. Use --reset to start over.");
    return;
  }

  if (reset) {
    await prisma.moviePrerequisites.deleteMany();
    await prisma.movies.deleteMany();
    await prisma.cinemas.deleteMany();
    // Start ids from 1 again so the sample data always has the same ids.
    await prisma.$executeRawUnsafe(`DBCC CHECKIDENT ('movies', RESEED, 0)`);
    await prisma.$executeRawUnsafe(`DBCC CHECKIDENT ('cinemas', RESEED, 0)`);
  }

  // Sample data from the assessment. Runtimes are approximate.
  const ironMan = await createMovie("Iron Man", 2008, 126, true);
  const firstAvenger = await createMovie("Captain America: The First Avenger", 2011, 124, true);
  const avengers = await createMovie("The Avengers", 2012, 143, false, [ironMan, firstAvenger]);
  const civilWar = await createMovie("Captain America: Civil War", 2016, 147, false, [avengers]);
  const ragnarok = await createMovie("Thor: Ragnarok", 2017, 130, false);
  const infinityWar = await createMovie("Avengers: Infinity War", 2018, 149, false, [civilWar, ragnarok]);
  const endgame = await createMovie("Avengers: Endgame", 2019, 181, false, [infinityWar]);
  await createMovie("Avengers: Doomsday", 2026, 180, false, [endgame]);

  await createCinema("Star Cineplex Bashundhara", [6, 9, 20]);
  await createCinema("Blockbuster Cinemas", [1, 3, 4]);
  await createCinema("Lion Cinemas", [2, 5]);
  await createCinema("Silver Screen", [4, 6]);

  console.log("Seeded 8 movies and 4 cinemas.");
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
