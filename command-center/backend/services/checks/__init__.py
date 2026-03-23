"""Check implementations for the Standards & Compliance Dashboard.

Importing this package triggers registration of all checks with the
standards_service check registry. Each module calls register_check()
at import time.
"""

from services.checks import backend_checks      # noqa: F401
from services.checks import architecture_checks  # noqa: F401
from services.checks import authenticity_checks  # noqa: F401
from services.checks import content_checks       # noqa: F401
from services.checks import visual_checks        # noqa: F401
