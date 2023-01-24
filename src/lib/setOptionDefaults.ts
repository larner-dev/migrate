import { GlobalOptions, Raw } from "../types";
import { LogLevel } from "./logBuilder";

export const setOptionDefaults = <T extends GlobalOptions>(
  options: Raw<GlobalOptions>
): T => {
  const filledOptions = { ...options, exitOnCompletion: true } as unknown as T;
  if (!options.logLevels) {
    filledOptions.logLevels = Object.values(LogLevel);
  } else {
    filledOptions.logLevels = options.logLevels
      .split(",")
      .map((l) => l.toLowerCase().trim()) as LogLevel[];
    if (filledOptions.logLevels.includes("none" as LogLevel)) {
      filledOptions.logLevels = [];
    }
    if (filledOptions.logLevels.includes("all" as LogLevel)) {
      filledOptions.logLevels = Object.values(LogLevel);
    }
  }
  return filledOptions;
};
