import type { Insight, InsightCheck } from './types';

/**
 * The best-practice checks.
 *
 * Each is a pure function over the resource graph. v1 ships a handful covering
 * the walking-skeleton service set; the check set grows with the skill catalog.
 * Every observation cites the resource and field it is grounded in.
 */

/** Ports where ingress from anywhere is an exposure worth naming. */
const SENSITIVE_PORTS = new Set(['22', '3389', '3306', '5432', '6379', '27017', '1433', '9200']);

const stringField = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Firewall rules that allow ingress from 0.0.0.0/0 on a sensitive port. */
export const openSensitiveIngress: InsightCheck = (graph) => {
  const insights: Insight[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'firewall-rule') continue;
    if (stringField(node.data['direction']).toUpperCase() !== 'INGRESS') continue;

    const sourceRanges = stringField(node.data['sourceRanges'])
      .split(',')
      .map((range) => range.trim());
    if (!sourceRanges.includes('0.0.0.0/0')) continue;

    const exposedPorts = stringField(node.data['allowed'])
      .split(',')
      .map((entry) => entry.split(':')[1]?.trim())
      .filter((port): port is string => port !== undefined && SENSITIVE_PORTS.has(port));
    if (exposedPorts.length === 0) continue;

    insights.push({
      checkId: 'firewall-open-ingress',
      severity: 'warning',
      title: `${node.name} allows ingress from anywhere on a sensitive port`,
      detail: `The rule permits 0.0.0.0/0 to reach port ${exposedPorts.join(', ')}. Open management ports are a common, avoidable exposure.`,
      resourceId: node.id,
      field: 'sourceRanges',
      suggestion: `Narrow ${node.name}'s source ranges to the addresses that genuinely need access.`,
    });
  }
  return insights;
};

/** Networks left in auto subnet mode. */
export const autoModeNetwork: InsightCheck = (graph) => {
  const insights: Insight[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'network' || node.data['subnetMode'] !== 'auto') continue;
    insights.push({
      checkId: 'auto-mode-network',
      severity: 'advisory',
      title: `${node.name} uses auto subnet mode`,
      detail:
        'Auto mode creates a subnet in every region with predetermined ranges, which leaves addressing unplanned and ranges unused.',
      resourceId: node.id,
      field: 'subnetMode',
      suggestion: 'Prefer custom subnet mode for new networks so addressing is deliberate.',
    });
  }
  return insights;
};

/** The default network still in use. */
export const defaultNetwork: InsightCheck = (graph) => {
  const insights: Insight[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'network' || node.name !== 'default') continue;
    insights.push({
      checkId: 'default-network',
      severity: 'advisory',
      title: 'The default network is in use',
      detail:
        'The default network ships with permissive firewall rules and auto subnets. A purpose-built network is clearer and easier to secure.',
      resourceId: node.id,
      suggestion: 'Consider a custom-mode network for production workloads.',
    });
  }
  return insights;
};

/** Instances on legacy machine families. */
const LEGACY_MACHINE_PREFIXES = ['n1-', 'f1-', 'g1-'];
export const legacyMachineType: InsightCheck = (graph) => {
  const insights: Insight[] = [];
  for (const node of graph.nodes) {
    if (node.kind !== 'instance') continue;
    const machineType = stringField(node.data['machineType']);
    if (!LEGACY_MACHINE_PREFIXES.some((prefix) => machineType.startsWith(prefix))) continue;
    insights.push({
      checkId: 'legacy-machine-type',
      severity: 'advisory',
      title: `${node.name} runs on a legacy machine type`,
      detail: `${node.name} uses ${machineType}. Newer families such as e2 and n2 generally offer better price and performance.`,
      resourceId: node.id,
      field: 'machineType',
      suggestion: `Consider an e2 or n2 machine type for ${node.name}.`,
    });
  }
  return insights;
};

export const ALL_CHECKS: InsightCheck[] = [
  openSensitiveIngress,
  autoModeNetwork,
  defaultNetwork,
  legacyMachineType,
];
