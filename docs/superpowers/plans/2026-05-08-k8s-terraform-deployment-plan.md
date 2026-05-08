# Kubernetes Terraform Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy StoreFront application to Kubernetes using Terraform with Docker containerization, persistent volumes, and LoadBalancer exposure.

**Architecture:** Single-replica Node.js Deployment with two PVCs (SQLite data + uploads), ConfigMap for environment variables, and a LoadBalancer Service. Container image built from Alpine-based Dockerfile and pushed to Docker Hub.

**Tech Stack:** Docker, Terraform (hashicorp/kubernetes provider), Kubernetes

---

## File Structure

```
storefront/
├── Dockerfile
├── deploy.sh
└── infrastructure/
    └── terraform/
        ├── providers.tf
        ├── configmap.tf
        ├── pvc.tf
        ├── deployment.tf
        └── service.tf
```

---

### Task 1: Create Dockerfile

**Files:**
- Create: `storefront/Dockerfile`

- [ ] **Step 1: Write Dockerfile**

```dockerfile
# Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY server/ ./server/
COPY client/ ./client/
COPY data/ ./data/

# Create directories for persistent volumes
RUN mkdir -p /app/data /app/uploads

# Expose application port
EXPOSE 3001

# Start application
CMD ["node", "server/index.js"]
```

- [ ] **Step 2: Verify Dockerfile syntax**

Run: `docker build -f Dockerfile --no-cache -t test-build .`
Expected: Build completes successfully or fails with expected error (no network)

- [ ] **Step 3: Commit**

```bash
git add Dockerfile
git commit -m "feat: add Dockerfile for containerized deployment"
```

---

### Task 2: Create Terraform Provider Configuration

**Files:**
- Create: `storefront/infrastructure/terraform/providers.tf`

- [ ] **Step 1: Create infrastructure directory**

```bash
mkdir -p /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
```

- [ ] **Step 2: Write providers.tf**

```hcl
terraform {
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
  }
}

provider "kubernetes" {
  config_path    = "~/.kube/config"
  config_context = "lab-citic-admin@lab-citic"
}

variable "namespace" {
  description = "Kubernetes namespace"
  type        = string
  default     = "storefront"
}

variable "app_name" {
  description = "Application name"
  type        = string
  default     = "storefront"
}

variable "image" {
  description = "Docker image"
  type        = string
  default     = "rasprilla/storefront:latest"
}

variable "jwt_secret" {
  description = "JWT secret for token generation"
  type        = string
  default     = "storefront-jwt-secret-2024"
}
```

- [ ] **Step 3: Initialize Terraform**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform init
```

Expected: Provider plugins downloaded successfully

- [ ] **Step 4: Verify provider config**

```bash
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 5: Commit**

```bash
git add infrastructure/terraform/providers.tf
git commit -m "feat: add Terraform provider configuration"
```

---

### Task 3: Create ConfigMap

**Files:**
- Create: `storefront/infrastructure/terraform/configmap.tf`

- [ ] **Step 1: Write configmap.tf**

```hcl
resource "kubernetes_config_map" "storefront_config" {
  metadata {
    name      = "${var.app_name}-config"
    namespace = var.namespace
  }

  data = {
    NODE_ENV      = "production"
    PORT          = "3001"
    JWT_SECRET    = var.jwt_secret
    DB_PATH       = "/app/data/store.db"
    UPLOADS_PATH  = "/app/uploads"
  }
}
```

- [ ] **Step 2: Validate Terraform**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add infrastructure/terraform/configmap.tf
git commit -m "feat: add Terraform ConfigMap for environment variables"
```

---

### Task 4: Create Persistent Volume Claims

**Files:**
- Create: `storefront/infrastructure/terraform/pvc.tf`

- [ ] **Step 1: Write pvc.tf**

```hcl
resource "kubernetes_persistent_volume_claim" "sqlite_data" {
  metadata {
    name      = "sqlite-data"
    namespace = var.namespace
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "1Gi"
      }
    }

    storage_class_name = "standard"
  }
}

resource "kubernetes_persistent_volume_claim" "uploads_data" {
  metadata {
    name      = "uploads-data"
    namespace = var.namespace
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "2Gi"
      }
    }

    storage_class_name = "standard"
  }
}
```

- [ ] **Step 2: Validate Terraform**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add infrastructure/terraform/pvc.tf
git commit -m "feat: add Terraform PVCs for SQLite and uploads"
```

---

### Task 5: Create Deployment

**Files:**
- Create: `storefront/infrastructure/terraform/deployment.tf`

- [ ] **Step 1: Write deployment.tf**

```hcl
resource "kubernetes_deployment" "storefront_app" {
  metadata {
    name      = "${var.app_name}-app"
    namespace = var.namespace
    labels = {
      app = var.app_name
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = var.app_name
      }
    }

    template {
      metadata {
        labels = {
          app = var.app_name
        }
      }

      spec {
        container {
          name  = var.app_name
          image = var.image
          image_pull_policy = "Always"

          port {
            container_port = 3001
          }

          env_from {
            config_map_ref {
              name = kubernetes_config_map.storefront_config.metadata[0].name
            }
          }

          volume_mount {
            name       = "sqlite-data"
            mount_path = "/app/data"
          }

          volume_mount {
            name       = "uploads-data"
            mount_path = "/app/uploads"
          }

          liveness_probe {
            http_get {
              path = "/api/products"
              port = 3001
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            http_get {
              path = "/api/products"
              port = 3001
            }
            initial_delay_seconds = 10
            period_seconds        = 5
            timeout_seconds       = 3
            failure_threshold     = 3
          }
        }

        volume {
          name = "sqlite-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.sqlite_data.metadata[0].name
          }
        }

        volume {
          name = "uploads-data"
          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.uploads_data.metadata[0].name
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Validate Terraform**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add infrastructure/terraform/deployment.tf
git commit -m "feat: add Terraform Deployment with health checks"
```

---

### Task 6: Create Service

**Files:**
- Create: `storefront/infrastructure/terraform/service.tf`

- [ ] **Step 1: Write service.tf**

```hcl
resource "kubernetes_service" "storefront_svc" {
  metadata {
    name      = "${var.app_name}-svc"
    namespace = var.namespace
  }

  spec {
    type = "LoadBalancer"

    selector = {
      app = var.app_name
    }

    port {
      port        = 80
      target_port = 3001
      protocol    = "TCP"
    }
  }
}
```

- [ ] **Step 2: Validate Terraform**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform validate
```

Expected: `Success! The configuration is valid.`

- [ ] **Step 3: Commit**

```bash
git add infrastructure/terraform/service.tf
git commit -m "feat: add Terraform LoadBalancer Service"
```

---

### Task 7: Create Deploy Script

**Files:**
- Create: `storefront/deploy.sh`

- [ ] **Step 1: Write deploy.sh**

```bash
#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== StoreFront Kubernetes Deploy ===${NC}"

# Check kubeconfig
if [ ! -f ~/.kube/config ]; then
    echo -e "${RED}Error: ~/.kube/config not found${NC}"
    exit 1
fi

# Check docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker not installed${NC}"
    exit 1
fi

# Check terraform
if ! command -v terraform &> /dev/null; then
    echo -e "${RED}Error: Terraform not installed${NC}"
    exit 1
fi

# Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
cd "$(dirname "$0")"
docker build -t rasprilla/storefront:latest .

# Push to Docker Hub
echo -e "${YELLOW}Pushing to Docker Hub...${NC}"
if [ -z "$DOCKER_USERNAME" ] || [ -z "$DOCKER_PASSWORD" ]; then
    echo -e "${YELLOW}Warning: DOCKER_USERNAME or DOCKER_PASSWORD not set. Assuming already logged in.${NC}"
else
    echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin
fi
docker push rasprilla/storefront:latest

# Apply Terraform
echo -e "${YELLOW}Applying Terraform...${NC}"
cd infrastructure/terraform
terraform init
terraform apply -auto-approve

# Show status
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo -e "${YELLOW}Pods:${NC}"
kubectl get pods -n storefront
echo -e "${YELLOW}Service:${NC}"
kubectl get svc -n storefront

echo -e "${GREEN}Waiting for LoadBalancer IP...${NC}"
sleep 5
kubectl get svc storefront-svc -n storefront -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
echo
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/deploy.sh
```

- [ ] **Step 3: Verify script syntax**

```bash
bash -n /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/deploy.sh
echo $?
```

Expected: `0` (no syntax errors)

- [ ] **Step 4: Commit**

```bash
git add deploy.sh
git commit -m "feat: add deploy script for Docker build and Terraform apply"
```

---

### Task 8: Plan and Verify

**Files:**
- Test: `storefront/infrastructure/terraform/` (all files)

- [ ] **Step 1: Run Terraform plan**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/infrastructure/terraform
terraform plan
```

Expected: Shows plan with 6 resources to create (ConfigMap, 2 PVCs, Deployment, Service)

- [ ] **Step 2: Verify namespace exists**

```bash
kubectl get namespace storefront
```

Expected: `storefront` namespace is listed as Active

- [ ] **Step 3: Check storage class**

```bash
kubectl get storageclass
```

Expected: At least one StorageClass exists (e.g., `standard`)

- [ ] **Step 4: Commit plan output (optional)**

```bash
cd /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront
git add infrastructure/terraform/.terraform* infrastructure/terraform/terraform.tfstate 2>/dev/null || true
git commit -m "chore: add Terraform state after plan" || echo "No state changes to commit"
```

---

### Task 9: Update .gitignore for Terraform

**Files:**
- Modify: `storefront/.gitignore` (or create)

- [ ] **Step 1: Check if .gitignore exists**

```bash
cat /home/drakoniss/Desarrollo/Apps/simple-storefront/storefront/.gitignore 2>/dev/null || echo "No .gitignore found"
```

- [ ] **Step 2: Add Terraform entries**

If `.gitignore` exists, append:
```
# Terraform
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
*.tfvars
```

If not, create:
```
node_modules/
*.log

# Terraform
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
*.tfvars
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add Terraform to .gitignore"
```

---

## Self-Review

**1. Spec coverage:**
- Dockerfile: Task 1
- Terraform provider: Task 2
- ConfigMap: Task 3
- PVCs (sqlite + uploads): Task 4
- Deployment with health checks: Task 5
- LoadBalancer Service: Task 6
- Deploy script: Task 7
- Terraform state/.gitignore: Task 8-9

**2. Placeholder scan:**
- No TBD, TODO, or incomplete sections
- All files have exact paths and complete code
- All validation steps included

**3. Type consistency:**
- Variable names consistent across all tf files
- Namespace always `var.namespace`
- App name always `var.app_name`

**Plan complete and saved.**
