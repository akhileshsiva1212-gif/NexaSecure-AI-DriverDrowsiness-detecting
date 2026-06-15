"""OBD-II data source abstraction.

Defines the interface every OBD source must satisfy. The only real implementation is the
read-only serial/ELM327 driver (`serial_source.SerialObdSource`), selected via the
`NEXA_OBD_SOURCE` env var or the runtime connect endpoint. With no adapter the vehicle
monitor stays disconnected and reports nothing — engine data is never fabricated.

Safety/security note: OBD access is strictly **read-only**. Nothing here ever writes to
the vehicle bus.
"""

from __future__ import annotations

from typing import Protocol

from app.features.vehicle_health.schemas import VehicleReading


class ObdSource(Protocol):
    """Anything that can produce a vehicle reading on demand."""

    def read(self) -> VehicleReading: ...


def make_obd_source(kind: str) -> ObdSource:
    """Factory: return the OBD source selected by configuration."""
    if kind == "serial":
        # Real read-only ELM327 driver. `obd` (python-OBD) is an optional extra imported
        # lazily inside SerialObdSource, so a missing dependency surfaces here at construction
        # as a friendly install hint; a missing adapter surfaces as ObdConnectionError (which
        # the route turns into a 503).
        from app.core.config import get_settings
        from app.features.vehicle_health.serial_source import SerialObdSource

        settings = get_settings()
        try:
            return SerialObdSource(
                port=settings.obd_serial_port,
                baudrate=settings.obd_baudrate,
                timeout=settings.obd_connect_timeout,
            )
        except ImportError as exc:  # python-OBD not installed
            raise NotImplementedError(
                "Real OBD-II ('serial') needs python-OBD. Install it with: "
                "pip install -r requirements-obd.txt"
            ) from exc
    raise NotImplementedError(
        f"OBD source '{kind}' not available. Use NEXA_OBD_SOURCE=serial (real adapter) "
        "or 'none' to stay disconnected."
    )
