// Tanzania Real Estate Auctions - Main JavaScript Functionality
// Comprehensive interactive features for auction platform

class TanzaniaAuctions {
    constructor() {
        this.properties = [];
        this.auctions = [];
        this.user = null;
        this.map = null;
        this.markers = [];
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.initializeAnimations();
        this.initializeCounters();
        this.initializeTypedText();
        this.initializePropertyMap();
        this.initializeMarketChart();
        this.startAuctionTimers();
        this.initializeScrollReveal();
        
        // Page-specific initializations
        if (document.getElementById('propertiesGrid')) {
            this.initializePropertyFilters();
        }
        
        if (document.getElementById('auctionDashboard')) {
            this.initializeAuctionInterface();
        }
    }
    
    setupEventListeners() {
        // Navigation
        document.addEventListener('DOMContentLoaded', () => {
            this.setupNavigation();
            this.setupMobileMenu();
        });
        
        // Property filters
        const searchBtn = document.getElementById('searchBtn');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.filterProperties());
        }
        
        const clearFilters = document.getElementById('clearFilters');
        if (clearFilters) {
            clearFilters.addEventListener('click', () => this.clearAllFilters());
        }
        
        // Price range slider
        const priceRange = document.getElementById('priceRange');
        if (priceRange) {
            priceRange.addEventListener('input', (e) => this.updatePriceDisplay(e.target.value));
        }
        
        // Bid buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('bid-button') || e.target.closest('.bid-button')) {
                this.handleBidPlacement(e);
            }
            
            if (e.target.classList.contains('property-card') || e.target.closest('.property-card')) {
                this.handlePropertyCardClick(e);
            }
        });
        
        // Form submissions
        const contactForm = document.querySelector('form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => this.handleContactSubmission(e));
        }
        
        // View toggles
        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        if (gridView && listView) {
            gridView.addEventListener('click', () => this.toggleView('grid'));
            listView.addEventListener('click', () => this.toggleView('list'));
        }
    }
    
    setupNavigation() {
        // Smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });
        
        // Active navigation highlighting
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        const navLinks = document.querySelectorAll('nav a');
        navLinks.forEach(link => {
            const href = link.getAttribute('href');
            if (href === currentPage || (currentPage === '' && href === 'index.html')) {
                link.classList.add('text-savanna-gold', 'font-semibold');
            }
        });
    }
    
    setupMobileMenu() {
        const mobileMenuButton = document.querySelector('.md\\:hidden button');
        if (mobileMenuButton) {
            mobileMenuButton.addEventListener('click', () => {
                // Mobile menu toggle functionality
                console.log('Mobile menu toggled');
            });
        }
    }
    
    initializeAnimations() {
        // Initialize Anime.js animations
        if (typeof anime !== 'undefined') {
            // Property card hover animations
            const propertyCards = document.querySelectorAll('.property-card, .auction-card, .team-card');
            propertyCards.forEach(card => {
                card.addEventListener('mouseenter', () => {
                    anime({
                        targets: card,
                        scale: 1.02,
                        rotateX: 5,
                        duration: 300,
                        easing: 'easeOutCubic'
                    });
                });
                
                card.addEventListener('mouseleave', () => {
                    anime({
                        targets: card,
                        scale: 1,
                        rotateX: 0,
                        duration: 300,
                        easing: 'easeOutCubic'
                    });
                });
            });
            
            // Button hover animations
            const buttons = document.querySelectorAll('button, .btn');
            buttons.forEach(button => {
                button.addEventListener('mouseenter', () => {
                    anime({
                        targets: button,
                        scale: 1.05,
                        duration: 200,
                        easing: 'easeOutCubic'
                    });
                });
                
                button.addEventListener('mouseleave', () => {
                    anime({
                        targets: button,
                        scale: 1,
                        duration: 200,
                        easing: 'easeOutCubic'
                    });
                });
            });
        }
    }
    
    initializeCounters() {
        const counters = document.querySelectorAll('[data-counter]');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-counter'));
            const duration = 2000;
            const increment = target / (duration / 16);
            let current = 0;
            
            const updateCounter = () => {
                current += increment;
                if (current < target) {
                    counter.textContent = Math.floor(current);
                    requestAnimationFrame(updateCounter);
                } else {
                    counter.textContent = target;
                }
            };
            
            // Start counter when element is visible
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        updateCounter();
                        observer.unobserve(entry.target);
                    }
                });
            });
            
            observer.observe(counter);
        });
    }
    
    initializeTypedText() {
        const typedElement = document.getElementById('typed-text');
        if (typedElement && typeof Typed !== 'undefined') {
            new Typed('#typed-text', {
                strings: [
                    'Luxury Villas in Dar es Salaam',
                    'Safari Lodges in Serengeti',
                    'Beachfront Properties in Zanzibar',
                    'Commercial Investments in Arusha',
                    'Premium Real Estate Auctions'
                ],
                typeSpeed: 50,
                backSpeed: 30,
                backDelay: 2000,
                loop: true,
                showCursor: true,
                cursorChar: '|'
            });
        }
    }
    
    initializePropertyMap() {
        const mapContainer = document.getElementById('propertyMap');
        if (mapContainer && typeof L !== 'undefined') {
            // Initialize Leaflet map
            this.map = L.map('propertyMap').setView([-6.7924, 39.2083], 6); // Tanzania center
            
            // Add tile layer
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors'
            }).addTo(this.map);
            
            // Property locations
            const properties = [
                { name: 'Oceanfront Luxury Villa', lat: -6.7924, lng: 39.2083, price: '$285,000', type: 'Villa' },
                { name: 'Eco Safari Lodge', lat: -2.3333, lng: 34.8333, price: '$450,000', type: 'Safari Lodge' },
                { name: 'Modern Apartment Complex', lat: -6.7924, lng: 39.2083, price: '$180,000', type: 'Apartment' },
                { name: 'Beachfront Villa', lat: -6.1630, lng: 39.1980, price: '$320,000', type: 'Villa' },
                { name: 'Commercial Building', lat: -6.7924, lng: 39.2083, price: '$650,000', type: 'Commercial' },
                { name: 'Safari Camp', lat: -3.3667, lng: 35.8333, price: '$380,000', type: 'Safari Lodge' }
            ];
            
            // Add markers
            properties.forEach(property => {
                const marker = L.marker([property.lat, property.lng])
                    .addTo(this.map)
                    .bindPopup(`
                        <div class="p-2">
                            <h3 class="font-bold text-basalt-black">${property.name}</h3>
                            <p class="text-savanna-gold font-semibold">${property.price}</p>
                            <p class="text-sm text-mountain-gray">${property.type}</p>
                            <button class="mt-2 bg-ocean-teal text-white px-3 py-1 rounded text-sm hover:bg-savanna-gold transition-colors">
                                View Details
                            </button>
                        </div>
                    `);
                
                this.markers.push(marker);
            });
        }
    }
    
    initializeMarketChart() {
        const chartContainer = document.getElementById('marketChart');
        if (chartContainer && typeof echarts !== 'undefined') {
            const chart = echarts.init(chartContainer);
            
            const option = {
                title: {
                    text: 'Tanzania Property Market Trends',
                    textStyle: {
                        color: '#1A202C',
                        fontSize: 16,
                        fontWeight: 'bold'
                    }
                },
                tooltip: {
                    trigger: 'axis',
                    axisPointer: {
                        type: 'cross'
                    }
                },
                legend: {
                    data: ['Property Values', 'Rental Yields', 'Transaction Volume'],
                    bottom: 10
                },
                xAxis: {
                    type: 'category',
                    data: ['2019', '2020', '2021', '2022', '2023', '2024', '2025']
                },
                yAxis: {
                    type: 'value',
                    axisLabel: {
                        formatter: '{value}%'
                    }
                },
                series: [
                    {
                        name: 'Property Values',
                        type: 'line',
                        data: [100, 105, 112, 118, 125, 132, 140],
                        itemStyle: {
                            color: '#D4A574'
                        },
                        smooth: true
                    },
                    {
                        name: 'Rental Yields',
                        type: 'line',
                        data: [6.2, 6.5, 6.8, 7.1, 7.4, 7.6, 7.8],
                        itemStyle: {
                            color: '#2C7A7B'
                        },
                        smooth: true
                    },
                    {
                        name: 'Transaction Volume',
                        type: 'bar',
                        data: [85, 78, 92, 105, 118, 125, 135],
                        itemStyle: {
                            color: '#DD6B20'
                        }
                    }
                ]
            };
            
            chart.setOption(option);
            
            // Responsive chart
            window.addEventListener('resize', () => {
                chart.resize();
            });
        }
    }
    
    startAuctionTimers() {
        const timers = document.querySelectorAll('.countdown-timer');
        timers.forEach(timer => {
            this.updateAuctionTimer(timer);
            setInterval(() => this.updateAuctionTimer(timer), 1000);
        });
    }
    
    updateAuctionTimer(timerElement) {
        const timeText = timerElement.textContent;
        let hours = 0, minutes = 0, seconds = 0;
        
        if (timeText.includes(':')) {
            const parts = timeText.split(':');
            hours = parseInt(parts[0]) || 0;
            minutes = parseInt(parts[1]) || 0;
            seconds = parseInt(parts[2]) || 0;
            
            if (seconds > 0) {
                seconds--;
            } else if (minutes > 0) {
                minutes--;
                seconds = 59;
            } else if (hours > 0) {
                hours--;
                minutes = 59;
                seconds = 59;
            }
            
            const newTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
            timerElement.textContent = newTime;
            
            // Change color based on urgency
            if (hours === 0 && minutes < 30) {
                timerElement.style.color = '#DD6B20'; // Sundown orange for urgent
            } else if (hours === 0 && minutes < 60) {
                timerElement.style.color = '#D4A574'; // Savanna gold for warning
            }
        }
    }
    
    initializeScrollReveal() {
        const revealElements = document.querySelectorAll('.reveal-text');
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('revealed');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        });
        
        revealElements.forEach(element => {
            observer.observe(element);
        });
    }
    
    initializePropertyFilters() {
        // Initialize filter functionality
        const filters = {
            location: '',
            propertyType: '',
            priceRange: 500000,
            auctionStatus: ''
        };
        
        // Store filter values
        document.getElementById('locationFilter')?.addEventListener('change', (e) => {
            filters.location = e.target.value;
        });
        
        document.getElementById('propertyTypeFilter')?.addEventListener('change', (e) => {
            filters.propertyType = e.target.value;
        });
        
        document.getElementById('auctionStatusFilter')?.addEventListener('change', (e) => {
            filters.auctionStatus = e.target.value;
        });
    }
    
    filterProperties() {
        const properties = document.querySelectorAll('.property-card');
        let visibleCount = 0;
        
        const locationFilter = document.getElementById('locationFilter')?.value || '';
        const propertyTypeFilter = document.getElementById('propertyTypeFilter')?.value || '';
        const priceRange = parseInt(document.getElementById('priceRange')?.value || '1000000');
        const auctionStatusFilter = document.getElementById('auctionStatusFilter')?.value || '';
        
        properties.forEach(property => {
            const location = property.getAttribute('data-location') || '';
            const type = property.getAttribute('data-type') || '';
            const price = parseInt(property.getAttribute('data-price') || '0');
            const status = property.getAttribute('data-status') || '';
            
            let show = true;
            
            if (locationFilter && location !== locationFilter) show = false;
            if (propertyTypeFilter && type !== propertyTypeFilter) show = false;
            if (price > priceRange) show = false;
            if (auctionStatusFilter && status !== auctionStatusFilter) show = false;
            
            if (show) {
                property.style.display = 'block';
                visibleCount++;
                
                // Animate in
                if (typeof anime !== 'undefined') {
                    anime({
                        targets: property,
                        opacity: [0, 1],
                        translateY: [30, 0],
                        duration: 500,
                        delay: visibleCount * 100,
                        easing: 'easeOutCubic'
                    });
                }
            } else {
                property.style.display = 'none';
            }
        });
        
        // Update property count
        const countElement = document.getElementById('propertyCount');
        if (countElement) {
            countElement.textContent = visibleCount;
        }
    }
    
    clearAllFilters() {
        document.getElementById('locationFilter').value = '';
        document.getElementById('propertyTypeFilter').value = '';
        document.getElementById('priceRange').value = '1000000';
        document.getElementById('auctionStatusFilter').value = '';
        this.updatePriceDisplay('1000000');
        this.filterProperties();
    }
    
    updatePriceDisplay(value) {
        const display = document.getElementById('priceDisplay');
        if (display) {
            const price = parseInt(value);
            if (price >= 1000000) {
                display.textContent = `$${(price / 1000000).toFixed(1)}M`;
            } else if (price >= 1000) {
                display.textContent = `$${(price / 1000).toFixed(0)}K`;
            } else {
                display.textContent = `$${price}`;
            }
        }
    }
    
    initializeAuctionInterface() {
        // Auto-bid functionality
        const autoBidToggle = document.querySelector('input[type="checkbox"]');
        if (autoBidToggle) {
            autoBidToggle.addEventListener('change', (e) => {
                const slider = document.querySelector('.auto-bid-slider');
                if (slider) {
                    slider.disabled = !e.target.checked;
                }
            });
        }
        
        // Bid input validation
        const bidInputs = document.querySelectorAll('.bid-input');
        bidInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                const minBid = parseInt(e.target.getAttribute('min') || '0');
                const value = parseInt(e.target.value || '0');
                
                if (value < minBid) {
                    e.target.setCustomValidity(`Minimum bid is $${minBid.toLocaleString()}`);
                } else {
                    e.target.setCustomValidity('');
                }
            });
        });
    }
    
    handleBidPlacement(e) {
        e.preventDefault();
        const bidInput = e.target.closest('.auction-card')?.querySelector('.bid-input');
        if (bidInput) {
            const bidAmount = bidInput.value;
            if (bidAmount) {
                this.showNotification(`Bid of $${parseInt(bidAmount).toLocaleString()} placed successfully!`, 'success');
                
                // Update bid history (simulated)
                this.updateBidHistory(bidAmount);
            } else {
                this.showNotification('Please enter a bid amount', 'error');
            }
        }
    }
    
    updateBidHistory(bidAmount) {
        const bidHistory = document.querySelector('.bid-history-item');
        if (bidHistory) {
            const newBid = document.createElement('div');
            newBid.className = 'bid-history-item p-3 rounded-lg';
            newBid.innerHTML = `
                <div class="flex justify-between items-center">
                    <span class="font-semibold text-sm">You</span>
                    <span class="text-savanna-gold font-bold">$${parseInt(bidAmount).toLocaleString()}</span>
                </div>
                <div class="text-xs text-mountain-gray">Just now</div>
            `;
            
            const container = bidHistory.parentElement;
            container.insertBefore(newBid, container.firstChild);
            
            // Remove old entries if more than 5
            const bids = container.querySelectorAll('.bid-history-item');
            if (bids.length > 5) {
                container.removeChild(bids[bids.length - 1]);
            }
        }
    }
    
    handlePropertyCardClick(e) {
        const card = e.target.closest('.property-card');
        if (card && !e.target.closest('button')) {
            // Navigate to property details
            const propertyId = card.getAttribute('data-id') || 'property-details';
            console.log(`Navigating to property: ${propertyId}`);
            
            // For demo purposes, show a modal or navigate
            this.showPropertyModal(card);
        }
    }
    
    showPropertyModal(card) {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4';
        modal.innerHTML = `
            <div class="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="text-2xl font-crimson font-bold text-basalt-black">Property Details</h3>
                        <button class="close-modal text-mountain-gray hover:text-basalt-black">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                            </svg>
                        </button>
                    </div>
                    <div class="space-y-4">
                        <p class="text-mountain-gray">Full property details would be displayed here including:</p>
                        <ul class="list-disc list-inside text-mountain-gray space-y-2">
                            <li>Detailed property specifications</li>
                            <li>High-resolution image gallery</li>
                            <li>Virtual tour (if available)</li>
                            <li>Legal documentation</li>
                            <li>Investment analysis</li>
                            <li>Neighborhood information</li>
                        </ul>
                        <div class="flex space-x-4 mt-6">
                            <button class="bg-savanna-gold text-white px-6 py-3 rounded-lg font-semibold hover:bg-sundown-orange transition-colors">
                                Place Bid
                            </button>
                            <button class="border-2 border-ocean-teal text-ocean-teal px-6 py-3 rounded-lg font-semibold hover:bg-ocean-teal hover:text-white transition-colors">
                                Add to Watchlist
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Close modal functionality
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }
    
    handleContactSubmission(e) {
        e.preventDefault();
        const formData = new FormData(e.target);
        
        // Simulate form submission
        this.showNotification('Thank you for your inquiry! We will contact you within 24 hours.', 'success');
        e.target.reset();
    }
    
    toggleView(viewType) {
        const gridView = document.getElementById('gridView');
        const listView = document.getElementById('listView');
        const propertiesGrid = document.getElementById('propertiesGrid');
        
        if (viewType === 'grid') {
            gridView.classList.add('bg-savanna-gold', 'text-white');
            gridView.classList.remove('bg-gray-200', 'text-basalt-black');
            listView.classList.add('bg-gray-200', 'text-basalt-black');
            listView.classList.remove('bg-savanna-gold', 'text-white');
            
            propertiesGrid.className = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8';
        } else {
            listView.classList.add('bg-savanna-gold', 'text-white');
            listView.classList.remove('bg-gray-200', 'text-basalt-black');
            gridView.classList.add('bg-gray-200', 'text-basalt-black');
            gridView.classList.remove('bg-savanna-gold', 'text-white');
            
            propertiesGrid.className = 'grid grid-cols-1 gap-4';
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-20 right-4 z-50 p-4 rounded-lg shadow-lg max-w-sm transform translate-x-full transition-transform duration-300`;
        
        if (type === 'success') {
            notification.classList.add('bg-green-500', 'text-white');
        } else if (type === 'error') {
            notification.classList.add('bg-red-500', 'text-white');
        } else {
            notification.classList.add('bg-ocean-teal', 'text-white');
        }
        
        notification.innerHTML = `
            <div class="flex items-center justify-between">
                <span>${message}</span>
                <button class="ml-4 text-white hover:text-gray-200">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 5000);
        
        // Manual close
        notification.querySelector('button').addEventListener('click', () => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentNode) {
                    document.body.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.tanzaniaAuctions = new TanzaniaAuctions();
});

// Export for potential module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TanzaniaAuctions;
}