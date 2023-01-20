#!/usr/bin/env node

import { program } from "commander";
import pkg from "../package.json";
import { upCommand } from "./commands/up";

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
  .option("-s, --ssl", "Use ssl when connecting.")
  .action((dir, connectionString, options) =>
    upCommand(dir, connectionString, options, program)
  );

program.showHelpAfterError();

program.parse();
