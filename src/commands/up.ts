import { readFile } from "fs/promises";
import { QueryTypes, Sequelize } from "sequelize";
import klaw from "klaw";
import { cwd } from "process";
import { extname, isAbsolute, join, resolve } from "path";
import { watch } from "chokidar";
import { ExitCode, GlobalOptions } from "../types";
import { logBuilder, Logger, LogLevel } from "../lib/logBuilder";
import { dbConnect } from "../lib/dbConnect";

export interface UpCommandOptions extends GlobalOptions {
  watch?: boolean;
  filter?: string;
}

interface Migration {
  path: string;
  version: string;
}

export const runMigrations = async (
  dir: string,
  db: Sequelize,
  log: Logger,
  filter?: RegExp
) => {
  if (!isAbsolute(dir)) {
    dir = resolve(cwd(), dir);
  }

  const allMigrations = await new Promise<Migration[]>((resolve, reject) => {
    const migrations: Migration[] = [];
    let error = "";
    klaw(dir)
      .on("data", (item) => {
        const relativePath = item.path.substring(dir.length + 1);
        if (item.stats.isFile()) {
          if (filter) {
            const match = relativePath.match(filter);
            if (match) {
              if (match.length !== 2) {
                error = "Filter regex must have exactly one capture group";
              } else {
                migrations.push({
                  path: relativePath,
                  version: match[1],
                });
              }
            }
          } else {
            migrations.push({
              path: relativePath,
              version: relativePath.substring(
                0,
                relativePath.length - extname(relativePath).length
              ),
            });
          }
        }
      })
      .on("error", (error) => {
        if ("code" in error && error.code === "ENOENT") {
          reject(new Error(`Migration directory "${dir}" does not exist`));
        } else {
          reject(error);
        }
      })
      .on("end", () =>
        error ? reject(new Error(error)) : resolve(migrations)
      );
  });

  let migrationsToRun = [];

  // Start the migration
  let currentMigrationVersion = null;
  try {
    await db.query("BEGIN");
    // Create the migrations table if it doesn't already exist
    await db.query(
      `CREATE TABLE IF NOT EXISTS migrations (
      version character varying PRIMARY KEY,
      started_at timestamp with time zone,
      ended_at timestamp with time zone
    );
    CREATE UNIQUE INDEX IF NOT EXISTS migrations_pkey ON migrations(version text_ops);`
    );
    const lastMigration = await db.query<{ version: string }>(
      "SELECT version FROM migrations ORDER BY ended_at DESC, version DESC LIMIT 1",
      { type: QueryTypes.SELECT }
    );
    migrationsToRun = await Promise.all(
      (lastMigration.length
        ? allMigrations.filter((m) => m.version > lastMigration[0].version)
        : allMigrations
      ).map(async (m) => ({
        info: m,
        sql: (await readFile(join(dir, m.path))).toString(),
      }))
    );

    for (const migration of migrationsToRun) {
      currentMigrationVersion = migration.info;
      await db.query(
        "INSERT INTO migrations (version, started_at) VALUES($version, NOW())",
        { bind: { version: migration.info.version } }
      );
      await db.query(migration.sql);
      await db.query(
        "UPDATE migrations SET ended_at=NOW() WHERE version=$version",
        { bind: { version: migration.info.version } }
      );
      log(`Ran migration ${migration.info.version}`, {
        logLevel: LogLevel.Success,
      });
    }
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    log(error, { logLevel: LogLevel.Error, preStyled: true });
    return log(
      `Rolled back... An error occurred while running migration ${JSON.stringify(
        currentMigrationVersion
      )}`,
      {
        code: ExitCode.QueryError,
        logLevel: LogLevel.Error,
      }
    );
  }
};

export const upCommand = async (
  dir: string,
  connectionStrings: string[],
  options: UpCommandOptions = {}
) => {
  console.log({ connectionStrings });
  const exitOnCompletion = options.watch ? false : options.exitOnCompletion;
  const log = logBuilder(options.logLevels, exitOnCompletion);
  const dbs = await Promise.all(
    connectionStrings.map((c) =>
      dbConnect({
        log,
        connectionString: c,
        ssl: options.ssl,
      })
    )
  );

  const migrationDir = resolve(cwd(), dir);

  let filterRegex: RegExp | undefined;
  if (options.filter) {
    filterRegex = new RegExp(options.filter);
  }

  try {
    for (const db of dbs) {
      console.log("running migration for", db.config.database);
      await runMigrations(migrationDir, db, log, filterRegex);
    }
  } catch (error) {
    return log(error, {
      code: ExitCode.UncaughtException,
      logLevel: LogLevel.Error,
    });
  }

  if (options.watch) {
    watch(migrationDir, {
      awaitWriteFinish: { pollInterval: 100, stabilityThreshold: 2000 },
      ignoreInitial: true,
    })
      .on("all", (event, path) => {
        if (
          ["add", "change"].includes(event) &&
          (!filterRegex ||
            filterRegex.test(path.substring(migrationDir.length + 1)))
        ) {
          dbs.map((db) => runMigrations(migrationDir, db, log, filterRegex));
        }
      })
      .on("error", (event) => {
        return log(event, {
          code: ExitCode.UncaughtException,
          logLevel: LogLevel.Error,
        });
      });
  } else {
    return log("All migrations ran successfully!", {
      code: ExitCode.Success,
      logLevel: LogLevel.Success,
    });
  }
};
