import { blastRadius, type ClassifiedCommand, type ResourceGraph } from '@cloud-hermes/core';

/**
 * Computes the blast radius of a classified command — the resources it touches.
 *
 * For a CREATE the resource does not exist yet, so the radius is the resource
 * being created. For an UPDATE, the command's target is matched to a node in
 * the resource graph and its transitive dependents are pulled in — that is what
 * the change really reaches. Every approval card carries this; it is not an
 * empty state.
 */
export function computeBlastRadius(
  classified: ClassifiedCommand,
  graph: ResourceGraph | null,
): string[] {
  const command = classified.command;
  const targetName = command?.positionals[0] ?? '(unnamed)';

  if (classified.classification === 'CREATE') {
    return [`creates ${command?.resourceType ?? 'resource'} "${targetName}"`];
  }

  if (classified.classification === 'UPDATE') {
    if (graph !== null) {
      const targetNode = graph.nodes.find((node) => node.name === targetName);
      if (targetNode !== undefined) {
        const reached = blastRadius(graph, targetNode.id);
        return reached.map((node) => `${node.kind} "${node.name}"`);
      }
    }
    return [`updates ${command?.resourceType ?? 'resource'} "${targetName}"`];
  }

  return [`${classified.classification.toLowerCase()} ${targetName}`];
}
