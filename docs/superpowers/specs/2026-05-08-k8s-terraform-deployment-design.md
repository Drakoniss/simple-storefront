# Diseño: Despliegue StoreFront con Terraform a Kubernetes

**Fecha:** 2026-05-08
**Estado:** Aprobado para implementación

---

## Resumen

Desplegar la aplicación StoreFront (Node.js/Express + SQLite + frontend vanilla JS) en un cluster Kubernetes existente usando Terraform. Incluye creación de Dockerfile, volumenes persistentes para SQLite y uploads, exposición vía LoadBalancer, y registry Docker Hub.

---

## Contexto

- **Aplicación**: Node.js/Express, SQLite, frontend vanilla JS
- **Cluster**: Kubernetes `lab-citic` (1 control plane + 2 workers)
- **Kubeconfig**: `~/.kube/config`
- **Namespace**: `storefront` (ya creado)
- **Exposición**: LoadBalancer (puerto 3001)
- **Registry**: Docker Hub (`rasprilla/storefront:latest`)

---

## Arquitectura

```
Namespace: storefront
├── Deployment: storefront-app (1 réplica, escalable)
│   ├── Container: storefront (Node.js, puerto 3001)
│   ├── PVC Mount: /app/data (SQLite)
│   └── PVC Mount: /app/uploads (archivos subidos)
├── Service: storefront-svc (LoadBalancer, puerto 80 → 3001)
├── ConfigMap: storefront-config (variables de entorno)
├── PVC: sqlite-data (1Gi, ReadWriteOnce)
└── PVC: uploads-data (2Gi, ReadWriteOnce)
```

---

## 1. Dockerfile

**Ubicación**: `storefront/Dockerfile`

**Base image**: `node:20-alpine`

**Estrategia**: Multi-stage build (aunque es simple, alpine es ligero)

**Pasos**:
1. Copiar `package.json` e instalar dependencias
2. Copiar código fuente (server/, client/, data/)
3. Exponer puerto 3001
4. Comando: `node server/index.js`

**Consideraciones**:
- SQLite se ejecuta dentro del contenedor, datos persistentes en PVC
- Directorio `data/` contiene la base de datos SQLite inicial
- Directorio `uploads/` para archivos subidos por usuarios
- No incluir `node_modules` ni archivos de desarrollo en la imagen

---

## 2. Terraform

**Ubicación**: `storefront/infrastructure/terraform/`

**Provider**: `hashicorp/kubernetes` (usando kubeconfig local)

**Archivos**:
```
infrastructure/terraform/
├── providers.tf      (provider kubernetes + variables)
├── configmap.tf      (variables de entorno)
├── pvc.tf            (volumenes persistentes)
├── deployment.tf     (deployment de la app)
└── service.tf        (servicio LoadBalancer)
```

### 2.1 providers.tf

Configuración del provider Kubernetes leyendo `~/.kube/config`:
- `config_path = "~/.kube/config"`
- `config_context = "lab-citic-admin@lab-citic"`

### 2.2 configmap.tf

ConfigMap `storefront-config` con variables:
- `NODE_ENV=production`
- `PORT=3001`
- `JWT_SECRET` (secreto fijo para reproducibilidad)
- `DB_PATH=/app/data/store.db`
- `UPLOADS_PATH=/app/uploads`

### 2.3 pvc.tf

Dos PVCs:

**sqlite-data**:
- Storage: 1Gi
- AccessMode: ReadWriteOnce
- StorageClass: `standard` (default del cluster)
- ReclaimPolicy: Retain

**uploads-data**:
- Storage: 2Gi
- AccessMode: ReadWriteOnce
- StorageClass: `standard`
- ReclaimPolicy: Retain

### 2.4 deployment.tf

Deployment `storefront-app`:
- Réplicas: 1 (SQLite no soporta escritura concurrente)
- Selector: `app=storefront`
- Container:
  - Image: `rasprilla/storefront:latest`
  - ImagePullPolicy: `Always`
  - Port: 3001
  - EnvFrom: ConfigMap `storefront-config`
  - VolumeMounts:
    - `sqlite-data` → `/app/data`
    - `uploads-data` → `/app/uploads`
- Volumes:
  - `sqlite-data` (PVC)
  - `uploads-data` (PVC)
- Probes:
  - Liveness: HTTP GET `/api/products` (puerto 3001), initialDelay 30s
  - Readiness: HTTP GET `/api/products` (puerto 3001), initialDelay 10s

### 2.5 service.tf

Service `storefront-svc`:
- Type: LoadBalancer
- Selector: `app=storefront`
- Port: 80 (external) → 3001 (target)
- Protocol: TCP

---

## 3. Script de Build y Deploy

**Ubicación**: `storefront/deploy.sh`

**Pasos**:
1. Verificar kubeconfig disponible
2. Construir imagen Docker: `docker build -t rasprilla/storefront:latest .`
3. Push a Docker Hub: `docker push rasprilla/storefront:latest`
4. Aplicar Terraform: `terraform apply -auto-approve`
5. Mostrar IP externa del LoadBalancer

**Variables de entorno necesarias**:
- `DOCKER_USERNAME` (para login a Docker Hub)
- `DOCKER_PASSWORD` (para login a Docker Hub)

---

## 4. Persistentes

### SQLite (1Gi)
- **Razón**: SQLite es un archivo en disco. Si el pod se recrea sin PVC, los datos se pierden.
- **Mount**: `/app/data/`
- **Backup**: No incluido en esta fase

### Uploads (2Gi)
- **Razón**: Archivos subidos por usuarios (importaciones, recibos)
- **Mount**: `/app/uploads/`
- **Cleanup**: No incluido en esta fase

---

## 5. Variables de Entorno

| Variable | Valor | Descripción |
|----------|-------|-------------|
| NODE_ENV | production | Modo producción |
| PORT | 3001 | Puerto de la aplicación |
| JWT_SECRET | [fijo] | Secreto para tokens JWT |
| DB_PATH | /app/data/store.db | Ruta de la base de datos |
| UPLOADS_PATH | /app/uploads | Ruta de uploads |

---

## 6. Health Checks

**Liveness Probe**:
- Path: `/api/products`
- Port: 3001
- Initial delay: 30s
- Period: 10s
- Timeout: 5s
- Failure threshold: 3

**Readiness Probe**:
- Path: `/api/products`
- Port: 3001
- Initial delay: 10s
- Period: 5s
- Timeout: 3s
- Failure threshold: 3

---

## 7. Consideraciones

- **SQLite no escala horizontalmente**: Solo 1 réplica permitida
- **JWT_SECRET**: Usar valor fijo para reproducibilidad. En producción real, usar secretos externos (Vault, Sealed Secrets)
- **Image pull**: Docker Hub puede tener rate limits. Para uso frecuente, considerar registry privado
- **Backup**: No incluido. SQLite backup puede ser copia del archivo `.db`
- **SSL/TLS**: No incluido. LoadBalancer expone HTTP. Para HTTPS, añadir cert-manager + Ingress
- **Resource limits**: No definidos. Añadir si el cluster tiene resource quotas

---

## 8. Archivos a Crear

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

## 9. Comandos de Verificación

Después del deploy:
```bash
kubectl get pods -n storefront
kubectl get svc -n storefront
kubectl logs -n storefront deployment/storefront-app
```

---

## Aprobación

- [x] Dockerfile
- [x] Terraform provider
- [x] ConfigMap
- [x] PVCs (sqlite + uploads)
- [x] Deployment
- [x] Service (LoadBalancer)
- [x] Script de deploy
- [x] Health checks
- [x] Documentación

**Aprobado por:** Usuario
**Fecha de aprobación:** 2026-05-08
