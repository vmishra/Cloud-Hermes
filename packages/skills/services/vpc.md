---
id: vpc
displayName: VPC networks
version: 1.1.0
description: Create and inspect VPC networks — the private, global backbone every other resource attaches to. Use when creating a network or asking how a project's networks are arranged.
triggers:
  - create a VPC
  - create a network
  - new VPC network
  - what networks does this project have
  - network topology
  - subnet mode
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
        description: The network name, unique within the project and permanent once created.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: subnetMode
        description: custom (you define every subnet) or auto (one subnet per region). Prefer custom.
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

## Prerequisites

- **API:** the Compute Engine API (`compute.googleapis.com`) must be enabled on
  the project. If a command fails because the API is disabled, tell the user to
  run `gcloud services enable compute.googleapis.com` — Cloud Hermes does not
  enable APIs on its own.
- **IAM:** creating a network needs the **Compute Network Admin** role
  (`roles/compute.networkAdmin`) on the project; describing one needs
  **Compute Network Viewer** (`roles/compute.networkViewer`).

## Best practices

- **Default to `custom` subnet mode.** Auto mode creates a subnet in every
  region with predetermined, overlapping-prone ranges, which leaves addressing
  unplanned. Use auto only when the user explicitly asks for it.
- **One network per environment** — production, staging — is a clean default.
  Stronger isolation is better served by separate projects than by more networks
  inside one.
- A network is **global**; its subnets are **regional**. Plan the network first,
  then carve subnets into it.

> **Day-0 decision.** A network's name and subnet mode are set at creation. The
> name cannot be changed, and switching subnet mode afterwards is disruptive.
> Confirm both with the user before proposing the create.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `subnetMode` — `custom` or `auto`; prefer `custom`.

## Related

Subnets are created into a network — see the `subnet` skill. Firewall rules
apply to a network — see the `firewall` skill.
