document.addEventListener('DOMContentLoaded', function () {
    // Get UI elements
    const convertButton = document.getElementById('convert');
    const restoreButton = document.getElementById('restore');
    const refreshRateButton = document.getElementById('refresh-rate');
    const exchangeRateElement = document.getElementById('exchange-rate');
    const lastUpdatedElement = document.getElementById('last-updated');
    const loaderElement = document.getElementById('loader');
    const statusElement = document.getElementById('status');

    // State variables
    let currentExchangeRate = null;
    let isConverted = false;

    // Format timestamp function
    function formatLastUpdated(timestamp) {
        if (!timestamp) return 'Never updated';

        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
        } else if (diffMins < 1440) {
            const hours = Math.floor(diffMins / 60);
            return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
        } else {
            return date.toLocaleString();
        }
    }

    // Show loading state
    function setLoading(isLoading) {
        if (isLoading) {
            loaderElement.style.display = 'block';
            convertButton.disabled = true;
            restoreButton.disabled = true;
            refreshRateButton.disabled = true;
        } else {
            loaderElement.style.display = 'none';
            convertButton.disabled = isConverted;
            restoreButton.disabled = !isConverted;
            refreshRateButton.disabled = false;
        }
    }

    // Set status message
    function setStatus(message, type = 'info') {
        statusElement.textContent = message;
        statusElement.className = 'status';
        if (type) {
            statusElement.classList.add(type);
        }
    }

    // Update UI based on conversion state
    function updateUI() {
        convertButton.disabled = isConverted;
        restoreButton.disabled = !isConverted;

        if (isConverted) {
            convertButton.classList.add('toggle-off');
            restoreButton.classList.remove('toggle-off');
        } else {
            convertButton.classList.remove('toggle-off');
            restoreButton.classList.add('toggle-off');
        }
    }

    // Get current exchange rate from background.js
    function getExchangeRate() {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(
                { action: 'getExchangeRate' },
                function (response) {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                        return;
                    }

                    if (!response || !response.exchangeRate) {
                        reject(
                            new Error('Invalid response from background script')
                        );
                        return;
                    }

                    currentExchangeRate = response.exchangeRate;
                    exchangeRateElement.textContent = `$${currentExchangeRate.toFixed(
                        4
                    )}`;
                    lastUpdatedElement.textContent = `Last updated: ${formatLastUpdated(
                        response.lastUpdated
                    )}`;

                    resolve(response.exchangeRate);
                }
            );
        });
    }

    // Force refresh exchange rate
    function refreshExchangeRate() {
        setLoading(true);
        setStatus('Refreshing exchange rate...');

        chrome.runtime.sendMessage(
            { action: 'forceRefreshRate' },
            function (response) {
                setLoading(false);

                if (chrome.runtime.lastError) {
                    setStatus('Error refreshing rate. Try again.', 'error');
                    return;
                }

                if (!response || !response.exchangeRate) {
                    setStatus(
                        'Invalid response from background script',
                        'error'
                    );
                    return;
                }

                currentExchangeRate = response.exchangeRate;
                exchangeRateElement.textContent = `$${currentExchangeRate.toFixed(
                    4
                )}`;
                lastUpdatedElement.textContent = `Last updated: ${formatLastUpdated(
                    response.lastUpdated
                )}`;

                setStatus('Exchange rate refreshed!', 'success');
                setTimeout(() => {
                    setStatus('Ready to convert prices');
                }, 2000);
            }
        );
    }

    // Check current conversion state from the active tab's content script
    function checkConversionState() {
        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                if (!tabs || !tabs[0] || !tabs[0].id) {
                    setStatus('No active tab found', 'error');
                    return;
                }

                // Try to send a message to the content script
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: 'getConversionState' },
                    function (response) {
                        // If no response, the content script might not be loaded for this page
                        if (chrome.runtime.lastError) {
                            console.log(
                                'Content script not available on this page'
                            );
                            isConverted = false;
                            updateUI();
                            return;
                        }

                        if (response && response.isConverted) {
                            isConverted = true;
                            if (response.currentRate) {
                                currentExchangeRate = response.currentRate;
                                exchangeRateElement.textContent = `$${currentExchangeRate.toFixed(
                                    4
                                )}`;
                            }
                            setStatus('Prices are currently in USD', 'success');
                        } else {
                            isConverted = false;
                            setStatus('Ready to convert prices');
                        }

                        updateUI();
                    }
                );
            }
        );
    }

    // Convert currency in the active tab
    function convertCurrency() {
        setLoading(true);
        setStatus('Converting prices...');

        getExchangeRate()
            .then((exchangeRate) => {
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    function (tabs) {
                        if (!tabs || !tabs[0] || !tabs[0].id) {
                            throw new Error('No active tab found');
                        }

                        return new Promise((resolve, reject) => {
                            chrome.tabs.sendMessage(
                                tabs[0].id,
                                {
                                    action: 'convertCurrency',
                                    exchangeRate: exchangeRate,
                                },
                                function (response) {
                                    if (chrome.runtime.lastError) {
                                        reject(
                                            new Error(
                                                `Content script error: ${chrome.runtime.lastError.message}`
                                            )
                                        );
                                        return;
                                    }

                                    resolve(response);
                                }
                            );
                        });
                    }
                );
            })
            .then((response) => {
                setLoading(false);
                if (response && response.success) {
                    isConverted = true;
                    updateUI();
                    setStatus('Prices converted to USD!', 'success');
                } else {
                    throw new Error('Conversion failed');
                }
            })
            .catch((error) => {
                setLoading(false);
                console.error('Error:', error);
                setStatus(`Error: ${error.message}`, 'error');
            });
    }

    // Restore original prices
    function restoreOriginalPrices() {
        setLoading(true);
        setStatus('Restoring original prices...');

        chrome.tabs.query(
            { active: true, currentWindow: true },
            function (tabs) {
                chrome.tabs.sendMessage(
                    tabs[0].id,
                    { action: 'restoreOriginalPrices' },
                    function (response) {
                        setLoading(false);

                        if (chrome.runtime.lastError) {
                            setStatus('Error restoring prices', 'error');
                            return;
                        }

                        if (response && response.success) {
                            isConverted = false;
                            updateUI();
                            setStatus('Original prices restored!', 'success');
                        } else {
                            setStatus('Failed to restore prices', 'error');
                        }
                    }
                );
            }
        );
    }

    // Event listeners
    convertButton.addEventListener('click', convertCurrency);
    restoreButton.addEventListener('click', restoreOriginalPrices);
    refreshRateButton.addEventListener('click', refreshExchangeRate);

    // Message listener for notifications from content script
    chrome.runtime.onMessage.addListener(function (
        request,
        sender,
        sendResponse
    ) {
        if (request.action === 'conversionComplete') {
            isConverted = true;
            updateUI();
            setStatus(`Converted ${request.count} prices to USD!`, 'success');
        } else if (request.action === 'pricesRestored') {
            isConverted = false;
            updateUI();
            setStatus(`Restored ${request.count} prices to RON!`, 'success');
        } else if (request.action === 'contentScriptReady') {
            isConverted = request.isConverted;
            updateUI();
        }
    });

    // Initialize popup
    setLoading(true);
    getExchangeRate()
        .then(() => {
            checkConversionState();
            setLoading(false);
        })
        .catch((error) => {
            console.error('Initialization error:', error);
            setStatus('Failed to load exchange rate', 'error');
            setLoading(false);
        });
});
