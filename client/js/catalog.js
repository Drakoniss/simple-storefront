// StoreFront Catalog Application
const API_BASE = '/api';

// Catalog State
const catalog = {
    products: [],
    categories: [],
    cart: [],
    currentCategory: '',
    searchQuery: '',
    page: 0,
    limit: 20,
    hasMore: true,
    currentProduct: null,
    taxRate: 0
};

// Utility functions
const utils = {
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount || 0);
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
    async get(endpoint) {
        const response = await fetch(`${API_BASE}${endpoint}`);
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    },

    async post(endpoint, data) {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Network error' }));
            throw new Error(error.error || 'Request failed');
        }
        return response.json();
    }
};

// Initialize catalog
async function initCatalog() {
    // Load cart from localStorage
    const savedCart = localStorage.getItem('catalogCart');
    if (savedCart) {
        catalog.cart = JSON.parse(savedCart);
        updateCartUI();
    }

    // Load tax rate
    try {
        const settings = await api.get('/settings');
        const taxSetting = settings.find(s => s.key === 'tax_rate');
        if (taxSetting) {
            catalog.taxRate = parseFloat(taxSetting.value) || 0;
        }
    } catch (e) {
        console.log('Using default tax rate');
    }

    // Load categories
    await loadCategories();

    // Load products
    await loadProducts();

    // Setup event listeners
    setupEventListeners();
}

// Load categories
async function loadCategories() {
    try {
        const data = await api.get('/catalog/categories');
        catalog.categories = data;

        const categoryList = document.getElementById('category-list');

        // Add "All Products" option
        let html = '<li class="category-item active" data-category="">All Products</li>';

        // Add categories
        data.forEach(cat => {
            html += `<li class="category-item" data-category="${cat.id}">
                ${cat.name}
                <span class="count">${cat.product_count || 0}</span>
            </li>`;
        });

        categoryList.innerHTML = html;

        // Add click handlers
        categoryList.querySelectorAll('.category-item').forEach(item => {
            item.addEventListener('click', () => {
                categoryList.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                catalog.currentCategory = item.dataset.category;
                catalog.page = 0;
                catalog.products = [];
                loadProducts();
            });
        });
    } catch (error) {
        console.error('Error loading categories:', error);
        utils.showToast('Failed to load categories', 'error');
    }
}

// Load products
async function loadProducts(append = false) {
    const productsGrid = document.getElementById('products-grid');
    const loadMoreBtn = document.getElementById('load-more-btn');

    if (!append) {
        productsGrid.innerHTML = '<div class="loading">Loading products...</div>';
    }

    try {
        let url = `/catalog/products?limit=${catalog.limit}&offset=${catalog.page * catalog.limit}`;

        if (catalog.currentCategory) {
            url += `&category=${catalog.currentCategory}`;
        }

        if (catalog.searchQuery) {
            url += `&search=${encodeURIComponent(catalog.searchQuery)}`;
        }

        const data = await api.get(url);

        if (append) {
            catalog.products = [...catalog.products, ...data.products];
        } else {
            catalog.products = data.products;
        }

        catalog.hasMore = data.pagination.hasMore;

        renderProducts();

        loadMoreBtn.style.display = catalog.hasMore ? 'block' : 'none';
    } catch (error) {
        console.error('Error loading products:', error);
        productsGrid.innerHTML = '<div class="loading">Failed to load products. Please try again.</div>';
    }
}

// Render products
function renderProducts() {
    const productsGrid = document.getElementById('products-grid');
    const productsCount = document.getElementById('products-count');

    if (catalog.products.length === 0) {
        productsGrid.innerHTML = '<div class="loading">No products found</div>';
        productsCount.textContent = '0 products';
        return;
    }

    productsCount.textContent = `${catalog.products.length} product${catalog.products.length !== 1 ? 's' : ''}`;

    let html = '';
    catalog.products.forEach(product => {
        const stockClass = product.quantity <= 0 ? 'out' : product.quantity <= 10 ? 'low' : '';
        const stockText = product.quantity <= 0 ? 'Out of stock' : product.quantity <= 10 ? `Only ${product.quantity} left` : 'In stock';
        const stockColor = product.quantity <= 0 ? 'var(--danger)' : product.quantity <= 10 ? 'var(--warning)' : 'var(--success)';

        html += `
            <div class="product-card" data-id="${product.id}">
                <div class="product-card-image">
                    ${product.image_url
                        ? `<img src="${product.image_url}" alt="${product.name}" onerror="this.parentElement.innerHTML='<i class=\\'fas fa-image\\'></i>'">`
                        : '<i class="fas fa-image"></i>'}
                    ${product.quantity <= 0 ? '<span class="product-card-badge">Out of Stock</span>' : ''}
                </div>
                <div class="product-card-content">
                    <h4>${product.name}</h4>
                    <p>${product.category_name || 'Uncategorized'}</p>
                    <div class="product-card-price">${utils.formatCurrency(product.selling_price)}</div>
                    <div class="product-card-stock ${stockClass}" style="color: ${stockColor}">${stockText}</div>
                </div>
            </div>
        `;
    });

    productsGrid.innerHTML = html;

    // Add click handlers
    productsGrid.querySelectorAll('.product-card').forEach(card => {
        card.addEventListener('click', () => showProductDetail(card.dataset.id));
    });
}

// Show product detail
async function showProductDetail(productId) {
    try {
        const product = await api.get(`/catalog/products/${productId}`);
        catalog.currentProduct = product;

        const modal = document.getElementById('product-modal');
        const imageDiv = document.getElementById('product-image');
        const nameEl = document.getElementById('product-name');
        const categoryEl = document.getElementById('product-category');
        const descEl = document.getElementById('product-description');
        const priceEl = document.getElementById('product-price');
        const stockEl = document.getElementById('product-stock');
        const qtyInput = document.getElementById('product-qty');

        // Set image
        if (product.image_url) {
            imageDiv.innerHTML = `<img src="${product.image_url}" alt="${product.name}">`;
        } else {
            imageDiv.innerHTML = '<i class="fas fa-image"></i>';
        }

        // Set info
        nameEl.textContent = product.name;
        categoryEl.textContent = product.category_name || 'Uncategorized';
        descEl.textContent = product.description || 'No description available';
        priceEl.textContent = utils.formatCurrency(product.selling_price);

        const stockClass = product.quantity <= 0 ? 'Out of stock' : product.quantity <= 10 ? `Only ${product.quantity} left` : 'In stock';
        stockEl.textContent = stockClass;

        qtyInput.value = 1;
        qtyInput.max = product.quantity || 99;

        modal.classList.add('active');
    } catch (error) {
        console.error('Error loading product:', error);
        utils.showToast('Failed to load product details', 'error');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Search
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('input', utils.debounce((e) => {
        catalog.searchQuery = e.target.value.trim();
        catalog.page = 0;
        catalog.products = [];
        loadProducts();
    }, 300));

    // Cart button
    document.getElementById('cart-btn').addEventListener('click', toggleCart);

    // Close cart
    document.getElementById('close-cart-btn').addEventListener('click', toggleCart);
    document.getElementById('cart-overlay').addEventListener('click', toggleCart);

    // Product modal close
    document.getElementById('product-modal-close').addEventListener('click', () => {
        document.getElementById('product-modal').classList.remove('active');
    });

    // Product modal click outside
    document.getElementById('product-modal').addEventListener('click', (e) => {
        if (e.target.id === 'product-modal') {
            e.target.classList.remove('active');
        }
    });

    // Quantity buttons
    document.getElementById('qty-minus').addEventListener('click', () => {
        const input = document.getElementById('product-qty');
        if (input.value > 1) input.value = parseInt(input.value) - 1;
    });

    document.getElementById('qty-plus').addEventListener('click', () => {
        const input = document.getElementById('product-qty');
        const max = parseInt(input.max) || 99;
        if (input.value < max) input.value = parseInt(input.value) + 1;
    });

    // Add to cart
    document.getElementById('add-to-cart-btn').addEventListener('click', addToCart);

    // Load more
    document.getElementById('load-more-btn').addEventListener('click', () => {
        catalog.page++;
        loadProducts(true);
    });

    // Checkout button
    document.getElementById('checkout-btn').addEventListener('click', showCheckoutModal);

    // Checkout modal close
    document.getElementById('checkout-modal-close').addEventListener('click', () => {
        document.getElementById('checkout-modal').classList.remove('active');
    });

    // Checkout form submit
    document.getElementById('checkout-form').addEventListener('submit', handleCheckout);

    // Continue shopping
    document.getElementById('continue-shopping-btn').addEventListener('click', () => {
        document.getElementById('confirmation-modal').classList.remove('active');
        catalog.cart = [];
        saveCart();
        updateCartUI();
    });
}

// Toggle cart
function toggleCart() {
    const sidebar = document.getElementById('cart-sidebar');
    const overlay = document.getElementById('cart-overlay');

    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Add to cart
function addToCart() {
    if (!catalog.currentProduct) return;

    const qty = parseInt(document.getElementById('product-qty').value);
    const product = catalog.currentProduct;

    if (product.quantity <= 0) {
        utils.showToast('Product is out of stock', 'error');
        return;
    }

    if (qty > product.quantity) {
        utils.showToast(`Only ${product.quantity} items available`, 'error');
        return;
    }

    // Check if already in cart
    const existingItem = catalog.cart.find(item => item.productId === product.id);

    if (existingItem) {
        const newQty = existingItem.quantity + qty;
        if (newQty > product.quantity) {
            utils.showToast(`Cannot add more. Only ${product.quantity} available`, 'error');
            return;
        }
        existingItem.quantity = newQty;
    } else {
        catalog.cart.push({
            productId: product.id,
            name: product.name,
            price: product.selling_price,
            image_url: product.image_url,
            quantity: qty,
            maxQuantity: product.quantity
        });
    }

    saveCart();
    updateCartUI();
    document.getElementById('product-modal').classList.remove('active');
    utils.showToast('Added to cart', 'success');
}

// Save cart to localStorage
function saveCart() {
    localStorage.setItem('catalogCart', JSON.stringify(catalog.cart));
}

// Update cart UI
function updateCartUI() {
    const cartBody = document.getElementById('cart-body');
    const cartFooter = document.getElementById('cart-footer');
    const cartCount = document.getElementById('cart-count');

    const totalItems = catalog.cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;

    if (catalog.cart.length === 0) {
        cartBody.innerHTML = `
            <div class="cart-empty">
                <i class="fas fa-shopping-basket"></i>
                <p>Your cart is empty</p>
            </div>
        `;
        cartFooter.style.display = 'none';
        return;
    }

    // Calculate totals
    const subtotal = catalog.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * (catalog.taxRate / 100);
    const total = subtotal + tax;

    let html = '';
    catalog.cart.forEach((item, index) => {
        html += `
            <div class="cart-item">
                <div class="cart-item-image">
                    ${item.image_url
                        ? `<img src="${item.image_url}" alt="${item.name}">`
                        : '<i class="fas fa-image"></i>'}
                </div>
                <div class="cart-item-info">
                    <h4>${item.name}</h4>
                    <p>${utils.formatCurrency(item.price)} each</p>
                    <div class="cart-qty">
                        <button onclick="updateCartItem(${index}, -1)">-</button>
                        <span>${item.quantity}</span>
                        <button onclick="updateCartItem(${index}, 1)">+</button>
                    </div>
                </div>
                <div class="cart-item-actions">
                    <button class="cart-item-remove" onclick="removeCartItem(${index})">
                        <i class="fas fa-trash"></i>
                    </button>
                    <div class="cart-item-price">${utils.formatCurrency(item.price * item.quantity)}</div>
                </div>
            </div>
        `;
    });

    cartBody.innerHTML = html;
    document.getElementById('cart-subtotal').textContent = utils.formatCurrency(subtotal);
    document.getElementById('cart-tax').textContent = utils.formatCurrency(tax);
    document.getElementById('cart-total').textContent = utils.formatCurrency(total);
    cartFooter.style.display = 'block';
}

// Update cart item quantity
function updateCartItem(index, delta) {
    const item = catalog.cart[index];
    const newQty = item.quantity + delta;

    if (newQty < 1) {
        removeCartItem(index);
        return;
    }

    if (newQty > item.maxQuantity) {
        utils.showToast(`Only ${item.maxQuantity} available`, 'error');
        return;
    }

    item.quantity = newQty;
    saveCart();
    updateCartUI();
}

// Remove cart item
function removeCartItem(index) {
    catalog.cart.splice(index, 1);
    saveCart();
    updateCartUI();
    utils.showToast('Item removed from cart', 'success');
}

// Show checkout modal
function showCheckoutModal() {
    if (catalog.cart.length === 0) {
        utils.showToast('Your cart is empty', 'error');
        return;
    }

    toggleCart(); // Close cart sidebar

    // Populate order summary
    const summary = document.getElementById('order-summary');
    let html = '';
    catalog.cart.forEach(item => {
        html += `
            <div class="order-item">
                <span>${item.name} x${item.quantity}</span>
                <span>${utils.formatCurrency(item.price * item.quantity)}</span>
            </div>
        `;
    });
    summary.innerHTML = html;

    // Calculate totals
    const subtotal = catalog.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * (catalog.taxRate / 100);
    const total = subtotal + tax;

    document.getElementById('order-subtotal').textContent = utils.formatCurrency(subtotal);
    document.getElementById('order-tax').textContent = utils.formatCurrency(tax);
    document.getElementById('order-total').textContent = utils.formatCurrency(total);

    document.getElementById('checkout-modal').classList.add('active');
}

// Handle checkout
async function handleCheckout(e) {
    e.preventDefault();

    const form = e.target;
    const formData = new FormData(form);
    const placeOrderBtn = document.getElementById('place-order-btn');

    placeOrderBtn.disabled = true;
    placeOrderBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

    try {
        // Prepare order data
        const orderData = {
            customerName: formData.get('customerName') || 'Guest',
            customerEmail: formData.get('customerEmail'),
            customerPhone: formData.get('customerPhone'),
            shippingAddress: formData.get('shippingAddress'),
            notes: formData.get('notes'),
            paymentMethod: formData.get('paymentMethod'),
            items: catalog.cart.map(item => ({
                productId: item.productId,
                quantity: item.quantity
            }))
        };

        const result = await api.post('/orders', orderData);

        // Show confirmation
        document.getElementById('checkout-modal').classList.remove('active');
        document.getElementById('confirmation-order-number').textContent = result.order.orderNumber;
        document.getElementById('confirmation-email').textContent = result.order.customerEmail || 'Not provided';
        document.getElementById('confirmation-modal').classList.add('active');

        // Clear cart
        catalog.cart = [];
        saveCart();
        updateCartUI();

        // Reset form
        form.reset();

    } catch (error) {
        console.error('Checkout error:', error);
        utils.showToast(error.message || 'Failed to place order. Please try again.', 'error');
    } finally {
        placeOrderBtn.disabled = false;
        placeOrderBtn.innerHTML = '<i class="fas fa-check"></i> Place Order';
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initCatalog);