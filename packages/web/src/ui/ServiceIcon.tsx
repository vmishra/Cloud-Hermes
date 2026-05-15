/**
 * Service iconography — the official Google Cloud category icons.
 *
 * `ServiceIcon` takes a resource-graph node kind, a gcloud service, or a Cloud
 * Asset Inventory `assetType` (e.g. `storage.googleapis.com/Bucket`) and renders
 * the matching Google Cloud category icon. The icons are colour SVGs served
 * from `public/icons/gcp/`.
 */

/** Maps any resource key — kind, service, or assetType — to a category slug. */
function categoryFor(key: string): string {
  const k = key.toLowerCase();
  if (
    k.includes('network') ||
    k.includes('subnet') ||
    k.includes('firewall') ||
    k.includes('vpc') ||
    k.includes('route') ||
    k.includes('dns') ||
    k.includes('loadbalanc')
  ) {
    return 'networking';
  }
  if (k.includes('run') || k.includes('function') || k.includes('appengine')) {
    return 'serverless-computing';
  }
  if (
    k.includes('gke') ||
    k.includes('kubernetes') ||
    k.includes('container') ||
    k.includes('artifactregistry')
  ) {
    return 'containers';
  }
  if (
    k.includes('sql') ||
    k.includes('spanner') ||
    k.includes('firestore') ||
    k.includes('bigtable') ||
    k.includes('alloydb') ||
    k.includes('memorystore') ||
    k.includes('redis') ||
    k.includes('database')
  ) {
    return 'databases';
  }
  if (k.includes('storage') || k.includes('bucket') || k.includes('filestore')) {
    return 'storage';
  }
  if (
    k.includes('bigquery') ||
    k.includes('dataflow') ||
    k.includes('dataproc') ||
    k.includes('pubsub') ||
    k.includes('analytics')
  ) {
    return 'data-analytics';
  }
  if (
    k.includes('aiplatform') ||
    k.includes('vertex') ||
    k.includes('gemini') ||
    k.includes('notebook') ||
    k.includes('ml')
  ) {
    return 'ai-machine-learning';
  }
  if (
    k.includes('iam') ||
    k.includes('security') ||
    k.includes('kms') ||
    k.includes('secret') ||
    k.includes('certificate')
  ) {
    return 'security-identity';
  }
  if (
    k.includes('logging') ||
    k.includes('monitoring') ||
    k.includes('trace') ||
    k.includes('error') ||
    k.includes('observ')
  ) {
    return 'observability';
  }
  if (k.includes('project') || k.includes('resourcemanager') || k.includes('billing')) {
    return 'management-tools';
  }
  if (k.includes('instance') || k.includes('compute') || k.includes('disk') || k === 'vm') {
    return 'compute';
  }
  // A sensible default for an unrecognized Google Cloud resource.
  return 'compute';
}

export function ServiceIcon({
  kind,
  size = 16,
  className,
}: {
  kind: string;
  size?: number;
  className?: string;
}) {
  return (
    <img
      src={`/icons/gcp/${categoryFor(kind)}.svg`}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      className={className}
      style={{ display: 'block' }}
    />
  );
}
