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