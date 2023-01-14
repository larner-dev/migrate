import { readdir, readFile } from "fs/promises";
import chalk from "chalk";
import { Command } from "commander";
import { QueryTypes, Sequelize } from "sequelize";
import { log } from "../lib/log";
import { cwd } from "process";
import { join, resolve } from "path";
import { watch } from "chokidar";

const exit = (
  message: string,
  program: Command,
  db?: Sequelize,
  isError = true
) => {
  db?.close();
  if (isError) {
    program.error(message);
  } else {
    log(message);
  }
};

const runMigrations = async (
  dir: string,
  db: Sequelize,
  log: (message: string, isError?: boolean) => void,
  filter?: RegExp
) => {
  // Create the migrations table if it doesn't already exist
  await db.query(
    `CREATE TABLE IF NOT EXISTS migrations (
      version character varying PRIMARY KEY,
      started_at timestamp with time zone,
      ended_at timestamp with time zone
    );
    CREATE UNIQUE INDEX IF NOT EXISTS migrations_pkey ON migrations(version text_ops);`
  );

  const dirents = await readdir(dir, { withFileTypes: true });
  const allMigrations = dirents
    .filter((d) => !d.isDirectory() && (!filter || filter.test(d.name)))
    .map((d) => d.name);

  let migrationsToRun = [];

  // Start the migration
  let currentMigrationVersion = null;
  try {
    await db.query("BEGIN;");
    const lastMigration = await db.query<{ version: string }>(
      "SELECT version FROM migrations ORDER BY ended_at DESC, version DESC LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    migrationsToRun = await Promise.all(
      (lastMigration.length
        ? allMigrations.filter((m) => m > lastMigration[0].version)
        : allMigrations
      ).map(async (m) => ({
        version: m,
        sql: (await readFile(join(dir, m))).toString(),
      }))
    );

    for (const migration of migrationsToRun) {
      currentMigrationVersion = migration.version;
      await db.query(
        "INSERT INTO migrations (version, started_at) VALUES($version, NOW())",
        { bind: { version: migration.version } }
      );
      await db.query(migration.sql);
      await db.query(
        "UPDATE migrations SET ended_at=NOW() WHERE version=$version",
        { bind: { version: migration.version } }
      );
      log(chalk.green(`Ran migration ${migration.version}`));
    }
    await db.query("COMMIT;");
  } catch (error) {
    await db.query("ROLLBACK;");
    return log(
      chalk.red(
        `Rolled back... An error occurred while running migration ${currentMigrationVersion}: '${
          (error as Record<string, unknown>).message
        }'`
      )
    );
  }
};

export const upCommand = async (
  dir: string,
  connectionString: string,
  options: Record<string, unknown>,
  program: Command
) => {
  let db: Sequelize;
  const migrationDir = resolve(cwd(), dir);
  // Create the database connection
  try {
    db = new Sequelize(connectionString, {
      logging: false,
    });
  } catch (error) {
    return exit(
      chalk.red(
        `Error connecting to the database with connection string '${connectionString}'`
      ),
      program
    );
  }

  // Ensure that we can authenticate
  try {
    await db.authenticate();
  } catch (error) {
    return exit(
      chalk.red(
        `Unable to authenticate with connection string '${connectionString}'`
      ),
      program,
      db
    );
  }

  let filterRegex: RegExp | undefined;
  if (options.filter) {
    filterRegex = new RegExp(options.filter as string);
  }

  await runMigrations(
    migrationDir,
    db,
    (message: string, isError?: boolean) =>
      options.watch ? log(message) : exit(message, program, db, isError),
    filterRegex
  );

  if (options.watch) {
    watch(migrationDir, {
      awaitWriteFinish: { pollInterval: 100, stabilityThreshold: 2000 },
      ignoreInitial: true,
    }).on("all", (event, path) => {
      if (
        ["add", "change"].includes(event) &&
        (!filterRegex ||
          filterRegex.test(path.substring(migrationDir.length + 1)))
      ) {
        runMigrations(
          migrationDir,
          db,
          (message: string, isError?: boolean) =>
            options.watch ? log(message) : exit(message, program, db, isError),
          filterRegex
        );
      }
    });
  } else {
    return exit(
      chalk.green("All migrations ran successfully!"),
      program,
      db,
      false
    );
  }
};
