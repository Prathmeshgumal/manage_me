from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(self, status: int, message: str, details=None):
        self.status = status
        self.message = message
        self.details = details


def _body(message: str, details=None) -> dict:
    inner: dict = {"message": message}
    if details is not None:
        inner["details"] = details
    return {"error": inner}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app_error(_req: Request, exc: AppError):
        return JSONResponse(status_code=exc.status, content=_body(exc.message, exc.details))

    @app.exception_handler(RequestValidationError)
    async def _validation(_req: Request, exc: RequestValidationError):
        return JSONResponse(status_code=400, content=_body("Validation failed", _safe_errors(exc)))


def _safe_errors(exc: RequestValidationError):
    # exc.errors() can contain non-JSON-serializable context (e.g. ValueError);
    # reduce to plain, serializable fields.
    out = []
    for err in exc.errors():
        out.append({"loc": list(err.get("loc", [])), "msg": err.get("msg"), "type": err.get("type")})
    return out
