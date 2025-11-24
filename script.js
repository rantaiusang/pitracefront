// =============================================
// AUTHENTICATION & INITIALIZATION
// =============================================

// Global variables
let Pi = window.Pi;
let piSDK = null;
let currentUser = null;
let products = [];
let payments = [];

// API Configuration - GUNAKAN URL BACKEND ANDA YANG SEBENARNYA
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000/api'
  : 'https://back-git-main-tesnet.vercel.app/api'; // GANTI DENGAN DOMAIN BACKEND ANDA

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    updateDebugPanel('Initializing PI TRACE application...');
    updateDebugPanel(`API Base: ${API_BASE}`);
    
    // Check if user is already logged in
    checkExistingLogin();
    
    // Initialize Pi SDK
    initializePiSDK();
}

// Check if user is already logged in
function checkExistingLogin() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        handleSuccessfulLogin(currentUser);
        updateDebugPanel('Resumed session for: ' + currentUser.username);
    }
}

// Initialize Pi SDK
function initializePiSDK() {
    try {
        if (window.Pi) {
            piSDK = Pi.init({ version: "2.0", sandbox: true });
            updateDebugPanel('Pi SDK initialized successfully');
        } else {
            updateDebugPanel('Pi SDK not available - guest mode only');
        }
    } catch (error) {
        console.error('Pi SDK initialization failed:', error);
        updateDebugPanel('Pi SDK init failed: ' + error.message);
    }
}

// =============================================
// LOGIN FUNCTIONS
// =============================================

// Login with Pi Wallet
async function loginWithPi() {
    updateDebugPanel('Starting Pi Wallet authentication...');
    
    try {
        // Check if Pi SDK is available
        if (!window.Pi) {
            updateDebugPanel('Error: Pi SDK not loaded');
            showStatus('Pi Network SDK not available. Please use guest mode or check your connection.', 'error');
            return;
        }

        updateDebugPanel('Authenticating with Pi Network...');
        
        // Pi Network authentication
        const scopes = ['username', 'payments', 'wallet_address'];
        const authResult = await Pi.authenticate(scopes, onIncompletePaymentFound);
        
        if (authResult) {
            const userData = {
                username: authResult.user.username || 'Pi User',
                uid: authResult.user.uid,
                accessToken: authResult.accessToken,
                loginType: 'pi',
                walletAddress: authResult.user.walletAddress
            };
            
            // Send user data to backend
            try {
                const response = await fetch(`${API_BASE}/auth`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(userData)
                });
                
                const result = await response.json();
                
                if (result.success) {
                    currentUser = {
                        ...result.data.user,
                        token: result.data.token // Save JWT token
                    };
                    localStorage.setItem('currentUser', JSON.stringify(currentUser));
                    
                    // Update UI and switch to app section
                    handleSuccessfulLogin(currentUser);
                    updateDebugPanel('Pi login successful! Welcome ' + currentUser.username);
                    showStatus('Successfully logged in with Pi Wallet!', 'success');
                } else {
                    throw new Error(result.message);
                }
            } catch (apiError) {
                console.error('Backend auth error:', apiError);
                // Fallback to frontend-only auth
                currentUser = userData;
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                handleSuccessfulLogin(currentUser);
                updateDebugPanel('Pi login successful (fallback mode)! Welcome ' + currentUser.username);
                showStatus('Successfully logged in with Pi Wallet!', 'success');
            }
        }
        
    } catch (error) {
        console.error('Pi login error:', error);
        updateDebugPanel('Pi login failed: ' + error.message);
        showStatus('Login failed: ' + error.message, 'error');
        
        // Fallback: suggest guest option
        setTimeout(() => {
            updateDebugPanel('Try continuing as Guest instead');
        }, 2000);
    }
}

// Guest login function
async function guestLogin() {
    updateDebugPanel('Starting guest session...');
    
    const guestUser = {
        username: 'Guest User',
        uid: 'guest_' + Date.now(),
        loginType: 'guest',
        walletAddress: null
    };
    
    try {
        // Send guest user to backend
        const response = await fetch(`${API_BASE}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(guestUser)
        });
        
        const result = await response.json();
        
        if (result.success) {
            currentUser = {
                ...result.data.user,
                token: result.data.token
            };
        } else {
            throw new Error(result.message);
        }
    } catch (apiError) {
        console.error('Backend auth error:', apiError);
        // Fallback to frontend-only auth
        currentUser = guestUser;
    }
    
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update UI and switch to app section
    handleSuccessfulLogin(currentUser);
    updateDebugPanel('Guest login successful!');
    showStatus('Welcome! Continuing as Guest.', 'info');
}

// Handle successful login
function handleSuccessfulLogin(user) {
    // Update user info in UI
    document.getElementById('username').textContent = user.username;
    document.getElementById('login-type').textContent = 
        user.loginType === 'pi' ? 'Authenticated with Pi Wallet' : 'Guest Mode';
    
    // Switch to app section
    document.getElementById('login-section').classList.remove('section-active');
    document.getElementById('login-section').classList.add('section-hidden');
    document.getElementById('app-section').classList.remove('section-hidden');
    document.getElementById('app-section').classList.add('section-active');
    
    // Load user's products and payments
    loadUserProducts();
    loadPaymentHistory();
}

// Logout function
function logout() {
    updateDebugPanel('Logging out...');
    
    // Clear user data
    currentUser = null;
    localStorage.removeItem('currentUser');
    localStorage.removeItem('userProducts'); // Clear local products cache
    
    // Reset UI to login section
    document.getElementById('app-section').classList.remove('section-active');
    document.getElementById('app-section').classList.add('section-hidden');
    document.getElementById('login-section').classList.remove('section-hidden');
    document.getElementById('login-section').classList.add('section-active');
    
    // Reset debug panel
    updateDebugPanel('Ready - Choose login method to start');
    
    showStatus('You have been logged out.', 'info');
}

// Handle incomplete payments (required by Pi SDK)
function onIncompletePaymentFound(payment) {
    console.log('Incomplete payment found:', payment);
    updateDebugPanel('Found incomplete payment: ' + payment.identifier);
    
    // Try to recover incomplete payment
    recoverPayment(payment.identifier);
}

// Recover incomplete payment
async function recoverPayment(paymentIdentifier) {
    try {
        updateDebugPanel('Attempting to recover payment: ' + paymentIdentifier);
        
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                identifier: paymentIdentifier,
                status: 'completed'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            updateDebugPanel('Payment recovered successfully');
            showStatus('Previous payment completed!', 'success');
        }
    } catch (error) {
        console.error('Payment recovery failed:', error);
        updateDebugPanel('Payment recovery failed: ' + error.message);
    }
}

// =============================================
// PRODUCT MANAGEMENT
// =============================================

// Load user's products
async function loadUserProducts() {
    updateDebugPanel('Loading user products from backend...');
    
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/products?userId=${currentUser.uid}`);
        const result = await response.json();
        
        if (result.success) {
            products = result.data;
            updateDebugPanel(`Loaded ${products.length} products from backend`);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Failed to load products from backend:', error);
        updateDebugPanel('Backend load failed, using local storage');
        
        // Fallback to localStorage
        const userProducts = JSON.parse(localStorage.getItem('userProducts')) || [];
        
        if (userProducts.length === 0 && currentUser) {
            // Add some sample products for new users
            const sampleProducts = [
                {
                    _id: 'prod_' + Date.now(),
                    name: 'Organic Coffee Beans',
                    category: 'food',
                    description: 'Premium organic coffee from Indonesia',
                    quantity: 50,
                    unit: 'kg',
                    price: 2.5,
                    origin: { country: 'Indonesia', city: 'Bali' },
                    hash: 'COFFEE_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    uploadDate: new Date().toISOString(),
                    owner: currentUser.uid
                },
                {
                    _id: 'prod_' + (Date.now() + 1),
                    name: 'Handcrafted Batik Scarf',
                    category: 'clothing',
                    description: 'Traditional Indonesian batik design',
                    quantity: 10,
                    unit: 'pcs',
                    price: 5.0,
                    origin: { country: 'Indonesia', city: 'Yogyakarta' },
                    hash: 'BATIK_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
                    uploadDate: new Date(Date.now() - 86400000).toISOString(),
                    owner: currentUser.uid
                }
            ];
            
            products = sampleProducts;
            localStorage.setItem('userProducts', JSON.stringify(sampleProducts));
        } else {
            products = userProducts;
        }
        
        showStatus('Using local storage - some features may be limited', 'warning');
    }
    
    displayProducts();
    updateProductCount();
}

// Display products in the UI
function displayProducts() {
    const productList = document.getElementById('productList');
    productList.innerHTML = '';
    
    if (products.length === 0) {
        productList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h3>No Products Yet</h3>
                <p>Add your first product to start tracking</p>
                <button class="btn btn-primary" onclick="showProductModal()">
                    <i class="fas fa-plus"></i> Add Product
                </button>
            </div>
        `;
        return;
    }
    
    products.forEach(product => {
        const productId = product._id || product.id;
        const originDisplay = typeof product.origin === 'string' 
            ? product.origin 
            : `${product.origin.country}${product.origin.city ? ', ' + product.origin.city : ''}`;
        
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-header">
                <div class="product-badge ${product.category}">${getCategoryName(product.category)}</div>
                <div class="product-actions">
                    <button class="btn-view" onclick="viewProduct('${productId}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-delete" onclick="confirmDelete('${productId}', '${product.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-meta">
                    <span class="meta-item">
                        <i class="fas fa-hashtag"></i> ${product.hash}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-map-marker-alt"></i> ${originDisplay}
                    </span>
                </div>
                <div class="product-stats">
                    <div class="stat">
                        <label>Quantity</label>
                        <span>${product.quantity} ${product.unit}</span>
                    </div>
                    <div class="stat">
                        <label>Price</label>
                        <span>${product.price} π</span>
                    </div>
                    <div class="stat">
                        <label>Added</label>
                        <span>${formatDate(product.uploadDate)}</span>
                    </div>
                </div>
            </div>
        `;
        productList.appendChild(productCard);
    });
}

// Update product count display
function updateProductCount() {
    const productCount = document.getElementById('productCount');
    productCount.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
}

// Get category display name
function getCategoryName(category) {
    const categories = {
        'electronics': 'Electronics',
        'clothing': 'Clothing',
        'food': 'Food & Beverages',
        'other': 'Other'
    };
    return categories[category] || 'Other';
}

// Format date for display
function formatDate(dateString) {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
}

// =============================================
// PRODUCT MODAL FUNCTIONS
// =============================================

// Show product registration modal
function showProductModal() {
    // Check if user is logged in
    if (!currentUser) {
        showStatus('Please log in to add products', 'error');
        return;
    }
    
    // Reset form
    document.getElementById('productName').value = '';
    document.getElementById('productCategory').value = '';
    document.getElementById('productDescription').value = '';
    document.getElementById('productQuantity').value = '1';
    document.getElementById('productUnit').value = 'pcs';
    document.getElementById('productPrice').value = '';
    document.getElementById('originCountry').value = 'Indonesia';
    document.getElementById('originCity').value = '';
    
    // Update preview
    updateProductPreview();
    
    // Show modal
    document.getElementById('productModal').style.display = 'block';
}

// Close modal
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Update product preview in modal
function updateProductPreview() {
    const name = document.getElementById('productName').value;
    const category = document.getElementById('productCategory').value;
    
    // Update hash code display
    if (name && category) {
        document.getElementById('hashCodeDisplay').textContent = 'Will be generated by server';
    } else {
        document.getElementById('hashCodeDisplay').textContent = 'Will be generated automatically';
    }
    
    // Update upload date
    document.getElementById('uploadDateDisplay').textContent = new Date().toLocaleDateString();
}

// Submit new product
async function submitProduct() {
    const name = document.getElementById('productName').value.trim();
    const category = document.getElementById('productCategory').value;
    const description = document.getElementById('productDescription').value.trim();
    const quantity = parseInt(document.getElementById('productQuantity').value);
    const unit = document.getElementById('productUnit').value;
    const price = parseFloat(document.getElementById('productPrice').value) || 0;
    const country = document.getElementById('originCountry').value;
    const city = document.getElementById('originCity').value.trim();
    
    // Validation
    if (!name) {
        showStatus('Please enter a product name', 'error');
        return;
    }
    
    if (!category) {
        showStatus('Please select a category', 'error');
        return;
    }
    
    // Create product object
    const productData = {
        name: name,
        category: category,
        description: description || 'No description provided',
        quantity: quantity,
        unit: unit,
        price: price,
        origin: {
            country: country,
            city: city
        },
        owner: currentUser.uid
    };
    
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        // Add authorization header if token exists
        if (currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }
        
        const response = await fetch(`${API_BASE}/products`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(productData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Add to products array
            products.unshift(result.data);
            
            // Update UI
            displayProducts();
            updateProductCount();
            
            // Close modal and show success message
            closeModal('productModal');
            showStatus('Product registered successfully!', 'success');
            
            updateDebugPanel('New product added: ' + result.data.name);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Failed to save product to backend:', error);
        
        // Fallback to localStorage
        showStatus('Failed to save to server. Using local storage.', 'warning');
        
        const localProduct = {
            id: 'prod_' + Date.now(),
            ...productData,
            hash: generateProductHash(name, category),
            uploadDate: new Date().toISOString()
        };
        
        products.unshift(localProduct);
        localStorage.setItem('userProducts', JSON.stringify(products));
        
        // Update UI
        displayProducts();
        updateProductCount();
        closeModal('productModal');
        showStatus('Product saved locally!', 'success');
    }
}

// Generate product hash (fallback function)
function generateProductHash(name, category) {
    const prefix = category.substring(0, 3).toUpperCase();
    const random = Math.random().toString(36).substr(2, 9).toUpperCase();
    return `${prefix}_${random}`;
}

// =============================================
// PRODUCT VIEW & DELETE
// =============================================

// View product details
function viewProduct(productId) {
    const product = products.find(p => (p._id === productId) || (p.id === productId));
    if (!product) return;
    
    const originDisplay = typeof product.origin === 'string' 
        ? product.origin 
        : `${product.origin.country}${product.origin.city ? ', ' + product.origin.city : ''}`;
    
    const modal = document.getElementById('productDetailModal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Product Details</h2>
                <span class="close-modal" onclick="closeModal('productDetailModal')">&times;</span>
            </div>
            
            <div class="modal-body">
                <div class="product-detail-header">
                    <div class="product-badge ${product.category}">${getCategoryName(product.category)}</div>
                    <h3>${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                </div>
                
                <div class="product-detail-info">
                    <div class="info-row">
                        <div class="info-item">
                            <label>Unique Hash</label>
                            <div class="hash-code">${product.hash}</div>
                        </div>
                        <div class="info-item">
                            <label>Origin</label>
                            <div>${originDisplay}</div>
                        </div>
                    </div>
                    
                    <div class="info-row">
                        <div class="info-item">
                            <label>Quantity</label>
                            <div>${product.quantity} ${product.unit}</div>
                        </div>
                        <div class="info-item">
                            <label>Price</label>
                            <div>${product.price} π</div>
                        </div>
                    </div>
                    
                    <div class="info-row">
                        <div class="info-item">
                            <label>Registration Date</label>
                            <div>${formatDate(product.uploadDate)}</div>
                        </div>
                        <div class="info-item">
                            <label>Status</label>
                            <div class="status-badge active">Active</div>
                        </div>
                    </div>
                </div>
                
                <div class="supply-chain-timeline">
                    <h4>Supply Chain Journey</h4>
                    <div class="timeline">
                        <div class="timeline-item active">
                            <div class="timeline-marker"></div>
                            <div class="timeline-content">
                                <h5>Product Registered</h5>
                                <p>${formatDate(product.uploadDate)}</p>
                                <span>Product entered into blockchain registry</span>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-content">
                                <h5>In Production</h5>
                                <p>Estimated: ${new Date(Date.now() + 86400000).toLocaleDateString()}</p>
                                <span>Product being prepared for shipment</span>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-content">
                                <h5>In Transit</h5>
                                <p>Estimated: ${new Date(Date.now() + 172800000).toLocaleDateString()}</p>
                                <span>Product shipped to distribution center</span>
                            </div>
                        </div>
                        <div class="timeline-item">
                            <div class="timeline-marker"></div>
                            <div class="timeline-content">
                                <h5>Delivered</h5>
                                <p>Estimated: ${new Date(Date.now() + 259200000).toLocaleDateString()}</p>
                                <span>Product reached final destination</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('productDetailModal')">Close</button>
                <button class="btn btn-primary" onclick="shareProduct('${productId}')">
                    <i class="fas fa-share"></i> Share
                </button>
                ${currentUser.loginType === 'pi' ? `
                <button class="btn btn-success" onclick="createPaymentForProduct('${productId}')">
                    <i class="fas fa-coins"></i> Pay with Pi
                </button>
                ` : ''}
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

// Confirm product deletion
function confirmDelete(productId, productName) {
    document.getElementById('deleteProductName').textContent = productName;
    
    // Set up delete confirmation
    const confirmBtn = document.getElementById('confirmDeleteBtn');
    confirmBtn.onclick = function() {
        deleteProduct(productId);
    };
    
    document.getElementById('deleteConfirmModal').style.display = 'block';
}

// Delete product
async function deleteProduct(productId) {
    try {
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }
        
        const response = await fetch(`${API_BASE}/products`, {
            method: 'DELETE',
            headers: headers,
            body: JSON.stringify({ id: productId })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Remove from products array
            products = products.filter(p => (p._id !== productId) && (p.id !== productId));
            
            // Update localStorage as fallback
            localStorage.setItem('userProducts', JSON.stringify(products));
            
            // Update UI
            displayProducts();
            updateProductCount();
            
            // Close modal and show message
            closeModal('deleteConfirmModal');
            showStatus('Product deleted successfully', 'info');
            
            updateDebugPanel('Product deleted: ' + productId);
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Failed to delete product from backend:', error);
        
        // Fallback to frontend-only delete
        products = products.filter(p => (p._id !== productId) && (p.id !== productId));
        localStorage.setItem('userProducts', JSON.stringify(products));
        
        // Update UI
        displayProducts();
        updateProductCount();
        closeModal('deleteConfirmModal');
        showStatus('Product deleted locally', 'info');
    }
}

// Share product
function shareProduct(productId) {
    const product = products.find(p => (p._id === productId) || (p.id === productId));
    if (!product) return;
    
    const shareText = `Check out ${product.name} on PI TRACE - Tracked on Blockchain. Hash: ${product.hash}`;
    
    if (navigator.share) {
        navigator.share({
            title: product.name,
            text: shareText,
            url: window.location.href
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            showStatus('Product details copied to clipboard!', 'success');
        });
    }
}

// =============================================
// PAYMENT FUNCTIONS
// =============================================

// Create payment (Pi Network integration)
async function createPayment() {
    if (!currentUser) {
        showStatus('Please log in to make payments', 'error');
        return;
    }
    
    if (currentUser.loginType !== 'pi') {
        showStatus('Pi Wallet authentication required for payments', 'error');
        return;
    }
    
    try {
        updateDebugPanel('Creating payment...');
        
        const paymentData = {
            amount: 3.14,
            memo: "PI TRACE - Premium Service",
            metadata: { 
                product: "premium_tracking",
                features: ["advanced_tracking", "priority_support"]
            },
            serviceType: "premium_tracking"
        };
        
        // Try backend payment first
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }
        
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(paymentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const payment = result.data;
            updateDebugPanel(`Backend payment created: ${payment.paymentId}`);
            
            // Now create Pi Network payment
            if (currentUser.loginType === 'pi' && window.Pi) {
                try {
                    const piPayment = await Pi.createPayment({
                        amount: paymentData.amount,
                        memo: paymentData.memo,
                        metadata: { 
                            ...paymentData.metadata,
                            paymentId: payment.paymentId
                        }
                    });
                    
                    updateDebugPanel(`Pi payment created: ${piPayment.identifier}`);
                    
                    // Update backend with Pi payment identifier
                    await fetch(`${API_BASE}/payments`, {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            paymentId: payment.paymentId,
                            identifier: piPayment.identifier,
                            status: 'approved'
                        })
                    });
                    
                    showStatus('Payment initiated! Please approve in your Pi Wallet.', 'info');
                    
                    // Poll for payment completion
                    checkPaymentStatus(payment.paymentId);
                    
                } catch (piError) {
                    console.error('Pi payment error:', piError);
                    updateDebugPanel('Pi payment failed, but backend payment recorded');
                    showStatus('Payment recorded! Pi Wallet integration failed.', 'warning');
                }
            } else {
                showStatus('Payment created! Pi Wallet not available.', 'info');
            }
        } else {
            throw new Error(result.message);
        }
        
    } catch (error) {
        console.error('Payment error:', error);
        updateDebugPanel('Payment failed: ' + error.message);
        showStatus('Payment failed: ' + error.message, 'error');
    }
}

// Create payment for specific product
async function createPaymentForProduct(productId) {
    const product = products.find(p => (p._id === productId) || (p.id === productId));
    if (!product) return;
    
    try {
        updateDebugPanel(`Creating payment for product: ${product.name}`);
        
        const paymentData = {
            amount: product.price,
            memo: `PI TRACE - Purchase: ${product.name}`,
            metadata: { 
                product: "product_purchase",
                productId: productId,
                productName: product.name,
                productHash: product.hash
            },
            productId: product._id || product.id
        };
        
        const headers = {
            'Content-Type': 'application/json',
        };
        
        if (currentUser.token) {
            headers['Authorization'] = `Bearer ${currentUser.token}`;
        }
        
        const response = await fetch(`${API_BASE}/payments`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(paymentData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            const payment = result.data;
            
            if (window.Pi && currentUser.loginType === 'pi') {
                const piPayment = await Pi.createPayment({
                    amount: paymentData.amount,
                    memo: paymentData.memo,
                    metadata: paymentData.metadata
                });
                
                // Update backend
                await fetch(`${API_BASE}/payments`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        paymentId: payment.paymentId,
                        identifier: piPayment.identifier,
                        status: 'approved'
                    })
                });
                
                showStatus('Payment initiated for ' + product.name, 'info');
                checkPaymentStatus(payment.paymentId);
            }
        }
    } catch (error) {
        console.error('Product payment error:', error);
        showStatus('Failed to create payment: ' + error.message, 'error');
    }
}

// Check payment status
async function checkPaymentStatus(paymentId, retries = 0) {
    if (retries > 10) {
        updateDebugPanel('Payment status check timeout');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/payments?paymentId=${paymentId}`);
        const result = await response.json();
        
        if (result.success && result.data) {
            const payment = result.data;
            
            if (payment.status === 'completed') {
                showStatus('Payment completed successfully!', 'success');
                updateDebugPanel('Payment completed: ' + paymentId);
                loadPaymentHistory(); // Refresh payment history
                return;
            } else if (payment.status === 'failed' || payment.status === 'cancelled') {
                showStatus(`Payment ${payment.status}`, 'error');
                return;
            }
        }
        
        // Continue polling if still pending
        setTimeout(() => {
            checkPaymentStatus(paymentId, retries + 1);
        }, 3000);
        
    } catch (error) {
        console.error('Payment status check error:', error);
    }
}

// Load payment history
async function loadPaymentHistory() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE}/payments?userId=${currentUser.uid}`);
        const result = await response.json();
        
        if (result.success) {
            payments = result.data.payments || [];
            updateDebugPanel(`Loaded ${payments.length} payments`);
        }
    } catch (error) {
        console.error('Load payment history error:', error);
        payments = [];
    }
}

// Show payment history modal
function showPaymentHistory() {
    const modal = document.getElementById('paymentHistoryModal');
    if (!modal) {
        // Create payment history modal if it doesn't exist
        createPaymentHistoryModal();
        return;
    }
    
    const paymentList = document.getElementById('paymentList');
    paymentList.innerHTML = '';
    
    if (payments.length === 0) {
        paymentList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-receipt"></i>
                <h3>No Payments Yet</h3>
                <p>Your payment history will appear here</p>
            </div>
        `;
    } else {
        payments.forEach(payment => {
            const paymentItem = document.createElement('div');
            paymentItem.className = 'payment-item';
            paymentItem.innerHTML = `
                <div class="payment-header">
                    <div class="payment-id">${payment.paymentId}</div>
                    <div class="payment-status ${payment.status}">${payment.status}</div>
                </div>
                <div class="payment-details">
                    <div class="payment-amount">${payment.amount} π</div>
                    <div class="payment-date">${formatDate(payment.createdAt)}</div>
                </div>
                <div class="payment-memo">${payment.memo}</div>
            `;
            paymentList.appendChild(paymentItem);
        });
    }
    
    modal.style.display = 'block';
}

// Create payment history modal
function createPaymentHistoryModal() {
    const modal = document.createElement('div');
    modal.id = 'paymentHistoryModal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Payment History</h2>
                <span class="close-modal" onclick="closeModal('paymentHistoryModal')">&times;</span>
            </div>
            <div class="modal-body">
                <div id="paymentList" class="payment-list">
                    <!-- Payments will be loaded here -->
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-outline" onclick="closeModal('paymentHistoryModal')">Close</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    showPaymentHistory();
}

// =============================================
// FEATURE FUNCTIONS
// =============================================

// Open QR scanner modal
function openQRScanner() {
    document.getElementById('qrScannerModal').style.display = 'block';
}

// Process manual QR input
function processManualQR() {
    const qrInput = document.getElementById('manualQRInput').value.trim();
    
    if (!qrInput) {
        showStatus('Please enter a QR code', 'error');
        return;
    }
    
    // Simulate QR code processing
    showStatus('Searching for product with code: ' + qrInput, 'info');
    
    // Close modal after a delay
    setTimeout(() => {
        closeModal('qrScannerModal');
        showStatus('Product not found in your registry. Try a different code.', 'warning');
    }, 2000);
}

// Open supply chain overview
function openSupplyChain() {
    // Update stats
    document.getElementById('totalProductsStat').textContent = products.length;
    document.getElementById('activeProductsStat').textContent = products.length;
    document.getElementById('shippedProductsStat').textContent = '0';
    
    // Load supply chain list
    const chainList = document.getElementById('supplyChainList');
    chainList.innerHTML = '';
    
    if (products.length === 0) {
        chainList.innerHTML = '<p class="empty-message">No products to track yet</p>';
    } else {
        products.forEach(product => {
            const chainItem = document.createElement('div');
            chainItem.className = 'chain-item';
            chainItem.innerHTML = `
                <div class="chain-product">
                    <h4>${product.name}</h4>
                    <span class="chain-hash">${product.hash}</span>
                </div>
                <div class="chain-status">
                    <span class="status-badge active">Registered</span>
                </div>
                <div class="chain-date">${formatDate(product.uploadDate)}</div>
            `;
            chainList.appendChild(chainItem);
        });
    }
    
    document.getElementById('supplyChainModal').style.display = 'block';
}

// Search products
function searchProducts() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    if (!searchTerm) {
        displayProducts();
        return;
    }
    
    const filteredProducts = products.filter(product => {
        const originDisplay = typeof product.origin === 'string' 
            ? product.origin 
            : `${product.origin.country}${product.origin.city ? ', ' + product.origin.city : ''}`;
            
        return product.name.toLowerCase().includes(searchTerm) ||
               product.description.toLowerCase().includes(searchTerm) ||
               product.hash.toLowerCase().includes(searchTerm) ||
               originDisplay.toLowerCase().includes(searchTerm);
    });
    
    const productList = document.getElementById('productList');
    productList.innerHTML = '';
    
    if (filteredProducts.length === 0) {
        productList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Products Found</h3>
                <p>No products match your search criteria</p>
            </div>
        `;
        return;
    }
    
    filteredProducts.forEach(product => {
        const productId = product._id || product.id;
        const originDisplay = typeof product.origin === 'string' 
            ? product.origin 
            : `${product.origin.country}${product.origin.city ? ', ' + product.origin.city : ''}`;
            
        const productCard = document.createElement('div');
        productCard.className = 'product-card';
        productCard.innerHTML = `
            <div class="product-header">
                <div class="product-badge ${product.category}">${getCategoryName(product.category)}</div>
                <div class="product-actions">
                    <button class="btn-view" onclick="viewProduct('${productId}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn-delete" onclick="confirmDelete('${productId}', '${product.name}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
            <div class="product-info">
                <h3 class="product-name">${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-meta">
                    <span class="meta-item">
                        <i class="fas fa-hashtag"></i> ${product.hash}
                    </span>
                    <span class="meta-item">
                        <i class="fas fa-map-marker-alt"></i> ${originDisplay}
                    </span>
                </div>
            </div>
        `;
        productList.appendChild(productCard);
    });
}

// =============================================
// UTILITY FUNCTIONS
// =============================================

// Update debug panel
function updateDebugPanel(message) {
    const debugPanel = document.getElementById('debugPanel');
    if (debugPanel) {
        const timestamp = new Date().toLocaleTimeString();
        const debugItem = document.createElement('div');
        debugItem.className = 'debug-item';
        debugItem.innerHTML = `[${timestamp}] ${message}`;
        debugPanel.insertBefore(debugItem, debugPanel.firstChild);
        
        // Keep only last 10 messages
        while (debugPanel.children.length > 10) {
            debugPanel.removeChild(debugPanel.lastChild);
        }
    }
}

// Show status message
function showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    if (statusEl) {
        statusEl.textContent = message;
        statusEl.className = `status-container ${type}`;
        statusEl.style.display = 'block';
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            statusEl.style.display = 'none';
        }, 5000);
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (let modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
}

// Add payment history button to the UI
function addPaymentHistoryButton() {
    const actionButtons = document.querySelector('.action-buttons');
    if (actionButtons && !document.getElementById('paymentHistoryBtn')) {
        const paymentHistoryBtn = document.createElement('button');
        paymentHistoryBtn.className = 'btn btn-info';
        paymentHistoryBtn.id = 'paymentHistoryBtn';
        paymentHistoryBtn.innerHTML = '<i class="fas fa-history"></i> Payment History';
        paymentHistoryBtn.onclick = showPaymentHistory;
        actionButtons.appendChild(paymentHistoryBtn);
    }
}

// Initialize payment history button when app loads
setTimeout(addPaymentHistoryButton, 1000);
