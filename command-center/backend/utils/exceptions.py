"""Domain exceptions — raised by services, caught by middleware.

Per BACKEND-STANDARDS.md Section 6: services raise domain exceptions,
the global handler converts them to HTTP responses. Services never
import from fastapi.
"""


class CommandCenterError(Exception):
    """Base exception for all CC domain errors."""
    def __init__(self, message: str, detail: str = None):
        self.message = message
        self.detail = detail
        super().__init__(message)


class NotFoundError(CommandCenterError):
    """Raised when a requested resource doesn't exist."""
    pass


class ConflictError(CommandCenterError):
    """Raised when an operation conflicts with current state."""
    pass


class ValidationError(CommandCenterError):
    """Raised when business logic validation fails (beyond Pydantic)."""
    pass


class ExternalServiceError(CommandCenterError):
    """Raised when an external service (Claude API, Supabase) fails."""
    def __init__(self, service: str, message: str, detail: str = None):
        self.service = service
        super().__init__(f"{service}: {message}", detail)
