# T402 Facilitator Infrastructure

## Overview

The T402 Facilitator service supports both single-server Docker Compose deployment and multi-region Kubernetes deployment for high availability.

## Deployment Options

### Option 1: Docker Compose (Single Server)

Best for: Development, small-scale production, cost-sensitive deployments.

```bash
# Development
docker compose up -d

# Production
docker compose -f docker-compose.prod.yaml up -d
```

### Option 2: Kubernetes (Multi-Region)

Best for: High availability, horizontal scaling, geographic distribution.

```bash
# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

## Architecture

### Multi-Region Topology

```
                    ┌─────────────────────┐
                    │   Global DNS/CDN    │
                    │   (Cloudflare)      │
                    └──────────┬──────────┘
                               │
           ┌───────────────────┼───────────────────┐
           │                   │                   │
           ▼                   ▼                   ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │  US-East-1  │     │  EU-West-1  │     │ AP-South-1  │
    │  Cluster    │     │  Cluster    │     │  Cluster    │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
    ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
    │ Facilitator │     │ Facilitator │     │ Facilitator │
    │  (3 pods)   │     │  (3 pods)   │     │  (3 pods)   │
    └──────┬──────┘     └──────┬──────┘     └──────┬──────┘
           │                   │                   │
    ┌──────┴──────┐     ┌──────┴──────┐     ┌──────┴──────┐
    │   Redis     │     │   Redis     │     │   Redis     │
    │  (Primary)  │◄────│  (Replica)  │────►│  (Replica)  │
    └─────────────┘     └─────────────┘     └─────────────┘
```

### Components

| Component | Purpose | Scaling |
|-----------|---------|---------|
| Facilitator | Payment verification/settlement | HPA 3-20 pods |
| PostgreSQL | Persistence, intent state, idempotency | Primary-replica per region |
| Redis | Rate limiting, caching, nonce tracking | StatefulSet with replication |
| Ingress | TLS termination, routing | Per-cluster |
| ServiceMonitor | Prometheus metrics | Per-cluster |
| OpenTelemetry Collector | Distributed tracing | DaemonSet per-node |

## Kubernetes Directory Structure

```
k8s/
├── base/                          # Common resources
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   ├── pdb.yaml
│   ├── networkpolicy.yaml
│   ├── ingress.yaml
│   └── redis.yaml
└── overlays/
    ├── staging/                   # Staging environment
    │   ├── kustomization.yaml
    │   └── patches/
    │       ├── deployment.yaml
    │       ├── configmap.yaml
    │       ├── hpa.yaml
    │       └── ingress.yaml
    └── production/                # Production environment
        ├── kustomization.yaml
        ├── servicemonitor.yaml
        ├── patches/
        │   ├── deployment.yaml
        │   └── hpa.yaml
        └── regions/               # Region-specific configs
            ├── us-east.yaml
            ├── eu-west.yaml
            └── ap-southeast.yaml
```

## Deployment

### Prerequisites

1. **Kubernetes cluster** (v1.28+) in each region
2. **kubectl** configured with cluster access
3. **kustomize** (v5.0+) or kubectl with kustomize support
4. **cert-manager** installed for TLS certificates
5. **ingress-nginx** or similar ingress controller
6. **Prometheus Operator** for ServiceMonitor support

### Deploy to Staging

```bash
# Validate manifests
kubectl kustomize k8s/overlays/staging

# Apply to cluster
kubectl apply -k k8s/overlays/staging

# Verify deployment
kubectl -n t402-staging get pods
kubectl -n t402-staging get svc
```

### Deploy to Production

```bash
# Create secrets first (use external secrets manager in production)
kubectl create secret generic facilitator-secrets \
  --from-env-file=.env.prod \
  -n t402

# Apply base production config
kubectl apply -k k8s/overlays/production

# For region-specific deployment, patch with region config
kubectl patch deployment facilitator -n t402 \
  --patch-file k8s/overlays/production/regions/us-east.yaml
```

### Multi-Region Deployment

For true multi-region deployment, use a GitOps tool like ArgoCD or Flux:

```yaml
# argocd-application.yaml (example)
apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: facilitator
spec:
  generators:
    - list:
        elements:
          - cluster: us-east
            url: https://k8s-us-east.example.com
          - cluster: eu-west
            url: https://k8s-eu-west.example.com
          - cluster: ap-southeast
            url: https://k8s-ap-southeast.example.com
  template:
    metadata:
      name: 'facilitator-{{cluster}}'
    spec:
      project: t402
      source:
        repoURL: https://github.com/t402-io/t402
        targetRevision: main
        path: services/facilitator/k8s/overlays/production
      destination:
        server: '{{url}}'
        namespace: t402
```

## Scaling

### Horizontal Pod Autoscaler

The HPA automatically scales facilitator pods based on CPU/memory:

| Environment | Min Replicas | Max Replicas | CPU Target | Memory Target |
|-------------|--------------|--------------|------------|---------------|
| Staging | 1 | 3 | 70% | 80% |
| Production | 3 | 20 | 70% | 80% |

### Manual Scaling

```bash
# Scale deployment manually
kubectl -n t402 scale deployment facilitator --replicas=5

# View current scale
kubectl -n t402 get hpa
```

## Monitoring

### Prometheus Integration

ServiceMonitor resources are created for Prometheus Operator:

```bash
# View metrics endpoint
kubectl -n t402 port-forward svc/facilitator 8080:80
curl http://localhost:8080/metrics
```

### Key Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `facilitator_requests_total` | Counter | Total HTTP requests |
| `facilitator_request_duration_seconds` | Histogram | Request latency |
| `facilitator_verify_total` | Counter | Verification attempts |
| `facilitator_settle_total` | Counter | Settlement attempts |

## Security

### Network Policies

NetworkPolicy restricts pod-to-pod communication:

- **Ingress**: Only from ingress-nginx namespace and monitoring namespace
- **Egress**: DNS, Redis, and external HTTPS (RPC endpoints)

### Pod Security

- Non-root user (UID 65534)
- Read-only root filesystem
- No privilege escalation
- Dropped ALL capabilities

### Secrets Management

For production, use external secrets manager:

```bash
# AWS Secrets Manager
kubectl apply -f https://raw.githubusercontent.com/external-secrets/external-secrets/main/deploy/crds/bundle.yaml

# Or HashiCorp Vault
helm install vault hashicorp/vault
```

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
kubectl -n t402 describe pod <pod-name>
kubectl -n t402 logs <pod-name>
```

**Health check failures:**
```bash
kubectl -n t402 exec -it <pod-name> -- wget -qO- http://localhost:8080/health
```

**Network connectivity:**
```bash
kubectl -n t402 exec -it <pod-name> -- nc -zv redis 6379
```

### Rollback

```bash
# View rollout history
kubectl -n t402 rollout history deployment/facilitator

# Rollback to previous revision
kubectl -n t402 rollout undo deployment/facilitator

# Rollback to specific revision
kubectl -n t402 rollout undo deployment/facilitator --to-revision=2
```
