import { LogLevel } from "./lib/logBuilder";

export interface GlobalOptions {
  logLevels?: LogLevel[];
  ssl?: boolean;
  exitOnCompletion?: boolean;
}

export type Raw<T extends GlobalOptions> = Omit<
  Partial<GlobalOptions>,
  "logLevels"
> &
  T & {
    logLevels?: string;
  };

export enum ExitCode {
  Success = 0,
  ConnectionError = 1,
  AuthenticateError = 2,
  QueryError = 3,
  UncaughtException = 4,
}
