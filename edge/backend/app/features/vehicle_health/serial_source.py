"""Real, read-only OBD-II serial driver (ELM327 over USB/serial).

Implements the `ObdSource` interface (see `obd_source.py`) on top of **python-OBD**, so no
feature code changes when real hardware replaces the mock — it's selected with
`NEXA_OBD_SOURCE=serial`.

What's actually readable over **standard** OBD-II (and mapped here):
  * engine coolant **temperature** -> `engine_temp_c`   (PID 0105)
  * engine **RPM**                 -> `rpm`             (PID 010C)
  * vehicle **speed**              -> `speed_kph`       (PID 010D)
  * adapter **battery voltage**    -> `battery_voltage` (ELM327 `ATRV`)

`oil_pressure_kpa` and `coolant_pct` (coolant *level*) are **not** standard OBD-II PIDs and
cannot be read on a typical vehicle, so they are reported as `None` rather than fabricated.

Performance: we use `obd.Async`, which runs its own background thread continuously refreshing
the watched commands. `read()` returns the latest **cached** values instantly, so it never
blocks the FastAPI event loop (a synchronous `obd.OBD` would stall it on serial I/O each poll).

Safety/security HARD RULE: OBD access is strictly **read-only**. We only issue mode-01 reads
and the `ATRV` voltage query — never a write to the vehicle CAN bus.
"""

from __future__ import annotations

from app.core.logging import get_logger
from app.features.vehicle_health.schemas import VehicleReading

logger = get_logger("feature.vehicle_health.serial")


class ObdConnectionError(RuntimeError):
    """Raised when no adapter responds / the serial port cannot be opened."""


def _default_commands() -> dict:
    """Map our reading fields to python-OBD command objects (requires `obd` installed)."""
    import obd  # local import: optional heavy dependency

    return {
        "coolant_temp": obd.commands.COOLANT_TEMP,
        "rpm": obd.commands.RPM,
        "speed": obd.commands.SPEED,
        "voltage": obd.commands.ELM_VOLTAGE,
    }


class SerialObdSource:
    """A live, read-only OBD-II source backed by an ELM327 adapter (via python-OBD)."""

    def __init__(
        self,
        port: str = "auto",
        baudrate: int | None = None,
        timeout: float = 30.0,
        connection=None,
        commands: dict | None = None,
    ) -> None:
        # `connection`/`commands` are injection seams: tests pass fakes so this class can be
        # unit-tested for the PID->reading mapping with no hardware and no `obd` import.
        self._last: VehicleReading | None = None

        if connection is None:
            import obd  # local import: only needed for the real hardware path

            portstr = None if port in (None, "", "auto") else port
            logger.info("connecting OBD-II serial adapter (port=%s, baud=%s)",
                        portstr or "auto", baudrate or "auto")
            connection = obd.Async(portstr, baudrate=baudrate, fast=False, timeout=timeout)
            if not connection.is_connected():
                status = connection.status()
                connection.close()
                raise ObdConnectionError(
                    f"No OBD-II adapter responding (port={portstr or 'auto'}, status={status}). "
                    "Check the cable, that the adapter is seated, and the ignition is on."
                )
            commands = commands or _default_commands()
            for cmd in commands.values():
                connection.watch(cmd)
            connection.start()
            logger.info("OBD-II serial adapter connected (%s)", connection.status())

        self._conn = connection
        self._cmds = commands or _default_commands()

    @staticmethod
    def _num(resp) -> float | None:
        """Pull a float out of an OBD response, or None if the value is missing/null."""
        if resp is None:
            return None
        is_null = getattr(resp, "is_null", None)
        if callable(is_null) and resp.is_null():
            return None
        value = getattr(resp, "value", None)
        if value is None:
            return None
        magnitude = getattr(value, "magnitude", None)  # Pint Quantity -> plain number
        return float(magnitude) if magnitude is not None else float(value)

    def _coalesce(self, field: str, value: float | None) -> float:
        """A required core metric momentarily missing -> reuse last known (never fabricate)."""
        if value is not None:
            return round(value, 2)
        if self._last is not None:
            return getattr(self._last, field)
        logger.warning("OBD metric '%s' not yet available; defaulting to 0.0", field)
        return 0.0

    def read(self) -> VehicleReading:
        temp = self._num(self._conn.query(self._cmds["coolant_temp"]))
        rpm = self._num(self._conn.query(self._cmds["rpm"]))
        speed = self._num(self._conn.query(self._cmds["speed"]))
        volt = self._num(self._conn.query(self._cmds["voltage"]))

        reading = VehicleReading(
            engine_temp_c=self._coalesce("engine_temp_c", temp),
            rpm=self._coalesce("rpm", rpm),
            speed_kph=self._coalesce("speed_kph", speed),
            battery_voltage=self._coalesce("battery_voltage", volt),
            coolant_pct=None,        # not a standard OBD-II PID — honestly unreported
            oil_pressure_kpa=None,   # not a standard OBD-II PID — honestly unreported
        )
        self._last = reading
        return reading

    def close(self) -> None:
        """Stop the background poll thread and release the serial port."""
        try:
            stop = getattr(self._conn, "stop", None)
            if callable(stop):
                stop()
            close = getattr(self._conn, "close", None)
            if callable(close):
                close()
        except Exception as exc:  # noqa: BLE001 - best-effort cleanup
            logger.warning("error closing OBD connection: %r", exc)
