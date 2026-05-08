resource "kubernetes_config_map" "storefront_config" {
  metadata {
    name      = "${var.app_name}-config"
    namespace = var.namespace
  }

  data = {
    NODE_ENV     = "production"
    PORT         = "3001"
    JWT_SECRET   = var.jwt_secret
    DB_PATH      = "/app/data/store.db"
    UPLOADS_PATH = "/app/uploads"
  }
}