import { readdir, readFile } from "fs/promises";
import { QueryTypes, Sequelize } from "sequelize";
import { cwd } from "process";
import { join, resolve } from "path";
import { watch } from "chokidar";
import { ExitCode, GlobalOptions } from "../types";
import { logBuilder, Logger, LogLevel } from "../lib/logBuilder";
import { dbConnect } from "../lib/dbConnect";

export interface UpCommandOptions extends GlobalOptions {
  watch?: boolean;
  filter?: string;
}

const runMigrations = async (
  dir: string,
  db: Sequelize,
  log: Logger,
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
      log(`Ran migration ${migration.version}`, { logLevel: LogLevel.Success });
    }
    await db.query("COMMIT;");
  } catch (error) {
    await db.query("ROLLBACK;");
    log(error, { logLevel: LogLevel.Error, preStyled: true });
    return log(
      `Rolled back... An error occurred while running migration ${currentMigrationVersion}`,
      {
        code: ExitCode.QueryError,
        logLevel: LogLevel.Error,
      }
    );
  }
};

export const upCommand = async (
  dir: string,
  connectionString: string,
  options: UpCommandOptions = {}
) => {
  const log = logBuilder(options.logLevels, options.exitOnCompletion);
  let db: Sequelize = await dbConnect({
    log,
    connectionString,
    ssl: options.ssl,
  });

  const migrationDir = resolve(cwd(), dir);

  let filterRegex: RegExp | undefined;
  if (options.filter) {
    filterRegex = new RegExp(options.filter);
  }

  await runMigrations(migrationDir, db, log, filterRegex);

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
        runMigrations(migrationDir, db, log, filterRegex);
      }
    });
  } else {
    return log("All migrations ran successfully!", {
      code: ExitCode.Success,
      logLevel: LogLevel.Success,
    });
  }
};
