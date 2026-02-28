// StoreFront Application
const API_BASE = '/api';

// State management
const state = {
    user: null,
    token: localStorage.getItem('token'),
    cart: [],
    settings: {},
    currentPage: 'dashboard'
};

// Utility functions
const utils = {
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
    },

    formatDate(date) {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    formatDateShort(date) {
        return new Date(date).toLocaleDateString('en-US');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    },

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};

// API client
const api = {
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (state.token) {
            headers['Authorization'] = `Bearer ${state.token}`;
        }

        try {
            const response = await fetch(url, { ...options, headers });
            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    auth.logout();
                    throw new Error('Session expired. Please login again.');
                }
                throw new Error(data.error || 'Request failed');
            }

            return data;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },

    get(endpoint) {
        return this.request(endpoint, { method: 'GET' });
    },

    post(endpoint, body) {
        return this.request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body) {
        return this.request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint) {
        return this.request(endpoint, { method: 'DELETE' });
    }
};

// Authentication module
const auth = {
    async login(username, password) {
        try {
            const data = await api.post('/auth/login', { username, password });
            state.token = data.token;
            state.user = data.user;
            localStorage.setItem('token', data.token);
            return data;
        } catch (error) {
            throw error;
        }
    },

    async logout() {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            // Ignore logout errors
        }
        state.token = null;
        state.user = null;
        localStorage.removeItem('token');
        this.showLogin();
    },

    async checkAuth() {
        if (!state.token) {
            this.showLogin();
            return false;
        }

        try {
            const data = await api.get('/auth/me');
            state.user = data.user;
            return true;
        } catch (error) {
            this.showLogin();
            return false;
        }
    },

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('app').classList.add('hidden');
    },

    showApp() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        document.getElementById('current-user').textContent = state.user?.fullName || state.user?.username;
        
        // Show/hide admin-only elements
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = state.user?.role === 'admin' ? '' : 'none';
        });

        document.querySelectorAll('.manager-only').forEach(el => {
            el.style.display = ['admin', 'manager'].includes(state.user?.role) ? '' : 'none';
        });
    }
};

// Dashboard module
const dashboard = {
    async load() {
        try {
            const [summary, recentSales, lowStock] = await Promise.all([
                api.get('/dashboard/summary'),
                api.get('/dashboard/recent-sales?limit=5'),
                api.get('/dashboard/low-stock')
            ]);

            // Update summary cards
            document.getElementById('today-sales').textContent = utils.formatCurrency(summary.sales.today.total);
            document.getElementById('today-transactions').textContent = `${summary.sales.today.transactions} transactions`;
            document.getElementById('total-products').textContent = summary.inventory.totalProducts || 0;
            document.getElementById('inventory-value').textContent = utils.formatCurrency(summary.inventory.totalValue);
            document.getElementById('low-stock-count').textContent = summary.inventory.lowStock + summary.inventory.outOfStock;
            document.getElementById('monthly-sales').textContent = utils.formatCurrency(summary.sales.month.total);
            document.getElementById('monthly-transactions').textContent = `${summary.sales.month.transactions} transactions`;

            // Update recent sales table
            const salesTable = document.getElementById('recent-sales-table');
            if (recentSales.length === 0) {
                salesTable.innerHTML = '<tr><td colspan="4" class="text-center">No sales today</td></tr>';
            } else {
                salesTable.innerHTML = recentSales.map(sale => `
                    <tr>
                        <td>${sale.receipt_number}</td>
                        <td>${sale.customer_name || 'Walk-in'}</td>
                        <td>${utils.formatCurrency(sale.total)}</td>
                        <td>${utils.formatDate(sale.created_at)}</td>
                    </tr>
                `).join('');
            }

            // Update low stock table
            const stockTable = document.getElementById('low-stock-table');
            if (lowStock.length === 0) {
                stockTable.innerHTML = '<tr><td colspan="4" class="text-center">All items in stock</td></tr>';
            } else {
                stockTable.innerHTML = lowStock.slice(0, 5).map(product => `
                    <tr>
                        <td>${product.name}</td>
                        <td>${product.sku}</td>
                        <td><span class="badge ${product.quantity === 0 ? 'badge-danger' : 'badge-warning'}">${product.quantity}</span></td>
                        <td>
                            <button class="btn btn-sm btn-primary" onclick="inventory.showAdjustModal(${product.id}, '${product.name}', ${product.quantity})">
                                <i class="fas fa-plus"></i>
                            </button>
                        </td>
                    </tr>
                `).join('');
            }

            document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch (error) {
            utils.showToast('Failed to load dashboard data', 'error');
        }
    }
};

// POS module
const pos = {
    products: [],
    categories: [],
    customers: [],
    paymentMethod: 'cash',

    async init() {
        await Promise.all([
            this.loadProducts(),
            this.loadCategories(),
            this.loadCustomers()
        ]);
        this.setupEventListeners();
    },

    async loadProducts() {
        try {
            const data = await api.get('/products?limit=100');
            this.products = data.products;
            this.renderProducts();
        } catch (error) {
            utils.showToast('Failed to load products', 'error');
        }
    },

    async loadCategories() {
        try {
            this.categories = await api.get('/categories');
            this.renderCategoryFilter();
        } catch (error) {
            console.error('Failed to load categories');
        }
    },

    async loadCustomers() {
        try {
            const data = await api.get('/customers?limit=100');
            this.customers = data.customers;
            this.renderCustomers();
        } catch (error) {
            console.error('Failed to load customers');
        }
    },

    renderCategoryFilter() {
        const select = document.getElementById('pos-category-filter');
        select.innerHTML = '<option value="">All Categories</option>' +
            this.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    },

    renderCustomers() {
        const select = document.getElementById('pos-customer');
        select.innerHTML = '<option value="">Walk-in Customer</option>' +
            this.customers.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    },

    renderProducts(filter = '', categoryId = '') {
        let filtered = this.products.filter(p => p.is_active !== 0);
        
        if (filter) {
            const search = filter.toLowerCase();
            filtered = filtered.filter(p => 
                p.name.toLowerCase().includes(search) ||
                p.sku.toLowerCase().includes(search) ||
                (p.barcode && p.barcode.includes(search))
            );
        }

        if (categoryId) {
            filtered = filtered.filter(p => p.category_id == categoryId);
        }

        const grid = document.getElementById('pos-products-grid');
        if (filtered.length === 0) {
            grid.innerHTML = '<p class="text-center">No products found</p>';
            return;
        }

        grid.innerHTML = filtered.map(product => `
            <div class="product-card ${product.quantity <= 0 ? 'out-of-stock' : ''}" 
                 onclick="pos.addToCart(${product.id})">
                <h4>${product.name}</h4>
                <p>${utils.formatCurrency(product.selling_price)}</p>
                <span>${product.quantity > 0 ? `${product.quantity} in stock` : 'Out of stock'}</span>
            </div>
        `).join('');
    },

    addToCart(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) return;

        if (product.quantity <= 0) {
            utils.showToast('Product is out of stock', 'warning');
            return;
        }

        const existing = state.cart.find(item => item.productId === productId);
        if (existing) {
            if (existing.quantity >= product.quantity) {
                utils.showToast('Not enough stock', 'warning');
                return;
            }
            existing.quantity++;
            existing.totalPrice = existing.quantity * existing.unitPrice;
        } else {
            state.cart.push({
                productId: product.id,
                name: product.name,
                sku: product.sku,
                quantity: 1,
                unitPrice: product.selling_price,
                totalPrice: product.selling_price
            });
        }

        this.renderCart();
    },

    updateQuantity(productId, delta) {
        const item = state.cart.find(i => i.productId === productId);
        if (!item) return;

        const product = this.products.find(p => p.id === productId);
        const newQty = item.quantity + delta;

        if (newQty <= 0) {
            state.cart = state.cart.filter(i => i.productId !== productId);
        } else if (newQty > product.quantity) {
            utils.showToast('Not enough stock', 'warning');
            return;
        } else {
            item.quantity = newQty;
            item.totalPrice = item.quantity * item.unitPrice;
        }

        this.renderCart();
    },

    removeFromCart(productId) {
        state.cart = state.cart.filter(i => i.productId !== productId);
        this.renderCart();
    },

    renderCart() {
        const container = document.getElementById('cart-items');
        
        if (state.cart.length === 0) {
            container.innerHTML = '<div class="cart-empty">Add items to start a sale</div>';
            document.getElementById('cart-subtotal').textContent = '$0.00';
            document.getElementById('cart-tax').textContent = '$0.00';
            document.getElementById('cart-total').textContent = '$0.00';
            return;
        }

        container.innerHTML = state.cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${utils.formatCurrency(item.unitPrice)} each</p>
                </div>
                <div class="cart-item-qty">
                    <button onclick="pos.updateQuantity(${item.productId}, -1)">-</button>
                    <span>${item.quantity}</span>
                    <button onclick="pos.updateQuantity(${item.productId}, 1)">+</button>
                </div>
                <div class="cart-item-price">${utils.formatCurrency(item.totalPrice)}</div>
                <button onclick="pos.removeFromCart(${item.productId})" class="btn btn-sm btn-danger">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        this.updateTotals();
    },

    updateTotals() {
        const subtotal = state.cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxRate = parseFloat(state.settings?.tax_rate || 0) / 100;
        const tax = subtotal * taxRate;
        const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
        const total = subtotal + tax - discount;

        document.getElementById('cart-subtotal').textContent = utils.formatCurrency(subtotal);
        document.getElementById('cart-tax').textContent = utils.formatCurrency(tax);
        document.getElementById('cart-total').textContent = utils.formatCurrency(total);
    },

    clearCart() {
        state.cart = [];
        document.getElementById('cart-discount').value = 0;
        document.getElementById('pos-customer').value = '';
        this.renderCart();
    },

    async checkout() {
        if (state.cart.length === 0) {
            utils.showToast('Cart is empty', 'warning');
            return;
        }

        const subtotal = state.cart.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxRate = parseFloat(state.settings?.tax_rate || 0) / 100;
        const tax = subtotal * taxRate;
        const discount = parseFloat(document.getElementById('cart-discount').value) || 0;
        const total = subtotal + tax - discount;

        if (this.paymentMethod === 'cash') {
            const received = parseFloat(document.getElementById('cash-received').value) || 0;
            if (received < total) {
                utils.showToast('Insufficient cash received', 'error');
                return;
            }
        }

        try {
            const sale = await api.post('/sales', {
                customerId: document.getElementById('pos-customer').value || null,
                items: state.cart.map(item => ({
                    productId: item.productId,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice
                })),
                paymentMethod: this.paymentMethod,
                discount,
                tax
            });

            utils.showToast('Sale completed successfully', 'success');
            this.showReceipt(sale);
            this.clearCart();
            await this.loadProducts(); // Reload products for updated stock
            dashboard.load();
        } catch (error) {
            utils.showToast(error.message || 'Failed to complete sale', 'error');
        }
    },

    showReceipt(sale) {
        const modal = document.getElementById('receipt-modal');
        const body = document.getElementById('receipt-body');

        const change = this.paymentMethod === 'cash' ?
            (parseFloat(document.getElementById('cash-received').value) - sale.total) : 0;

        body.innerHTML = `
            <div class="receipt">
                <div class="receipt-header">
                    <h3>${state.settings?.store_name || 'StoreFront'}</h3>
                    <p>${state.settings?.store_address || ''}</p>
                    <p>${state.settings?.store_phone || ''}</p>
                </div>
                <hr class="receipt-divider">
                <p>Receipt #: ${sale.receipt_number}</p>
                <p>Date: ${utils.formatDate(sale.created_at)}</p>
                <p>Cashier: ${state.user?.fullName || state.user?.username}</p>
                <hr class="receipt-divider">
                <div class="receipt-items">
                    ${sale.items.map(item => `
                        <div class="receipt-item">
                            <span>${item.product_name} x${item.quantity}</span>
                            <span>${utils.formatCurrency(item.total_price)}</span>
                        </div>
                    `).join('')}
                </div>
                <hr class="receipt-divider">
                <div class="receipt-totals">
                    <div class="receipt-item">
                        <span>Subtotal</span>
                        <span>${utils.formatCurrency(sale.subtotal)}</span>
                    </div>
                    <div class="receipt-item">
                        <span>Tax</span>
                        <span>${utils.formatCurrency(sale.tax)}</span>
                    </div>
                    ${sale.discount > 0 ? `
                        <div class="receipt-item">
                            <span>Discount</span>
                            <span>-${utils.formatCurrency(sale.discount)}</span>
                        </div>
                    ` : ''}
                    <div class="receipt-item" style="font-weight: bold; font-size: 14px;">
                        <span>Total</span>
                        <span>${utils.formatCurrency(sale.total)}</span>
                    </div>
                    <div class="receipt-item">
                        <span>Payment</span>
                        <span>${sale.payment_method.toUpperCase()}</span>
                    </div>
                    ${this.paymentMethod === 'cash' ? `
                        <div class="receipt-item">
                            <span>Received</span>
                            <span>${utils.formatCurrency(parseFloat(document.getElementById('cash-received').value))}</span>
                        </div>
                        <div class="receipt-item">
                            <span>Change</span>
                            <span>${utils.formatCurrency(change)}</span>
                        </div>
                    ` : ''}
                </div>
                <hr class="receipt-divider">
                <div class="receipt-footer">
                    <p>${state.settings?.receipt_footer || 'Thank you for your purchase!'}</p>
                </div>
            </div>
        `;

        modal.classList.add('active');
        document.getElementById('cash-received').value = '';
    },

    setupEventListeners() {
        // Search
        document.getElementById('pos-search').addEventListener('input', utils.debounce((e) => {
            const categoryId = document.getElementById('pos-category-filter').value;
            this.renderProducts(e.target.value, categoryId);
        }, 300));

        // Category filter
        document.getElementById('pos-category-filter').addEventListener('change', (e) => {
            const search = document.getElementById('pos-search').value;
            this.renderProducts(search, e.target.value);
        });

        // Payment methods
        document.querySelectorAll('.payment-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.paymentMethod = btn.dataset.method;
                
                const cashSection = document.getElementById('cash-payment-section');
                if (this.paymentMethod === 'cash') {
                    cashSection.classList.remove('hidden');
                } else {
                    cashSection.classList.add('hidden');
                }
            });
        });

        // Discount change
        document.getElementById('cart-discount').addEventListener('input', () => this.updateTotals());

        // Cash received
        document.getElementById('cash-received').addEventListener('input', () => {
            const total = parseFloat(document.getElementById('cart-total').textContent.replace(/[^0-9.-]+/g, ''));
            const received = parseFloat(document.getElementById('cash-received').value) || 0;
            const change = Math.max(0, received - total);
            document.getElementById('change-due').textContent = utils.formatCurrency(change);
        });

        // Clear cart
        document.getElementById('clear-cart-btn').addEventListener('click', () => {
            if (state.cart.length > 0 && confirm('Clear all items from cart?')) {
                this.clearCart();
            }
        });

        // Checkout
        document.getElementById('checkout-btn').addEventListener('click', () => this.checkout());

        // Print receipt
        document.getElementById('print-receipt-btn').addEventListener('click', () => {
            window.print();
        });
    }
};

// Products module
const products = {
    currentPage: 1,
    totalPages: 1,

    async load(page = 1) {
        try {
            const search = document.getElementById('product-search')?.value || '';
            const category = document.getElementById('product-category-filter')?.value || '';
            const status = document.getElementById('product-status-filter')?.value || '';

            let url = `/products?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (category) url += `&category=${category}`;
            if (status) url += `&active=${status === 'active' ? 'true' : 'false'}`;

            const data = await api.get(url);
            this.currentPage = data.pagination.page;
            this.totalPages = data.pagination.totalPages;
            this.render(data.products);
            this.renderPagination();
        } catch (error) {
            utils.showToast('Failed to load products', 'error');
        }
    },

    render(products) {
        const tbody = document.getElementById('products-table');
        if (products.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No products found</td></tr>';
            return;
        }

        tbody.innerHTML = products.map(p => `
            <tr>
                <td>${p.sku}</td>
                <td>${p.name}</td>
                <td>${p.category_name || '-'}</td>
                <td>${utils.formatCurrency(p.cost_price)}</td>
                <td>${utils.formatCurrency(p.selling_price)}</td>
                <td><span class="badge ${p.quantity <= 0 ? 'badge-danger' : p.quantity <= p.min_stock_level ? 'badge-warning' : 'badge-success'}">${p.quantity}</span></td>
                <td><span class="badge ${p.is_active ? 'badge-success' : 'badge-secondary'}">${p.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="products.showEditModal(${p.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPagination() {
        const container = document.getElementById('products-pagination');
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= this.totalPages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="products.load(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    async showAddModal() {
        const categories = await api.get('/categories');
        const suppliers = await api.get('/suppliers');
        
        modal.show('Add Product', `
            <form id="product-form">
                <div class="form-group">
                    <label>SKU *</label>
                    <input type="text" id="product-sku" required>
                </div>
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="product-name" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="product-description"></textarea>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="product-category">
                        <option value="">None</option>
                        ${categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Supplier</label>
                    <select id="product-supplier">
                        <option value="">None</option>
                        ${suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Cost Price *</label>
                    <input type="number" id="product-cost" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>Selling Price *</label>
                    <input type="number" id="product-price" step="0.01" min="0" required>
                </div>
                <div class="form-group">
                    <label>Initial Quantity</label>
                    <input type="number" id="product-quantity" min="0" value="0">
                </div>
                <div class="form-group">
                    <label>Min Stock Level</label>
                    <input type="number" id="product-min-stock" min="0" value="10">
                </div>
                <div class="form-group">
                    <label>Barcode</label>
                    <input type="text" id="product-barcode">
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary btn-block">Add Product</button>
                </div>
            </form>
        `);

        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.save();
        });
    },

    async showEditModal(id) {
        const product = await api.get(`/products/${id}`);
        const categories = await api.get('/categories');
        const suppliers = await api.get('/suppliers');
        
        modal.show('Edit Product', `
            <form id="product-form">
                <input type="hidden" id="product-id" value="${product.id}">
                <div class="form-group">
                    <label>SKU</label>
                    <input type="text" id="product-sku" value="${product.sku}" readonly style="background:#f1f5f9">
                </div>
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="product-name" value="${product.name}" required>
                </div>
                <div class="form-group">
                    <label>Description</label>
                    <textarea id="product-description">${product.description || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Category</label>
                    <select id="product-category">
                        <option value="">None</option>
                        ${categories.map(c => `<option value="${c.id}" ${c.id == product.category_id ? 'selected' : ''}>${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Supplier</label>
                    <select id="product-supplier">
                        <option value="">None</option>
                        ${suppliers.map(s => `<option value="${s.id}" ${s.id == product.supplier_id ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label>Cost Price *</label>
                    <input type="number" id="product-cost" step="0.01" min="0" value="${product.cost_price}" required>
                </div>
                <div class="form-group">
                    <label>Selling Price *</label>
                    <input type="number" id="product-price" step="0.01" min="0" value="${product.selling_price}" required>
                </div>
                <div class="form-group">
                    <label>Min Stock Level</label>
                    <input type="number" id="product-min-stock" min="0" value="${product.min_stock_level}">
                </div>
                <div class="form-group">
                    <label>Max Stock Level</label>
                    <input type="number" id="product-max-stock" min="0" value="${product.max_stock_level}">
                </div>
                <div class="form-group">
                    <label>Barcode</label>
                    <input type="text" id="product-barcode" value="${product.barcode || ''}">
                </div>
                <div class="form-group">
                    <label>Status</label>
                    <select id="product-status">
                        <option value="1" ${product.is_active ? 'selected' : ''}>Active</option>
                        <option value="0" ${!product.is_active ? 'selected' : ''}>Inactive</option>
                    </select>
                </div>
                <div class="form-group">
                    <button type="submit" class="btn btn-primary btn-block">Update Product</button>
                </div>
            </form>
        `);

        document.getElementById('product-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.update(id);
        });
    },

    async save() {
        try {
            await api.post('/products', {
                sku: document.getElementById('product-sku').value,
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                categoryId: document.getElementById('product-category').value || null,
                supplierId: document.getElementById('product-supplier').value || null,
                costPrice: parseFloat(document.getElementById('product-cost').value),
                sellingPrice: parseFloat(document.getElementById('product-price').value),
                quantity: parseInt(document.getElementById('product-quantity').value) || 0,
                minStockLevel: parseInt(document.getElementById('product-min-stock').value) || 10,
                barcode: document.getElementById('product-barcode').value
            });

            utils.showToast('Product added successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async update(id) {
        try {
            await api.put(`/products/${id}`, {
                name: document.getElementById('product-name').value,
                description: document.getElementById('product-description').value,
                categoryId: document.getElementById('product-category').value || null,
                supplierId: document.getElementById('product-supplier').value || null,
                costPrice: parseFloat(document.getElementById('product-cost').value),
                sellingPrice: parseFloat(document.getElementById('product-price').value),
                minStockLevel: parseInt(document.getElementById('product-min-stock').value),
                maxStockLevel: parseInt(document.getElementById('product-max-stock').value),
                barcode: document.getElementById('product-barcode').value,
                isActive: document.getElementById('product-status').value === '1'
            });

            utils.showToast('Product updated successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    }
};

// Inventory module
const inventory = {
    currentPage: 1,
    totalPages: 1,

    async load(page = 1) {
        try {
            const search = document.getElementById('inventory-search')?.value || '';
            const status = document.getElementById('inventory-status-filter')?.value || '';

            let url = `/inventory?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (status) url += `&${status}=true`;

            const [data, summary] = await Promise.all([
                api.get(url),
                api.get('/inventory/summary')
            ]);

            this.currentPage = data.pagination.page;
            this.totalPages = data.pagination.totalPages;

            // Update summary
            document.getElementById('inv-total-products').textContent = summary.total_products || 0;
            document.getElementById('inv-total-units').textContent = summary.total_units || 0;
            document.getElementById('inv-total-value').textContent = utils.formatCurrency(summary.total_inventory_value);
            document.getElementById('inv-low-stock').textContent = summary.low_stock_count || 0;
            document.getElementById('inv-out-stock').textContent = summary.out_of_stock_count || 0;

            this.render(data.inventory);
            this.renderPagination();
        } catch (error) {
            utils.showToast('Failed to load inventory', 'error');
        }
    },

    render(items) {
        const tbody = document.getElementById('inventory-table');
        if (items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No inventory items found</td></tr>';
            return;
        }

        tbody.innerHTML = items.map(item => `
            <tr>
                <td>${item.sku}</td>
                <td>${item.name}</td>
                <td>${item.quantity}</td>
                <td>${item.min_stock_level}</td>
                <td>${item.max_stock_level}</td>
                <td>${utils.formatCurrency(item.quantity * item.cost_price)}</td>
                <td><span class="badge ${item.stock_status === 'in_stock' ? 'badge-success' : item.stock_status === 'low_stock' ? 'badge-warning' : 'badge-danger'}">${item.stock_status.replace('_', ' ')}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="inventory.showAdjustModal(${item.id}, '${item.name}', ${item.quantity})">
                        <i class="fas fa-adjust"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="inventory.showHistory(${item.id})">
                        <i class="fas fa-history"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPagination() {
        const container = document.getElementById('inventory-pagination');
        if (this.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= this.totalPages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="inventory.load(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    showAdjustModal(productId, name, currentQty) {
        modal.show('Stock Adjustment', `
            <form id="adjust-form">
                <input type="hidden" id="adjust-product-id" value="${productId}">
                <p><strong>Product:</strong> ${name}</p>
                <p><strong>Current Stock:</strong> ${currentQty}</p>
                <div class="form-group">
                    <label>Adjustment Type</label>
                    <select id="adjust-type">
                        <option value="add">Add Stock</option>
                        <option value="subtract">Subtract Stock</option>
                        <option value="set">Set Stock To</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Quantity</label>
                    <input type="number" id="adjust-quantity" min="0" required>
                </div>
                <div class="form-group">
                    <label>Reason</label>
                    <input type="text" id="adjust-reason" required placeholder="e.g., Stock delivery, Damaged goods">
                </div>
                <button type="submit" class="btn btn-primary btn-block">Apply Adjustment</button>
            </form>
        `);

        document.getElementById('adjust-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.adjust();
        });
    },

    async adjust() {
        try {
            await api.post('/inventory/adjust', {
                productId: parseInt(document.getElementById('adjust-product-id').value),
                quantity: parseInt(document.getElementById('adjust-quantity').value),
                type: document.getElementById('adjust-type').value,
                reason: document.getElementById('adjust-reason').value
            });

            utils.showToast('Stock adjusted successfully', 'success');
            modal.hide();
            this.load();
            pos.loadProducts();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async showHistory(productId) {
        try {
            const data = await api.get(`/inventory/transactions?productId=${productId}&limit=20`);
            
            modal.show('Stock History', `
                <table class="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Qty</th>
                            <th>Before</th>
                            <th>After</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${data.transactions.length === 0 ? '<tr><td colspan="6" class="text-center">No history</td></tr>' : 
                          data.transactions.map(t => `
                            <tr>
                                <td>${utils.formatDate(t.created_at)}</td>
                                <td><span class="badge badge-info">${t.transaction_type}</span></td>
                                <td>${t.quantity > 0 ? '+' : ''}${t.quantity}</td>
                                <td>${t.previous_quantity}</td>
                                <td>${t.new_quantity}</td>
                                <td>${t.notes || '-'}</td>
                            </tr>
                          `).join('')}
                    </tbody>
                </table>
            `);
        } catch (error) {
            utils.showToast('Failed to load history', 'error');
        }
    }
};

// Sales module
const sales = {
    currentPage: 1,

    async load(page = 1) {
        try {
            const startDate = document.getElementById('sales-start-date')?.value || '';
            const endDate = document.getElementById('sales-end-date')?.value || '';

            let url = `/sales?page=${page}&limit=20`;
            if (startDate) url += `&startDate=${startDate}`;
            if (endDate) url += `&endDate=${endDate}`;

            const data = await api.get(url);
            this.currentPage = data.pagination.page;

            // Update summary
            const total = data.sales.reduce((sum, s) => sum + s.total, 0);
            document.getElementById('sales-summary-total').textContent = utils.formatCurrency(total);
            document.getElementById('sales-summary-count').textContent = data.pagination.total;
            document.getElementById('sales-summary-avg').textContent = utils.formatCurrency(total / (data.pagination.total || 1));

            this.render(data.sales);
            this.renderPagination(data.pagination);
        } catch (error) {
            utils.showToast('Failed to load sales', 'error');
        }
    },

    render(sales) {
        const tbody = document.getElementById('sales-table');
        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No sales found</td></tr>';
            return;
        }

        tbody.innerHTML = sales.map(s => `
            <tr>
                <td>${s.receipt_number}</td>
                <td>${utils.formatDate(s.created_at)}</td>
                <td>${s.customer_name || 'Walk-in'}</td>
                <td>-</td>
                <td>${utils.formatCurrency(s.total)}</td>
                <td><span class="badge badge-info">${s.payment_method}</span></td>
                <td><span class="badge ${s.payment_status === 'completed' ? 'badge-success' : s.payment_status === 'voided' ? 'badge-danger' : 'badge-warning'}">${s.payment_status}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="sales.viewDetails(${s.id})">
                        <i class="fas fa-eye"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPagination(pagination) {
        const container = document.getElementById('sales-pagination');
        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= pagination.totalPages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="sales.load(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    async viewDetails(id) {
        try {
            const sale = await api.get(`/sales/${id}`);
            
            modal.show(`Sale Details - ${sale.receipt_number}`, `
                <div class="sale-details">
                    <p><strong>Date:</strong> ${utils.formatDate(sale.created_at)}</p>
                    <p><strong>Customer:</strong> ${sale.customer_name || 'Walk-in'}</p>
                    <p><strong>Cashier:</strong> ${sale.user_name}</p>
                    <hr>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Price</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sale.items.map(item => `
                                <tr>
                                    <td>${item.product_name}</td>
                                    <td>${item.quantity}</td>
                                    <td>${utils.formatCurrency(item.unit_price)}</td>
                                    <td>${utils.formatCurrency(item.total_price)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <hr>
                    <p><strong>Subtotal:</strong> ${utils.formatCurrency(sale.subtotal)}</p>
                    <p><strong>Tax:</strong> ${utils.formatCurrency(sale.tax)}</p>
                    ${sale.discount > 0 ? `<p><strong>Discount:</strong> -${utils.formatCurrency(sale.discount)}</p>` : ''}
                    <p><strong>Total:</strong> ${utils.formatCurrency(sale.total)}</p>
                    <p><strong>Payment:</strong> ${sale.payment_method.toUpperCase()}</p>
                    <p><strong>Status:</strong> <span class="badge ${sale.payment_status === 'completed' ? 'badge-success' : 'badge-danger'}">${sale.payment_status}</span></p>
                </div>
            `);
        } catch (error) {
            utils.showToast('Failed to load sale details', 'error');
        }
    }
};

// Customers module
const customers = {
    currentPage: 1,

    async load(page = 1) {
        try {
            const search = document.getElementById('customer-search')?.value || '';
            let url = `/customers?page=${page}&limit=20`;
            if (search) url += `&search=${encodeURIComponent(search)}`;

            const data = await api.get(url);
            this.currentPage = data.pagination.page;
            this.render(data.customers);
            this.renderPagination(data.pagination);
        } catch (error) {
            utils.showToast('Failed to load customers', 'error');
        }
    },

    render(customers) {
        const tbody = document.getElementById('customers-table');
        if (customers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No customers found</td></tr>';
            return;
        }

        tbody.innerHTML = customers.map(c => `
            <tr>
                <td>${c.name}</td>
                <td>${c.email || '-'}</td>
                <td>${c.phone || '-'}</td>
                <td>${c.loyalty_points || 0}</td>
                <td>${utils.formatCurrency(c.total_purchases)}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="customers.showEditModal(${c.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    renderPagination(pagination) {
        const container = document.getElementById('customers-pagination');
        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';
        for (let i = 1; i <= pagination.totalPages; i++) {
            html += `<button class="${i === this.currentPage ? 'active' : ''}" onclick="customers.load(${i})">${i}</button>`;
        }
        container.innerHTML = html;
    },

    showAddModal() {
        modal.show('Add Customer', `
            <form id="customer-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="customer-name" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="customer-email">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="customer-phone">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="customer-address"></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Add Customer</button>
            </form>
        `);

        document.getElementById('customer-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.save();
        });
    },

    async showEditModal(id) {
        const customer = await api.get(`/customers/${id}`);
        
        modal.show('Edit Customer', `
            <form id="customer-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="customer-name" value="${customer.name}" required>
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="customer-email" value="${customer.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="customer-phone" value="${customer.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="customer-address">${customer.address || ''}</textarea>
                </div>
                <div class="form-group">
                    <label>Loyalty Points: ${customer.loyalty_points}</label>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Update Customer</button>
            </form>
        `);

        document.getElementById('customer-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.update(id);
        });
    },

    async save() {
        try {
            await api.post('/customers', {
                name: document.getElementById('customer-name').value,
                email: document.getElementById('customer-email').value,
                phone: document.getElementById('customer-phone').value,
                address: document.getElementById('customer-address').value
            });

            utils.showToast('Customer added successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async update(id) {
        try {
            await api.put(`/customers/${id}`, {
                name: document.getElementById('customer-name').value,
                email: document.getElementById('customer-email').value,
                phone: document.getElementById('customer-phone').value,
                address: document.getElementById('customer-address').value
            });

            utils.showToast('Customer updated successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    }
};

// Suppliers module
const suppliers = {
    async load() {
        try {
            const data = await api.get('/suppliers');
            this.render(data);
        } catch (error) {
            utils.showToast('Failed to load suppliers', 'error');
        }
    },

    render(suppliers) {
        const tbody = document.getElementById('suppliers-table');
        if (suppliers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No suppliers found</td></tr>';
            return;
        }

        tbody.innerHTML = suppliers.map(s => `
            <tr>
                <td>${s.name}</td>
                <td>${s.contact_person || '-'}</td>
                <td>${s.email || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.product_count || 0}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="suppliers.showEditModal(${s.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    },

    showAddModal() {
        modal.show('Add Supplier', `
            <form id="supplier-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="supplier-name" required>
                </div>
                <div class="form-group">
                    <label>Contact Person</label>
                    <input type="text" id="supplier-contact">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="supplier-email">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="supplier-phone">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="supplier-address"></textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Add Supplier</button>
            </form>
        `);

        document.getElementById('supplier-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.save();
        });
    },

    async showEditModal(id) {
        const supplier = await api.get(`/suppliers/${id}`);
        
        modal.show('Edit Supplier', `
            <form id="supplier-form">
                <div class="form-group">
                    <label>Name *</label>
                    <input type="text" id="supplier-name" value="${supplier.name}" required>
                </div>
                <div class="form-group">
                    <label>Contact Person</label>
                    <input type="text" id="supplier-contact" value="${supplier.contact_person || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="supplier-email" value="${supplier.email || ''}">
                </div>
                <div class="form-group">
                    <label>Phone</label>
                    <input type="tel" id="supplier-phone" value="${supplier.phone || ''}">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <textarea id="supplier-address">${supplier.address || ''}</textarea>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Update Supplier</button>
            </form>
        `);

        document.getElementById('supplier-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.update(id);
        });
    },

    async save() {
        try {
            await api.post('/suppliers', {
                name: document.getElementById('supplier-name').value,
                contactPerson: document.getElementById('supplier-contact').value,
                email: document.getElementById('supplier-email').value,
                phone: document.getElementById('supplier-phone').value,
                address: document.getElementById('supplier-address').value
            });

            utils.showToast('Supplier added successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async update(id) {
        try {
            await api.put(`/suppliers/${id}`, {
                name: document.getElementById('supplier-name').value,
                contactPerson: document.getElementById('supplier-contact').value,
                email: document.getElementById('supplier-email').value,
                phone: document.getElementById('supplier-phone').value,
                address: document.getElementById('supplier-address').value
            });

            utils.showToast('Supplier updated successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    }
};

// Reports module
const reports = {
    async load() {
        const today = new Date();
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
        
        document.getElementById('report-start-date').value = monthAgo.toISOString().split('T')[0];
        document.getElementById('report-end-date').value = today.toISOString().split('T')[0];

        await this.refresh();
    },

    async refresh() {
        const startDate = document.getElementById('report-start-date').value;
        const endDate = document.getElementById('report-end-date').value;

        try {
            const [salesReport, topProducts, paymentBreakdown, categories] = await Promise.all([
                api.get(`/reports/sales?startDate=${startDate}&endDate=${endDate}`),
                api.get(`/reports/products?startDate=${startDate}&endDate=${endDate}&limit=5`),
                api.get(`/reports/payment-breakdown?startDate=${startDate}&endDate=${endDate}`),
                api.get(`/reports/categories?startDate=${startDate}&endDate=${endDate}`)
            ]);

            // Sales report
            document.getElementById('sales-report').innerHTML = `
                <div class="report-stats">
                    <div class="report-stat">
                        <span>Total Revenue</span>
                        <strong>${utils.formatCurrency(salesReport.summary.total_sales)}</strong>
                    </div>
                    <div class="report-stat">
                        <span>Transactions</span>
                        <strong>${salesReport.summary.total_transactions}</strong>
                    </div>
                    <div class="report-stat">
                        <span>Average Sale</span>
                        <strong>${utils.formatCurrency(salesReport.summary.average_sale)}</strong>
                    </div>
                </div>
            `;

            // Top products
            document.getElementById('top-products-report').innerHTML = topProducts.length === 0
                ? '<p class="text-center">No data</p>'
                : `<ol>${topProducts.map(p => `<li>${p.name} - ${utils.formatCurrency(p.revenue)} (${p.total_quantity} sold)</li>`).join('')}</ol>`;

            // Payment breakdown
            document.getElementById('payment-report').innerHTML = paymentBreakdown.length === 0
                ? '<p class="text-center">No data</p>'
                : paymentBreakdown.map(p => `
                    <div class="payment-stat">
                        <span>${p.payment_method.toUpperCase()}</span>
                        <strong>${utils.formatCurrency(p.total)}</strong>
                        <small>${p.count} transactions</small>
                    </div>
                `).join('');

            // Category performance
            document.getElementById('category-report').innerHTML = categories.length === 0
                ? '<p class="text-center">No data</p>'
                : `<table class="table">
                    <thead><tr><th>Category</th><th>Revenue</th></tr></thead>
                    <tbody>${categories.map(c => `
                        <tr><td>${c.name}</td><td>${utils.formatCurrency(c.total_revenue)}</td></tr>
                    `).join('')}</tbody>
                </table>`;

        } catch (error) {
            utils.showToast('Failed to load reports', 'error');
        }
    }
};

// Users module
const users = {
    async load() {
        try {
            const data = await api.get('/users');
            this.render(data.users);
        } catch (error) {
            utils.showToast('Failed to load users', 'error');
        }
    },

    render(users) {
        const tbody = document.getElementById('users-table');
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No users found</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.username}</td>
                <td>${u.full_name || '-'}</td>
                <td>${u.email || '-'}</td>
                <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : u.role === 'manager' ? 'badge-warning' : 'badge-info'}">${u.role}</span></td>
                <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-secondary'}">${u.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>${u.last_login ? utils.formatDate(u.last_login) : 'Never'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="users.showEditModal(${u.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${u.is_active 
                        ? `<button class="btn btn-sm btn-warning" onclick="users.deactivate(${u.id})"><i class="fas fa-ban"></i></button>`
                        : `<button class="btn btn-sm btn-success" onclick="users.activate(${u.id})"><i class="fas fa-check"></i></button>`
                    }
                </td>
            </tr>
        `).join('');
    },

    showAddModal() {
        modal.show('Add User', `
            <form id="user-form">
                <div class="form-group">
                    <label>Username *</label>
                    <input type="text" id="user-username" required minlength="3">
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="user-fullname">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="user-email">
                </div>
                <div class="form-group">
                    <label>Password *</label>
                    <input type="password" id="user-password" required minlength="6">
                </div>
                <div class="form-group">
                    <label>Role *</label>
                    <select id="user-role">
                        <option value="staff">Staff</option>
                        <option value="cashier">Cashier</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Add User</button>
            </form>
        `);

        document.getElementById('user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.save();
        });
    },

    async showEditModal(id) {
        const user = await api.get(`/users/${id}`);
        
        modal.show('Edit User', `
            <form id="user-form">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" value="${user.username}" disabled style="background:#f1f5f9">
                </div>
                <div class="form-group">
                    <label>Full Name</label>
                    <input type="text" id="user-fullname" value="${user.full_name || ''}">
                </div>
                <div class="form-group">
                    <label>Email</label>
                    <input type="email" id="user-email" value="${user.email || ''}">
                </div>
                <div class="form-group">
                    <label>Role</label>
                    <select id="user-role">
                        <option value="staff" ${user.role === 'staff' ? 'selected' : ''}>Staff</option>
                        <option value="cashier" ${user.role === 'cashier' ? 'selected' : ''}>Cashier</option>
                        <option value="manager" ${user.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                    </select>
                </div>
                <button type="submit" class="btn btn-primary btn-block">Update User</button>
            </form>
            <hr>
            <button class="btn btn-warning btn-block" onclick="users.resetPassword(${user.id})">Reset Password</button>
        `);

        document.getElementById('user-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.update(id);
        });
    },

    async save() {
        try {
            await api.post('/users', {
                username: document.getElementById('user-username').value,
                fullName: document.getElementById('user-fullname').value,
                email: document.getElementById('user-email').value,
                password: document.getElementById('user-password').value,
                role: document.getElementById('user-role').value
            });

            utils.showToast('User added successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async update(id) {
        try {
            await api.put(`/users/${id}`, {
                fullName: document.getElementById('user-fullname').value,
                email: document.getElementById('user-email').value,
                role: document.getElementById('user-role').value
            });

            utils.showToast('User updated successfully', 'success');
            modal.hide();
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async resetPassword(id) {
        const newPassword = prompt('Enter new password (min 6 characters):');
        if (!newPassword || newPassword.length < 6) {
            utils.showToast('Password must be at least 6 characters', 'error');
            return;
        }

        try {
            await api.post(`/users/${id}/reset-password`, { newPassword });
            utils.showToast('Password reset successfully', 'success');
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async activate(id) {
        try {
            await api.post(`/users/${id}/activate`);
            utils.showToast('User activated', 'success');
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    },

    async deactivate(id) {
        if (!confirm('Are you sure you want to deactivate this user?')) return;
        
        try {
            await api.post(`/users/${id}/deactivate`);
            utils.showToast('User deactivated', 'success');
            this.load();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    }
};

// Settings
const settings = {
    async load() {
        try {
            const data = await api.get('/dashboard/summary');
            // Load settings from localStorage for now
            const saved = localStorage.getItem('storeSettings');
            state.settings = saved ? JSON.parse(saved) : {
                store_name: 'My Store',
                store_address: '',
                store_phone: '',
                tax_rate: 0,
                receipt_footer: 'Thank you for your purchase!'
            };

            document.getElementById('setting-store-name').value = state.settings.store_name || '';
            document.getElementById('setting-store-address').value = state.settings.store_address || '';
            document.getElementById('setting-store-phone').value = state.settings.store_phone || '';
            document.getElementById('setting-tax-rate').value = state.settings.tax_rate || 0;
            document.getElementById('setting-receipt-footer').value = state.settings.receipt_footer || '';
        } catch (error) {
            console.error('Failed to load settings');
        }
    },

    save(e) {
        e.preventDefault();
        state.settings = {
            store_name: document.getElementById('setting-store-name').value,
            store_address: document.getElementById('setting-store-address').value,
            store_phone: document.getElementById('setting-store-phone').value,
            tax_rate: document.getElementById('setting-tax-rate').value,
            receipt_footer: document.getElementById('setting-receipt-footer').value
        };
        localStorage.setItem('storeSettings', JSON.stringify(state.settings));
        utils.showToast('Settings saved successfully', 'success');
    },

    async changePassword(e) {
        e.preventDefault();
        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            utils.showToast('Passwords do not match', 'error');
            return;
        }

        try {
            await api.post('/auth/change-password', { currentPassword, newPassword });
            utils.showToast('Password changed successfully', 'success');
            e.target.reset();
        } catch (error) {
            utils.showToast(error.message, 'error');
        }
    }
};

// Modal helper
const modal = {
    show(title, content) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = content;
        document.getElementById('modal').classList.add('active');
    },

    hide() {
        document.getElementById('modal').classList.remove('active');
    }
};

// Navigation
function navigateTo(page) {
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });

    // Show page
    document.querySelectorAll('.page').forEach(p => {
        p.classList.remove('active');
    });
    document.getElementById(`page-${page}`).classList.add('active');

    state.currentPage = page;

    // Load page data
    switch (page) {
        case 'dashboard':
            dashboard.load();
            break;
        case 'pos':
            pos.init();
            break;
        case 'products':
            products.load();
            loadCategories();
            break;
        case 'inventory':
            inventory.load();
            break;
        case 'sales':
            sales.load();
            break;
        case 'customers':
            customers.load();
            break;
        case 'suppliers':
            suppliers.load();
            break;
        case 'reports':
            reports.load();
            break;
        case 'users':
            users.load();
            break;
        case 'settings':
            settings.load();
            break;
    }
}

async function loadCategories() {
    try {
        const categories = await api.get('/categories');
        const select = document.getElementById('product-category-filter');
        if (select) {
            select.innerHTML = '<option value="">All Categories</option>' +
                categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (error) {
        console.error('Failed to load categories');
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    // Login form handler
    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('login-error');

        try {
            await auth.login(username, password);
            auth.showApp();
            navigateTo('dashboard');
            utils.showToast(`Welcome, ${state.user?.fullName || state.user?.username}!`, 'success');
        } catch (error) {
            errorEl.textContent = error.message;
        }
    });

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', () => {
        if (confirm('Are you sure you want to logout?')) {
            auth.logout();
        }
    });

    // Navigation handlers
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            navigateTo(item.dataset.page);
        });
    });

    // Modal close handlers
    document.querySelectorAll('.modal-close, .modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => modal.hide());
    });

    document.getElementById('modal').addEventListener('click', (e) => {
        if (e.target.id === 'modal') modal.hide();
    });

    document.getElementById('receipt-modal').addEventListener('click', (e) => {
        if (e.target.id === 'receipt-modal') e.target.classList.remove('active');
    });

    // Add buttons
    document.getElementById('add-product-btn')?.addEventListener('click', () => products.showAddModal());
    document.getElementById('add-customer-btn')?.addEventListener('click', () => customers.showAddModal());
    document.getElementById('add-supplier-btn')?.addEventListener('click', () => suppliers.showAddModal());
    document.getElementById('add-user-btn')?.addEventListener('click', () => users.showAddModal());

    // Filters
    document.getElementById('product-search')?.addEventListener('input', utils.debounce(() => products.load(1), 300));
    document.getElementById('product-category-filter')?.addEventListener('change', () => products.load(1));
    document.getElementById('product-status-filter')?.addEventListener('change', () => products.load(1));
    document.getElementById('inventory-search')?.addEventListener('input', utils.debounce(() => inventory.load(1), 300));
    document.getElementById('inventory-status-filter')?.addEventListener('change', () => inventory.load(1));
    document.getElementById('customer-search')?.addEventListener('input', utils.debounce(() => customers.load(1), 300));
    document.getElementById('filter-sales-btn')?.addEventListener('click', () => sales.load(1));
    document.getElementById('generate-report-btn')?.addEventListener('click', () => reports.refresh());

    // Settings
    document.getElementById('store-settings-form')?.addEventListener('submit', (e) => settings.save(e));
    document.getElementById('change-password-form')?.addEventListener('submit', (e) => settings.changePassword(e));

    // Check authentication
    const isAuthed = await auth.checkAuth();
    if (isAuthed) {
        auth.showApp();
        navigateTo('dashboard');
    }
});