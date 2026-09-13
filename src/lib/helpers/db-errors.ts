export interface SchemaMismatchResult {
  isSchemaMismatch: boolean;
  userMessage: string;
  suggestedAction: string;
}

const SCHEMA_ERROR_CODES: Record<string, string> = {
  "42703": "undefined_column",
  "42P01": "undefined_table",
  "42704": "undefined_object",
  "42710": "duplicate_object",
  "42701": "duplicate_column",
  "42P07": "duplicate_table",
};

export function isPostgresError(error: unknown): error is PostgresLikeError {
  return (
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof (error as Record<string, unknown>).code === "string"
  );
}

interface PostgresLikeError {
  code: string;
  message?: string;
  column_name?: string;
  table_name?: string;
  detail?: string;
}

export function isSchemaMismatchError(error: unknown): SchemaMismatchResult {
  const defaultResult: SchemaMismatchResult = {
    isSchemaMismatch: false,
    userMessage: "An unexpected error occurred",
    suggestedAction: "Please try again later",
  };

  if (!isPostgresError(error)) {
    return defaultResult;
  }

  const errorType = SCHEMA_ERROR_CODES[error.code];

  if (!errorType) {
    return defaultResult;
  }

  const columnMatch = error.message?.match(/column "([^"]+)"/);
  const tableMatch = error.message?.match(/(?:table|relation) "([^"]+)"/);
  const typeMatch = error.message?.match(/type "([^"]+)"/);

  const missingObject =
    columnMatch?.[1] ||
    tableMatch?.[1] ||
    typeMatch?.[1] ||
    error.column_name ||
    error.table_name ||
    "unknown";

  switch (errorType) {
    case "undefined_column":
      return {
        isSchemaMismatch: true,
        userMessage: `Database schema is out of date (missing column: ${missingObject})`,
        suggestedAction: "Run 'npm run db:repair' or 'npm run db:migrate' to update the schema",
      };

    case "undefined_table":
      return {
        isSchemaMismatch: true,
        userMessage: `Database schema is out of date (missing table: ${missingObject})`,
        suggestedAction: "Run 'npm run db:migrate' to create required tables",
      };

    case "undefined_object":
      return {
        isSchemaMismatch: true,
        userMessage: `Database schema is out of date (missing type: ${missingObject})`,
        suggestedAction: "Run 'npm run db:repair' or 'npm run db:migrate' to update the schema",
      };

    case "duplicate_object":
    case "duplicate_column":
    case "duplicate_table":
      return {
        isSchemaMismatch: true,
        userMessage: "Database migration conflict detected",
        suggestedAction: "Run 'npm run db:repair' to sync migration state",
      };

    default:
      return defaultResult;
  }
}

export function formatSchemaErrorResponse(error: unknown): {
  error: string;
  code: string;
  action: string;
} | null {
  const result = isSchemaMismatchError(error);

  if (!result.isSchemaMismatch) {
    return null;
  }

  return {
    error: result.userMessage,
    code: "SCHEMA_MISMATCH",
    action: result.suggestedAction,
  };
}
