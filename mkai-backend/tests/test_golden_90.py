#!/usr/bin/env python3
"""Backwards-compatible runner for test_pipeline_90.py (renamed per Round 2 Gap D)."""
import unittest
from test_pipeline_90 import TestMKAIPipeline90 as TestMKAIMasterUpgrade

if __name__ == "__main__":
    unittest.main(verbosity=2)
