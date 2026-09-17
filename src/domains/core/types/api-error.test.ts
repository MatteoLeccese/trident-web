import { describe, expect, it } from "vitest";
import { ApiError, isApiError } from "./api-error";

describe("ApiError", () => {
  it("carries the status, the machine code, the message and the recovery data", () => {
    const error = new ApiError(422, "game_version_conflict", "Stale state.", { version: 47 });

    expect(error.status).toBe(422);
    expect(error.errorCode).toBe("game_version_conflict");
    expect(error.message).toBe("Stale state.");
    expect(error.data).toEqual({ version: 47 });
  });

  it("is a real Error so it survives throw, catch and stack traces", () => {
    const error = new ApiError(500, "internal_error", "Something failed.");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.stack).toBeDefined();
  });

  it("defaults its data to null rather than undefined", () => {
    expect(new ApiError(404, "not_found", "Does not exist.").data).toBeNull();
  });

  it("narrows an unknown catch value", () => {
    // Always `catch (err: unknown)`; never `any`.
    const unknowns: unknown[] = [
      new ApiError(404, "not_found", "Does not exist."),
      new Error("a normal error"),
      "a string",
      null,
      { status: 404, errorCode: "not_found" },
    ];

    expect(unknowns.filter(isApiError)).toHaveLength(1);
  });
});
