# T402 Facilitator Disaster Recovery Plan

## Overview

This document outlines the disaster recovery (DR) procedures for the T402 Facilitator service, including Recovery Time Objectives (RTO), Recovery Point Objectives (RPO), and step-by-step recovery procedures.

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** | 15 minutes | Maximum acceptable downtime |
| **RPO** | 5 minutes | Maximum acceptable data loss |
| **MTTR** | 30 minutes | Mean time to recovery |

## Risk Assessment

### Critical Components

| Component | Impact if Lost | Recovery Priority |
|-----------|---------------|-------------------|
| Facilitator Service | Payment processing halts | P0 - Immediate |
| Hot Wallet Keys | Cannot settle transactions | P0 - Immediate |
| Redis Cache | Rate limiting fails | P1 - High |
| Prometheus Data | Lose historical metrics | P2 - Medium |
| Grafana Dashboards | Lose monitoring visibility | P2 - Medium |

### Failure Scenarios

| Scenario | Probability | Impact | Mitigation |
|----------|-------------|--------|------------|
| Single pod failure | High | None | HPA maintains replicas |
| Single node failure | Medium | Minimal | Pod rescheduling |
| Single region failure | Low | Moderate | Multi-region failover |
| Cloud provider outage | Very Low | High | Multi-cloud deployment |
| Data center failure | Very Low | High | Geographic distribution |
| Key compromise | Very Low | Critical | Key rotation procedure |

## Backup Strategy

### What to Back Up

| Data | Frequency | Retention | Storage |
|------|-----------|-----------|---------|
| Redis data | Every 5 min | 7 days | S3/GCS |
| Prometheus metrics | Every hour | 30 days | S3/GCS |
| Grafana dashboards | On change | Forever | Git |
| Kubernetes secrets | On change | Encrypted | Vault/KMS |
| Configuration | On change | Forever | Git |

### Backup Procedures

#### Redis Backup

```bash
# Manual backup
kubectl -n t402 exec redis-0 -- redis-cli BGSAVE
kubectl -n t402 cp redis-0:/data/dump.rdb ./backups/redis-$(date +%Y%m%d-%H%M%S).rdb

# Automated backup (CronJob)
apiVersion: batch/v1
kind: CronJob
metadata:
  name: redis-backup
  namespace: t402
spec:
  schedule: "*/5 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
            - name: backup
              image: redis:7-alpine
              command:
                - /bin/sh
                - -c
                - |
                  redis-cli -h redis BGSAVE
                  sleep 5
                  aws s3 cp /data/dump.rdb s3://t402-backups/redis/$(date +%Y%m%d-%H%M%S).rdb
          restartPolicy: OnFailure
```

#### Secrets Backup

```bash
# Export secrets (encrypted)
kubectl -n t402 get secret facilitator-secrets -o yaml | \
  kubeseal --format yaml > sealed-secrets-backup.yaml

# Store in secure location
gpg --encrypt --recipient ops@t402.io sealed-secrets-backup.yaml
```

## Recovery Procedures

### Scenario 1: Pod Failure

**Detection:** Kubernetes automatically detects via health checks.

**Automatic Recovery:**
1. Failed pod is terminated
2. Deployment controller creates replacement
3. New pod passes readiness check
4. Traffic routes to new pod

**Manual Intervention (if needed):**
```bash
# Force pod restart
kubectl -n t402 delete pod <pod-name>

# Check replacement
kubectl -n t402 get pods -w
```

**RTO:** < 2 minutes (automatic)

---

### Scenario 2: Node Failure

**Detection:** Node becomes NotReady, pods evicted.

**Automatic Recovery:**
1. Pods rescheduled to healthy nodes
2. PDB ensures minimum availability
3. HPA may scale up if needed

**Manual Intervention:**
```bash
# Cordon failed node
kubectl cordon <node-name>

# Drain remaining pods
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Verify pods rescheduled
kubectl -n t402 get pods -o wide
```

**RTO:** < 5 minutes

---

### Scenario 3: Region Failure

**Detection:** Health checks from global load balancer fail.

**Recovery Steps:**

1. **Verify failure scope:**
   ```bash
   # Check cluster connectivity
   kubectl cluster-info --context=us-east
   kubectl cluster-info --context=eu-west
   ```

2. **Update DNS/Load Balancer:**
   ```bash
   # Cloudflare: Disable failed region in load balancer pool
   curl -X PATCH "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/load_balancers/${LB_ID}" \
     -H "Authorization: Bearer ${CF_TOKEN}" \
     -d '{"fallback_pool": "eu-west-pool"}'
   ```

3. **Scale up healthy regions:**
   ```bash
   # Increase replicas in healthy region
   kubectl --context=eu-west -n t402 scale deployment facilitator --replicas=10
   ```

4. **Monitor recovery:**
   ```bash
   # Watch pod status
   kubectl --context=eu-west -n t402 get pods -w

   # Check service endpoints
   kubectl --context=eu-west -n t402 get endpoints facilitator
   ```

**RTO:** < 15 minutes

---

### Scenario 4: Redis Data Loss

**Detection:** Application errors, rate limiting failures.

**Recovery Steps:**

1. **Stop traffic (optional):**
   ```bash
   kubectl -n t402 scale deployment facilitator --replicas=0
   ```

2. **Restore from backup:**
   ```bash
   # Download latest backup
   aws s3 cp s3://t402-backups/redis/latest.rdb ./dump.rdb

   # Copy to Redis pod
   kubectl -n t402 cp ./dump.rdb redis-0:/data/dump.rdb

   # Restart Redis
   kubectl -n t402 delete pod redis-0
   ```

3. **Verify restoration:**
   ```bash
   kubectl -n t402 exec redis-0 -- redis-cli DBSIZE
   ```

4. **Resume traffic:**
   ```bash
   kubectl -n t402 scale deployment facilitator --replicas=3
   ```

**RPO:** < 5 minutes (backup frequency)
**RTO:** < 10 minutes

---

### Scenario 5: Key Compromise

**CRITICAL: Follow immediately if private keys are compromised.**

**Immediate Actions:**

1. **Revoke compromised keys:**
   ```bash
   # Rotate Kubernetes secrets immediately
   kubectl -n t402 delete secret facilitator-secrets
   ```

2. **Generate new keys:**
   ```bash
   # Generate new EVM key
   cast wallet new

   # Generate new Solana key
   solana-keygen new

   # Generate new TON mnemonic
   tonkeygen
   ```

3. **Transfer funds:**
   ```bash
   # Move funds from compromised wallet to new wallet
   # EVM example:
   cast send --private-key $OLD_KEY $NEW_ADDRESS --value $(cast balance $OLD_ADDRESS)
   ```

4. **Update secrets:**
   ```bash
   kubectl create secret generic facilitator-secrets \
     --from-env-file=.env.new \
     -n t402
   ```

5. **Restart facilitator:**
   ```bash
   kubectl -n t402 rollout restart deployment/facilitator
   ```

6. **Update facilitator wallet addresses:**
   - Update documentation
   - Notify users via status page
   - Update SDK defaults (if applicable)

**RTO:** < 30 minutes
**Note:** Fund recovery depends on speed of response.

---

### Scenario 6: Complete Cluster Loss

**Recovery Steps:**

1. **Provision new cluster:**
   ```bash
   # Using Terraform (example)
   cd infrastructure/terraform
   terraform apply -var="cluster_name=t402-recovery"
   ```

2. **Install prerequisites:**
   ```bash
   # cert-manager
   kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

   # ingress-nginx
   kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
   ```

3. **Restore secrets:**
   ```bash
   # From encrypted backup
   gpg --decrypt sealed-secrets-backup.yaml.gpg | kubectl apply -f -
   ```

4. **Deploy application:**
   ```bash
   kubectl apply -k k8s/overlays/production
   ```

5. **Restore Redis data:**
   ```bash
   # Follow Redis restoration procedure above
   ```

6. **Update DNS:**
   ```bash
   # Point DNS to new cluster load balancer IP
   ```

**RTO:** < 60 minutes

## Communication Plan

### Internal Escalation

| Severity | Response Time | Escalation Path |
|----------|---------------|-----------------|
| P0 (Critical) | Immediate | On-call → Engineering Lead → CTO |
| P1 (High) | 15 minutes | On-call → Engineering Lead |
| P2 (Medium) | 1 hour | On-call |
| P3 (Low) | 24 hours | Regular triage |

### External Communication

1. **Status Page Update:** https://status.t402.io
2. **Twitter/X:** @t402protocol
3. **Discord:** #announcements channel

### Incident Template

```markdown
## Incident: [TITLE]

**Status:** Investigating | Identified | Monitoring | Resolved
**Severity:** P0 | P1 | P2 | P3
**Started:** YYYY-MM-DD HH:MM UTC
**Resolved:** YYYY-MM-DD HH:MM UTC

### Summary
[Brief description of the incident]

### Impact
[Services affected, user impact]

### Timeline
- HH:MM - [Event]
- HH:MM - [Event]

### Root Cause
[What caused the incident]

### Resolution
[How it was fixed]

### Prevention
[Steps to prevent recurrence]
```

## Testing

### DR Drill Schedule

| Test | Frequency | Last Run | Next Run |
|------|-----------|----------|----------|
| Pod failure recovery | Monthly | - | - |
| Node failure simulation | Quarterly | - | - |
| Region failover | Semi-annually | - | - |
| Full DR exercise | Annually | - | - |
| Backup restoration | Monthly | - | - |

### Chaos Engineering

Use chaos engineering tools to regularly test resilience:

```bash
# Install Chaos Mesh
kubectl apply -f https://mirrors.chaos-mesh.org/latest/chaos-mesh.yaml

# Pod failure experiment
kubectl apply -f - <<EOF
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: facilitator-pod-kill
  namespace: t402
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces:
      - t402
    labelSelectors:
      app.kubernetes.io/name: facilitator
  scheduler:
    cron: "@hourly"
EOF
```

## Contacts

| Role | Name | Contact |
|------|------|---------|
| On-call Primary | - | PagerDuty |
| On-call Secondary | - | PagerDuty |
| Engineering Lead | - | - |
| Cloud Provider Support | AWS/GCP | Support portal |

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-20 | - | Initial version |

---

**Review Schedule:** Quarterly or after any major incident.
