from fastapi import FastAPI

from .errors import install_error_handlers


def create_app() -> FastAPI:
    app = FastAPI(title="MySchedule API")
    install_error_handlers(app)

    @app.get("/health")
    async def health() -> dict[str, bool]:
        return {"ok": True}

    return app


app = create_app()
