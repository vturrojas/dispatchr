import { api } from "./client";
import type { Executor } from "./types";

export function listExecutors() {
  return api<Executor[]>("/executors");
}
