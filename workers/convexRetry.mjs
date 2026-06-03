const DEFAULT_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 250;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorText(error) {
  if (error instanceof Error) return error.message;
  return String(error ?? "");
}

export function isTransientConvexError(error) {
  const text = errorText(error);
  return /WorkerOverloaded|InternalServerError|couldn'?t be completed|Try again later/i.test(text);
}

export async function withConvexRetry(operation, options = {}) {
  const attempts = Number(options.attempts ?? DEFAULT_ATTEMPTS);
  const baseDelayMs = Number(options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS);
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientConvexError(error)) {
        throw error;
      }
      await sleep(baseDelayMs * attempt);
    }
  }

  throw lastError;
}

export async function convexMutation(client, mutationRef, args, options) {
  return await withConvexRetry(() => client.mutation(mutationRef, args), options);
}
