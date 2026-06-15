"""Accident Prediction — sensor fusion across every other feature.

No single signal predicts a crash; risk is highest when several line up — a drowsy driver
*and* a closing lead vehicle *and* a lane drift. This module reads the latest state of every
feature monitor, scores each contribution, and combines them into one 0-100 risk score that
drives a fused advisory (and, downstream, the SOS feature).
"""
