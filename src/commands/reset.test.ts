import { Sequelize } from "sequelize";
import { describe, test, expect, vi, beforeEach, Mock } from "vitest";
import { logBuilder, LogLevel } from "../lib/logBuilder";
import { dropAllTables, resetCommand } from "./reset";
import * as dbConnectModule from "../lib/dbConnect";
import * as upModule from "./up";

vi.mock("../lib/dbConnect");
vi.mock("./up");

describe("dropAllTables", () => {
  test("executes DROP SCHEMA and CREATE SCHEMA queries", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb" },
    } as unknown as Sequelize;
    const log = vi.fn(logBuilder([]));

    await dropAllTables(db, log);

    expect(db.query).toHaveBeenCalledTimes(2);
    expect(db.query).toHaveBeenNthCalledWith(1, "DROP SCHEMA public CASCADE");
    expect(db.query).toHaveBeenNthCalledWith(2, "CREATE SCHEMA public");
    expect(log).toHaveBeenCalledWith("Dropped all tables for testdb", {
      logLevel: LogLevel.Success,
    });
  });

  test("propagates query errors", async () => {
    const db = {
      query: vi.fn(async () => {
        throw new Error("Permission denied");
      }),
      config: { database: "testdb" },
    } as unknown as Sequelize;
    const log = vi.fn(logBuilder([]));

    await expect(dropAllTables(db, log)).rejects.toThrow("Permission denied");
  });
});

describe("resetCommand", () => {
  const mockDbConnect = dbConnectModule.dbConnect as Mock;
  const mockRunMigrations = upModule.runMigrations as Mock;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("drops tables and runs migrations with --force flag", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
      force: true,
      exitOnCompletion: false,
      logLevels: [LogLevel.Info, LogLevel.Success, LogLevel.Error],
    });

    // Verify dbConnect was called
    expect(mockDbConnect).toHaveBeenCalledWith({
      log: expect.any(Function),
      connectionString: "postgres://localhost/testdb",
      ssl: undefined,
    });

    // Verify DROP SCHEMA was executed
    expect(db.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
    expect(db.query).toHaveBeenCalledWith("CREATE SCHEMA public");

    // Verify migrations were run
    expect(mockRunMigrations).toHaveBeenCalledWith(
      "fixtures/migrations_flat",
      db,
      expect.any(Function),
      undefined
    );
  });

  test("passes filter regex to runMigrations", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    await resetCommand("fixtures/migrations_nested", ["postgres://localhost/testdb"], {
      force: true,
      filter: "^([0-9]{5})/sql/up\\.sql",
      exitOnCompletion: false,
    });

    expect(mockRunMigrations).toHaveBeenCalledWith(
      "fixtures/migrations_nested",
      db,
      expect.any(Function),
      expect.any(RegExp)
    );

    // Verify the regex is passed and matches expected pattern
    const filterArg = mockRunMigrations.mock.calls[0][3] as RegExp;
    expect(filterArg).toBeInstanceOf(RegExp);
    expect(filterArg.test("00001/sql/up.sql")).toBe(true);
    expect(filterArg.test("00001/sql/down.sql")).toBe(false);
  });

  test("handles multiple database connections", async () => {
    const db1 = {
      query: vi.fn(async () => []),
      config: { database: "db1", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    const db2 = {
      query: vi.fn(async () => []),
      config: { database: "db2", host: "localhost", port: 5433 },
    } as unknown as Sequelize;

    mockDbConnect
      .mockResolvedValueOnce(db1)
      .mockResolvedValueOnce(db2);
    mockRunMigrations.mockResolvedValue(undefined);

    await resetCommand(
      "fixtures/migrations_flat",
      ["postgres://localhost:5432/db1", "postgres://localhost:5433/db2"],
      { force: true, exitOnCompletion: false }
    );

    // Verify both databases were connected
    expect(mockDbConnect).toHaveBeenCalledTimes(2);

    // Verify both databases had their schemas dropped
    expect(db1.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
    expect(db2.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");

    // Verify migrations were run for both
    expect(mockRunMigrations).toHaveBeenCalledTimes(2);
  });

  test("handles drop table errors gracefully", async () => {
    const db = {
      query: vi.fn(async () => {
        throw new Error("Permission denied");
      }),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);

    // Should not throw, but should log error
    await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
      force: true,
      exitOnCompletion: false,
    });

    // Migrations should not be run if drop failed
    expect(mockRunMigrations).not.toHaveBeenCalled();
  });

  test("handles migration errors gracefully", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockRejectedValue(new Error("Migration failed"));

    // Should not throw
    await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
      force: true,
      exitOnCompletion: false,
    });

    // Verify drop was still executed before migration failure
    expect(db.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
  });

  test("passes SSL option to dbConnect", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
      force: true,
      ssl: true,
      exitOnCompletion: false,
    });

    expect(mockDbConnect).toHaveBeenCalledWith({
      log: expect.any(Function),
      connectionString: "postgres://localhost/testdb",
      ssl: true,
    });
  });

  test("skips confirmation prompt when stdin is not a TTY", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    // Mock stdin.isTTY to be false (non-interactive)
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });

    try {
      await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
        // Note: force is NOT set
        exitOnCompletion: false,
      });

      // Should proceed without prompting
      expect(db.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
      expect(mockRunMigrations).toHaveBeenCalled();
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        configurable: true,
      });
    }
  });

  test("uses default options when none provided", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: { database: "testdb", host: "localhost", port: 5432 },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    // Mock stdin.isTTY to be false to skip interactive prompt
    const originalIsTTY = process.stdin.isTTY;
    Object.defineProperty(process.stdin, "isTTY", {
      value: false,
      configurable: true,
    });

    try {
      await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"]);

      expect(mockDbConnect).toHaveBeenCalled();
      expect(db.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
    } finally {
      Object.defineProperty(process.stdin, "isTTY", {
        value: originalIsTTY,
        configurable: true,
      });
    }
  });

  test("handles database with missing config fields gracefully", async () => {
    const db = {
      query: vi.fn(async () => []),
      config: {
        // database, host, port are missing/undefined
      },
    } as unknown as Sequelize;

    mockDbConnect.mockResolvedValue(db);
    mockRunMigrations.mockResolvedValue(undefined);

    // Should not throw even with missing config
    await resetCommand("fixtures/migrations_flat", ["postgres://localhost/testdb"], {
      force: true,
      exitOnCompletion: false,
    });

    expect(db.query).toHaveBeenCalledWith("DROP SCHEMA public CASCADE");
  });
});
