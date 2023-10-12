// Listen for messages from popup or background
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.action === 'convertCurrency') {
        var exchangeRate = request.exchangeRate; // Get the exchange rate from the message
        var elements = document.querySelectorAll(
            'p.product-new-price:not([data-converted]), .price:not([data-converted])'
        );

        elements.forEach((element) => {
            var priceInLei = element.innerText;
            var amountInLei = parseFloat(
                priceInLei
                    .replace(',', '.')
                    .replace(' USD', '')
                    .replace(' Lei', '')
                    .replace('de la ', '')
            );
            var amountInUsd = (amountInLei * exchangeRate).toFixed(2);
            element.innerText = `${amountInUsd} USD`;
            element.setAttribute('data-converted', 'true'); // Mark this element as converted
        });
    }
});
