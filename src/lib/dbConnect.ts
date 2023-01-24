import { readFileSync } from "fs";
import { resolve } from "path";
import { cwd } from "process";
import { Sequelize } from "sequelize";
import { ExitCode } from "../types";
import { Logger, LogLevel } from "./logBuilder";

interface DbConnectOptions {
  connectionString: string;
  log: Logger;
  ssl?: boolean;
}

let db: Sequelize | null = null;

const exitHandler = (code: number) => {
  db?.close();
  process.exit(code);
};

const uncaughtExceptionHandler = (err: unknown) => {
  db?.close();
  process.exit(ExitCode.UncaughtException);
};

process.on("exit", exitHandler);
process.on("uncaughtException", uncaughtExceptionHandler);

export const dbConnect = async ({
  log,
  connectionString,
  ssl,
}: DbConnectOptions): Promise<Sequelize> => {
  if (db) {
    return db;
  }
  // Create the database connection
  try {
    db = new Sequelize(connectionString, {
      logging: false,
      dialectOptions: {
        ssl: ssl
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
      },
    });
  } catch (error) {
    try {
      const json = JSON.parse(
        readFileSync(resolve(cwd(), connectionString)).toString()
      );
      db = new Sequelize(json.DB_NAME, json.DB_USER, json.DB_PASSWORD, {
        dialect: "postgres",
        host: json.DB_HOST,
        port: json.DB_PORT,
        logging: false,
        dialectOptions: {
          ssl: ssl
            ? {
                require: true,
                rejectUnauthorized: false,
              }
            : false,
        },
      });
    } catch (error2) {
      log(
        `Could not connect to database with connection string ${connectionString}`,
        { logLevel: LogLevel.Error }
      );
      log(error2 as string, {
        code: ExitCode.ConnectionError,
        preStyled: true,
      });
    }
  }

  if (!db) {
    throw new Error("SHOULD NOT HAPPEN");
  }

  // Ensure that we can authenticate
  try {
    await db.authenticate();
  } catch (error) {
    log(error as string, {
      code: ExitCode.AuthenticateError,
      preStyled: true,
    });
  }

  return db;
};
