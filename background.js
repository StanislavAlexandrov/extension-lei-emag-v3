// Global variable to hold the exchange rate
var exchangeRate = 0.22; // Initial fallback value

// Function to fetch latest exchange rate
async function fetchLatestExchangeRate() {
    try {
        const response = await fetch(
            'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/ron.json'
        );
        const data = await response.json();
        console.log(data.ron.usd + " this is what's returned");
        exchangeRate = data.ron.usd; // Update the global variable
    } catch (error) {
        console.error('Error fetching exchange rate:', error);
        // Fallback value is already set, no need to set it again
    }
}

// Fetch the exchange rate when the service worker starts
fetchLatestExchangeRate();
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'getExchangeRate') {
        sendResponse({ exchangeRate: exchangeRate });
    }
});
