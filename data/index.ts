// The app's single repository instance. To move to a hosted backend later, swap
// `new LocalRepository()` for `new ApiRepository(...)` — nothing else needs to change.
import { LocalRepository } from './localRepository';
import type { Repository } from './repository';

export const repo: Repository = new LocalRepository();

export * from './types';
export type {
  NewRecurringInput,
  NewTaskInput,
  ProjectPatch,
  RecurringPatch,
  Repository,
  TaskPatch,
} from './repository';
