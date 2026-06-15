"""My Mood feature.

Stores the driver's chosen wake-up audio preference (which sound plays when the
drowsiness detector crosses the alert threshold). The audio itself is generated/played
in the browser — the backend only persists the *selection* so it survives reloads and
is consistent across devices.
"""
