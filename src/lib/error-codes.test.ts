import { describe, expect, it } from "vitest";
import { ApiError } from "@/domains/core/types/api-error";
import { messageForError } from "./error-codes";

describe("messageForError", () => {
  it("translates a known machine code to a friendly message", () => {
    const message = messageForError(new ApiError(422, "not_your_turn", "Not your turn."));

    expect(message).toBe("No es tu turno todavía.");
    expect(message).not.toBe("Not your turn.");
  });

  it("falls back to the backend message when the code is unknown", () => {
    // Rule: the client branches on the code, but if it does not know it,
    // the backend's message is better than a useless generic one.
    expect(
      messageForError(new ApiError(422, "some_future_code", "Algo muy específico pasó.")),
    ).toBe("Algo muy específico pasó.");
  });

  it("falls back to a generic message when there is neither a known code nor a message", () => {
    expect(messageForError(new ApiError(500, "", ""))).toBe(
      "Ha ocurrido un error inesperado. Vuelve a intentarlo.",
    );
  });

  it("never returns an empty string", () => {
    const cases = [
      new ApiError(422, "not_your_turn", ""),
      new ApiError(500, "", ""),
      new ApiError(418, "algo_desconocido", ""),
      new ApiError(404, "not_found", ""),
    ];

    for (const error of cases) {
      expect(messageForError(error).length).toBeGreaterThan(0);
    }
  });

  it("covers every error code the backend kernel can currently emit", () => {
    // If the backend gains a new code, this test is the reminder to map it.
    const emittedByKernel = [
      "validation_error",
      "unauthenticated",
      "forbidden",
      "not_found",
      "too_many_requests",
      "internal_error",
    ];

    for (const code of emittedByKernel) {
      expect(messageForError(new ApiError(400, code, "")))
        .not.toBe("Ha ocurrido un error inesperado. Vuelve a intentarlo.");
    }
  });
});
