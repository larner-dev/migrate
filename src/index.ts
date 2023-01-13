#!/usr/bin/env node

import { program } from "commander";
import pkg from "../package.json";
import { upCommand } from "./commands/up";

program
  .name("migrate")
  .description("CLI for applying database migrations")
  .version(pkg.version);

program
  .command("up <dir> <conection_string>")
  .description(
    "Apply all new migrations in <dir> to the database at <conection_string>"
  )
  .option(
    "-w, --watch",
    "Watch for changes to <dir> and apply migrations any time files in the directory change"
  )
  .option(
    "-f, --filter <regex_pattern>",
    "Only include files in <dir> that match the specified regex pattern."
  )
  .action((dir, connectionString, options) =>
    upCommand(dir, connectionString, options, program)
  );

program.showHelpAfterError();

program.parse();
