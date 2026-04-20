# Sección de Ayuda - Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar sección de documentación/ayuda completa al final del menú principal de StoreFront.

**Architecture:** Frontend-only implementation. Nueva página HTML con índice lateral sticky, contenido scrollable, estilos CSS nuevos, y módulo JavaScript para navegación y búsqueda.

**Tech Stack:** HTML, CSS (vanilla), JavaScript (vanilla, sin cambios en backend)

---

## Archivos a Modificar

| Archivo | Cambio | Descripción |
|---------|--------|-------------|
| `storefront/client/index.html` | Modificar | Agregar menú Ayuda + página completa |
| `storefront/client/css/styles.css` | Modificar | Agregar estilos para help page |
| `storefront/client/js/app.js` | Modificar | Agregar módulo help + navegación |

---

## Task 1: Agregar menú "Ayuda" al sidebar

**Files:**
- Modify: `storefront/client/index.html:93` (después de Settings)

- [ ] **Step 1: Agregar item del menú en HTML**

Buscar la línea con `<li class="nav-item" data-page="settings">` y agregar después del cierre `</li>`:

```html
                <li class="nav-item" data-page="help">
                    <i class="fas fa-question-circle"></i>
                    <span>Ayuda</span>
                </li>
```

- [ ] **Step 2: Verificar que el menú se muestra correctamente**

Abrir http://localhost:3001, login, verificar que "Ayuda" aparece al final del menú.

---

## Task 2: Agregar página de Ayuda (HTML structure)

**Files:**
- Modify: `storefront/client/index.html:781` (después de Settings page)

- [ ] **Step 1: Agregar contenedor de la página de ayuda**

Después del `</div>` que cierra `page-settings`, agregar:

```html
            <!-- Help Page -->
            <div id="page-help" class="page">
                <div class="page-header">
                    <h1><i class="fas fa-book"></i> Ayuda</h1>
                    <div class="page-actions">
                        <input type="text" id="help-search" placeholder="Buscar en la ayuda..." class="help-search-input">
                    </div>
                </div>
                <div class="help-container">
                    <aside class="help-sidebar">
                        <nav class="help-nav">
                            <a href="#help-general" class="help-nav-item active">
                                <i class="fas fa-info-circle"></i> General
                            </a>
                            <a href="#help-modules" class="help-nav-item">
                                <i class="fas fa-th-large"></i> Módulos
                            </a>
                            <a href="#help-tutorials" class="help-nav-item">
                                <i class="fas fa-graduation-cap"></i> Tutoriales
                            </a>
                            <a href="#help-faq" class="help-nav-item">
                                <i class="fas fa-question-circle"></i> FAQ
                            </a>
                            <a href="#help-glossary" class="help-nav-item">
                                <i class="fas fa-book-open"></i> Glosario
                            </a>
                            <a href="#help-shortcuts" class="help-nav-item">
                                <i class="fas fa-keyboard"></i> Atajos
                            </a>
                            <a href="#help-troubleshooting" class="help-nav-item">
                                <i class="fas fa-tools"></i> Problemas
                            </a>
                        </nav>
                    </aside>
                    <main class="help-content" id="help-content">
                        <!-- Content sections will be injected by JavaScript -->
                    </main>
                </div>
            </div>
```

- [ ] **Step 2: Verificar estructura HTML**

Confirmar que el HTML es válido y no hay errores de sintaxis.

---

## Task 3: Agregar estilos CSS para la página de ayuda

**Files:**
- Modify: `storefront/client/css/styles.css:500` (al final del archivo)

- [ ] **Step 1: Agregar estilos del contenedor y layout**

Agregar al final del archivo CSS:

```css
/* ========================================
   Help Page Styles
   ======================================== */

.help-search-input {
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    font-size: 0.875rem;
    width: 250px;
}

.help-search-input:focus {
    outline: none;
    border-color: var(--primary);
    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.help-container {
    display: flex;
    gap: 1.5rem;
    min-height: calc(100vh - 150px);
}

.help-sidebar {
    width: 220px;
    flex-shrink: 0;
}

.help-nav {
    position: sticky;
    top: 1rem;
    background: white;
    border-radius: 0.75rem;
    padding: 1rem;
    box-shadow: var(--card-shadow);
}

.help-nav-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    color: var(--dark);
    font-size: 0.875rem;
    transition: var(--transition);
    cursor: pointer;
}

.help-nav-item:hover {
    background: var(--light);
}

.help-nav-item.active {
    background: var(--primary);
    color: white;
}

.help-nav-item i {
    width: 20px;
    text-align: center;
}

.help-content {
    flex: 1;
    background: white;
    border-radius: 0.75rem;
    padding: 1.5rem;
    box-shadow: var(--card-shadow);
    overflow-y: auto;
}

.help-section {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border);
}

.help-section:last-child {
    border-bottom: none;
    margin-bottom: 0;
}

.help-section h2 {
    font-size: 1.25rem;
    color: var(--dark);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.help-section h2 i {
    color: var(--primary);
}

.help-section h3 {
    font-size: 1rem;
    color: var(--dark);
    margin: 1.5rem 0 0.75rem;
}

.help-section p {
    color: var(--gray);
    line-height: 1.7;
    margin-bottom: 1rem;
}

.help-section ul {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
}

.help-section li {
    color: var(--gray);
    margin-bottom: 0.5rem;
    line-height: 1.6;
}

/* Module Cards */
.module-card {
    background: var(--light);
    border-radius: 0.75rem;
    padding: 1.5rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--primary);
}

.module-card h4 {
    font-size: 1rem;
    color: var(--dark);
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.module-card h4 i {
    color: var(--primary);
}

.module-card p {
    font-size: 0.875rem;
    color: var(--gray);
    margin-bottom: 0.75rem;
}

.module-features {
    list-style: none;
    margin: 0 0 0.75rem 0;
}

.module-features li {
    padding-left: 1.25rem;
    position: relative;
}

.module-features li::before {
    content: "✓";
    position: absolute;
    left: 0;
    color: var(--success);
}

/* Tutorial Steps */
.tutorial-step {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 1rem;
    background: var(--light);
    border-radius: 0.5rem;
}

.step-number {
    width: 32px;
    height: 32px;
    background: var(--primary);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    flex-shrink: 0;
}

.step-content h4 {
    font-size: 0.9rem;
    color: var(--dark);
    margin-bottom: 0.25rem;
}

.step-content p {
    font-size: 0.85rem;
    color: var(--gray);
    margin: 0;
}

/* FAQ Accordion */
.faq-category {
    margin-bottom: 1.5rem;
}

.faq-category h4 {
    font-size: 0.9rem;
    color: var(--dark);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
}

.faq-item {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    margin-bottom: 0.5rem;
    overflow: hidden;
}

.faq-item summary {
    padding: 1rem;
    cursor: pointer;
    font-weight: 500;
    color: var(--dark);
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.faq-item summary:hover {
    background: var(--light);
}

.faq-item[open] summary {
    background: var(--light);
    border-bottom: 1px solid var(--border);
}

.faq-item .faq-answer {
    padding: 1rem;
    color: var(--gray);
    font-size: 0.9rem;
    line-height: 1.6;
}

/* Glossary Table */
.glossary-table {
    width: 100%;
    border-collapse: collapse;
}

.glossary-table th,
.glossary-table td {
    padding: 0.75rem 1rem;
    text-align: left;
    border-bottom: 1px solid var(--border);
}

.glossary-table th {
    background: var(--light);
    font-weight: 600;
    color: var(--dark);
}

.glossary-table td:first-child {
    font-weight: 500;
    color: var(--dark);
}

.glossary-table td:last-child {
    color: var(--gray);
}

/* Shortcuts Grid */
.shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 1rem;
}

.shortcuts-category {
    background: var(--light);
    border-radius: 0.75rem;
    padding: 1rem;
}

.shortcuts-category h4 {
    font-size: 0.9rem;
    color: var(--dark);
    margin-bottom: 0.75rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
}

.shortcut-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 0;
}

.shortcut-row kbd {
    background: white;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.25rem 0.5rem;
    font-family: monospace;
    font-size: 0.8rem;
    color: var(--dark);
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.shortcut-row span {
    color: var(--gray);
    font-size: 0.85rem;
}

/* Troubleshooting */
.trouble-item {
    background: var(--light);
    border-radius: 0.75rem;
    padding: 1.25rem;
    margin-bottom: 1rem;
    border-left: 4px solid var(--danger);
}

.trouble-item h4 {
    font-size: 0.95rem;
    color: var(--danger);
    margin-bottom: 0.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
}

.trouble-item ol {
    margin-left: 1.5rem;
    color: var(--gray);
}

.trouble-item li {
    margin-bottom: 0.5rem;
}

.trouble-item .warning-note {
    background: rgba(239, 68, 68, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    margin-top: 0.75rem;
}

/* Responsive */
@media (max-width: 768px) {
    .help-container {
        flex-direction: column;
    }

    .help-sidebar {
        width: 100%;
        margin-bottom: 1rem;
    }

    .help-nav {
        position: static;
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
    }

    .help-nav-item {
        padding: 0.5rem 0.75rem;
        font-size: 0.8rem;
    }

    .help-search-input {
        width: 100%;
    }
}
```

- [ ] **Step 2: Verificar estilos**

Recargar la página y verificar que los estilos se aplican correctamente.

---

## Task 4: Agregar módulo JavaScript de ayuda

**Files:**
- Modify: `storefront/client/js/app.js:2318` (en switch de navigateTo)

- [ ] **Step 1: Agregar módulo help completo**

Agregar después de la definición de `settings` (línea ~2253), antes de `const modal`:

```javascript
// Help module
const help = {
    currentSection: 'general',

    content: {
        general: `
            <section id="help-general" class="help-section">
                <h2><i class="fas fa-info-circle"></i> Información General</h2>
                
                <h3>Acerca de StoreFront</h3>
                <p>StoreFront es un sistema completo de gestión de inventario y punto de venta (POS) diseñado para pequeños y medianos negocios. Permite gestionar productos, ventas, clientes, proveedores y generar reportes detallados.</p>
                
                <h3>Requisitos del Sistema</h3>
                <ul>
                    <li>Navegador web moderno (Chrome, Firefox, Edge, Safari)</li>
                    <li>JavaScript habilitado</li>
                    <li>Conexión a internet (para la versión en línea)</li>
                </ul>
                
                <h3>Inicio de Sesión</h3>
                <p>Para acceder al sistema, ingresa tu nombre de usuario y contraseña en la pantalla de login. Las credenciales por defecto son:</p>
                <ul>
                    <li><strong>Usuario:</strong> admin</li>
                    <li><strong>Contraseña:</strong> admin123</li>
                </ul>
                <p><em>⚠️ Importante: Cambia la contraseña por defecto inmediatamente después del primer inicio de sesión.</em></p>
                
                <h3>Navegación Básica</h3>
                <p>El sistema utiliza un menú lateral (sidebar) para la navegación entre secciones:</p>
                <ul>
                    <li>Haz clic en cualquier elemento del menú para acceder a esa sección</li>
                    <li>Las secciones disponibles dependen de tu rol de usuario</li>
                    <li>El botón "Logout" cierra tu sesión de forma segura</li>
                </ul>
                
                <h3>Roles de Usuario</h3>
                <p>El sistema cuenta con 4 roles con diferentes permisos:</p>
                <ul>
                    <li><strong>Admin:</strong> Acceso completo a todas las funciones</li>
                    <li><strong>Manager:</strong> Gestión de productos, inventario, reportes y configuración</li>
                    <li><strong>Cashier:</strong> Acceso al POS y visualización de productos</li>
                    <li><strong>Staff:</strong> Solo visualización del dashboard y productos</li>
                </ul>
            </section>
        `,

        modules: `
            <section id="help-modules" class="help-section">
                <h2><i class="fas fa-th-large"></i> Módulos del Sistema</h2>
                
                <div class="module-card">
                    <h4><i class="fas fa-tachometer-alt"></i> Dashboard</h4>
                    <p>Panel principal con resumen de métricas importantes del negocio.</p>
                    <ul class="module-features">
                        <li>Ventas del día y del mes</li>
                        <li>Conteo de productos y valor del inventario</li>
                        <li>Alertas de stock bajo</li>
                        <li>Ventas recientes y órdenes de catálogo</li>
                        <li>Resumen de órdenes pendientes</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-cash-register"></i> Point of Sale (POS)</h4>
                    <p>Sistema de punto de venta para procesar transacciones rápidas.</p>
                    <ul class="module-features">
                        <li>Búsqueda de productos por nombre, SKU o código de barras</li>
                        <li>Carrito de compras con edición de cantidades</li>
                        <li>Selección de cliente (walk-in o registrado)</li>
                        <li>Métodos de pago: efectivo, tarjeta, móvil</li>
                        <li>Cálculo automático de impuestos y cambio</li>
                        <li>Generación e impresión de recibos</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-boxes"></i> Products</h4>
                    <p>Gestión del catálogo de productos del negocio.</p>
                    <ul class="module-features">
                        <li>Crear, editar y desactivar productos</li>
                        <li>Asignar categorías y proveedores</li>
                        <li>Definir precios de costo y venta</li>
                        <li>Configurar niveles mínimos y máximos de stock</li>
                        <li>Importación masiva desde Excel</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-clipboard-list"></i> Inventory</h4>
                    <p>Control y seguimiento del inventario de productos.</p>
                    <ul class="module-features">
                        <li>Vista de niveles de stock actuales</li>
                        <li>Ajustes manuales de inventario</li>
                        <li>Historial de transacciones de stock</li>
                        <li>Alertas de stock bajo y agotado</li>
                        <li>Conteo de inventario (stock count)</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-receipt"></i> Sales</h4>
                    <p>Historial de todas las transacciones de venta.</p>
                    <ul class="module-features">
                        <li>Lista de ventas con filtros por fecha</li>
                        <li>Detalle de cada transacción</li>
                        <li>Ver e imprimir recibos</li>
                        <li>Anulación de ventas (Admin/Manager)</li>
                        <li>Resumen de ventas por período</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-shopping-bag"></i> Orders</h4>
                    <p>Gestión de órdenes del catálogo público (e-commerce).</p>
                    <ul class="module-features">
                        <li>Lista de órdenes con filtros por estado</li>
                        <li>Actualización de estado de órdenes</li>
                        <li>Gestión de pagos de órdenes</li>
                        <li>Cancelación con restauración de inventario</li>
                        <li>Estadísticas de órdenes por estado</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-users"></i> Customers</h4>
                    <p>Base de datos de clientes y programa de lealtad.</p>
                    <ul class="module-features">
                        <li>Registro de clientes con información de contacto</li>
                        <li>Sistema de puntos de lealtad</li>
                        <li>Historial de compras por cliente</li>
                        <li>Búsqueda y filtrado de clientes</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-truck"></i> Suppliers</h4>
                    <p>Gestión de proveedores y asociación con productos.</p>
                    <ul class="module-features">
                        <li>Registro de información de proveedores</li>
                        <li>Persona de contacto y datos de comunicación</li>
                        <li>Productos asociados a cada proveedor</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-chart-bar"></i> Reports</h4>
                    <p>Reportes y análisis del negocio.</p>
                    <ul class="module-features">
                        <li>Reporte de ventas por período</li>
                        <li>Productos más vendidos</li>
                        <li>Desglose por método de pago</li>
                        <li>Rendimiento por categoría</li>
                        <li>Análisis de ventas por hora</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-user-cog"></i> Users</h4>
                    <p>Administración de usuarios del sistema (solo Admin).</p>
                    <ul class="module-features">
                        <li>Crear, editar y desactivar usuarios</li>
                        <li>Asignación de roles</li>
                        <li>Reset de contraseñas</li>
                        <li>Activación/desactivación de cuentas</li>
                    </ul>
                </div>
                
                <div class="module-card">
                    <h4><i class="fas fa-cog"></i> Settings</h4>
                    <p>Configuración general del sistema.</p>
                    <ul class="module-features">
                        <li>Información de la tienda (nombre, dirección, teléfono)</li>
                        <li>Configuración de tasa de impuestos</li>
                        <li>Personalización del pie de recibo</li>
                        <li>Cambio de contraseña personal</li>
                    </ul>
                </div>
            </section>
        `,

        tutorials: `
            <section id="help-tutorials" class="help-section">
                <h2><i class="fas fa-graduation-cap"></i> Tutoriales Paso a Paso</h2>
                
                <h3>Cómo crear una venta en el POS</h3>
                <p>Aprende a procesar una venta completa desde la selección de productos hasta la generación del recibo.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Seleccionar productos</h4>
                        <p>Usa el buscador o filtra por categoría para encontrar productos. Haz clic en el producto para agregarlo al carrito. Ajusta la cantidad con los botones + y -.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Seleccionar cliente (opcional)</h4>
                        <p>Elige "Walk-in Customer" para ventas sin registro, o selecciona un cliente registrado para acumular puntos de lealtad.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Aplicar descuento (opcional)</h4>
                        <p>Ingresa el monto a descontar en el campo "Discount" si es necesario.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Elegir método de pago</h4>
                        <p>Selecciona Cash (efectivo), Card (tarjeta) o Mobile (pago móvil). Si es efectivo, ingresa el monto recibido para calcular el cambio.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">5</div>
                    <div class="step-content">
                        <h4>Completar la venta</h4>
                        <p>Haz clic en "Complete Sale". El recibo se genera automáticamente y puedes imprimirlo si es necesario.</p>
                    </div>
                </div>
                
                <h3>Cómo agregar un nuevo producto</h3>
                <p>Aprende a registrar un producto en el catálogo.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ir a la sección Products</h4>
                        <p>Selecciona "Products" en el menú lateral y haz clic en "Add Product".</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Completar información básica</h4>
                        <p>Ingresa SKU (código único), nombre, descripción y selecciona categoría/proveedor si aplica.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Definir precios y stock</h4>
                        <p>Ingresa el precio de costo, precio de venta, cantidad inicial y nivel mínimo de stock.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Guardar el producto</h4>
                        <p>Haz clic en "Add Product" para guardar. El producto estará disponible inmediatamente.</p>
                    </div>
                </div>
                
                <h3>Cómo ajustar el inventario manualmente</h3>
                <p>Corrige discrepancias de stock o registra entradas/salidas.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ir a Inventory</h4>
                        <p>Selecciona "Inventory" en el menú y haz clic en "Stock Adjustment".</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Seleccionar el producto</h4>
                        <p>Busca el producto o haz clic en el botón de ajuste en la tabla de inventario.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Definir el ajuste</h4>
                        <p>Elige el tipo: "Add Stock" (sumar), "Subtract Stock" (restar) o "Set Stock To" (establecer valor). Ingresa la cantidad.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Ingresar razón</h4>
                        <p>Proporciona una razón para el ajuste (ej: "Stock delivery", "Damaged goods", "Inventory count correction").</p>
                    </div>
                </div>
                
                <h3>Cómo procesar una orden de catálogo</h3>
                <p>Gestiona las órdenes realizadas desde el catálogo público.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ir a Orders</h4>
                        <p>Selecciona "Orders" en el menú para ver la lista de órdenes.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Ver detalles</h4>
                        <p>Haz clic en el ícono de ojo para ver los detalles completos de la orden, incluyendo productos, cantidades y dirección de envío.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Actualizar estado</h4>
                        <p>Haz clic en el ícono de check para cambiar el estado de la orden: Pending → Confirmed → Processing → Shipped → Delivered.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Actualizar pago</h4>
                        <p>En el mismo formulario, puedes actualizar el estado del pago: Pending → Paid.</p>
                    </div>
                </div>
                
                <h3>Cómo generar reportes de ventas</h3>
                <p>Obtén métricas detalladas de rendimiento.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Ir a Reports</h4>
                        <p>Selecciona "Reports" en el menú lateral.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Seleccionar período</h4>
                        <p>Define las fechas de inicio y fin para el reporte.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Actualizar datos</h4>
                        <p>Haz clic en "Refresh" para generar el reporte con los datos actualizados.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Analizar resultados</h4>
                        <p>Revisa el resumen de ventas, productos más vendidos, desglose por método de pago y rendimiento por categoría.</p>
                    </div>
                </div>
                
                <h3>Cómo importar productos masivamente</h3>
                <p>Carga múltiples productos desde un archivo Excel.</p>
                
                <div class="tutorial-step">
                    <div class="step-number">1</div>
                    <div class="step-content">
                        <h4>Descargar plantilla</h4>
                        <p>Ve a Products → Batch Import → Download Template para obtener el archivo Excel con el formato correcto.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">2</div>
                    <div class="step-content">
                        <h4>Llenar la plantilla</h4>
                        <p>Completa los campos requeridos: SKU*, Name*, Cost Price*, Selling Price*. Los demás campos son opcionales.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">3</div>
                    <div class="step-content">
                        <h4>Subir archivo</h4>
                        <p>Arrastra el archivo o haz clic para seleccionarlo. Solo se aceptan archivos .xlsx o .xls.</p>
                    </div>
                </div>
                
                <div class="tutorial-step">
                    <div class="step-number">4</div>
                    <div class="step-content">
                        <h4>Procesar importación</h4>
                        <p>Haz clic en "Process Import". Revisa los resultados para ver productos importados y errores encontrados.</p>
                    </div>
                </div>
            </section>
        `,

        faq: `
            <section id="help-faq" class="help-section">
                <h2><i class="fas fa-question-circle"></i> Preguntas Frecuentes</h2>
                
                <div class="faq-category">
                    <h4>Inicio de Sesión y Cuentas</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo cambio mi contraseña?</summary>
                        <div class="faq-answer">
                            Ve a <strong>Settings > Change Password</strong>. Ingresa tu contraseña actual, luego la nueva contraseña (mínimo 6 caracteres) y confírmala. Haz clic en "Change Password" para guardar los cambios.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Qué hago si olvidé mi contraseña?</summary>
                        <div class="faq-answer">
                            Contacta al administrador del sistema. Solo un administrador puede resetear tu contraseña desde <strong>Users > Reset Password</strong>. Por seguridad, no hay opción de recuperación automática.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo creo un nuevo usuario?</summary>
                        <div class="faq-answer">
                            Solo los administradores pueden crear usuarios. Ve a <strong>Users > Add User</strong>, completa el nombre de usuario, nombre completo, email, contraseña y selecciona el rol apropiado.
                        </div>
                    </details>
                </div>
                
                <div class="faq-category">
                    <h4>Productos e Inventario</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo importo productos masivamente?</summary>
                        <div class="faq-answer">
                            Ve a <strong>Products > Batch Import</strong>. Descarga la plantilla Excel, llénala con los datos de tus productos (SKU, Name, Cost Price, Selling Price son requeridos), y súbelo al sistema. El sistema procesará el archivo y te mostrará los resultados.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Qué significa "Low Stock"?</summary>
                        <div class="faq-answer">
                            "Low Stock" indica que el inventario de un producto está por debajo del nivel mínimo que configuraste. Esto es una alerta para reabastecer el producto antes de que se agote completamente.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo ajusto el stock de un producto?</summary>
                        <div class="faq-answer">
                            En la sección <strong>Inventory</strong>, haz clic en el botón de ajuste (ícono de flechas) junto al producto. Selecciona el tipo de ajuste (Add, Subtract, o Set), ingresa la cantidad y una razón para el cambio.
                        </div>
                    </details>
                </div>
                
                <div class="faq-category">
                    <h4>Ventas y Órdenes</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Puedo anular una venta ya realizada?</summary>
                        <div class="faq-answer">
                            Sí, pero solo los administradores y managers pueden hacerlo. Ve a <strong>Sales</strong>, busca la venta y selecciona la opción "Void". Esto revertirá el stock de los productos vendidos.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo registro un cliente en una venta?</summary>
                        <div class="faq-answer">
                            En el POS, usa el dropdown "Customer" arriba del carrito. Selecciona un cliente registrado o deja "Walk-in Customer" para ventas sin registro. Los clientes registrados acumulan puntos de lealtad.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cuál es la diferencia entre Sales y Orders?</summary>
                        <div class="faq-answer">
                            <strong>Sales</strong> son transacciones realizadas directamente en el POS (tienda física). <strong>Orders</strong> son pedidos realizados desde el catálogo público en línea. Ambos consumen inventario pero se gestionan en secciones diferentes.
                        </div>
                    </details>
                </div>
                
                <div class="faq-category">
                    <h4>Clientes</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo funcionan los puntos de lealtad?</summary>
                        <div class="faq-answer">
                            Los clientes acumulan puntos por cada compra realizada. Los puntos se calculan automáticamente basándose en el monto de la compra. Un administrador o manager puede ajustar los puntos manualmente desde el perfil del cliente.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo veo el historial de compras de un cliente?</summary>
                        <div class="faq-answer">
                            Ve a <strong>Customers</strong>, busca el cliente y haz clic en "Edit". Desde allí puedes ver el historial de compras y los puntos acumulados.
                        </div>
                    </details>
                </div>
                
                <div class="faq-category">
                    <h4>Reportes</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo exporto los reportes?</summary>
                        <div class="faq-answer">
                            Actualmente los reportes se muestran en pantalla. Puedes usar la función de impresión del navegador (Ctrl+P) para guardar como PDF o imprimir. Futuras versiones incluirán exportación a Excel.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Qué significa "Average Sale"?</summary>
                        <div class="faq-answer">
                            Es el promedio del monto total de las transacciones en el período seleccionado. Se calcula dividiendo el total de ventas entre el número de transacciones.
                        </div>
                    </details>
                </div>
                
                <div class="faq-category">
                    <h4>Sistema</h4>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Cómo configuro los impuestos?</summary>
                        <div class="faq-answer">
                            Ve a <strong>Settings</strong> y modifica el campo "Tax Rate (%)". Este porcentaje se aplicará automáticamente a todas las ventas en el POS.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Puedo personalizar los recibos?</summary>
                        <div class="faq-answer">
                            Sí, en <strong>Settings</strong> puedes configurar el nombre de la tienda, dirección, teléfono y el texto del pie de recibo que aparecerá en todos los recibos impresos.
                        </div>
                    </details>
                    
                    <details class="faq-item">
                        <summary>❓ ¿Dónde se guardan mis datos?</summary>
                        <div class="faq-answer">
                            Los datos se almacenan en una base de datos SQLite localizada en <code>storefront/data/store.db</code>. Se recomienda hacer copias de seguridad regulares de este archivo.
                        </div>
                    </details>
                </div>
            </section>
        `,

        glossary: `
            <section id="help-glossary" class="help-section">
                <h2><i class="fas fa-book-open"></i> Glosario de Términos</h2>
                
                <table class="glossary-table">
                    <thead>
                        <tr>
                            <th>Término</th>
                            <th>Definición</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>SKU</td>
                            <td>Stock Keeping Unit - Código único de identificación de producto utilizado para rastrear inventario.</td>
                        </tr>
                        <tr>
                            <td>POS</td>
                            <td>Point of Sale - Punto de venta donde se procesan transacciones con clientes.</td>
                        </tr>
                        <tr>
                            <td>Walk-in Customer</td>
                            <td>Cliente sin registro que realiza una compra sin identificación en el sistema.</td>
                        </tr>
                        <tr>
                            <td>Stock</td>
                            <td>Cantidad disponible de un producto en el inventario.</td>
                        </tr>
                        <tr>
                            <td>Low Stock</td>
                            <td>Estado de alerta cuando el inventario está por debajo del nivel mínimo configurado.</td>
                        </tr>
                        <tr>
                            <td>Out of Stock</td>
                            <td>Producto con inventario en cero, no disponible para venta.</td>
                        </tr>
                        <tr>
                            <td>Receipt</td>
                            <td>Recibo o comprobante de venta generado automáticamente por el sistema.</td>
                        </tr>
                        <tr>
                            <td>Loyalty Points</td>
                            <td>Puntos de fidelidad acumulados por clientes registrados en cada compra.</td>
                        </tr>
                        <tr>
                            <td>Batch Import</td>
                            <td>Importación masiva de datos desde un archivo Excel para crear múltiples registros.</td>
                        </tr>
                        <tr>
                            <td>Void</td>
                            <td>Anular una venta ya procesada, revirtiendo el stock y marcando la transacción como cancelada.</td>
                        </tr>
                        <tr>
                            <td>Markup</td>
                            <td>Margen de ganancia, la diferencia entre el precio de costo y el precio de venta.</td>
                        </tr>
                        <tr>
                            <td>Tax Rate</td>
                            <td>Tasa de impuesto aplicada a las ventas, configurada en Settings.</td>
                        </tr>
                        <tr>
                            <td>Dashboard</td>
                            <td>Panel principal con resumen visual de métricas importantes del negocio.</td>
                        </tr>
                        <tr>
                            <td>Backorder</td>
                            <td>Orden de producto que no puede ser surtido por falta de stock.</td>
                        </tr>
                        <tr>
                            <td>Cost Price</td>
                            <td>Precio de costo del producto, lo que paga el negocio al proveedor.</td>
                        </tr>
                        <tr>
                            <td>Selling Price</td>
                            <td>Precio de venta del producto, lo que paga el cliente.</td>
                        </tr>
                        <tr>
                            <td>Profit Margin</td>
                            <td>Porcentaje de ganancia sobre el precio de venta.</td>
                        </tr>
                        <tr>
                            <td>Inventory Transaction</td>
                            <td>Registro de cualquier movimiento de stock: entrada, salida, ajuste.</td>
                        </tr>
                        <tr>
                            <td>Stock Count</td>
                            <td>Conteo físico de inventario para verificar y ajustar cantidades.</td>
                        </tr>
                        <tr>
                            <td>Stock Adjustment</td>
                            <td>Cambio manual en la cantidad de stock de un producto.</td>
                        </tr>
                        <tr>
                            <td>Category</td>
                            <td>Clasificación de productos para organización y filtrado.</td>
                        </tr>
                        <tr>
                            <td>Supplier</td>
                            <td>Proveedor o distribuidor de productos.</td>
                        </tr>
                        <tr>
                            <td>Customer</td>
                            <td>Cliente registrado en el sistema con información de contacto.</td>
                        </tr>
                        <tr>
                            <td>Role</td>
                            <td>Nivel de acceso de usuario: Admin, Manager, Cashier, Staff.</td>
                        </tr>
                        <tr>
                            <td>Permission</td>
                            <td>Autorización para realizar acciones específicas según el rol.</td>
                        </tr>
                        <tr>
                            <td>JWT Token</td>
                            <td>Token de autenticación seguro que mantiene la sesión del usuario activa.</td>
                        </tr>
                        <tr>
                            <td>Modal</td>
                            <td>Ventana emergente superpuesta para formularios y detalles.</td>
                        </tr>
                        <tr>
                            <td>Sidebar</td>
                            <td>Menú lateral de navegación principal del sistema.</td>
                        </tr>
                        <tr>
                            <td>Pagination</td>
                            <td>Navegación entre páginas de resultados en listas largas.</td>
                        </tr>
                    </tbody>
                </table>
            </section>
        `,

        shortcuts: `
            <section id="help-shortcuts" class="help-section">
                <h2><i class="fas fa-keyboard"></i> Atajos de Teclado</h2>
                
                <p>Usa estos atajos para navegar más rápidamente por el sistema:</p>
                
                <div class="shortcuts-grid">
                    <div class="shortcuts-category">
                        <h4><i class="fas fa-compass"></i> Navegación General</h4>
                        <div class="shortcut-row">
                            <span>Abrir búsqueda global</span>
                            <kbd>Ctrl + K</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Cerrar modal / Volver</span>
                            <kbd>Esc</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Navegar entre campos</span>
                            <kbd>Tab</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Retroceder campo</span>
                            <kbd>Shift + Tab</kbd>
                        </div>
                    </div>
                    
                    <div class="shortcuts-category">
                        <h4><i class="fas fa-cash-register"></i> En el POS</h4>
                        <div class="shortcut-row">
                            <span>Buscar producto</span>
                            <kbd>Enter</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Seleccionar cliente</span>
                            <kbd>F2</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Limpiar carrito</span>
                            <kbd>F4</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Completar venta</span>
                            <kbd>F8</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Eliminar item del carrito</span>
                            <kbd>Delete</kbd>
                        </div>
                    </div>
                    
                    <div class="shortcuts-category">
                        <h4><i class="fas fa-table"></i> Gestión de Tablas</h4>
                        <div class="shortcut-row">
                            <span>Filtro rápido</span>
                            <kbd>Ctrl + F</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Navegar filas</span>
                            <kbd>↑ ↓</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Abrir registro</span>
                            <kbd>Enter</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Seleccionar todo</span>
                            <kbd>Ctrl + A</kbd>
                        </div>
                    </div>
                    
                    <div class="shortcuts-category">
                        <h4><i class="fas fa-edit"></i> Formularios</h4>
                        <div class="shortcut-row">
                            <span>Guardar formulario</span>
                            <kbd>Ctrl + Enter</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Cancelar</span>
                            <kbd>Esc</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Copiar</span>
                            <kbd>Ctrl + C</kbd>
                        </div>
                        <div class="shortcut-row">
                            <span>Pegar</span>
                            <kbd>Ctrl + V</kbd>
                        </div>
                    </div>
                </div>
                
                <p style="margin-top: 1rem; color: var(--gray); font-size: 0.85rem;">
                    <i class="fas fa-info-circle"></i> Nota: Los atajos pueden variar según el navegador y sistema operativo. En dispositivos móviles, algunos atajos pueden no estar disponibles.
                </p>
            </section>
        `,

        troubleshooting: `
            <section id="help-troubleshooting" class="help-section">
                <h2><i class="fas fa-tools"></i> Solución de Problemas</h2>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-plug"></i> Error: "Cannot connect to server"</h4>
                    <ol>
                        <li>Verifica que el servidor esté ejecutándose (comando <code>npm start</code>)</li>
                        <li>Confirma que la URL sea <code>http://localhost:3001</code></li>
                        <li>Revisa tu conexión de red local</li>
                        <li>Intenta refrescar la página (F5)</li>
                        <li>Elimina el caché del navegador y vuelve a intentar</li>
                    </ol>
                </div>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-database"></i> Error: "Database locked" o corrupción</h4>
                    <ol>
                        <li>Detén el servidor (Ctrl+C en la terminal)</li>
                        <li>Ve a la carpeta <code>storefront/data/</code></li>
                        <li>Elimina el archivo <code>store.db</code></li>
                        <li>Reinicia el servidor (la BD se recreará)</li>
                    </ol>
                    <div class="warning-note">
                        ⚠️ Advertencia: Esto eliminará todos los datos guardados. Solo hazlo si no hay otra solución.
                    </div>
                </div>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-user-lock"></i> Error: "Invalid credentials"</h4>
                    <ol>
                        <li>Verifica que el nombre de usuario sea correcto</li>
                        <li>Verifica que la contraseña sea correcta (revisa mayúsculas/minúsculas)</li>
                        <li>Si olvidaste tu contraseña, contacta al administrador</li>
                        <li>Credenciales por defecto: <code>admin</code> / <code>admin123</code></li>
                        <li>Si tu cuenta fue desactivada, un administrador debe reactivarla</li>
                    </ol>
                </div>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-print"></i> El recibo no imprime</h4>
                    <ol>
                        <li>Verifica que la impresora esté conectada y encendida</li>
                        <li>Usa <code>Ctrl+P</code> para abrir el diálogo de impresión manual</li>
                        <li>Habilita las ventanas emergentes (pop-ups) en tu navegador</li>
                        <li>Intenta en otro navegador (Chrome recomendado)</li>
                        <li>Verifica que no haya trabajos de impresión atascados</li>
                    </ol>
                </div>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-search"></i> Producto no encontrado en búsqueda</h4>
                    <ol>
                        <li>Verifica que el producto esté activo (status: Active)</li>
                        <li>Revisa que el SKU o nombre coincidan exactamente</li>
                        <li>Si usas código de barras, verifica que esté registrado</li>
                        <li>Refresca la página para actualizar la lista</li>
                        <li>Verifica que el producto pertenezca a la categoría seleccionada</li>
                    </ol>
                </div>
                
                <div class="trouble-item">
                    <h4><i class="fas fa-exclamation-triangle"></i> Error: "Not enough stock"</h4>
                    <ol>
                        <li>Verifica el stock actual del producto en Inventory</li>
                        <li>Si hay discrepancia, realiza un ajuste de inventario</li>
                        <li>El stock puede estar reservado por órdenes pendientes</li>
                        <li>Verifica que no haya ventas en proceso que consuman el stock</li>
                    </ol>
                </div>
                
                <h3 style="margin-top: 2rem;"><i class="fas fa-code"></i> Códigos de Error HTTP</h3>
                <table class="table" style="margin-top: 1rem;">
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Significado</th>
                            <th>Solución</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="badge badge-warning">401</span></td>
                            <td>No autenticado</td>
                            <td>Vuelve a iniciar sesión. Tu sesión puede haber expirado.</td>
                        </tr>
                        <tr>
                            <td><span class="badge badge-danger">403</span></td>
                            <td>Sin permisos</td>
                            <td>Contacta al administrador si necesitas acceso a esta función.</td>
                        </tr>
                        <tr>
                            <td><span class="badge badge-secondary">404</span></td>
                            <td>No encontrado</td>
                            <td>El recurso solicitado no existe. Verifica el ID o URL.</td>
                        </tr>
                        <tr>
                            <td><span class="badge badge-danger">500</span></td>
                            <td>Error del servidor</td>
                            <td>Error interno. Revisa los logs del servidor o contacta soporte.</td>
                        </tr>
                    </tbody>
                </table>
            </section>
        `
    },

    init() {
        this.render();
        this.setupNavigation();
        this.setupSearch();
    },

    render() {
        const container = document.getElementById('help-content');
        if (!container) return;
        
        // Render all sections
        container.innerHTML = Object.values(this.content).join('');
    },

    setupNavigation() {
        const navItems = document.querySelectorAll('.help-nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Update active state
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                
                // Scroll to section
                const sectionId = item.getAttribute('href').substring(1);
                const section = document.getElementById(sectionId);
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });

        // Update active nav on scroll
        const content = document.getElementById('help-content');
        if (content) {
            content.addEventListener('scroll', utils.debounce(() => {
                const sections = content.querySelectorAll('.help-section');
                let currentSection = 'general';
                
                sections.forEach(section => {
                    const rect = section.getBoundingClientRect();
                    if (rect.top <= 150) {
                        currentSection = section.id.replace('help-', '');
                    }
                });
                
                navItems.forEach(item => {
                    item.classList.remove('active');
                    if (item.getAttribute('href') === `#help-${currentSection}`) {
                        item.classList.add('active');
                    }
                });
            }, 100));
        }
    },

    setupSearch() {
        const searchInput = document.getElementById('help-search');
        if (!searchInput) return;
        
        searchInput.addEventListener('input', utils.debounce((e) => {
            const query = e.target.value.toLowerCase().trim();
            const content = document.getElementById('help-content');
            
            if (!query) {
                // Show all sections
                content.querySelectorAll('.help-section').forEach(section => {
                    section.style.display = '';
                });
                return;
            }
            
            // Search and filter
            content.querySelectorAll('.help-section').forEach(section => {
                const text = section.textContent.toLowerCase();
                if (text.includes(query)) {
                    section.style.display = '';
                    // Highlight first match (simple approach)
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                } else {
                    section.style.display = 'none';
                }
            });
        }, 300));
    }
};
```

- [ ] **Step 2: Agregar caso 'help' en navigateTo**

En el switch de la función `navigateTo` (línea ~2287), agregar después de `case 'settings':`:

```javascript
        case 'help':
            help.init();
            break;
```

- [ ] **Step 3: Verificar que el módulo se carga correctamente**

Recargar página, ir a Ayuda, verificar que el contenido aparece.

---

## Task 5: Verificación final y commit

**Files:**
- Todos los archivos modificados

- [ ] **Step 1: Verificar funcionalidad completa**

Ejecutar checklist:
1. El menú muestra "Ayuda" al final
2. La página de ayuda se abre al hacer clic
3. El índice lateral navega a las secciones
4. La búsqueda filtra contenido
5. Los acordeones de FAQ funcionan
6. Responsive funciona en móvil

- [ ] **Step 2: Commit final**

```bash
git add storefront/client/index.html storefront/client/css/styles.css storefront/client/js/app.js
git commit -m "$(cat <<'EOF'
feat: add comprehensive Help section to StoreFront

- Add "Ayuda" menu item at end of sidebar navigation
- Create help page with sidebar index and scrollable content
- Include sections: General, Modules, Tutorials, FAQ, Glossary, Shortcuts, Troubleshooting
- Add detailed documentation for all 11 application modules
- Add 6 step-by-step tutorials for common tasks
- Add 15+ FAQ items organized by category
- Add glossary with 28 terms
- Add keyboard shortcuts reference
- Add troubleshooting guide with solutions
- Implement search filtering for help content
- Add responsive styles for mobile devices

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Menú "Ayuda" al final del sidebar - Task 1
- [x] Layout con índice sticky - Task 2, 3
- [x] Secciones: General, Módulos, Tutoriales, FAQ, Glosario, Atajos, Problemas - Task 4
- [x] Documentación de 11 módulos - Task 4
- [x] 6 tutoriales paso a paso - Task 4
- [x] FAQ con acordeón - Task 4
- [x] Glosario con ~28 términos - Task 4
- [x] Atajos de teclado - Task 4
- [x] Solución de problemas - Task 4
- [x] Responsive - Task 3

**Placeholder scan:** No TBDs, TODOs, or incomplete sections found.

**Type consistency:** All functions and variables defined in same style as existing code.

---

**Plan completado.** Guardado en `docs/superpowers/plans/2026-04-20-help-documentation-plan.md`