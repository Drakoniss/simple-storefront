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