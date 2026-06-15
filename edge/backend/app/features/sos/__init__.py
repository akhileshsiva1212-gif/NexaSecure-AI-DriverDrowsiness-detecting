"""SOS / Emergency response.

When a crash-class signal fires (high fused crash risk, or a forward-collision warning), SOS
*arms* a short, cancelable countdown. If the driver does not cancel in time, it *dispatches*
an emergency advisory and records the incident. The countdown is the safety valve against
false alarms; dispatch is advisory-only here (it records and surfaces the emergency) and is
where a real deployment would relay to emergency services.
"""
