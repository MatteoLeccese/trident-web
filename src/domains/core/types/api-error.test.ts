import { describe, expect, it } from "vitest";
import { ApiError, isApiError } from "./api-error";

describe("ApiError", () => {
  it("carries the status, the machine code, the message and the recovery data", () => {
    const error = new ApiError(422, "game_version_conflict", "Estado obsoleto.", { version: 47 });

    expect(error.status).toBe(422);
    expect(error.errorCode).toBe("game_version_conflict");
    expect(error.message).toBe("Estado obsoleto.");
    expect(error.data).toEqual({ version: 47 });
  });

  it("is a real Error so it survives throw, catch and stack traces", () => {
    const error = new ApiError(500, "internal_error", "Algo falló.");

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ApiError");
    expect(error.stack).toBeDefined();
  });

  it("defaults its data to null rather than undefined", () => {
    expect(new ApiError(404, "not_found", "No existe.").data).toBeNull();
  });

  it("narrows an unknown catch value", () => {
    // Always `catch (err: unknown)`; never `any`.
    const unknowns: unknown[] = [
      new ApiError(404, "not_found", "No existe."),
      new Error("un error normal"),
      "una cadena",
      null,
      { status: 404, errorCode: "not_found" },
    ];

    expect(unknowns.filter(isApiError)).toHaveLength(1);
  });
});
