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

    selector {
      match_labels = {
        type = "sqlite"
      }
    }
  }

  wait_until_bound = false
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

    selector {
      match_labels = {
        type = "uploads"
      }
    }
  }

  wait_until_bound = false
}
