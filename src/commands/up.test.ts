import { resolve } from "path";
import { cwd } from "process";
import { Sequelize } from "sequelize";
import { describe, test, expect, vi } from "vitest";
import { logBuilder } from "../lib/logBuilder";
import { runMigrations } from "./up";

const log = logBuilder();

describe("runMigrations", () => {
  test("throws if the directory doesn't exist", async () => {
    await expect(
      runMigrations("fixtures/nonexistant", {} as Sequelize, log)
    ).rejects.toThrow(
      `Migration directory "${resolve(
        cwd(),
        "fixtures/nonexistant"
      )}" does not exist`
    );
  });
  test("throws if the filter regex has no capture groups", async () => {
    await expect(
      runMigrations("fixtures/migrations_nested", {} as Sequelize, log, /.*/)
    ).rejects.toThrow("Filter regex must have exactly one capture group");
  });
  test("throws if the filter regex has more than one capture groups", async () => {
    await expect(
      runMigrations(
        "fixtures/migrations_nested",
        {} as Sequelize,
        log,
        /(.)(.*)/
      )
    ).rejects.toThrow("Filter regex must have exactly one capture group");
  });
  test("runs migrations on flat directory structure", async () => {
    const db = {
      query: vi.fn(async () => []),
    } as unknown as Sequelize;
    const log = vi.fn(logBuilder([]));
    await expect(
      runMigrations("fixtures/migrations_flat", db, log)
    ).resolves.toEqual(undefined);
    expect(db.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(db.query).toHaveBeenNthCalledWith(
      4,
      "INSERT INTO migrations (version, started_at) VALUES($version, NOW())",
      { bind: { version: "00001" } }
    );
    expect(db.query).toHaveBeenNthCalledWith(
      5,
      'CREATE TABLE "users" ("id" serial, PRIMARY KEY ("id"));'
    );
    expect(db.query).toHaveBeenNthCalledWith(
      8,
      'ALTER TABLE "users" RENAME COLUMN "id" TO "id2";'
    );
    expect(db.query).toHaveBeenNthCalledWith(10, "COMMIT");
    expect(log).toHaveBeenNthCalledWith(1, "Ran migration 00001", {
      logLevel: "success",
    });
    expect(log).toHaveBeenNthCalledWith(2, "Ran migration 00002", {
      logLevel: "success",
    });
  });
  test("runs migrations on nested directory structure", async () => {
    const db = {
      query: vi.fn(async () => []),
    } as unknown as Sequelize;
    const log = vi.fn(logBuilder([]));
    await expect(
      runMigrations(
        "fixtures/migrations_nested",
        db,
        log,
        new RegExp("^([0-9]{5})/sql/up\\.sql")
      )
    ).resolves.toEqual(undefined);
    expect(db.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(db.query).toHaveBeenNthCalledWith(
      4,
      "INSERT INTO migrations (version, started_at) VALUES($version, NOW())",
      { bind: { version: "00001" } }
    );
    expect(db.query).toHaveBeenNthCalledWith(
      5,
      'CREATE TABLE "users" ("id" serial, PRIMARY KEY ("id"));'
    );
    expect(db.query).toHaveBeenNthCalledWith(
      8,
      'ALTER TABLE "users" RENAME COLUMN "id" TO "id2";'
    );
    expect(db.query).toHaveBeenNthCalledWith(10, "COMMIT");
    expect(log).toHaveBeenNthCalledWith(1, "Ran migration 00001", {
      logLevel: "success",
    });
    expect(log).toHaveBeenNthCalledWith(2, "Ran migration 00002", {
      logLevel: "success",
    });
  });
});
