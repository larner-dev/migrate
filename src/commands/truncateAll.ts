import chalk from "chalk";
import { Sequelize } from "sequelize";
import { logBuilder, LogLevel } from "../lib/logBuilder";
import { ExitCode, GlobalOptions } from "../types";
import { dbConnect } from "../lib/dbConnect";

export type TruncateAllCommandOptions = GlobalOptions;

export const truncateAllCommand = async (
  connectionString: string,
  options: TruncateAllCommandOptions = {}
) => {
  const log = logBuilder(options.logLevels, options.exitOnCompletion);
  let db: Sequelize = await dbConnect({
    log,
    connectionString,
    ssl: options.ssl,
  });

  await db.query(
    `DO
    $do$
    BEGIN
       EXECUTE
       (SELECT 'TRUNCATE TABLE ' || string_agg(oid::regclass::text, ', ') || ' CASCADE'
        FROM   pg_class
        WHERE  relkind = 'r' AND oid::regclass::text <> 'migrations'  -- only tables
        AND    relnamespace = 'public'::regnamespace
       );
    END
    $do$;`
  );
  log("All tables (except migrations) truncated.", {
    logLevel: LogLevel.Success,
    code: ExitCode.Success,
  });
};
