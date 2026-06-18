import { InMemoryTransferRepository } from '../../src/transfers/adapters/in-memory/in-memory-transfer.repository';
import { runRepositoryContract } from './transfer-repository.contract';

/**
 * Runs the shared port contract against the in-memory adapter. Fast, no external
 * services — part of the `unit` Jest project.
 */
let repo: InMemoryTransferRepository;

runRepositoryContract('InMemory', {
  makeRepo: async () => {
    repo = repo ?? new InMemoryTransferRepository();
    return repo;
  },
  reset: async () => {
    repo = new InMemoryTransferRepository();
  },
});
