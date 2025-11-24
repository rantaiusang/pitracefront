// Configuration
const CONFIG = {
    API_BASE_URL: 'https://pi-trace-backend.vercel.app/api',
    DEBUG: true
};

// State Management
let appState = {
    currentUser: null,
    isGuest: false,
    products: [],
    currentProduct: null
};

// DOM Elements
const elements = {
    loginSection: document.getElementById('login-section'),
    appSection: document.getElementById('app-section'),
    debugPanel: document.getElementById('debugPanel'),
    username: document.getElementById('username'),
    loginType: document.getElementById('login-type'),
    productList: document.getElementById('productList'),
    productCount: document.getElementById('productCount'),
    status: document.getElementById('status')
};

// Utility Functions
function logDebug(message) {
    if (CONFIG.DEBUG) {
        const timestamp = new Date().toLocaleTimeString();
        const debugItem = document.createElement('div');
        debugItem.className = 'debug-item';
        debugItem.textContent = `[${timestamp}] ${message}`;
        elements.debugPanel.appendChild(debugItem);
        elements.debugPanel.scrollTop = elements.debugPanel.scrollHeight;
    }
}

function showStatus(message, type = 'success') {
    const statusEl = document.createElement('div');
    statusEl.className = `status-message status-${type}`;
    statusEl.textContent = message;
    elements.status.appendChild(statusEl);

    setTimeout(() => {
        statusEl.remove();
    }, 5000);
}

// Modal Management
function showModal(modalId) {
    document.getElementById(modalId).style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Login Functions
async function loginWithPi() {
    logDebug('Initializing Pi SDK login...');
    
    try {
        // Pi SDK initialization
        const Pi = window.Pi;
        
        if (!Pi) {
            throw new Error('Pi SDK not loaded');
        }

        const scopes = ['username', 'payments'];
        const onIncompletePaymentFound = (payment) => {
            logDebug('Incomplete payment found: ' + payment.identifier);
        };

        // Initialize Pi SDK
        await Pi.init({ version: "2.0", sandbox: true });
        logDebug('Pi SDK initialized successfully');

        // Authenticate user
        const user = await Pi.authenticate(scopes, onIncompletePaymentFound);
        logDebug('User authenticated: ' + user.username);

        // Update app state
        appState.currentUser = user;
        appState.isGuest = false;
        
        // Show main app
        showMainApp(user.username, 'Pi Wallet');
        showStatus('Login successful! Welcome ' + user.username);

    } catch (error) {
        logDebug('Pi login error: ' + error.message);
        showStatus('Login failed: ' + error.message, 'error');
        
        // Fallback to guest mode
        guestLogin();
    }
}

function guestLogin() {
    logDebug('Starting guest session...');
    
    const guestUser = {
        username: 'Guest User',
        uid: 'guest_' + Date.now()
    };
    
    appState.currentUser = guestUser;
    appState.isGuest = true;
    
    showMainApp(guestUser.username, 'Guest Mode');
    showStatus('Welcome! You are in guest mode.');
}

function logout() {
    logDebug('Logging out...');
    
    appState.currentUser = null;
    appState.isGuest = false;
    appState.products = [];
    
    // Reset UI
    elements.loginSection.classList.add('section-active');
    elements.loginSection.classList.remove('section-hidden');
    elements.appSection.classList.add('section-hidden');
    elements.appSection.classList.remove('section-active');
    
    // Clear product list
    elements.productList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-box-open"></i>
            <p>No products yet</p>
            <button class="btn btn-primary" onclick="showProductModal()">Add Your First Product</button>
        </div>
    `;
    
    showStatus('Logged out successfully');
}

function showMainApp(username, loginType) {
    elements.username.textContent = username;
    elements.loginType.textContent = `Authenticated with ${loginType}`;
    
    elements.loginSection.classList.remove('section-active');
    elements.loginSection.classList.add('section-hidden');
    elements.appSection.classList.remove('section-hidden');
    elements.appSection.classList.add('section-active');
    
    // Load user products
    loadUserProducts();
}

// Product Management
function showProductModal() {
    // Reset form
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productQuantity').value = '1';
    document.getElementById('productPrice').value = '';
    document.getElementById('originCity').value = '';
    
    // Generate preview info
    const now = new Date();
    document.getElementById('uploadDateDisplay').textContent = now.toLocaleString();
    document.getElementById('hashCodeDisplay').textContent = 'PROD_' + now.getTime();
    
    showModal('productModal');
}

async function submitProduct() {
    const productData = {
        name: document.getElementById('productName').value,
        category: document.getElementById('productCategory').value,
        description: document.getElementById('productDescription').value,
        quantity: parseInt(document.getElementById('productQuantity').value),
        unit: document.getElementById('productUnit').value,
        price: parseFloat(document.getElementById('productPrice').value) || 0,
        originCountry: document.getElementById('originCountry').value,
        originCity: document.getElementById('originCity').value,
        hash: document.getElementById('hashCodeDisplay').textContent,
        timestamp: new Date().toISOString(),
        status: 'registered'
    };

    // Validation
    if (!productData.name || !productData.category) {
        showStatus('Please fill in all required fields', 'error');
        return;
    }

    try {
        // Simulate API call
        logDebug('Submitting product: ' + productData.name);
        
        // Add to local state
        productData.id = 'prod_' + Date.now();
        appState.products.push(productData);
        
        // Update UI
        loadUserProducts();
        closeModal('productModal');
        showStatus('Product registered successfully!');
        
    } catch (error) {
        logDebug('Product submission error: ' + error.message);
        showStatus('Failed to register product', 'error');
    }
}

function loadUserProducts() {
    const productList = elements.productList;
    const productCount = elements.productCount;
    
    if (appState.products.length === 0) {
        productList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <p>No products yet</p>
                <button class="btn btn-primary" onclick="showProductModal()">Add Your First Product</button>
            </div>
        `;
        productCount.textContent = '0 products';
        return;
    }
    
    productCount.textContent = `${appState.products.length} product${appState.products.length > 1 ? 's' : ''}`;
    
    productList.innerHTML = appState.products.map(product => `
        <div class="product-item" onclick="viewProductDetail('${product.id}')">
            <div class="product-info">
                <h4>${product.name}</h4>
                <p>${product.category} • ${product.quantity} ${product.unit}</p>
                <small>${product.originCity}, ${product.originCountry}</small>
            </div>
            <div class="product-status">
                <span class="status-badge status-${product.status}">${product.status}</span>
                <i class="fas fa-chevron-right"></i>
            </div>
        </div>
    `).join('');
}

function viewProductDetail(productId) {
    const product = appState.products.find(p => p.id === productId);
    if (!product) return;
    
    appState.currentProduct = product;
    showStatus(`Viewing details for: ${product.name}`);
    // In a real app, you would show a detailed modal here
}

// QR Scanner Functions
function openQRScanner() {
    showModal('qrScannerModal');
}

function processManualQR() {
    const qrCode = document.getElementById('manualQRInput').value;
    
    if (!qrCode) {
        showStatus('Please enter a QR code', 'error');
        return;
    }
    
    logDebug('Processing manual QR code: ' + qrCode);
    showStatus('Tracking product with QR: ' + qrCode);
    
    // Simulate product tracking
    setTimeout(() => {
        const mockProduct = {
            id: 'tracked_' + Date.now(),
            name: 'Tracked Product',
            status: 'in_transit',
            location: 'Distribution Center',
            timestamp: new Date().toLocaleString()
        };
        
        showStatus(`Product found: ${mockProduct.name} - ${mockProduct.location}`);
        closeModal('qrScannerModal');
    }, 1500);
}

// Supply Chain Functions
function openSupplyChain() {
    // Update stats
    document.getElementById('totalProductsStat').textContent = appState.products.length;
    document.getElementById('activeProductsStat').textContent = appState.products.filter(p => p.status === 'active').length;
    document.getElementById('shippedProductsStat').textContent = appState.products.filter(p => p.status === 'in_transit').length;
    
    showModal('supplyChainModal');
}

// Payment Functions
async function createPayment() {
    if (appState.isGuest) {
        showStatus('Please login with Pi Wallet to make payments', 'warning');
        return;
    }
    
    try {
        const paymentData = {
            amount: 3.14,
            memo: 'PI TRACE - Premium Feature',
            metadata: { product: 'premium_feature' }
        };
        
        logDebug('Creating payment: ' + paymentData.amount + ' π');
        
        // Pi SDK payment
        const Pi = window.Pi;
        const payment = await Pi.createPayment(paymentData);
        logDebug('Payment created: ' + payment.identifier);
        
        showStatus('Payment initiated! Please check your Pi Wallet.');
        
    } catch (error) {
        logDebug('Payment error: ' + error.message);
        showStatus('Payment failed: ' + error.message, 'error');
    }
}

// Search Functionality
function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        loadUserProducts();
        return;
    }
    
    const filteredProducts = appState.products.filter(product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.category.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm)
    );
    
    if (filteredProducts.length === 0) {
        elements.productList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <p>No products found for "${searchTerm}"</p>
                <button class="btn btn-primary" onclick="showProductModal()">Add New Product</button>
            </div>
        `;
    } else {
        elements.productList.innerHTML = filteredProducts.map(product => `
            <div class="product-item" onclick="viewProductDetail('${product.id}')">
                <div class="product-info">
                    <h4>${product.name}</h4>
                    <p>${product.category} • ${product.quantity} ${product.unit}</p>
                    <small>${product.originCity}, ${product.originCountry}</small>
                </div>
                <div class="product-status">
                    <span class="status-badge status-${product.status}">${product.status}</span>
                    <i class="fas fa-chevron-right"></i>
                </div>
            </div>
        `).join('');
    }
}

// Initialize App
document.addEventListener('DOMContentLoaded', function() {
    logDebug('PI TRACE Application Initialized');
    logDebug('API Base: ' + CONFIG.API_BASE_URL);
    logDebug('Ready - Choose login method to start');
    
    // Add CSS for product items
    const style = document.createElement('style');
    style.textContent = `
        .product-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            margin-bottom: 10px;
            cursor: pointer;
            transition: all 0.3s ease;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .product-item:hover {
            background: rgba(255, 255, 255, 0.15);
            transform: translateX(5px);
        }
        
        .product-info h4 {
            margin-bottom: 5px;
            font-size: 14px;
        }
        
        .product-info p {
            font-size: 12px;
            opacity: 0.8;
            margin-bottom: 5px;
        }
        
        .product-info small {
            font-size: 10px;
            opacity: 0.6;
        }
        
        .product-status {
            display: flex;
            align-items: center;
            gap: 10px;
        }
        
        .status-badge {
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: bold;
        }
        
        .status-registered {
            background: #4CAF50;
            color: white;
        }
        
        .status-active {
            background: #2196F3;
            color: white;
        }
        
        .status-in_transit {
            background: #FF9800;
            color: white;
        }
        
        .status-delivered {
            background: #757575;
            color: white;
        }
    `;
    document.head.appendChild(style);
});

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
};
