/**
 * Every error that crosses the HTTP boundary arrives here normalised.
 *
 * The client branches on `errorCode`, never on the text of `message`
 * (see guidelines/api-contract.md).
 */
export class ApiError extends Error {
  public readonly status: number;

  public readonly errorCode: string;

  public readonly data: unknown;

  public constructor (status: number, errorCode: string, message: string, data: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errorCode = errorCode;
    this.data = data;

    // Without this, `instanceof` fails when compiling to ES5 and narrowing breaks.
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export function isApiError (value: unknown): value is ApiError {
  return value instanceof ApiError;
}
