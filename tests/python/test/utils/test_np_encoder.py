"""Tests for utils.np_encoder.NPEncoder.

NPEncoder is the JSON fallback encoder Flask uses for every response: it must
turn numpy scalars/arrays into plain Python values and clamp anything beyond
CONFIG.BIG_NUMBER so the GUI never receives values that overflow JavaScript.
"""

import json

import numpy as np

from config import CONFIG
from utils.np_encoder import NPEncoder


def test_default_clamps_python_ints_to_big_number():
    """Python ints beyond +/-BIG_NUMBER are clamped, normal ints pass through."""
    encoder = NPEncoder()
    assert encoder.default(CONFIG.BIG_NUMBER + 1) == CONFIG.BIG_NUMBER
    assert encoder.default(-CONFIG.BIG_NUMBER - 1) == -CONFIG.BIG_NUMBER
    assert encoder.default(42) == 42


def test_default_clamps_python_floats_to_big_number():
    """Python floats beyond +/-BIG_NUMBER are clamped, normal floats pass through."""
    encoder = NPEncoder()
    assert encoder.default(float(CONFIG.BIG_NUMBER) * 2) == CONFIG.BIG_NUMBER
    assert encoder.default(float(-CONFIG.BIG_NUMBER) * 2) == -CONFIG.BIG_NUMBER
    assert encoder.default(3.5) == 3.5


def test_default_converts_and_clamps_numpy_integers():
    """Numpy integer scalars become Python ints, clamped at +/-BIG_NUMBER."""
    encoder = NPEncoder()
    result = encoder.default(np.int32(7))
    assert result == 7
    assert isinstance(result, int) and not isinstance(result, np.integer)
    assert encoder.default(np.int64(CONFIG.BIG_NUMBER + 1)) == CONFIG.BIG_NUMBER
    assert encoder.default(np.int64(-CONFIG.BIG_NUMBER - 1)) == -CONFIG.BIG_NUMBER


def test_default_converts_and_clamps_numpy_floats():
    """Numpy float scalars become Python floats, clamped at +/-BIG_NUMBER."""
    encoder = NPEncoder()
    result = encoder.default(np.float64(2.25))
    assert result == 2.25
    assert isinstance(result, float) and not isinstance(result, np.floating)
    assert encoder.default(np.float64(CONFIG.BIG_NUMBER) * 2) == CONFIG.BIG_NUMBER
    assert encoder.default(np.float64(-CONFIG.BIG_NUMBER) * 2) == -CONFIG.BIG_NUMBER


def test_default_keeps_only_real_part_of_complex_values():
    """Complex values are reduced to their real part (imaginary part dropped)."""
    encoder = NPEncoder()
    assert encoder.default(complex(3.0, 4.0)) == 3.0


def test_default_converts_ndarray_to_list():
    """Numpy arrays are serialized as plain Python lists."""
    encoder = NPEncoder()
    assert encoder.default(np.array([1, 2, 3])) == [1, 2, 3]


def test_default_converts_generic_numpy_scalar_via_item():
    """Numpy scalar types outside the int/float unions use the .item() fallback."""
    encoder = NPEncoder()
    result = encoder.default(np.bool_(True))
    assert result is True


def test_default_returns_none_for_unencodable_object():
    """Objects the base JSONEncoder rejects are swallowed and encoded as None."""
    encoder = NPEncoder()
    assert encoder.default(object()) is None


def test_json_dumps_minifies_and_encodes_numpy_payload():
    """End to end: numpy payload is minified JSON without spaces after separators."""
    payload = {"a": np.array([1.5, 2.5]), "n": np.int64(3)}
    encoded = json.dumps(payload, cls=NPEncoder)
    assert encoded == '{"a":[1.5,2.5],"n":3}'
