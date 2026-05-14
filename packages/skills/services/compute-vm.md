---
id: compute-vm
displayName: Compute Engine VMs
description: Create and inspect Compute Engine virtual machine instances.
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
        description: The machine type, e.g. e2-medium.
        pattern: "^[a-z0-9]+-[a-z0-9-]+$"
      - name: subnet
        description: The subnet the instance draws its address from.
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

## Best practices

- Match the machine type to the workload. `e2` types are the economical default
  for general-purpose work; reach for `n2` or `c3` only when a workload needs
  the headroom.
- Place an instance in a subnet whose region matches the instance's zone — a
  `us-central1-a` instance belongs in a `us-central1` subnet.
- Name instances for what they are and where they sit. A name carries meaning
  long after the command that created it is forgotten.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `zone` — e.g. `us-central1-a`.
- `machineType` — e.g. `e2-medium`.
- `subnet` — the subnet to place the instance in; its region must match `zone`.

## Related

An instance needs a subnet — see the `subnet` skill — and that subnet needs a
network — see the `vpc` skill. Ingress to the instance is governed by firewall
rules — see the `firewall` skill.
