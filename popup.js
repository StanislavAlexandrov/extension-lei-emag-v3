document.addEventListener('DOMContentLoaded', function () {
    const convertButton = document.getElementById('convert');

    convertButton.addEventListener('click', function () {
        // Fetch exchangeRate from background.js
        chrome.runtime.sendMessage(
            { action: 'getExchangeRate' },
            function (response) {
                var exchangeRate = response.exchangeRate;

                // Send message to content script
                chrome.tabs.query(
                    { active: true, currentWindow: true },
                    function (tabs) {
                        chrome.scripting.executeScript(
                            {
                                target: { tabId: tabs[0].id },
                                function: function (params) {
                                    window.exchangeRate = params.exchangeRate;
                                },
                                args: [{ exchangeRate: exchangeRate }],
                            },
                            () => {
                                chrome.tabs.sendMessage(tabs[0].id, {
                                    action: 'convertCurrency',
                                    exchangeRate: exchangeRate,
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});
