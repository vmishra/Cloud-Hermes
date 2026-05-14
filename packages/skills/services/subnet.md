---
id: subnet
displayName: Subnets
version: 1.1.0
description: Create and inspect subnets — the regional IPv4 ranges carved into a VPC. Use when adding addressable space to a network in a region or asking what ranges a network already uses.
triggers:
  - create a subnet
  - add a subnet
  - subnet range
  - CIDR range
  - what IP ranges does this network use
  - regional address space
service: compute
dependsOn: [vpc]
docs:
  - https://cloud.google.com/vpc/docs/subnets
  - https://cloud.google.com/vpc/docs/create-use-subnets
capabilities:
  - resourceType: networks subnets
    verb: create
    classification: CREATE
    gcloudTemplate: "gcloud compute networks subnets create {name} --network={network} --region={region} --range={range}"
    terraformTemplate: subnet.tf.tmpl
    requiredParams:
      - name: name
        description: The subnet name, unique within its region and network.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: network
        description: The VPC network this subnet belongs to.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: region
        description: The region the subnet lives in, e.g. us-central1.
        pattern: "^[a-z]+-[a-z]+[0-9]$"
      - name: range
        description: The primary IPv4 CIDR range, e.g. 10.0.0.0/20. Cannot be shrunk later.
        pattern: "^([0-9]{1,3}[.]){3}[0-9]{1,3}/[0-9]{1,2}$"
  - resourceType: networks subnets
    verb: describe
    classification: READ
    gcloudTemplate: "gcloud compute networks subnets describe {name} --region={region}"
    requiredParams:
      - name: name
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: region
        pattern: "^[a-z]+-[a-z]+[0-9]$"
---
# Subnets

A subnet is a regional slice of a VPC: it owns a primary IPv4 range, and every
instance in the region draws its address from a subnet.

## When to use this skill

Reach for this skill when the user wants to add addressable space to a network
in a region, or asks what ranges a network already uses.

## Prerequisites

- **API:** the Compute Engine API (`compute.googleapis.com`) must be enabled.
- **IAM:** creating a subnet needs the **Compute Network Admin** role
  (`roles/compute.networkAdmin`); describing one needs **Compute Network
  Viewer** (`roles/compute.networkViewer`).
- **A network in `custom` subnet mode** must already exist — see the `vpc`
  skill. Auto-mode networks manage their own subnets.

## Best practices

- **Size the range with headroom.** A `/20` (4,094 usable addresses) is a sane
  default for general regional workloads; go smaller only with a clear reason.
- **Keep ranges from overlapping** — across subnets in the project, and well
  clear of ranges used by peered networks or on-premises, or routing will not
  behave. Read the network's existing subnets before proposing a new range.
- **One subnet per region per network** is usually enough. Reach for a second
  only when a workload genuinely needs range isolation.

> **Day-0 decision.** A subnet's primary range can be *expanded* later but never
> *shrunk*, and the region is fixed at creation. Confirm the range and region
> with the user, and check they do not overlap existing subnets, before
> proposing the create.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `network` — the VPC network to create the subnet in.
- `region` — e.g. `us-central1`.
- `range` — the primary CIDR, e.g. `10.0.0.0/20`.

## Related

A subnet needs a network first — see the `vpc` skill. Instances are placed into
a subnet — see the `compute-vm` skill.
