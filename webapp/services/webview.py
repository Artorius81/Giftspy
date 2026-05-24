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

def fetch_and_process_market_page(url_or_query: str, marketplace: str = "yandex", incoming_cookies: dict = None) -> tuple[str, dict]:
    """
    Fetches the Yandex Market or Ozon mobile page by query or URL through Novosibirsk SOCKS proxy,
    injects `<base>` tag, click interceptors, and custom CSS overrides to make it render
    beautifully inside the MiniApp WebView.
    """
    if not url_or_query:
        return "<h3>Ошибка: не указан поисковый запрос или URL</h3>", {}

    # Normalize marketplace from target URL if it is a complete URL
    if url_or_query.startswith("http://") or url_or_query.startswith("https://"):
        target_url = url_or_query
        if "ozon.ru" in target_url:
            marketplace = "ozon"
        else:
            marketplace = "yandex"
    else:
        # Build search URL based on selected marketplace
        if marketplace == "ozon":
            target_url = f"https://m.ozon.ru/search/?text={urllib.parse.quote(url_or_query)}"
        else:
            target_url = f"https://m.market.yandex.ru/search?text={urllib.parse.quote(url_or_query)}"

    # Gracefully intercept Ozon and bypass completely by serving a gorgeous Ozon-branded landing
    # that opens natively in Telegram's secure in-app browser with the user's real residential IP.
    if marketplace == "ozon":
        ozon_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
            <title>Поиск Ozon</title>
            <script src="https://telegram.org/js/telegram-web-app.js"></script>
            <style>
                :root {{
                    --ozon-blue: #005bff;
                    --ozon-blue-hover: #004ecc;
                    --bg-dark: #0a0a0c;
                    --card-bg: rgba(255, 255, 255, 0.03);
                    --border-color: rgba(255, 255, 255, 0.08);
                    --text: #ffffff;
                    --text-secondary: #8e8e93;
                }}
                
                * {{
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background-color: var(--bg-dark);
                    color: var(--text);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    padding: 24px;
                    text-align: center;
                }}
                
                .card {{
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    padding: 36px 24px;
                    max-width: 360px;
                    width: 100%;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
                    animation: fadeIn 0.4s ease-out;
                }}
                
                @keyframes fadeIn {{
                    from {{ opacity: 0; transform: translateY(10px); }}
                    to {{ opacity: 1; transform: translateY(0); }}
                }}
                
                .icon-container {{
                    width: 76px;
                    height: 76px;
                    background: rgba(0, 91, 255, 0.12);
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 20px;
                    font-size: 36px;
                    border: 1px solid rgba(0, 91, 255, 0.25);
                }}
                
                h2 {{
                    font-size: 20px;
                    font-weight: 850;
                    margin-bottom: 12px;
                    letter-spacing: -0.5px;
                }}
                
                p {{
                    font-size: 13.5px;
                    color: var(--text-secondary);
                    line-height: 1.55;
                    margin-bottom: 26px;
                }}
                
                .btn {{
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    padding: 15px 24px;
                    background: var(--ozon-blue);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    font-size: 14.5px;
                    font-weight: 750;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    text-decoration: none;
                    box-shadow: 0 4px 15px rgba(0, 91, 255, 0.3);
                }}
                
                .btn:hover {{
                    background: var(--ozon-blue-hover);
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(0, 91, 255, 0.45);
                }}
                
                .btn:active {{
                    transform: translateY(0);
                }}
                
                .btn-icon {{
                    margin-left: 8px;
                    font-size: 16px;
                }}
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon-container">🔵</div>
                <h2>Поиск на Ozon</h2>
                <p>
                    Для стабильного поиска и безопасности ваших покупок, Ozon откроется непосредственно в оригинальном, безопасном мобильном браузере Telegram.
                </p>
                <button onclick="openOzon()" class="btn">
                    Открыть Ozon <span class="btn-icon">🚀</span>
                </button>
            </div>
            
            <script>
                // Initialize Telegram WebApp
                if (window.Telegram && window.Telegram.WebApp) {{
                    window.Telegram.WebApp.ready();
                    // Auto-open on load to make it seamless
                    setTimeout(openOzon, 150);
                }}
                
                function openOzon() {{
                    var targetUrl = "{target_url}";
                    if (window.Telegram && window.Telegram.WebApp) {{
                        window.Telegram.WebApp.openLink(targetUrl);
                    }} else {{
                        window.open(targetUrl, '_blank');
                    }}
                }}
            </script>
        </body>
        </html>
        """
        return ozon_html, {}

    logger.info(f"WebView Proxy ({marketplace}): Fetching target URL: {target_url}")

    headers = {
        "User-Agent": (
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Connection": "keep-alive"
    }

    if marketplace == "ozon":
        headers["Referer"] = "https://m.ozon.ru/"
    else:
        headers["Referer"] = "https://m.market.yandex.ru/"

    proxies = get_proxies()
    response_text = ""
    response_cookies = {}
    success = False

    # Step 1: Attempt to fetch using SOCKS proxy
    if proxies:
        logger.info(f"WebView Proxy ({marketplace}): Attempting to fetch with Novosibirsk SOCKS proxy...")
        try:
            response = requests.get(target_url, headers=headers, cookies=incoming_cookies, proxies=proxies, timeout=12)
            response.raise_for_status()
            response_text = response.text
            response_cookies = dict(response.cookies)
            success = True
            logger.info(f"WebView Proxy ({marketplace}): Successfully fetched page via SOCKS proxy!")
        except Exception as e:
            logger.error(f"WebView Proxy ({marketplace}): SOCKS proxy fetch failed or timed out: {e}")

    # Step 2: Fallback to direct fetch ONLY if proxies are not configured (Local Dev)
    if not success:
        if proxies:
            logger.error(f"WebView Proxy ({marketplace}): SOCKS proxy request failed, blocking direct fallback on production VPS to prevent foreign IP bans.")
            return f"<h3>Ошибка подключения к маркетплейсу ({marketplace}) через прокси. Пожалуйста, попробуйте еще раз.</h3>", {}

        logger.info(f"WebView Proxy ({marketplace}): Falling back to direct fetch without proxy (Local Dev)...")
        try:
            response = requests.get(target_url, headers=headers, cookies=incoming_cookies, timeout=10)
            response.raise_for_status()
            response_text = response.text
            response_cookies = dict(response.cookies)
            success = True
            logger.info(f"WebView Proxy ({marketplace}): Successfully fetched page via direct connection!")
        except Exception as e:
            logger.error(f"WebView Proxy ({marketplace}): Direct fetch fallback also failed: {e}")
            return f"<h3>Ошибка подключения к маркетплейсу ({marketplace}): {str(e)}</h3>", {}

    # Step 3: Process the HTML
    # We inject the `<base>` tag to resolve static assets relative to the correct mobile site.
    if marketplace == "ozon":
        base_href = "https://m.ozon.ru/"
    else:
        base_href = "https://m.market.yandex.ru/"
        
    base_tag = f'<base href="{base_href}">'
    
    # Custom JS to intercept clicks and form submissions in the iframe.
    # We rewrite them so they go through our proxy backend endpoint `/api/market/webview`.
    script_injection = """
    <script>
    (function() {
        var currentMarketplace = "__MARKETPLACE__";
        console.log("Giftspy WebView Proxy (" + currentMarketplace + "): Injecting click and form submit interceptors.");
        
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
                
                // Route all Yandex/Ozon links through our proxy backend
                var isMarketLink = originalUrl.indexOf('market.yandex.ru') !== -1 || 
                                   originalUrl.indexOf('ozon.ru') !== -1 || 
                                   originalUrl.startsWith('/') || 
                                   !originalUrl.startsWith('http');
                                   
                if (isMarketLink) {
                    window.location.href = "/api/market/webview?marketplace=" + currentMarketplace + "&url=" + encodeURIComponent(originalUrl);
                } else {
                    // Open external links in a new window
                    window.open(originalUrl, '_blank');
                }
            }
        }, true);

        // Intercept all form submissions (e.g. search bars inside page)
        document.addEventListener('submit', function(e) {
            var form = e.target;
            if (form && form.action) {
                var actionUrl = form.action;
                var isMarketAction = actionUrl.indexOf('market.yandex.ru') !== -1 || 
                                     actionUrl.indexOf('ozon.ru') !== -1 || 
                                     actionUrl.startsWith('/') || 
                                     !actionUrl.startsWith('http');
                                     
                if (isMarketAction) {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    var formData = new FormData(form);
                    var params = new URLSearchParams();
                    for (var pair of formData.entries()) {
                        params.append(pair[0], pair[1]);
                    }
                    
                    var separator = actionUrl.indexOf('?') !== -1 ? '&' : '?';
                    var finalUrl = actionUrl + separator + params.toString();
                    
                    window.location.href = "/api/market/webview?marketplace=" + currentMarketplace + "&url=" + encodeURIComponent(finalUrl);
                }
            }
        }, true);
    })();
    </script>
    """.replace("__MARKETPLACE__", marketplace)

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

    return response_text, response_cookies
