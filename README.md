# @larner.dev/migrate

A tool to run database migrations. Currently only supports postgres.

## Commands

### up

```
npx @larner.dev/migrate up [options] <dir> <credentials...>

Apply all new migrations in <dir> to the database(s) using <credentials>

Options:
  -w, --watch                   Watch for changes to <dir> and apply migrations any time files in
                                the directory change
  -f, --filter <regex_pattern>  Only include files in <dir> that match the specified regex
                                pattern. There should be exactly one regex capture group that
                                captures the id of the migration from the file path.
  -s, --ssl                     Use ssl when connecting.
  -l, --logLevels               A comma separated list of log levels to display. Valid values are
                                info, warning, error, success, all or none. Defaults to all.
  -h, --help                    display help for command
```

### reset

```
npx @larner.dev/migrate reset [options] <dir> <credentials...>

Drop all tables (including migrations) and re-run all migrations from scratch.
Useful for development iteration and CI test database setup.

Options:
  -f, --filter <regex_pattern>  Only include files in <dir> that match the specified regex
                                pattern. There should be exactly one regex capture group that
                                captures the id of the migration from the file path.
  --force                       Skip confirmation prompt (for CI/scripted usage)
  -s, --ssl                     Use ssl when connecting.
  -l, --logLevels               A comma separated list of log levels to display. Valid values are
                                info, warning, error, success, all or none. Defaults to all.
  -h, --help                    display help for command
```

### truncateAll

```
npx @larner.dev/migrate truncateAll [options] <credentials>

TRUNCATE all tables except for the migrations table.

Options:
  -s, --ssl                     Use ssl when connecting.
  -l, --logLevels               A comma separated list of log levels to display. Valid values are
                                info, warning, error, success, all or none. Defaults to all.
  -h, --help                    display help for command
```

## Setup Locally

Run `npm install`

## Dev Commands

Use `npm run` followed by any of these commands:

- `build`: Output both ESM and CJS versions of the project, as well as type definitions to `build` directory.
- `build-cjs`: Output CJS versions of the project to `build/cjs` directory.
- `build-ems`: Output ESM versions of the project to `build/esm` directory.
- `build-types`: Output type definitions to `build/types.d.ts` file.
- `dev`: Re-build the ESM version any time there are changes to the project.
- `format`: Format all typescript files using prettier.
- `lint`: Run the linter to check for errors.
- `test`: Run unit tests.
