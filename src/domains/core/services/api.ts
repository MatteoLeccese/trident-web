import axios, { AxiosError, type AxiosInstance } from "axios";
import { ApiError } from "@/domains/core/types/api-error";

const DEFAULT_TIMEOUT_MS = 10_000;

function resolveTimeout (): number {
  const configured = Number.parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS ?? "", 10);

  return Number.isNaN(configured) ? DEFAULT_TIMEOUT_MS : configured;
}

/** Does the body have the shape of the envelope the backend produces? */
function isEnvelope (body: unknown): body is { message: string; error: string; data: unknown; } {
  return typeof body === "object"
    && body !== null
    && "error" in body
    && typeof (body as { error: unknown; }).error === "string";
}

function toApiError (thrown: unknown): ApiError {
  if (!(thrown instanceof AxiosError)) {
    return new ApiError(0, "internal_error", "Ha ocurrido un error inesperado.");
  }

  if (thrown.response === undefined) {
    const timedOut = thrown.code === AxiosError.ECONNABORTED || thrown.code === AxiosError.ETIMEDOUT;

    return timedOut
      ? new ApiError(0, "timeout", "El servidor ha tardado demasiado en responder.")
      : new ApiError(0, "network_error", "No hemos podido conectar. Revisa tu conexión.");
  }

  const { status, data } = thrown.response;

  if (isEnvelope(data)) {
    return new ApiError(status, data.error, data.message, data.data ?? null);
  }

  // A 502 from a proxy returns HTML, not our envelope. It must not blow anything up.
  return new ApiError(status, "internal_error", "El servidor ha devuelto una respuesta inesperada.");
}

/**
 * The browser's single HTTP instance.
 *
 * `baseURL` points at the Next BFF, never at Laravel: the `controller_token`
 * lives in an httpOnly cookie that the browser's JS cannot read.
 */
export const api: AxiosInstance = axios.create({
  baseURL: "/api/proxy",
  timeout: resolveTimeout(),
  headers: {
    Accept: "application/json",
    "Content-Type": "application/json",
  },
});

api.interceptors.response.use(
  (response) => response,
  (thrown: unknown) => Promise.reject(toApiError(thrown)),
);
