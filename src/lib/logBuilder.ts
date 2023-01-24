import chalk from "chalk";
import { Sequelize } from "sequelize";
import { ExitCode } from "../types";

export enum LogLevel {
  Info = "info",
  Warning = "warning",
  Error = "error",
  Success = "success",
}

const logLevelColors = {
  [LogLevel.Info]: chalk.white,
  [LogLevel.Warning]: chalk.yellow,
  [LogLevel.Error]: chalk.red,
  [LogLevel.Success]: chalk.green,
};

interface LogOptions {
  code?: ExitCode;
  preStyled?: boolean;
  logLevel?: LogLevel;
}

export type Logger = (message: unknown, options?: LogOptions) => void;

export const logBuilder = (
  logLevels?: LogLevel[],
  exitOnCompletion?: boolean
): Logger => {
  if (!logLevels) {
    logLevels = Object.values(LogLevel);
  }

  return (message: unknown, options: LogOptions = {}) => {
    const logLevel = options.logLevel || LogLevel.Info;
    if (logLevels?.includes(logLevel)) {
      if (!options.preStyled && typeof message === "string") {
        message = logLevelColors[logLevel](message);
      }
      console.log(message);
    }
    if (exitOnCompletion && "code" in options) {
      process.exit(options.code);
    }
  };
};
