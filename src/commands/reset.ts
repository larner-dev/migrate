import * as readline from "readline";
import { Sequelize } from "sequelize";
import { logBuilder, Logger, LogLevel } from "../lib/logBuilder";
import { ExitCode, GlobalOptions } from "../types";
import { dbConnect } from "../lib/dbConnect";
import { runMigrations } from "./up";

export interface ResetCommandOptions extends GlobalOptions {
  filter?: string;
  force?: boolean;
}

interface DatabaseInfo {
  db: Sequelize;
  name: string;
  host: string;
  port: number;
}

const parseConnectionInfo = (db: Sequelize): { name: string; host: string; port: number } => {
  return {
    name: db.config.database || "unknown",
    host: db.config.host || "localhost",
    port: Number(db.config.port) || 5432,
  };
};

const isInteractive = (): boolean => {
  return process.stdin.isTTY === true;
};

const promptConfirmation = async (databases: DatabaseInfo[]): Promise<boolean> => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const dbList = databases
    .map((d) => `  - ${d.name} (${d.host}:${d.port})`)
    .join("\n");

  console.log(`\nThis will DROP ALL TABLES in the following databases:\n${dbList}\n`);

  return new Promise((resolve) => {
    rl.question("Are you sure? [y/N] ", (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
};

export const dropAllTables = async (db: Sequelize, log: Logger): Promise<void> => {
  await db.query(`DROP SCHEMA public CASCADE`);
  await db.query(`CREATE SCHEMA public`);
  log(`Dropped all tables for ${db.config.database}`, {
    logLevel: LogLevel.Success,
  });
};

export const resetCommand = async (
  dir: string,
  connectionStrings: string[],
  options: ResetCommandOptions = {}
): Promise<void> => {
  const log = logBuilder(options.logLevels, options.exitOnCompletion);

  // Connect to all databases
  const dbs = await Promise.all(
    connectionStrings.map((c) =>
      dbConnect({
        log,
        connectionString: c,
        ssl: options.ssl,
      })
    )
  );

  // Build database info for confirmation prompt
  const databases: DatabaseInfo[] = dbs.map((db) => ({
    db,
    ...parseConnectionInfo(db),
  }));

  // Check for confirmation unless --force is passed or stdin is not a TTY
  if (!options.force && isInteractive()) {
    const confirmed = await promptConfirmation(databases);
    if (!confirmed) {
      return log("Reset cancelled.", {
        code: ExitCode.Success,
        logLevel: LogLevel.Info,
      });
    }
  }

  // Drop all tables for each database
  try {
    for (const { db } of databases) {
      log(`Resetting ${db.config.database} on ${db.config.host}:${db.config.port}...`, {
        logLevel: LogLevel.Info,
      });
      await dropAllTables(db, log);
    }
  } catch (error) {
    log(error, {
      logLevel: LogLevel.Error,
      preStyled: true,
    });
    return log("Failed to drop tables.", {
      code: ExitCode.QueryError,
      logLevel: LogLevel.Error,
    });
  }

  // Re-run migrations
  log("Running migrations...", { logLevel: LogLevel.Info });

  let filterRegex: RegExp | undefined;
  if (options.filter) {
    filterRegex = new RegExp(options.filter);
  }

  try {
    await Promise.all(
      dbs.map((db) => runMigrations(dir, db, log, filterRegex))
    );
  } catch (error) {
    return log(error, {
      code: ExitCode.UncaughtException,
      logLevel: LogLevel.Error,
    });
  }

  return log("Reset complete.", {
    code: ExitCode.Success,
    logLevel: LogLevel.Success,
  });
};
