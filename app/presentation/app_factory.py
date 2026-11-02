"""FastHTML Application Factory for DCLM Field Utility."""
from __future__ import annotations

from pathlib import Path
from fasthtml.common import FastHTML, Link, Meta, Script
from faststrap import add_bootstrap, mount_assets
from starlette.responses import FileResponse

from ..core.config import APP_NAME
from ..core.theme import FASTSTRAP_THEME
from .routes.api_proxy import setup_api_proxy_routes
from .routes.auth import setup_auth_routes
from .routes.attendance import setup_attendance_routes
from .routes.counter import setup_counter_routes
from .routes.home import setup_home_routes
from .routes.fellowship import setup_fellowship_routes
from .routes.information import setup_information_routes
from .routes.queues import setup_queue_routes
from .routes.registration import setup_registration_routes
from .routes.settings import setup_settings_routes
from .routes.setup import setup_setup_routes

BASE_DIR = Path(__file__).resolve().parents[2]


def create_app() -> FastHTML:
    """Instantiate and configure the FastHTML + Faststrap application."""
    app = FastHTML(surreal=False, htmx=False)

    # 1. Initialize Faststrap Bootstrap 5.3 runtime
    add_bootstrap(app, theme=FASTSTRAP_THEME, mode="light")

    # 2. Mount app-owned static assets
    mount_assets(app, str(BASE_DIR / "assets"), url_path="/assets")

    # 3. Add PWA Manifest, custom CSS, and JS engine headers
    sw_registration = """
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', async () => {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations
            .filter((registration) => new URL(registration.scope).pathname === '/assets/js/')
            .map((registration) => registration.unregister()));
          await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
        } catch (err) {
          console.warn('SW failed:', err);
        }
      });
    }
    """

    app.hdrs = app.hdrs + [
        Meta(name="viewport", content="width=device-width, initial-scale=1, viewport-fit=cover"),
        Meta(name="apple-mobile-web-app-capable", content="yes"),
        Meta(name="apple-mobile-web-app-status-bar-style", content="default"),
        Meta(name="theme-color", content="#0f2752"),
        Link(rel="icon", href="/assets/favicon.png", type="image/png"),
        Link(rel="apple-touch-icon", href="/assets/icon-192.png"),
        Link(rel="manifest", href="/assets/manifest.json"),
        Link(rel="stylesheet", href="/assets/css/utility.css?v=8"),
        Script(src="/assets/js/db.js?v=8", defer=True),
        Script(src="/assets/js/auth.js?v=3", defer=True),
        Script(src="/assets/js/haptics.js?v=3", defer=True),
        Script(src="/assets/js/sync.js?v=8", defer=True),
        Script(src="/assets/js/app.js?v=11", defer=True),
        Script(sw_registration),
    ]

    # 4. Register all route modules
    setup_home_routes(app)
    setup_auth_routes(app)
    setup_counter_routes(app)
    setup_attendance_routes(app)
    setup_registration_routes(app)
    setup_fellowship_routes(app)
    setup_setup_routes(app)
    setup_queue_routes(app)
    setup_information_routes(app)
    setup_settings_routes(app)
    setup_api_proxy_routes(app)

    @app.get("/sw.js")
    def service_worker_script():
        return FileResponse(
            BASE_DIR / "assets" / "js" / "sw.js",
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/", "Cache-Control": "no-cache"},
        )

    @app.get("/health")
    def health():
        return {"status": "ok", "app": APP_NAME, "version": "1.0.0"}

    return app
