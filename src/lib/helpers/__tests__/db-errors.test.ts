import { describe, it, expect } from "vitest";
import {
  isPostgresError,
  isSchemaMismatchError,
  formatSchemaErrorResponse,
} from "../db-errors";

describe("db-errors", () => {
  describe("isPostgresError", () => {
    it("returns true for postgres-like errors with code", () => {
      const error = { code: "42703", message: "column does not exist" };
      expect(isPostgresError(error)).toBe(true);
    });

    it("returns false for null", () => {
      expect(isPostgresError(null)).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isPostgresError(undefined)).toBe(false);
    });

    it("returns false for regular Error", () => {
      expect(isPostgresError(new Error("test"))).toBe(false);
    });

    it("returns false for objects without code", () => {
      expect(isPostgresError({ message: "test" })).toBe(false);
    });

    it("returns false for objects with non-string code", () => {
      expect(isPostgresError({ code: 42703 })).toBe(false);
    });
  });

  describe("isSchemaMismatchError", () => {
    it("detects undefined_column error (42703)", () => {
      const error = {
        code: "42703",
        message: 'column "verification_status" does not exist',
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(true);
      expect(result.userMessage).toContain("verification_status");
      expect(result.suggestedAction).toContain("db:repair");
    });

    it("detects undefined_table error (42P01)", () => {
      const error = {
        code: "42P01",
        message: 'relation "verification_events" does not exist',
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(true);
      expect(result.userMessage).toContain("verification_events");
      expect(result.suggestedAction).toContain("db:migrate");
    });

    it("detects undefined_object error (42704)", () => {
      const error = {
        code: "42704",
        message: 'type "verification_status" does not exist',
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(true);
      expect(result.userMessage).toContain("verification_status");
      expect(result.suggestedAction).toContain("db:repair");
    });

    it("detects duplicate_object error (42710)", () => {
      const error = {
        code: "42710",
        message: 'type "subscription_plan" already exists',
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(true);
      expect(result.userMessage).toContain("migration conflict");
      expect(result.suggestedAction).toContain("db:repair");
    });

    it("returns false for non-schema errors", () => {
      const error = {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(false);
    });

    it("returns false for non-postgres errors", () => {
      const result = isSchemaMismatchError(new Error("network error"));

      expect(result.isSchemaMismatch).toBe(false);
    });

    it("extracts column name from error object properties", () => {
      const error = {
        code: "42703",
        message: "some message",
        column_name: "my_column",
      };

      const result = isSchemaMismatchError(error);

      expect(result.isSchemaMismatch).toBe(true);
      expect(result.userMessage).toContain("my_column");
    });
  });

  describe("formatSchemaErrorResponse", () => {
    it("formats schema mismatch errors for API response", () => {
      const error = {
        code: "42703",
        message: 'column "verification_status" does not exist',
      };

      const response = formatSchemaErrorResponse(error);

      expect(response).not.toBeNull();
      expect(response?.error).toContain("Database schema is out of date");
      expect(response?.code).toBe("SCHEMA_MISMATCH");
      expect(response?.action).toContain("npm run");
    });

    it("returns null for non-schema errors", () => {
      const error = {
        code: "23505",
        message: "unique violation",
      };

      const response = formatSchemaErrorResponse(error);

      expect(response).toBeNull();
    });

    it("returns null for regular errors", () => {
      const response = formatSchemaErrorResponse(new Error("test"));

      expect(response).toBeNull();
    });
  });
});
