/**
 * src/kernel/scheduler.ts
 *
 * DAG scheduler determining which contracts are ready to dispatch based on completed dependencies.
 */

export interface ContractNode {
  id: string;
  dependsOn: string[];
}

export class TaskScheduler {
  getReadyContracts(
    allContracts: ContractNode[],
    completedContractIds: Set<string>,
    activeContractIds: Set<string>,
  ): ContractNode[] {
    const ready: ContractNode[] = [];

    for (const node of allContracts) {
      if (completedContractIds.has(node.id)) continue;
      if (activeContractIds.has(node.id)) continue;

      const depsMet = node.dependsOn.every((depId) => completedContractIds.has(depId));

      if (depsMet) {
        ready.push(node);
      }
    }

    return ready;
  }
}
