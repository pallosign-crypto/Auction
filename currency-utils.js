// Tanzania Real Estate Auctions - Currency Utilities
// Handles Tanzanian Shilling (TZS) formatting and conversion

class CurrencyUtils {
    constructor() {
        this.baseCurrency = 'TZS';
        this.exchangeRates = {
            USD: 2500,  // 1 USD = 2500 TZS (approximate rate)
            EUR: 2700,  // 1 EUR = 2700 TZS (approximate rate)
            GBP: 3100,  // 1 GBP = 3100 TZS (approximate rate)
            KES: 17,    // 1 KES = 17 TZS (approximate rate)
            UGX: 0.65   // 1 UGX = 0.65 TZS (approximate rate)
        };
        
        this.tzsSymbol = '₦'; // Using Naira symbol as placeholder for TZS
        this.decimalPlaces = 0; // TZS typically doesn't use decimal places
    }
    
    // Format TZS amount with proper symbol and separators
    formatTZS(amount, showSymbol = true) {
        const formattedAmount = this.formatNumber(amount);
        return showSymbol ? `${this.tzsSymbol} ${formattedAmount}` : formattedAmount;
    }
    
    // Format number with thousand separators
    formatNumber(number) {
        return new Intl.NumberFormat('en-TZ', {
            minimumFractionDigits: this.decimalPlaces,
            maximumFractionDigits: this.decimalPlaces
        }).format(number);
    }
    
    // Convert from foreign currency to TZS
    convertToTZS(amount, fromCurrency) {
        if (fromCurrency === this.baseCurrency) {
            return amount;
        }
        
        const rate = this.exchangeRates[fromCurrency];
        if (!rate) {
            console.warn(`Exchange rate for ${fromCurrency} not found`);
            return amount;
        }
        
        return Math.round(amount * rate);
    }
    
    // Convert from TZS to foreign currency
    convertFromTZS(amount, toCurrency) {
        if (toCurrency === this.baseCurrency) {
            return amount;
        }
        
        const rate = this.exchangeRates[toCurrency];
        if (!rate) {
            console.warn(`Exchange rate for ${toCurrency} not found`);
            return amount;
        }
        
        return Math.round(amount / rate);
    }
    
    // Format price range for search filters
    formatPriceRange(minPrice, maxPrice, currency = 'TZS') {
        if (currency !== 'TZS') {
            minPrice = this.convertToTZS(minPrice, currency);
            maxPrice = this.convertToTZS(maxPrice, currency);
        }
        
        if (minPrice === 0 && maxPrice === 0) {
            return 'Any Price';
        }
        
        if (minPrice === 0) {
            return `Up to ${this.formatTZS(maxPrice)}`;
        }
        
        if (maxPrice === 0) {
            return `From ${this.formatTZS(minPrice)}`;
        }
        
        return `${this.formatTZS(minPrice)} - ${this.formatTZS(maxPrice)}`;
    }
    
    // Parse price input from user
    parsePriceInput(input) {
        // Remove currency symbols and commas
        const cleanInput = input.toString().replace(/[₦,\s]/g, '');
        const number = parseFloat(cleanInput);
        
        if (isNaN(number)) {
            return 0;
        }
        
        return Math.round(number);
    }
    
    // Get price in millions/billions format for display
    getShortPriceFormat(amount) {
        if (amount >= 1000000000) {
            return `${this.formatNumber(amount / 1000000000)}B`;
        } else if (amount >= 1000000) {
            return `${this.formatNumber(amount / 1000000)}M`;
        } else if (amount >= 1000) {
            return `${this.formatNumber(amount / 1000)}K`;
        } else {
            return this.formatNumber(amount);
        }
    }
    
    // Convert property data to TZS
    convertPropertyPrices(property, fromCurrency = 'USD') {
        const converted = { ...property };
        
        if (property.price && fromCurrency !== 'TZS') {
            converted.price = this.convertToTZS(property.price, fromCurrency);
        }
        
        if (property.currentBid && fromCurrency !== 'TZS') {
            converted.currentBid = this.convertToTZS(property.currentBid, fromCurrency);
        }
        
        if (property.reservePrice && fromCurrency !== 'TZS') {
            converted.reservePrice = this.convertToTZS(property.reservePrice, fromCurrency);
        }
        
        if (property.startingPrice && fromCurrency !== 'TZS') {
            converted.startingPrice = this.convertToTZS(property.startingPrice, fromCurrency);
        }
        
        return converted;
    }
    
    // Format bid amount with increment
    formatBidWithIncrement(currentBid, incrementPercent = 5) {
        const increment = Math.round(currentBid * (incrementPercent / 100));
        const nextBid = currentBid + increment;
        
        return {
            current: this.formatTZS(currentBid),
            increment: this.formatTZS(increment),
            nextBid: this.formatTZS(nextBid),
            nextBidRaw: nextBid
        };
    }
    
    // Generate price range options for filters
    getPriceRangeOptions() {
        return [
            { label: 'Any Price', min: 0, max: 0 },
            { label: 'Under ₦ 100M', min: 0, max: 100000000 },
            { label: '₦ 100M - ₦ 500M', min: 100000000, max: 500000000 },
            { label: '₦ 500M - ₦ 1B', min: 500000000, max: 1000000000 },
            { label: '₦ 1B - ₦ 5B', min: 1000000000, max: 5000000000 },
            { label: 'Over ₦ 5B', min: 5000000000, max: 0 }
        ];
    }
    
    // Calculate commission and fees
    calculateFees(amount, commissionRate = 0.05) {
        const commission = Math.round(amount * commissionRate);
        const stampDuty = Math.round(amount * 0.01); // 1% stamp duty
        const registrationFee = Math.round(amount * 0.0025); // 0.25% registration fee
        const totalFees = commission + stampDuty + registrationFee;
        
        return {
            commission: commission,
            stampDuty: stampDuty,
            registrationFee: registrationFee,
            totalFees: totalFees,
            netAmount: amount - totalFees
        };
    }
    
    // Format auction statistics
    formatAuctionStats(stats) {
        return {
            totalBids: this.formatNumber(stats.totalBids || 0),
            currentBid: this.formatTZS(stats.currentBid || 0),
            startingPrice: this.formatTZS(stats.startingPrice || 0),
            reservePrice: this.formatTZS(stats.reservePrice || 0),
            totalRevenue: this.formatTZS(stats.totalRevenue || 0),
            averageBid: this.formatTZS(stats.averageBid || 0),
            highestBid: this.formatTZS(stats.highestBid || 0),
            lowestBid: this.formatTZS(stats.lowestBid || 0)
        };
    }
}

// Create global instance
window.currencyUtils = new CurrencyUtils();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CurrencyUtils;
}