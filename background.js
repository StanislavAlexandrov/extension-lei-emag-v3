// Global variables for exchange rate handling
let exchangeRateData = {
    rate: 0.21, // Initial fallback value
    lastUpdated: 0,
    isLoading: false,
};

// Auto-convert setting
let autoConvertEnabled = true; // Default to enabled

// Cache duration in milliseconds (4 hours)
const CACHE_DURATION = 4 * 60 * 60 * 1000;

// Function to fetch latest exchange rate
async function fetchLatestExchangeRate() {
    // Don't fetch if already loading or if cache is still valid
    const now = Date.now();
    if (
        exchangeRateData.isLoading ||
        (now - exchangeRateData.lastUpdated < CACHE_DURATION &&
            exchangeRateData.lastUpdated !== 0)
    ) {
        return exchangeRateData.rate;
    }

    exchangeRateData.isLoading = true;

    try {
        const response = await fetch(
            'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/ron.json'
        );

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();
        console.log(`Fetched exchange rate: ${data.ron.usd}`);

        // Update the exchange rate data
        exchangeRateData = {
            rate: data.ron.usd,
            lastUpdated: now,
            isLoading: false,
        };

        // Store in local storage for persistence across browser restarts
        chrome.storage.local.set({ exchangeRateData: exchangeRateData });

        return exchangeRateData.rate;
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        exchangeRateData.isLoading = false;
        return exchangeRateData.rate; // Return existing rate on error
    }
}

// Initialize: try to load from storage, then fetch fresh data
chrome.runtime.onInstalled.addListener(async () => {
    try {
        // Load exchange rate from storage
        const result = await chrome.storage.local.get('exchangeRateData');
        if (result.exchangeRateData) {
            exchangeRateData = result.exchangeRateData;
            console.log('Loaded cached exchange rate:', exchangeRateData.rate);
        }

        // Load auto-convert setting from storage
        const autoConvertResult = await chrome.storage.local.get(
            'autoConvertEnabled'
        );
        if (autoConvertResult.autoConvertEnabled !== undefined) {
            autoConvertEnabled = autoConvertResult.autoConvertEnabled;
            console.log('Loaded auto-convert setting:', autoConvertEnabled);
        } else {
            // If setting doesn't exist yet, initialize it
            chrome.storage.local.set({
                autoConvertEnabled: autoConvertEnabled,
            });
        }
    } catch (e) {
        console.error('Error loading cached data:', e);
    }

    // Fetch fresh rate regardless of cache
    fetchLatestExchangeRate();
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getExchangeRate') {
        // Return immediately with current rate
        sendResponse({
            exchangeRate: exchangeRateData.rate,
            lastUpdated: exchangeRateData.lastUpdated,
        });

        // Then refresh in background if needed
        fetchLatestExchangeRate();
        return true; // Keep the message channel open for the async response
    }

    if (request.action === 'forceRefreshRate') {
        // Reset last updated time to force a refresh
        exchangeRateData.lastUpdated = 0;
        fetchLatestExchangeRate().then((rate) => {
            sendResponse({
                exchangeRate: rate,
                lastUpdated: exchangeRateData.lastUpdated,
            });
        });
        return true; // Keep the message channel open for the async response
    }

    if (request.action === 'getAutoConvertSetting') {
        sendResponse({
            enabled: autoConvertEnabled,
        });
        return true;
    }

    if (request.action === 'setAutoConvertSetting') {
        autoConvertEnabled = request.enabled;
        chrome.storage.local.set({ autoConvertEnabled: autoConvertEnabled });
        sendResponse({
            success: true,
        });
        return true;
    }
});
