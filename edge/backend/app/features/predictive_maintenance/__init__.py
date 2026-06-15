"""Predictive Maintenance — forecasts component issues by trending vehicle telemetry.

Where Vehicle Health answers "is anything wrong *now*?", this feature answers "is anything
*trending* toward wrong?" by fitting the recent time-series of each metric and projecting it
forward to see whether it will cross a danger threshold within a look-ahead horizon.
"""
