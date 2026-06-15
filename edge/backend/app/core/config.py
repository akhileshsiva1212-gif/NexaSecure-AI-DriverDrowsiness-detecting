"""Application configuration.

All settings are read from environment variables (or a local .env file) so the same
code runs unchanged across development, staging, and production. See `.env.example`
at the repo root for the full list and safe defaults.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Strongly-typed application settings, populated from the environment."""

    model_config = SettingsConfigDict(
        env_prefix="NEXA_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ---- App ----
    env: str = "development"
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    log_level: str = "INFO"

    # ---- Security ----
    jwt_secret: str = "dev-only-change-me"
    jwt_expire_minutes: int = 60

    # ---- Database ----
    database_url: str = "sqlite:///./nexasecure.sqlite3"

    # ---- Sensors ----
    # OBD connection mode on startup. "none" = stay disconnected (honest default: show
    # real engine data only when an adapter is connected); "serial" = real read-only
    # ELM327/serial adapter (needs `pip install -r requirements-obd.txt`).
    obd_source: str = "none"  # "none" | "serial"
    obd_poll_seconds: float = 2.0
    # Real serial adapter settings (only used when obd_source/connect mode is "serial").
    # "auto" lets python-OBD scan for the port; otherwise e.g. COM3, /dev/ttyUSB0, or the
    # ELM327-emulator's pseudo-tty. baudrate "None" = auto-detect (ELM327 ~38400 or 9600).
    obd_serial_port: str = "auto"
    obd_baudrate: int | None = None
    obd_connect_timeout: float = 30.0

    # ---- Driver-facing camera (drowsiness/distraction) ----
    # Real detection runs in the browser (MediaPipe FaceLandmarker) and is pushed to
    # POST /driver/ingest. "none" = no backend source (idle until live frames arrive);
    # "webcam" = optional server-side OpenCV camera for headless/dev use.
    driver_cam_source: str = "none"  # "none" | "webcam"
    driver_fps: float = 5.0          # frames analyzed per second
    driver_cam_index: int = 0        # OpenCV camera index for the webcam source

    # ---- Road-facing camera (traffic signs) ----
    # Real detection runs in the browser and is pushed to POST /road/signs/ingest, so there
    # is no Python road-camera source. "none" = idle until live frames arrive.
    sign_source: str = "none"        # "none"
    sign_fps: float = 4.0            # sign frames analyzed per second

    # ---- Predictive maintenance ----
    maintenance_interval_seconds: float = 5.0  # how often to re-trend telemetry
    maintenance_window: int = 60               # readings used per trend fit

    # ---- Road perception (hazard / lane / forward collision) ----
    # Real detection runs in the browser (MediaPipe ObjectDetector + OpenCV.js lane CV) and is
    # pushed to the respective /road/* ingest endpoints. "none" = idle until live frames arrive.
    road_source: str = "none"        # "none"
    road_fps: float = 5.0            # road frames analyzed per second

    # ---- Fusion (accident prediction) ----
    fusion_interval_seconds: float = 1.0       # how often to recompute the risk score
    fusion_risk_warn: int = 50                 # risk score that raises a warning
    fusion_risk_critical: int = 75             # risk score that raises a critical advisory

    # ---- SOS / emergency ----
    sos_countdown_seconds: int = 15            # grace period to cancel before "dispatch"

    # ---- Privacy (safe defaults: everything off) ----
    cloud_sync: bool = False
    store_incident_clips: bool = False
    anonymized_analytics: bool = False

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton of the settings."""
    return Settings()
