from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .auth.routes import auth_router
from .config import get_settings
from .errors import AppError, install_error_handlers
from .github.routes import github_router
from .routers.labels import labels_router
from .routers.library import library_router
from .routers.projects import projects_router
from .routers.tasks import tasks_router
from .routers.todos import todos_router
from .routers.trash import trash_router
from .routers.wishlist import wishlist_router


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="MySchedule API")

    if settings.is_prod:
        origins = [settings.frontend_url] if settings.frontend_url else []
        app.add_middleware(
            CORSMiddleware, allow_origins=origins, allow_credentials=True,
            allow_methods=["*"], allow_headers=["*"],
        )
    else:
        app.add_middleware(
            CORSMiddleware, allow_origin_regex=".*", allow_credentials=True,
            allow_methods=["*"], allow_headers=["*"],
        )

    install_error_handlers(app)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(auth_router)
    app.include_router(tasks_router)
    app.include_router(projects_router)
    app.include_router(labels_router)
    app.include_router(library_router)
    app.include_router(trash_router)
    app.include_router(github_router)
    app.include_router(wishlist_router)
    app.include_router(todos_router)

    @app.api_route("/{path:path}", methods=["GET", "POST", "PATCH", "PUT", "DELETE"])
    async def _not_found(_request: Request, path: str):
        raise AppError(404, "Not found")

    return app


app = create_app()
