"""Tests for utils.dataset_cache.

dataset_cache is a process-wide LRU (size CONFIG.PYTHON_CACHE_SIZE) keyed by
md5-derived strings; every reader/engine call goes through it, so its
contains/get/remove semantics and key stability must hold exactly.
"""

import pytest

import utils.dataset_cache as DsCache
from config import CONFIG


@pytest.fixture(autouse=True)
def clean_cache():
    """Each test starts and ends with an empty cache (it is module-global)."""
    DsCache.clear()
    yield
    DsCache.clear()


def test_add_get_contains_roundtrip():
    """A stored value is reported present and returned unchanged."""
    DsCache.add("key1", {"payload": 1})
    assert DsCache.contains("key1") is True
    assert DsCache.get("key1") == {"payload": 1}


def test_get_returns_none_for_missing_key():
    """Reading an absent key yields None instead of raising."""
    assert DsCache.get("missing") is None


def test_remove_deletes_entry_and_reports_result():
    """remove returns True when it deleted something and False otherwise."""
    DsCache.add("key1", "value")
    assert DsCache.remove("key1") is True
    assert DsCache.contains("key1") is False
    assert DsCache.remove("key1") is False


def test_remove_with_prefix_only_removes_matching_keys():
    """Prefix removal drops FILTERED_* style keys and keeps the rest."""
    DsCache.add("FILTERED_a", 1)
    DsCache.add("FILTERED_b", 2)
    DsCache.add("LC_c", 3)
    DsCache.remove_with_prefix("FILTERED")
    assert DsCache.contains("FILTERED_a") is False
    assert DsCache.contains("FILTERED_b") is False
    assert DsCache.contains("LC_c") is True


def test_count_and_clear():
    """count follows insertions and clear empties the cache."""
    DsCache.add("k1", 1)
    DsCache.add("k2", 2)
    assert DsCache.count() == 2
    DsCache.clear()
    assert DsCache.count() == 0


def test_lru_evicts_oldest_entry_beyond_capacity():
    """Inserting one entry over capacity evicts the least recently used key."""
    capacity = CONFIG.PYTHON_CACHE_SIZE
    for i in range(capacity + 1):
        DsCache.add(f"key{i}", i)
    assert DsCache.count() == capacity
    assert DsCache.contains("key0") is False  # oldest entry was evicted
    assert DsCache.contains(f"key{capacity}") is True


def test_get_key_strict_is_deterministic_and_alphanumeric():
    """Strict keys are stable for equal input, distinct for different input."""
    key_a = DsCache.get_key("destination|0", strict=True)
    key_b = DsCache.get_key("destination|0", strict=True)
    key_c = DsCache.get_key("destination|1", strict=True)
    assert key_a == key_b
    assert key_a != key_c
    assert key_a.isalnum()


def test_get_key_non_strict_is_salted():
    """Non-strict keys embed a random salt: same input gives varying keys."""
    keys = {DsCache.get_key("destination") for _ in range(20)}
    assert len(keys) > 1
    assert all(key.isalnum() for key in keys)


def test_get_key_returns_empty_string_on_bad_input():
    """A non-string input (None) fails the salting concat and yields ''."""
    assert DsCache.get_key(None) == ""


def test_unhashable_key_is_swallowed_by_error_handling():
    """Unhashable keys cannot be cached: add logs, contains reports False."""
    DsCache.add(["unhashable"], "value")
    assert DsCache.contains(["unhashable"]) is False
    assert DsCache.count() == 0
