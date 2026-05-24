import logging
import urllib.parse
import requests
import config

logger = logging.getLogger("webview_service")

def get_proxies() -> dict | None:
    """Get Novosibirsk SOCKS proxy configuration from config."""
    proxy_url = getattr(config, "PROXY_URL", None)
    if proxy_url:
        return {
            "http": proxy_url,
            "https": proxy_url
        }
    return None

def fetch_and_process_market_page(url_or_query: str) -> str:
    """
    Fetches the Yandex Market page by query or URL through Novosibirsk SOCKS proxy,
    injects `<base>` tag, click interceptors, and custom CSS overrides to make it render
    beautifully inside the MiniApp WebView.
    """
    if not url_or_query:
        return "<h3>Ошибка: не указан поисковый запрос или URL</h3>"

    # Determine URL
    if url_or_query.startswith("http://") or url_or_query.startswith("https://"):
        target_url = url_or_query
    else:
        # Build search URL
        target_url = f"https://market.yandex.ru/search?text={urllib.parse.quote(url_or_query)}"

    logger.info(f"WebView Proxy: Fetching target URL: {target_url}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive",
        "Referer": "https://market.yandex.ru/"
    }

    proxies = get_proxies()
    response_text = ""
    success = False

    # Step 1: Attempt to fetch using SOCKS proxy
    if proxies:
        logger.info(f"WebView Proxy: Attempting to fetch with Novosibirsk SOCKS proxy...")
        try:
            response = requests.get(target_url, headers=headers, proxies=proxies, timeout=12)
            response.raise_for_status()
            response_text = response.text
            success = True
            logger.info("WebView Proxy: Successfully fetched page via SOCKS proxy!")
        except Exception as e:
            logger.error(f"WebView Proxy: SOCKS proxy fetch failed or timed out: {e}")

    # Step 2: Fallback to direct fetch (crucial for local development)
    if not success:
        logger.info("WebView Proxy: Falling back to direct fetch without proxy (Local Dev Fallback)...")
        try:
            response = requests.get(target_url, headers=headers, timeout=10)
            response.raise_for_status()
            response_text = response.text
            success = True
            logger.info("WebView Proxy: Successfully fetched page via direct connection!")
        except Exception as e:
            logger.error(f"WebView Proxy: Direct fetch fallback also failed: {e}")
            return f"<h3>Ошибка подключения к Яндекс Маркету: {str(e)}</h3>"

    # Step 3: Process the HTML
    # We inject the `<base>` tag to resolve static assets relative to Yandex Market.
    base_tag = '<base href="https://market.yandex.ru/">'
    
    # Custom JS to intercept clicks and form submissions in the iframe.
    # We rewrite them so they go through our proxy backend endpoint `/api/market/webview`.
    script_injection = """
    <script>
    (function() {
        console.log("Giftspy WebView Proxy: Injecting click and form submit interceptors.");
        
        // Intercept all link clicks
        document.addEventListener('click', function(e) {
            var target = e.target;
            while (target && target.tagName !== 'A') {
                target = target.parentNode;
            }
            if (target && target.href) {
                // Ignore hash links or javascript void
                var originalUrl = target.href;
                if (originalUrl.startsWith('#') || originalUrl.startsWith('javascript:')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                // Route all Yandex Market links through our proxy backend
                if (originalUrl.indexOf('market.yandex.ru') !== -1 || originalUrl.startsWith('/') || !originalUrl.startsWith('http')) {
                    window.location.href = "/api/market/webview?url=" + encodeURIComponent(originalUrl);
                } else {
                    // Open external links in a new window
                    window.open(originalUrl, '_blank');
                }
            }
        }, true);

        // Intercept all form submissions (e.g. search bars inside Yandex Market page)
        document.addEventListener('submit', function(e) {
            var form = e.target;
            if (form && form.action) {
                var actionUrl = form.action;
                
                // If it's a Yandex Market action
                if (actionUrl.indexOf('market.yandex.ru') !== -1 || actionUrl.startsWith('/') || !actionUrl.startsWith('http')) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var formData = new FormData(form);
                    var params = new URLSearchParams();
                    for (var pair of formData.entries()) {
                        params.append(pair[0], pair[1]);
                    }
                    
                    var separator = actionUrl.indexOf('?') !== -1 ? '&' : '?';
                    var finalUrl = actionUrl + separator + params.toString();
                    
                    window.location.href = "/api/market/webview?url=" + encodeURIComponent(finalUrl);
                }
            }
        }, true);
    })();
    </script>
    """

    # Custom CSS to hide distracting banners and install ads to make the Webview look premium.
    style_injection = """
    <style>
    /* Hide app install banners, cookie warnings, popups */
    .smart-banner, 
    [class*="smart-banner"], 
    [class*="smartbanner"],
    .cookie-notification,
    [class*="CookieNotification"],
    [class*="WelcomePopup"],
    [class*="Overlay-root"] {
        display: none !important;
    }
    
    /* Smooth scroll */
    html {
        scroll-behavior: smooth;
    }
    </style>
    """

    # Inject base tag in `<head>`
    if "<head>" in response_text:
        response_text = response_text.replace("<head>", f"<head>{base_tag}{style_injection}", 1)
    else:
        response_text = f"{base_tag}{style_injection}{response_text}"

    # Inject JS script before `</body>`
    if "</body>" in response_text:
        response_text = response_text.replace("</body>", f"{script_injection}</body>", 1)
    else:
        response_text = f"{response_text}{script_injection}"

    return response_text
