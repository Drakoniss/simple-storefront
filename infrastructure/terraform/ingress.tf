resource "kubernetes_ingress_v1" "storefront_ingress" {
  metadata {
    name      = "${var.app_name}-ingress"
    namespace = var.namespace
    annotations = {
      "nginx.ingress.kubernetes.io/rewrite-target" = "/"
    }
  }

  spec {
    ingress_class_name = "nginx"

    rule {
      host = "storefront.citic.internal"

      http {
        path {
          path = "/"

          backend {
            service {
              name = kubernetes_service.storefront_svc.metadata[0].name
              port {
                number = 80
              }
            }
          }
        }
      }
    }
  }
}
