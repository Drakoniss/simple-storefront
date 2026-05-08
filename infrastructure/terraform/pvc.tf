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