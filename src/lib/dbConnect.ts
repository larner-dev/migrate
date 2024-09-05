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

const dbs: Record<string, Sequelize> = {};

const exitHandler = (code: number) => {
  for (const db of Object.values(dbs)) {
    db.close();
  }

  process.exit(code);
};

const uncaughtExceptionHandler = () => {
  for (const db of Object.values(dbs)) {
    db.close();
  }
  process.exit(ExitCode.UncaughtException);
};

process.on("exit", exitHandler);
process.on("uncaughtException", uncaughtExceptionHandler);

export const dbConnect = async ({
  log,
  connectionString,
  ssl,
}: DbConnectOptions): Promise<Sequelize> => {
  if (dbs[connectionString]) {
    return dbs[connectionString];
  }
  // Create the database connection
  try {
    dbs[connectionString] = new Sequelize(connectionString, {
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
      dbs[connectionString] = new Sequelize(
        json.DB_NAME,
        json.DB_USER,
        json.DB_PASSWORD,
        {
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
        }
      );
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

  if (!dbs) {
    throw new Error("SHOULD NOT HAPPEN");
  }

  // Ensure that we can authenticate
  try {
    await dbs[connectionString].authenticate();
  } catch (error) {
    log(error as string, {
      code: ExitCode.AuthenticateError,
      preStyled: true,
    });
  }

  return dbs[connectionString];
};
