from fastapi import FastAPI

from .auth.routes import auth_router
from .errors import install_error_handlers
from .routers.projects import projects_router
from .routers.tasks import tasks_router


def create_app() -> FastAPI:
    app = FastAPI(title="MySchedule API")
    install_error_handlers(app)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(auth_router)
    app.include_router(tasks_router)
    app.include_router(projects_router)

    return app


app = create_app()
