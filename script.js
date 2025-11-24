// Mobile Optimized PI TRACE App
class PiTraceApp {
    constructor() {
        this.config = {
            API_BASE_URL: 'https://pi-trace-backend.vercel.app/api',
            DEBUG: true
        };
        
        this.state = {
            currentUser: null,
            isGuest: false,
            products: [],
            currentProduct: null
        };
        
        this.init();
    }

    init() {
        this.logDebug('PI TRACE Mobile App Initialized');
        this.setupEventListeners();
        this.detectMobile();
    }

    // Mobile Detection
    detectMobile() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (isMobile) {
            document.body.classList.add('mobile-device');
            this.logDebug('Mobile device detected');
            
            // Mobile specific adjustments
            this.adjustForMobile();
        }
    }

    adjustForMobile() {
        // Add touch-friendly styles
        const style = document.createElement('style');
        style.textContent = `
            .mobile-device .btn {
                min-height: 44px; /* Minimum touch target size */
            }
            
            .mobile-device .feature-card {
                padding: 12px 8px;
            }
            
            .mobile-device .search-input {
                font-size: 16px; /* Prevent zoom on iOS */
            }
            
            /* Improve scrolling on mobile */
            .mobile-device .product-list {
                -webkit-overflow-scrolling: touch;
            }
        `;
        document.head.appendChild(style);
    }

    // Utility Methods
    logDebug(message) {
        if (this.config.DEBUG) {
            const debugPanel = document.getElementById('debugPanel');
            if (debugPanel) {
                const timestamp = new Date().toLocaleTimeString();
                const debugItem = document.createElement('div');
                debugItem.className = 'debug-item';
                debugItem.textContent = `[${timestamp}] ${message}`;
                debugPanel.appendChild(debugItem);
                debugPanel.scrollTop = debugPanel.scrollHeight;
            }
            console.log(`[PI TRACE] ${message}`);
        }
    }

    showStatus(message, type = 'success') {
        const statusContainer = document.getElementById('statusContainer');
        if (!statusContainer) return;

        const statusEl = document.createElement('div');
        statusEl.className = `status ${type}`;
        statusEl.innerHTML = `
            <i class="fas fa-${this.getStatusIcon(type)}"></i>
            <span>${message}</span>
        `;

        statusContainer.appendChild(statusEl);

        // Auto remove after 4 seconds
        setTimeout(() => {
            if (statusEl.parentNode) {
                statusEl.remove();
            }
        }, 4000);
    }

    getStatusIcon(type) {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Event Listeners
    setupEventListeners() {
        // Search input enter key support
        document.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && e.target.id === 'searchInput') {
                this.searchProducts();
            }
        });

        // Close modals on backdrop click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });

        // Touch event improvements for mobile
        document.addEventListener('touchstart', function() {}, { passive: true });
    }

    // Login Methods
    async loginWithPi() {
        this.logDebug('Starting Pi Wallet login...');
        
        try {
            if (!window.Pi) {
                throw new Error('Pi SDK not available');
            }

            await window.Pi.init({ version: "2.0", sandbox: true });
            this.logDebug('Pi SDK initialized');

            const user = await window.Pi.authenticate(['username', 'payments'], () => {});
            
            this.state.currentUser = user;
            this.state.isGuest = false;
            
            this.showMainApp(user.username, 'Pi Wallet');
            this.showStatus(`Welcome ${user.username}!`);

        } catch (error) {
            this.logDebug(`Pi login failed: ${error.message}`);
            this.showStatus('Pi login unavailable, using guest mode', 'warning');
            this.guestLogin();
        }
    }

    guestLogin() {
        const guestUser = {
            username: 'Guest User',
            uid: 'guest_' + Date.now()
        };
        
        this.state.currentUser = guestUser;
        this.state.isGuest = true;
        
        this.showMainApp(guestUser.username, 'Guest Mode');
        this.showStatus('Welcome! Guest mode activated.');
    }

    showMainApp(username, loginType) {
        document.getElementById('username').textContent = username;
        document.getElementById('login-type').textContent = `Logged in with ${loginType}`;
        
        document.getElementById('login-section').classList.replace('section-active', 'section-hidden');
        document.getElementById('app-section').classList.replace('section-hidden', 'section-active');
        
        this.loadUserProducts();
    }

    logout() {
        this.state.currentUser = null;
        this.state.isGuest = false;
        this.state.products = [];
        
        document.getElementById('login-section').classList.replace('section-hidden', 'section-active');
        document.getElementById('app-section').classList.replace('section-active', 'section-hidden');
        
        this.showStatus('Logged out successfully');
    }

    // Product Management
    showProductModal() {
        // Reset form
        ['productName', 'productCategory', 'productQuantity', 'productPrice'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.value = id === 'productQuantity' ? '1' : '';
        });
        
        this.showModal('productModal');
    }

    submitProduct() {
        const productData = {
            name: document.getElementById('productName').value,
            category: document.getElementById('productCategory').value,
            quantity: parseInt(document.getElementById('productQuantity').value) || 1,
            price: parseFloat(document.getElementById('productPrice').value) || 0,
            id: 'prod_' + Date.now(),
            timestamp: new Date().toISOString(),
            status: 'active'
        };

        if (!productData.name || !productData.category) {
            this.showStatus('Please fill required fields', 'error');
            return;
        }

        this.state.products.push(productData);
        this.loadUserProducts();
        this.closeModal('productModal');
        this.showStatus('Product added successfully!');
    }

    loadUserProducts() {
        const productList = document.getElementById('productList');
        const productCount = document.getElementById('productCount');
        
        if (!productList) return;

        if (this.state.products.length === 0) {
            productList.innerHTML = `
                <div style="text-align: center; padding: 40px 20px; color: rgba(255,255,255,0.7)">
                    <i class="fas fa-box-open" style="font-size: 3rem; margin-bottom: 15px;"></i>
                    <p style="margin-bottom: 15px;">No products yet</p>
                    <button class="btn btn-primary" onclick="app.showProductModal()">
                        Add Your First Product
                    </button>
                </div>
            `;
        } else {
            productList.innerHTML = this.state.products.map(product => `
                <div class="product-card" onclick="app.viewProduct('${product.id}')">
                    <div class="product-header">
                        <div>
                            <div class="product-name">${product.name}</div>
                            <div class="product-meta">${product.category} • ${product.quantity} pcs</div>
                        </div>
                        <div class="status-badge">${product.status}</div>
                    </div>
                    ${product.price ? `<div style="color: #4cc9a7; font-weight: bold; margin-top: 8px;">${product.price} π</div>` : ''}
                </div>
            `).join('');
        }
        
        if (productCount) {
            productCount.textContent = `${this.state.products.length} product${this.state.products.length !== 1 ? 's' : ''}`;
        }
    }

    viewProduct(productId) {
        const product = this.state.products.find(p => p.id === productId);
        if (product) {
            this.showStatus(`Viewing: ${product.name}`);
        }
    }

    // Modal Management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // QR Scanner
    openQRScanner() {
        this.showModal('qrScannerModal');
    }

    processManualQR() {
        const qrCode = document.getElementById('manualQRInput').value;
        if (!qrCode) {
            this.showStatus('Please enter QR code', 'error');
            return;
        }
        
        this.showStatus(`Tracking product: ${qrCode}`);
        this.closeModal('qrScannerModal');
        
        // Simulate finding product
        setTimeout(() => {
            this.showStatus('Product found in supply chain!', 'success');
        }, 1500);
    }

    // Supply Chain
    openSupplyChain() {
        document.getElementById('totalProductsStat').textContent = this.state.products.length;
        document.getElementById('activeProductsStat').textContent = this.state.products.filter(p => p.status === 'active').length;
        document.getElementById('transitProductsStat').textContent = this.state.products.filter(p => p.status === 'transit').length;
        
        this.showModal('supplyChainModal');
    }

    // Search
    searchProducts() {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        this.showStatus(`Searching for: ${searchTerm || 'all products'}`);
        // Search logic would go here
    }

    handleSearchEnter(event) {
        if (event.key === 'Enter') {
            this.searchProducts();
        }
    }

    // Payment
    async createPayment() {
        if (this.state.isGuest) {
            this.showStatus('Login with Pi Wallet for payments', 'warning');
            return;
        }

        try {
            const payment = await window.Pi.createPayment({
                amount: 3.14,
                memo: 'PI TRACE - Premium Feature'
            });
            
            this.showStatus('Payment initiated! Check Pi Wallet.');
            this.logDebug(`Payment created: ${payment.identifier}`);
            
        } catch (error) {
            this.showStatus('Payment failed', 'error');
            this.logDebug(`Payment error: ${error.message}`);
        }
    }
}

// Initialize app when DOM is loaded
let app;
document.addEventListener('DOMContentLoaded', function() {
    app = new PiTraceApp();
});

// Global functions for HTML onclick
function loginWithPi() { app.loginWithPi(); }
function guestLogin() { app.guestLogin(); }
function logout() { app.logout(); }
function showProductModal() { app.showProductModal(); }
function submitProduct() { app.submitProduct(); }
function openQRScanner() { app.openQRScanner(); }
function processManualQR() { app.processManualQR(); }
function openSupplyChain() { app.openSupplyChain(); }
function searchProducts() { app.searchProducts(); }
function handleSearchEnter(event) { app.handleSearchEnter(event); }
function createPayment() { app.createPayment(); }
function closeModal(modalId) { app.closeModal(modalId); }
