---
id: subnet
displayName: Subnets
description: Create and inspect subnets — the regional IP ranges carved into a VPC.
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
        description: The primary IPv4 CIDR range, e.g. 10.0.0.0/20.
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

## Best practices

- Size the range for the region's expected footprint, then leave headroom — a
  `/20` (4,094 usable addresses) is a sane default for general workloads.
- Keep ranges from overlapping across subnets, and well clear of ranges used by
  peered networks or on-premises, or routing will not behave.
- One subnet per region per network is usually enough; reach for a second only
  when a workload genuinely needs range isolation.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `network` — the VPC network to create the subnet in.
- `region` — e.g. `us-central1`.
- `range` — the primary CIDR, e.g. `10.0.0.0/20`.

## Related

A subnet needs a network first — see the `vpc` skill. Instances are placed into
a subnet — see the `compute-vm` skill.
