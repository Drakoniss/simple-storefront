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
            tcp_socket {
              port = 3001
            }
            initial_delay_seconds = 30
            period_seconds        = 10
            timeout_seconds       = 5
            failure_threshold     = 3
          }

          readiness_probe {
            tcp_socket {
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