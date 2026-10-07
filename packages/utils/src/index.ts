type Success<T> = [T, null];

type Failure<E> = [null, E];

type Result<T, E = unknown> = Success<T> | Failure<E>;

export async function tryCatch<T>(promise: Promise<T>): Promise<Result<T>> {
  try {
    const data = await promise;
    return [data, null];
  } catch (error) {
    return [null, error];
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
