---
id: compute-vm
displayName: Compute Engine VMs
version: 1.1.0
description: Create and inspect Compute Engine virtual machine instances. Use when running a VM, choosing a machine type, or asking about the instances already running in the project.
triggers:
  - create a VM
  - create a compute instance
  - launch a server
  - run a virtual machine
  - what instances are running
  - machine type
service: compute
dependsOn: [vpc, subnet]
docs:
  - https://cloud.google.com/compute/docs/instances
  - https://cloud.google.com/compute/docs/instances/create-start-instance
capabilities:
  - resourceType: instances
    verb: create
    classification: CREATE
    gcloudTemplate: "gcloud compute instances create {name} --zone={zone} --machine-type={machineType} --subnet={subnet}"
    terraformTemplate: instance.tf.tmpl
    requiredParams:
      - name: name
        description: The instance name, unique within its zone.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: zone
        description: The zone the instance runs in, e.g. us-central1-a.
        pattern: "^[a-z]+-[a-z]+[0-9]-[a-z]$"
      - name: machineType
        description: The machine type, e.g. e2-medium. Prefer the e2 family by default.
        pattern: "^[a-z0-9]+-[a-z0-9-]+$"
      - name: subnet
        description: The subnet the instance draws its address from; its region must match the zone.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
  - resourceType: instances
    verb: describe
    classification: READ
    gcloudTemplate: "gcloud compute instances describe {name} --zone={zone}"
    requiredParams:
      - name: name
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: zone
        pattern: "^[a-z]+-[a-z]+[0-9]-[a-z]$"
---
# Compute Engine VMs

A VM instance is a virtual machine running in a zone, drawing its private
address from a subnet.

## When to use this skill

Reach for this skill when the user wants to run a virtual machine, or asks
about the instances already running in the project.

## Prerequisites

- **API:** the Compute Engine API (`compute.googleapis.com`) must be enabled.
- **IAM:** creating an instance needs the **Compute Instance Admin (v1)** role
  (`roles/compute.instanceAdmin.v1`); if the instance runs as a non-default
  service account, the caller also needs **Service Account User**
  (`roles/iam.serviceAccountUser`). Describing an instance needs **Compute
  Viewer** (`roles/compute.viewer`).
- **A subnet** in the instance's region must already exist — see the `subnet`
  and `vpc` skills.

## Best practices

- **Default to the `e2` family.** `e2` machine types are the economical
  general-purpose default; reach for `n2` or `c3` only when a workload genuinely
  needs the headroom, and say why.
- **Match region to zone.** A `us-central1-a` instance belongs in a
  `us-central1` subnet — the subnet's region must contain the instance's zone.
- **Name instances for what they are and where they sit.** A name carries
  meaning long after the command that created it is forgotten.

> **Cost note.** A running instance bills continuously. When proposing a create,
> state the machine type plainly so the user is making an informed choice, not
> an accidental one.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `zone` — e.g. `us-central1-a`.
- `machineType` — e.g. `e2-medium`.
- `subnet` — the subnet to place the instance in; its region must match `zone`.

## Related

An instance needs a subnet — see the `subnet` skill — and that subnet needs a
network — see the `vpc` skill. Ingress to the instance is governed by firewall
rules — see the `firewall` skill.
