#!/usr/bin/env node

import { program } from "commander";
import pkg from "../package.json";
import {
  truncateAllCommand,
  TruncateAllCommandOptions,
} from "./commands/truncateAll";
import { upCommand, UpCommandOptions } from "./commands/up";
import { setOptionDefaults } from "./lib/setOptionDefaults";
import { Raw } from "./types";

program
  .name("migrate")
  .description("CLI for applying database migrations")
  .version(pkg.version);

program
  .command("up <dir> <credentials>")
  .description(
    "Apply all new migrations in <dir> to the database using <credentials>. " +
      "<credentials> should be either a valid db connection string or a json file path. If a json " +
      "file path is provided, it should contain the following keys: DB_HOST, DB_NAME, DB_PASSWORD, " +
      "DB_PORT, DB_USER."
  )
  .option(
    "-w, --watch",
    "Watch for changes to <dir> and apply migrations any time files in the directory change"
  )
  .option(
    "-f, --filter <regex_pattern>",
    "Only include files in <dir> that match the specified regex pattern."
  )
  .option(
    "-l, --logLevels",
    "A comma separated list of log levels to display. Valid values are info, warning, error, " +
      "success, all or none. Defaults to all."
  )
  .option("-s, --ssl", "Use ssl when connecting.")
  .action(
    (dir: string, connectionString: string, options: Raw<UpCommandOptions>) =>
      upCommand(dir, connectionString, setOptionDefaults(options))
  );

program
  .command("truncateAll <credentials>")
  .description("TRUNCATE all tables except for the migrations table")
  .option("-s, --ssl", "Use ssl when connecting.")
  .option(
    "-l, --logLevels",
    "A comma separated list of log levels to display. Valid values are info, warning, error, " +
      "success, all or none. Defaults to all."
  )
  .action((connectionString, options: Raw<TruncateAllCommandOptions>) =>
    truncateAllCommand(connectionString, setOptionDefaults(options))
  );

program.parse();
