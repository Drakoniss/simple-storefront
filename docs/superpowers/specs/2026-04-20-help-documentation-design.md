# Diseño: Sección de Ayuda - StoreFront

**Fecha:** 2026-04-20
**Estado:** Aprobado para implementación

---

## Resumen

Agregar una entrada de menú "Ayuda" al final del menú principal con documentación detallada de todos los elementos de la aplicación, tutoriales paso a paso, FAQ, glosario, atajos de teclado y solución de problemas.

---

## Fases de Implementación

- **Fase 1:** Página única con navegación lateral (este documento)
- **Fase 2:** Sub-páginas separadas para cada sección (futuro)

---

## 1. Estructura del Menú

**Ubicación:** Al final del sidebar, después de Settings

**Código:**
```html
<li class="nav-item" data-page="help">
    <i class="fas fa-question-circle"></i>
    <span>Ayuda</span>
</li>
```

**Icono:** `fa-question-circle` (Font Awesome)

---

## 2. Layout de la Página

```
┌─────────────────────────────────────────────────────────────┐
│  📚 Ayuda                                    [Buscar ayuda] │
├──────────────┬──────────────────────────────────────────────┤
│   ÍNDICE     │  CONTENIDO PRINCIPAL                        │
│   (sticky)   │  (scrollable)                               │
│              │                                              │
│   ▸ General  │  [Sección seleccionada]                     │
│   ▸ Módulos  │                                              │
│   ▸ Tutoriales│  - Texto explicativo                        │
│   ▸ FAQ      │  - Pasos numerados                          │
│   ▸ Glosario │  - Tablas                                   │
│   ▸ Atajos   │  - Acordeones                               │
│   ▸ Problemas│                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Responsive:** En móvil, índice colapsable como dropdown.

---

## 3. Secciones del Índice

| Sección | Contenido |
|---------|-----------|
| **General** | Introducción, requisitos, login, navegación básica |
| **Módulos** | Dashboard, POS, Productos, Inventario, Ventas, Órdenes, Clientes, Proveedores, Reportes, Usuarios, Configuración |
| **Tutoriales** | Crear venta, Agregar producto, Ajustar inventario, Crear cliente, Procesar orden, Generar reportes |
| **FAQ** | Preguntas frecuentes por categoría (acordeón) |
| **Glosario** | ~25-30 términos con definiciones (tabla) |
| **Atajos** | Atajos de teclado por contexto (tarjetas) |
| **Problemas** | Solución de problemas y errores comunes |

---

## 4. Estructura por Módulo

Cada módulo incluye:

```markdown
## [Nombre del Módulo]

### Descripción
[Breve descripción del propósito]

### Funcionalidades
- [Lista de funcionalidades principales]

### Campos y Elementos
| Campo | Descripción |
|-------|-------------|
| [campo] | [descripción] |

### Tutoriales Relacionados
→ Ver: "[Nombre del tutorial]"
```

**Módulos a documentar:** Dashboard, POS, Productos, Inventario, Ventas, Órdenes, Clientes, Proveedores, Reportes, Usuarios, Configuración.

---

## 5. Estructura de Tutoriales

```markdown
## [Título del Tutorial]

### Objetivo
[Qué aprenderá el usuario]

### Pasos
1️⃣ **[Título del paso]**
   - [Detalle]
   - [Detalle]

2️⃣ **[Título del paso]**
   - [Detalle]

### Resultado esperado
[Qué sucede al completar]

### Ver también
→ [Enlaces relacionados]
```

**Tutoriales incluidos:**
1. Crear una venta en el POS
2. Agregar un nuevo producto
3. Ajustar inventario manualmente
4. Crear un nuevo cliente
5. Procesar una orden de catálogo
6. Generar reportes de ventas
7. Importar productos masivamente

---

## 6. Estructura de FAQ

**Formato:** Acordeón expandible por categoría

**Categorías:**
- Inicio de Sesión y Cuentas
- Productos e Inventario
- Ventas y Órdenes
- Clientes
- Reportes
- Sistema

**Cada pregunta:**
```html
<details>
<summary>❓ ¿Pregunta?</summary>
[Respuesta detallada]
</details>
```

**FAQs incluidas:** ~15-20 preguntas frecuentes.

---

## 7. Glosario de Términos

**Formato:** Tabla con búsqueda/filtrado

**Términos incluidos:**
- SKU, POS, Walk-in, Stock, Low Stock, Receipt
- Loyalty Points, Batch Import, Void, Markup
- Tax Rate, Dashboard, Backorder
- Cost Price, Selling Price, Profit Margin
- Inventory Transaction, Stock Count, Stock Adjustment
- Customer, Supplier, Category
- Role, Permission, JWT Token
- Modal, Sidebar, Pagination

**Total:** ~25-30 términos.

---

## 8. Atajos de Teclado

**Agrupados por contexto:**

### Navegación General
- `Ctrl + K` - Abrir búsqueda global
- `Esc` - Cerrar modal/volver
- `Tab` - Navegar entre campos

### En el POS
- `Enter` - Buscar producto / Confirmar venta
- `F2` - Seleccionar cliente
- `F4` - Limpiar carrito
- `F8` - Completar venta
- `Delete` - Eliminar item del carrito

### Gestión de Tablas
- `Ctrl + F` - Filtro rápido
- `↑` `↓` - Navegar filas
- `Enter` - Abrir registro

---

## 9. Solución de Problemas

**Estructura por problema:**

```markdown
**🔴 Error: "[Mensaje de error]"**

1. [Paso de diagnóstico/solución]
2. [Paso]
3. [Paso]
4. [Alternativa si aplica]
```

**Problemas incluidos:**
- Error de conexión al servidor
- Database locked / corrupción
- Invalid credentials
- El recibo no imprime
- Producto no encontrado
- Stock insuficiente
- Error 401/403/404/500 API

---

## 10. Archivos a Modificar

```
storefront/client/
├── index.html          (+ menú Ayuda, + página help)
├── css/styles.css      (+ estilos help)
└── js/app.js           (+ lógica help)
```

### Nuevos Estilos CSS

```css
/* Help Page */
.help-container { display: flex; }
.help-sidebar { position: sticky; ... }
.help-content { flex: 1; overflow-y: auto; }
.help-section { margin-bottom: 2rem; }
.help-nav-item { cursor: pointer; ... }
.help-nav-item.active { background: var(--primary); }

/* FAQ Accordion */
.accordion details { border: 1px solid #ddd; }
.accordion summary { cursor: pointer; padding: 1rem; }

/* Shortcuts */
.shortcut-card { display: grid; grid-template-columns: auto 1fr; }
kbd { background: #eee; border-radius: 4px; padding: 2px 6px; }
```

### Lógica JavaScript

```javascript
// Inicializar página de ayuda
function initHelpPage() {
  // Renderizar índice
  // Configurar navegación
  // Implementar búsqueda
  // Scroll suave a secciones
}
```

---

## 11. Consideraciones

- **Sin cambios en backend:** Toda la documentación es frontend
- **Documentación general:** Visible para todos los usuarios sin filtro de rol
- **Mantenimiento:** Actualizar documentación cuando cambie la funcionalidad
- **Futuro (Fase 2):** Migrar a sub-páginas por sección

---

## Aprobación

- [x] Estructura del menú
- [x] Layout de la página
- [x] Secciones del índice
- [x] Contenido por módulo
- [x] Estructura de tutoriales
- [x] Estructura de FAQ
- [x] Glosario de términos
- [x] Atajos de teclado
- [x] Solución de problemas
- [x] Archivos y estructura

**Aprobado por:** Usuario
**Fecha de aprobación:** 2026-04-20