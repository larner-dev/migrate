# @larner.dev/migrate

A tool to run database migrations. Currently only supports postgres.

## Commands

```
npx @larner.dev/migrate up [options] <dir> <conection_string>

Apply all new migrations in <dir> to the database at <conection_string>

Options:
  -w, --watch                   Watch for changes to <dir> and apply migrations any time files in
                                the directory change
  -f, --filter <regex_pattern>  Only include files in <dir> that match the specified regex
                                pattern.
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
