---
id: firewall
displayName: Firewall rules
description: Create, inspect, and tighten VPC firewall rules.
service: compute
dependsOn: [vpc]
docs:
  - https://cloud.google.com/firewall/docs/firewalls
  - https://cloud.google.com/firewall/docs/using-firewalls
capabilities:
  - resourceType: firewall-rules
    verb: create
    classification: CREATE
    gcloudTemplate: "gcloud compute firewall-rules create {name} --network={network} --direction={direction} --action=ALLOW --rules={rules} --source-ranges={sourceRanges}"
    terraformTemplate: firewall.tf.tmpl
    requiredParams:
      - name: name
        description: The firewall rule name, unique within the project.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: network
        description: The VPC network the rule applies to.
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: direction
        description: INGRESS (into resources) or EGRESS (out of them).
        oneOf: [INGRESS, EGRESS]
      - name: rules
        description: Protocol and ports, e.g. tcp:22 or tcp:80,tcp:443.
        pattern: "^[a-z0-9:,-]+$"
      - name: sourceRanges
        description: Comma-separated CIDR ranges the rule applies to.
        pattern: "^[0-9.,/ ]+$"
  - resourceType: firewall-rules
    verb: describe
    classification: READ
    gcloudTemplate: "gcloud compute firewall-rules describe {name}"
    requiredParams:
      - name: name
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
  - resourceType: firewall-rules
    verb: update
    classification: UPDATE
    gcloudTemplate: "gcloud compute firewall-rules update {name} --source-ranges={sourceRanges}"
    flagDenylist: ["--clear-", "--no-"]
    requiredParams:
      - name: name
        pattern: "^[a-z]([-a-z0-9]{0,61}[a-z0-9])?$"
      - name: sourceRanges
        description: The replacement set of source CIDR ranges.
        pattern: "^[0-9.,/ ]+$"
---
# Firewall rules

A firewall rule decides which traffic may reach or leave the resources on a
network. Rules are stateful and evaluated by priority.

## When to use this skill

Reach for this skill when the user wants to allow traffic to a resource, asks
what is currently permitted, or wants to narrow an existing rule.

## Best practices

- Scope source ranges as tightly as the use allows. `0.0.0.0/0` on a
  management port such as SSH (`tcp:22`) or RDP (`tcp:3389`) is an exposure to
  call out, not a default.
- Prefer rules that target specific resources over broad network-wide rules —
  a rule should describe an intent, not a blanket.
- Updating a rule's source ranges replaces the whole set. Read the current rule
  first so the change is deliberate, not accidental.

## Parameters

- `name` — lowercase, may contain hyphens, 1–63 characters.
- `network` — the VPC network the rule applies to.
- `direction` — `INGRESS` or `EGRESS`.
- `rules` — protocol and ports, e.g. `tcp:22` or `tcp:80,tcp:443`.
- `sourceRanges` — comma-separated CIDR ranges.

## Related

A firewall rule applies to a network — see the `vpc` skill. It governs traffic
to instances — see the `compute-vm` skill.
