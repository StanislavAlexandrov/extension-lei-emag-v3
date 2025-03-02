// Track conversion state
let isConverted = false;
let currentExchangeRate = 0;

// Create and append a tooltip element for hover information
const tooltip = document.createElement('div');
tooltip.className = 'conversion-tooltip';
tooltip.style.opacity = '0';
document.body.appendChild(tooltip);

// Price selectors for different Romanian e-commerce websites
const PRICE_SELECTORS = [
    // eMag selectors
    'p.product-new-price',
    '.product-new-price',
    '.product-list-price',

    // Ozone selectors
    '.price',
    '.product-price',

    // Common selectors that might work on both
    '.price-wrapper',
    '.regular-price',
    '.special-price',
    '[itemprop="price"]',
];

// Function to extract numeric price from text
function extractPrice(priceText) {
    // Handle currency symbols, commas, and various formats
    return parseFloat(
        priceText
            .replace(/[^\d,\.]/g, '') // Remove all non-numeric characters except comma and period
            .replace(',', '.') // Convert comma to period for parseFloat
    );
}

// Function to convert prices
function convertPrices(exchangeRate) {
    currentExchangeRate = exchangeRate;

    // Combine all selectors and query
    const elements = document.querySelectorAll(PRICE_SELECTORS.join(', '));
    let conversionCount = 0;

    elements.forEach((element) => {
        // Skip if already processed
        if (element.getAttribute('data-processed')) return;

        const originalText = element.innerText.trim();
        // Skip empty elements
        if (!originalText) return;

        try {
            // Extract the price
            const amountInLei = extractPrice(originalText);

            // Skip if not a valid number
            if (isNaN(amountInLei) || amountInLei <= 0) return;

            // Calculate USD amount
            const amountInUsd = (amountInLei * exchangeRate).toFixed(2);

            // Create wrapper if not already wrapped
            if (!element.classList.contains('price-container')) {
                // Create wrapper
                const wrapper = document.createElement('div');
                wrapper.className = 'price-container';
                element.parentNode.insertBefore(wrapper, element);
                wrapper.appendChild(element);

                // Create original price element
                const originalPrice = document.createElement('div');
                originalPrice.className = 'price-original';
                originalPrice.textContent = `Original: ${originalText}`;
                wrapper.appendChild(originalPrice);
            }

            // Save original text if not already saved
            if (!element.hasAttribute('data-original-price')) {
                element.setAttribute('data-original-price', originalText);
            }

            // Update the element with converted price
            element.textContent = `$${amountInUsd} USD`;
            element.classList.add('price-converted');

            // Mark as processed
            element.setAttribute('data-processed', 'true');
            conversionCount++;

            // Add hover event for the element
            element.addEventListener('mouseover', function (e) {
                tooltip.textContent = `Original: ${originalText} | Rate: 1 RON = $${exchangeRate} USD`;
                tooltip.style.opacity = '1';
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            });

            element.addEventListener('mouseout', function () {
                tooltip.style.opacity = '0';
            });

            element.addEventListener('mousemove', function (e) {
                tooltip.style.left = e.pageX + 10 + 'px';
                tooltip.style.top = e.pageY + 10 + 'px';
            });
        } catch (error) {
            console.error(
                `Error converting price for element:`,
                element,
                error
            );
        }
    });

    isConverted = true;
    console.log(`Converted ${conversionCount} prices from RON to USD`);

    // Notify popup about the conversion result
    chrome.runtime.sendMessage({
        action: 'conversionComplete',
        count: conversionCount,
    });
}

// Function to restore original prices
function restoreOriginalPrices() {
    const convertedElements = document.querySelectorAll(
        '[data-processed="true"]'
    );

    convertedElements.forEach((element) => {
        const originalPrice = element.getAttribute('data-original-price');
        if (originalPrice) {
            element.textContent = originalPrice;
            element.classList.remove('price-converted');
        }
    });

    isConverted = false;
    console.log(`Restored ${convertedElements.length} prices to original RON`);

    // Notify popup about the restoration
    chrome.runtime.sendMessage({
        action: 'pricesRestored',
        count: convertedElements.length,
    });
}

// Message listener
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'convertCurrency') {
        convertPrices(request.exchangeRate);
        sendResponse({ success: true });
    } else if (request.action === 'restoreOriginalPrices') {
        restoreOriginalPrices();
        sendResponse({ success: true });
    } else if (request.action === 'getConversionState') {
        sendResponse({
            isConverted: isConverted,
            currentRate: currentExchangeRate,
        });
    }
    return true; // Keep the message channel open for the async response
});

// Run once when page is fully loaded to detect if any other content scripts have already processed the page
window.addEventListener('load', function () {
    // Check if there are already converted prices
    const convertedElements = document.querySelectorAll(
        '[data-processed="true"]'
    );
    if (convertedElements.length > 0) {
        isConverted = true;
    }

    // Let the popup know we're ready
    chrome.runtime.sendMessage({
        action: 'contentScriptReady',
        isConverted: isConverted,
    });
});
