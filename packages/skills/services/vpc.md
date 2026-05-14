---
id: vpc
displayName: VPC networks
description: Create and inspect VPC networks — a project's private network backbone.
service: compute
dependsOn: []
docs:
  - https://cloud.google.com/vpc/docs/vpc
  - https://cloud.google.com/vpc/docs/create-modify-vpc-networks
capabilities:
  - resourceType: networks
    verb: create
    classification: CREATE
    gcloudTemplate: "gcloud compute networks create {name} --subnet-mode={subnetMode}"
    terraformTemplate: network.tf.tmpl
    requiredParams:
      - name: name
        description: The network name, unique within the project.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: subnetMode
        description: custom (you define every subnet) or auto (one subnet per region).
        oneOf: [custom, auto]
  - resourceType: networks
    verb: describe
    classification: READ
    gcloudTemplate: "gcloud compute networks describe {name}"
    requiredParams:
      - name: name
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
---
# VPC networks

A VPC network is the private, global backbone every other resource attaches to.
It carries no IP ranges itself — those belong to its subnets.

## When to use this skill

Reach for this skill when the user wants to create a network, or asks how the
networks in the project are arranged.

## Best practices

- Prefer **custom** subnet mode. Auto mode creates a subnet in every region
  with predetermined ranges, which is rarely what a considered design wants —
  it leaves unused ranges and removes the chance to plan addressing.
- One network per environment — production, staging — is a clean default.
  Stronger isolation is better served by separate projects than by more
  networks.
- A network is global; its subnets are regional. Plan the network first, then
  carve subnets into it.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `subnetMode` — `custom` or `auto`; prefer `custom`.

## Related

Subnets are created into a network — see the `subnet` skill. Firewall rules
apply to a network — see the `firewall` skill.
