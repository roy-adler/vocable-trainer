import { resolveOllamaModel } from "./settings";

/** Model frozen onto a new or retried extraction job. */
export function modelForNewJob(requestModel?: string | null): string {
  return resolveOllamaModel(requestModel);
}

export function modelForRetry(): string {
  return resolveOllamaModel();
}
