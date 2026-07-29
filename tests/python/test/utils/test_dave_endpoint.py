"""Tests for utils.dave_endpoint through the real Flask routes.

dave_endpoint is the HTTP boundary: it resolves filenames to destinations
(session / cache / uploads dir), rejects unresolvable ones with a 400
common_error, and otherwise dispatches to dave_engine and JSON-encodes the
result. Every route is driven with a valid payload and with an unresolvable
source file so both sides of the validation are pinned down.

Files are copied into a per-test uploads directory and referenced by bare
filename, which is the only form that works on all three CI platforms
(the absolute-path branch of file_utils is POSIX-only).
"""

import os
import shutil
from io import BytesIO

import pytest

import utils.dataset_cache as DsCache
from test.fixture import DATA_RESOURCES, TEST_RESOURCES
from test.server_support import import_server

server = import_server()

EVENTS_AXIS = [
    {"table": "EVENTS", "column": "TIME"},
    {"table": "EVENTS", "column": "PHA"},
]
RATE_AXIS = [
    {"table": "RATE", "column": "TIME"},
    {"table": "RATE", "column": "RATE"},
]
NO_BASELINE = {"niter": 0, "lam": 1000, "p": 0.01}


@pytest.fixture
def uploads(monkeypatch, tmp_path):
    """An uploads directory seeded with the sample files, isolated per test."""
    target = tmp_path / "uploadeddataset"
    target.mkdir()
    for name in ("test.evt", "test_Gtis.evt", "Test_Input_2.lc", "Test_Input_1.txt"):
        shutil.copy(os.path.join(TEST_RESOURCES, name), target)
    for name in ("monol_testA.evt",):
        shutil.copy(os.path.join(DATA_RESOURCES, name), target)
    monkeypatch.setattr(server, "UPLOADS_TARGET", str(target))
    DsCache.clear()
    yield target
    DsCache.clear()


@pytest.fixture
def client(uploads):
    return server.app.test_client()


@pytest.fixture
def client_with_energies(client, uploads, rmf_file):
    """Client whose cached monol_testA.evt dataset carries an E column.

    The energy-resolved analyses (covariance, rms, phase lag, rms vs count
    rate) require the E column that apply_rmf_file_to_dataset derives from
    the PI column using the synthetic RMF calibration.
    """
    shutil.copy(rmf_file, uploads / "synthetic.rmf")
    response = client.get(
        "/apply_rmf_file_to_dataset",
        query_string={
            "filename": "monol_testA.evt",
            "rmf_filename": "synthetic.rmf",
            "column": "PI",
        },
    )
    assert response.status_code == 200
    assert len(response.get_json()) == 1024  # one mean energy per RMF channel
    return client


# ---------- upload ----------


def test_upload_accepts_supported_files_and_registers_them(client):
    """Uploaded files are saved and their names returned to the GUI."""
    response = client.post(
        "/upload",
        data={"file": (BytesIO(b"1.0 0.5 2.0 0.5\n"), "fresh_upload.txt")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert response.get_json() == ["fresh_upload.txt"]


def test_upload_without_files_is_rejected(client):
    """A request carrying no files at all is a 400."""
    response = client.post("/upload", data={}, content_type="multipart/form-data")
    assert response.status_code == 400
    assert response.get_json()["error"] == "No sent files"


def test_upload_rejects_disallowed_file_type(client):
    """A file whose extension is not allowed fails validation with a 400."""
    response = client.post(
        "/upload",
        data={"file": (BytesIO(b"binary"), "malware.exe")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "All uploads failed" in response.get_json()["error"]


def test_upload_reports_partial_success_with_warnings(client):
    """When some files fail, the good ones are returned alongside warnings."""
    response = client.post(
        "/upload",
        data={
            "file": [
                (BytesIO(b"1.0 0.5 2.0 0.5\n"), "good.txt"),
                (BytesIO(b"nope"), "bad.exe"),
            ]
        },
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    payload = response.get_json()
    assert payload["filenames"] == ["good.txt"]
    assert len(payload["warnings"]) == 1


def test_upload_of_already_present_file_reuses_it(client):
    """Re-uploading a filename already in the uploads dir is accepted as-is."""
    response = client.post(
        "/upload",
        data={"file": (BytesIO(b"ignored"), "test.evt")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 200
    assert response.get_json() == ["test.evt"]


# ---------- schema / header ----------


def test_get_dataset_schema_describes_tables_and_columns(client):
    """The schema exposes each table's columns with counts and value ranges.

    monol_testA.evt holds 1000 events; the reader's GTI slicing is
    end-exclusive, so the event sitting on the GTI boundary is dropped and
    999 remain.
    """
    response = client.get("/get_dataset_schema", query_string={"filename": "monol_testA.evt"})
    assert response.status_code == 200
    schema = response.get_json()
    assert set(schema) == {"EVENTS", "GTI"}
    assert schema["EVENTS"]["TIME"]["count"] == 999
    assert schema["EVENTS"]["PI"]["min_value"] == 1
    assert schema["EVENTS"]["PI"]["max_value"] == 1022


def test_get_dataset_header_exposes_fits_keywords(client):
    """The header endpoint returns the FITS keywords of each table."""
    response = client.get(
        "/get_dataset_header", query_string={"filename": "monol_testA.evt"}
    )
    assert response.status_code == 200
    header = response.get_json()
    assert header["EVENTS"]["TELESCOP"] == "NuSTAR"
    assert header["EVENTS"]["TSTART"] == "80000000.0"


@pytest.mark.parametrize("route", ["/get_dataset_schema", "/get_dataset_header"])
def test_schema_and_header_reject_unknown_file(client, route):
    """An unresolvable filename yields a 400 naming the file."""
    response = client.get(route, query_string={"filename": "missing.evt"})
    assert response.status_code == 400
    assert "missing.evt" in response.get_json()["error"]


def test_get_destination_rejects_empty_filename(client):
    """An empty filename cannot be resolved to any destination."""
    response = client.get("/get_dataset_schema", query_string={"filename": ""})
    assert response.status_code == 400


# ---------- append / rmf ----------


def test_append_file_to_dataset_returns_joined_cache_key(client):
    """Appending a second events file yields a cache key for the joined set,
    whose schema holds the events of both files combined."""
    count_a = client.get(
        "/get_dataset_schema", query_string={"filename": "test.evt"}
    ).get_json()["EVENTS"]["TIME"]["count"]
    count_b = client.get(
        "/get_dataset_schema", query_string={"filename": "test_Gtis.evt"}
    ).get_json()["EVENTS"]["TIME"]["count"]

    response = client.post(
        "/append_file_to_dataset",
        json={"filename": "test.evt", "nextfile": "test_Gtis.evt"},
    )
    assert response.status_code == 200
    cache_key = response.get_json()
    assert cache_key
    assert DsCache.contains(cache_key)

    schema = client.get(
        "/get_dataset_schema", query_string={"filename": cache_key}
    ).get_json()
    assert schema["EVENTS"]["TIME"]["count"] == count_a + count_b


def test_append_file_to_dataset_requires_a_nextfile(client):
    """An empty nextfile is refused."""
    response = client.post(
        "/append_file_to_dataset", json={"filename": "test.evt", "nextfile": ""}
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "No nextfile setted"


def test_append_file_to_dataset_rejects_unknown_nextfile(client):
    """A nextfile that was never uploaded is refused."""
    response = client.post(
        "/append_file_to_dataset", json={"filename": "test.evt", "nextfile": "ghost.evt"}
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "Nextfile not uploaded"


def test_append_file_to_dataset_rejects_unknown_source(client):
    """An unresolvable source file is refused before anything is read."""
    response = client.post(
        "/append_file_to_dataset", json={"filename": "ghost.evt", "nextfile": "test.evt"}
    )
    assert response.status_code == 400


def test_apply_rmf_adds_energy_column_to_dataset(client_with_energies):
    """After the RMF is applied the events dataset gains an E column."""
    schema = client_with_energies.get(
        "/get_dataset_schema", query_string={"filename": "monol_testA.evt"}
    ).get_json()
    assert "E" in schema["EVENTS"]
    # E = 1.6 + 0.04 * PI + 0.02 (bin centre) for PI in 1..1022
    assert schema["EVENTS"]["E"]["min_value"] == pytest.approx(1.66, abs=0.01)
    assert schema["EVENTS"]["E"]["max_value"] == pytest.approx(42.5, abs=0.1)


def test_apply_rmf_requires_rmf_filename(client):
    """A missing rmf_filename is refused."""
    response = client.get(
        "/apply_rmf_file_to_dataset",
        query_string={"filename": "test.evt", "rmf_filename": "", "column": "PHA"},
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "No rmf_filename setted"


def test_apply_rmf_rejects_invalid_rmf_file(client):
    """An RMF filename that does not resolve to a real file is refused."""
    response = client.get(
        "/apply_rmf_file_to_dataset",
        query_string={"filename": "test.evt", "rmf_filename": "ghost.rmf", "column": "PHA"},
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "Invalid RMF file"


def test_apply_rmf_rejects_unknown_source(client):
    """An unresolvable source dataset is refused."""
    response = client.get(
        "/apply_rmf_file_to_dataset",
        query_string={"filename": "ghost.evt", "rmf_filename": "x.rmf", "column": "PHA"},
    )
    assert response.status_code == 400


# ---------- plot data ----------


def test_get_plot_data_returns_axis_columns_with_gtis(client):
    """A 2D plot request returns the two axis columns plus GTI start/stop."""
    response = client.post(
        "/get_plot_data",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "styles": {"type": "2d"},
            "axis": [
                {"table": "EVENTS", "column": "TIME"},
                {"table": "EVENTS", "column": "PI"},
            ],
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 4
    assert len(data[0]["values"]) == 999


def test_get_plot_data_from_models_evaluates_each_model_and_the_sum(client):
    """Model curves are evaluated pointwise and followed by their sum."""
    response = client.post(
        "/get_plot_data_from_models",
        json={
            "models": [
                {"type": "Const", "amplitude": 2.0},
                {"type": "Const", "amplitude": 3.0},
            ],
            "x_values": [0.1, 0.2, 0.3],
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 3
    assert data[0]["values"] == [2.0, 2.0, 2.0]
    assert data[1]["values"] == [3.0, 3.0, 3.0]
    assert data[2]["values"] == [5.0, 5.0, 5.0]


# ---------- lightcurves ----------


def test_get_lightcurve_conserves_event_counts(client):
    """The binned light curve holds the events of the file: sum(rate)*dt
    equals the number of events inside the GTI (999 of the 1000 events;
    the one on the GTI boundary is dropped by the end-exclusive slicing)."""
    response = client.post(
        "/get_lightcurve",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "baseline_opts": NO_BASELINE,
            "meanflux_opts": NO_BASELINE,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 23  # fixed result layout: time..warnmsg
    assert len(data[0]["values"]) == 64  # 1024 s of data in 16 s bins
    assert sum(data[1]["values"]) * 16.0 == pytest.approx(999.0, abs=0.5)
    assert data[3]["values"] == [0.0]  # GTI start (TSTART-relative)
    assert data[4]["values"] == [1025.0]  # GTI stop


def test_get_lightcurve_with_variance_options_returns_variability_columns(client):
    """Long-term variability options fill the chunk/excess-variance columns."""
    response = client.post(
        "/get_lightcurve",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "baseline_opts": {"niter": 10, "lam": 1000, "p": 0.01},
            "meanflux_opts": {"niter": 10, "lam": 1000, "p": 0.01},
            "variance_opts": {"min_counts": 10, "min_bins": 2, "mean_count": 2},
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data[5]["values"]) == len(data[0]["values"])  # baseline per bin
    assert len(data[7]["values"]) > 0  # chunk times
    assert len(data[11]["values"]) == len(data[7]["values"])  # excess variance
    assert len(data[21]["values"]) == 12  # four confidence intervals of 3 values


def test_get_lightcurve_rejects_wrong_axis_count(client):
    """The engine refuses a request that does not carry exactly two axes."""
    response = client.post(
        "/get_lightcurve",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS[:1],
            "dt": 16.0,
            "baseline_opts": NO_BASELINE,
            "meanflux_opts": NO_BASELINE,
        },
    )
    assert response.get_json()["error"] == "Wrong number of axis"


def test_get_lightcurve_with_background_of_itself_cancels_out(client):
    """Subtracting a file from itself leaves a zero count rate everywhere."""
    response = client.post(
        "/get_lightcurve",
        json={
            "filename": "test.evt",
            "bck_filename": "test.evt",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "baseline_opts": NO_BASELINE,
            "meanflux_opts": NO_BASELINE,
        },
    )
    data = response.get_json()
    assert all(value == 0 for value in data[1]["values"])


def test_get_joined_lightcurves_returns_two_matching_series(client):
    """Joining a light curve with itself yields two identical series."""
    response = client.post(
        "/get_joined_lightcurves",
        json={
            "lc0_filename": "test.evt",
            "lc1_filename": "test.evt",
            "lc0_bck_filename": "",
            "lc1_bck_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 2
    assert data[0]["values"] == data[1]["values"]


def test_get_divided_lightcurve_ds_creates_ratio_dataset(client):
    """Dividing a light curve by itself caches a dataset whose RATE is all 1."""
    response = client.post(
        "/get_divided_lightcurve_ds",
        json={
            "lc0_filename": "Test_Input_2.lc",
            "lc1_filename": "Test_Input_2.lc",
            "lc0_bck_filename": "",
            "lc1_bck_filename": "",
        },
    )
    assert response.status_code == 200
    cache_key = response.get_json()
    assert DsCache.contains(cache_key)
    schema = client.get(
        "/get_dataset_schema", query_string={"filename": cache_key}
    ).get_json()
    assert schema["RATE"]["RATE"]["min_value"] == 1.0
    assert schema["RATE"]["RATE"]["max_value"] == 1.0


def test_get_divided_lightcurves_from_colors_returns_ratio_series(client):
    """Two color filters produce the source series plus the color ratio."""
    color_filters = [
        {
            "table": "EVENTS",
            "column": "Color1",
            "from": 3000,
            "to": 4000,
            "source": "ColorSelector",
            "replaceColumn": "PHA",
        },
        {
            "table": "EVENTS",
            "column": "Color2",
            "from": 3000,
            "to": 4000,
            "source": "ColorSelector",
            "replaceColumn": "PHA",
        },
    ]
    response = client.post(
        "/get_divided_lightcurves_from_colors",
        json={
            "filename": "Test_Input_1.txt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": color_filters,
            "axis": EVENTS_AXIS,
            "dt": 1.0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data) == 5  # src rate, color ratio, time, gti start, gti stop
    # Both color selections resolve to the same PHA range, so the color
    # ratio light curve is exactly 1 wherever it is defined.
    assert all(value == 1.0 for value in data[1]["values"])


def test_get_divided_lightcurves_from_colors_needs_two_or_four_colors(client):
    """A single color filter is not a valid color-ratio request."""
    response = client.post(
        "/get_divided_lightcurves_from_colors",
        json={
            "filename": "Test_Input_1.txt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [
                {
                    "table": "EVENTS",
                    "column": "Color1",
                    "from": 0,
                    "to": 9999,
                    "source": "ColorSelector",
                    "replaceColumn": "PHA",
                }
            ],
            "axis": EVENTS_AXIS,
            "dt": 1.0,
        },
    )
    assert response.get_json()["error"] == "Wrong number of color filters"


# ---------- spectra ----------


def test_get_power_density_spectrum_returns_frequencies_within_nyquist(client):
    """A single PDS spans (0, Nyquist] with the expected frequency spacing."""
    response = client.post(
        "/get_power_density_spectrum",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    frequencies = data[0]["values"]
    assert frequencies[0] == pytest.approx(1.0 / 1024.0, rel=1e-3)
    assert max(frequencies) <= 1.0 / (2 * 16.0) + 1e-9
    assert len(data[1]["values"]) == len(frequencies)
    assert data[2]["values"] == [1024.0]  # observation length


def test_get_power_density_spectrum_rejects_unknown_normalization(client):
    """An unsupported normalization produces an empty result with a warning."""
    response = client.post(
        "/get_power_density_spectrum",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "bogus",
            "type": "Sng",
            "df": 0,
        },
    )
    data = response.get_json()
    assert data[0]["values"] == []


def test_get_dynamical_spectrum_returns_time_resolved_powers(client):
    """Splitting the single GTI by segment length yields one spectrum per
    segment, restricted to the requested frequency range."""
    response = client.post(
        "/get_dynamical_spectrum",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 8,
            "segment_size": 128.0,
            "norm": "leahy",
            "freq_range": [0.0, 0.03],
            "df": 0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    frequencies = data[0]["values"]
    assert frequencies and max(frequencies) <= 0.03
    assert len(data[2]["values"]) == 8  # 1024 s split into 128 s segments


def test_get_cross_spectrum_of_a_file_with_itself_is_fully_coherent(client):
    """Cross-spectrum of identical signals: coherence 1 and zero time lag."""
    payload = {
        "filename1": "monol_testA.evt",
        "bck_filename1": "",
        "gti_filename1": "",
        "filters1": [],
        "axis1": EVENTS_AXIS,
        "dt1": 16.0,
        "filename2": "monol_testA.evt",
        "bck_filename2": "",
        "gti_filename2": "",
        "filters2": [],
        "axis2": EVENTS_AXIS,
        "dt2": 16.0,
        "nsegm": 1,
        "segment_size": 0,
        "norm": "leahy",
        "type": "Sng",
    }
    response = client.post("/get_cross_spectrum", json=payload)
    assert response.status_code == 200
    data = response.get_json()
    assert len(data[0]["values"]) > 0
    time_lags = data[2]["values"][0]
    assert all(abs(lag) < 1e-9 for lag in time_lags)
    coherence = data[3]["values"][0]
    assert all(value == pytest.approx(1.0, abs=1e-6) for value in coherence)
    assert data[4]["values"] == [1024.0, 1024.0]


def test_get_cross_spectrum_rejects_unknown_type(client):
    """An unsupported cross-spectrum type is refused."""
    payload = {
        "filename1": "test.evt",
        "bck_filename1": "",
        "gti_filename1": "",
        "filters1": [],
        "axis1": EVENTS_AXIS,
        "dt1": 16.0,
        "filename2": "test.evt",
        "bck_filename2": "",
        "gti_filename2": "",
        "filters2": [],
        "axis2": EVENTS_AXIS,
        "dt2": 16.0,
        "nsegm": 1,
        "segment_size": 0,
        "norm": "leahy",
        "type": "Bogus",
    }
    response = client.post("/get_cross_spectrum", json=payload)
    assert response.get_json()["error"] == "Wrong cross spectrum type"


def test_get_covariance_spectrum_returns_band_centres(client_with_energies):
    """The covariance spectrum reports one point per energy band, centred in
    the band, with a covariance and error for each."""
    response = client_with_energies.post(
        "/get_covariance_spectrum",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "dt": 16.0,
            "ref_band_interest": [2.0, 40.0],
            "energy_range": [2.0, 10.0],
            "n_bands": 4,
            "std": -1,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data[0]["values"] == [3.0, 5.0, 7.0, 9.0]
    assert len(data[1]["values"]) == 4
    assert len(data[1]["error_values"]) == 4


def test_get_covariance_spectrum_requires_energy_column(client):
    """Without an E column the covariance spectrum cannot be computed."""
    response = client.post(
        "/get_covariance_spectrum",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "dt": 16.0,
            "ref_band_interest": [2.0, 40.0],
            "energy_range": [2.0, 10.0],
            "n_bands": 2,
            "std": -1,
        },
    )
    assert response.get_json()["error"] == "E column not found"


def test_get_rms_spectrum_returns_one_rms_per_energy_band(client_with_energies):
    """The RMS spectrum reports a non-negative rms per energy band and the
    frequency window that was integrated."""
    response = client_with_energies.post(
        "/get_rms_spectrum",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "frac",
            "type": "Sng",
            "df": 0,
            "freq_range": [-1, -1],
            "energy_range": [3.0, 20.0],
            "n_bands": 3,
            "white_noise": 0.0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data[0]["values"]) == 3
    assert len(data[1]["values"]) == 3
    assert all(value >= 0 for value in data[1]["values"])
    freq_min, freq_max = data[4]["values"]
    assert 0 < freq_min < freq_max


def test_get_rms_spectrum_rejects_unsupported_normalization(client_with_energies):
    """RMS spectra only support frac and leahy normalizations."""
    response = client_with_energies.post(
        "/get_rms_spectrum",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "abs",
            "type": "Sng",
            "df": 0,
            "freq_range": [-1, -1],
            "energy_range": [3.0, 20.0],
            "n_bands": 2,
            "white_noise": 0.0,
        },
    )
    assert response.get_json()["error"] == "Wrong normalization"


def test_get_rms_vs_countrate_returns_sorted_countrates(client_with_energies):
    """RMS versus count rate returns points sorted by increasing count rate."""
    response = client_with_energies.post(
        "/get_rms_vs_countrate",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "n_bands": 3,
            "df": 0,
            "freq_range": [-1, -1],
            "energy_range": [3.0, 20.0],
            "white_noise": 0.0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    countrates = data[0]["values"]
    assert countrates == sorted(countrates)
    assert len(data[1]["values"]) == len(countrates)


def test_get_phase_lag_spectrum_returns_energy_resolved_lags(client_with_energies):
    """The phase-lag spectrum returns one lag per energy band plus the
    frequency window it was measured over."""
    response = client_with_energies.post(
        "/get_phase_lag_spectrum",
        json={
            "filename": "monol_testA.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 256.0,
            "norm": "leahy",
            "type": "Avg",
            "df": 0,
            "freq_range": [0.005, 0.03],
            "energy_range": [3.0, 20.0],
            "n_bands": 2,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert data[4]["values"] == [0.005, 0.03]


def test_get_phase_lag_spectrum_requires_energy_column(client):
    """Without an E column the phase lag spectrum reports the missing column."""
    response = client.post(
        "/get_phase_lag_spectrum",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 256.0,
            "norm": "leahy",
            "type": "Avg",
            "df": 0,
            "freq_range": [-1, -1],
            "energy_range": [-1, -1],
            "n_bands": 2,
        },
    )
    assert response.get_json()[3]["values"] == ["E column not found"]


# ---------- fitting / periodograms ----------


def test_get_fit_powerspectrum_result_fits_white_noise_level(client):
    """Fitting a constant to a Leahy PDS of Poisson events recovers the
    white-noise level of 2 that Leahy normalization is defined to produce."""
    response = client.post(
        "/get_fit_powerspectrum_result",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "models": [{"type": "Const", "amplitude": 2.0}],
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    params = data[0]["values"]
    assert params[0]["name"] == "amplitude"
    assert params[0]["opt"] == pytest.approx(2.0, abs=1.0)
    stats = data[1]["values"]
    assert "aic" in stats and "bic" in stats


def test_get_lomb_scargle_results_covers_requested_frequencies(client):
    """The Lomb-Scargle periodogram spans the requested frequency window."""
    response = client.post(
        "/get_lomb_scargle_results",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "freq_range": [0.001, 0.03],
            "nyquist_factor": 1,
            "ls_norm": "standard",
            "samples_per_peak": 5,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    frequencies = data[0]["values"]
    assert min(frequencies) >= 0.001
    assert max(frequencies) <= 0.03
    assert len(data[1]["values"]) == len(frequencies)
    assert data[2]["values"] == [1024.0]


def test_get_fit_lomb_scargle_result_returns_parameters(client):
    """Fitting a constant to the Lomb-Scargle powers returns an estimate."""
    response = client.post(
        "/get_fit_lomb_scargle_result",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "freq_range": [0.001, 0.03],
            "nyquist_factor": 1,
            "ls_norm": "standard",
            "samples_per_peak": 5,
            "models": [{"type": "Const", "amplitude": 0.05}],
        },
    )
    assert response.status_code == 200
    params = response.get_json()[0]["values"]
    assert params[0]["name"] == "amplitude"
    assert params[0]["opt"] > 0


def test_get_bootstrap_results_reports_no_parameters_yet(client):
    """Bootstrap error analysis currently cannot fit the simulated spectra
    (the fit step is not implemented in the engine), so it returns no
    parameter distributions rather than failing the request."""
    response = client.post(
        "/get_bootstrap_results",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 256.0,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "models": [{"type": "Const", "amplitude": 2.0}],
            "n_iter": 1,
            "mean": 0.0,
            "red_noise": 1,
            "seed": 42,
        },
    )
    assert response.status_code == 200
    assert response.get_json() == []


# ---------- pulsar tools ----------


def test_get_pulse_search_scans_the_requested_frequency_band(client):
    """The pulse search returns a statistic for every scanned frequency
    inside the requested band."""
    response = client.post(
        "/get_pulse_search",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "freq_range": [0.1, 0.2],
            "mode": "z_n_search",
            "oversampling": 5,
            "nharm": 1,
            "nbin": 16,
            "segment_size": 5000,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    frequencies = data[0]["values"]
    assert min(frequencies) >= 0.1
    assert max(frequencies) <= 0.2
    assert len(data[1]["values"]) == len(frequencies)


def test_get_phaseogram_returns_phase_bins_and_folded_profile(client):
    """The phaseogram returns the requested phase/time grid and a profile
    doubled over two cycles for display."""
    response = client.post(
        "/get_phaseogram",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "f": 0.15,
            "nph": 8,
            "nt": 4,
            "fdot": 0.0,
            "fddot": 0.0,
        },
    )
    assert response.status_code == 200
    data = response.get_json()
    assert len(data[1]["values"]) == 17  # 2*nph phase bin edges over two cycles
    assert len(data[2]["values"]) == 5  # nt time bin edges
    assert len(data[3]["values"]) == 16  # 2*nph mean phases
    assert len(data[4]["values"]) == 16  # folded profile over two cycles
    assert len(data[5]["values"]) == 2  # low/high Poisson confidence bounds


# ---------- intermediate files / bulk ----------


def test_get_intermediate_files_creates_hendrics_files(client, uploads):
    """Valid inputs are converted to HENDRICS .nc intermediate files;
    invalid paths are skipped."""
    response = client.post(
        "/get_intermediate_files",
        json={"filepaths": [os.path.join(str(uploads), "test.evt"), "/nonexistent/file.evt"]},
    )
    assert response.status_code == 200
    filenames = response.get_json()
    assert len(filenames) == 1
    assert filenames[0].endswith(".nc")
    assert os.path.isfile(filenames[0])


def test_bulk_analisys_produces_lightcurve_outputs(client, uploads, tmp_path):
    """A bulk LcPlot run writes HENDRICS outputs and reports them per plot."""
    intermediate = client.post(
        "/get_intermediate_files",
        json={"filepaths": [os.path.join(str(uploads), "test.evt")]},
    ).get_json()

    response = client.post(
        "/bulk_analisys",
        json={
            "filenames": intermediate,
            "plotConfigs": [
                {
                    "id": "plot1",
                    "class": "LcPlot",
                    "dt": 16.0,
                    "filters": [],
                }
            ],
            "outdir": "bulkout",
        },
    )
    assert response.status_code == 200
    results = response.get_json()
    assert results["outdir"].endswith("bulkout")
    assert len(results["plot_configs"]) == 1
    assert results["plot_configs"][0]["plotId"] == "plot1"
    assert len(results["plot_configs"][0]["filenames"]) > 0


# ---------- shared validation of source/background/gti filenames ----------


ANALYSIS_REQUESTS = {
    "/get_plot_data": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "styles": {"type": "2d"},
        "axis": EVENTS_AXIS,
    },
    "/get_lightcurve": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "baseline_opts": NO_BASELINE,
        "meanflux_opts": NO_BASELINE,
    },
    "/get_divided_lightcurves_from_colors": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
    },
    "/get_power_density_spectrum": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 0,
        "norm": "leahy",
        "type": "Sng",
        "df": 0,
    },
    "/get_dynamical_spectrum": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 128.0,
        "norm": "leahy",
        "freq_range": [0, 1],
        "df": 0,
    },
    "/get_covariance_spectrum": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "dt": 16.0,
        "ref_band_interest": [2, 40],
        "energy_range": [2, 10],
        "n_bands": 2,
        "std": -1,
    },
    "/get_phase_lag_spectrum": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 128.0,
        "norm": "leahy",
        "type": "Avg",
        "df": 0,
        "freq_range": [-1, -1],
        "energy_range": [-1, -1],
        "n_bands": 2,
    },
    "/get_rms_spectrum": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 128.0,
        "norm": "frac",
        "type": "Avg",
        "df": 0,
        "freq_range": [-1, -1],
        "energy_range": [-1, -1],
        "n_bands": 2,
        "white_noise": 0.0,
    },
    "/get_rms_vs_countrate": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "n_bands": 2,
        "df": 0,
        "freq_range": [-1, -1],
        "energy_range": [-1, -1],
        "white_noise": 0.0,
    },
    "/get_fit_powerspectrum_result": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 0,
        "norm": "leahy",
        "type": "Sng",
        "df": 0,
        "models": [{"type": "Const", "amplitude": 2.0}],
    },
    "/get_bootstrap_results": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "nsegm": 1,
        "segment_size": 128.0,
        "norm": "leahy",
        "type": "Sng",
        "df": 0,
        "models": [{"type": "Const", "amplitude": 2.0}],
        "n_iter": 1,
        "mean": 0.0,
        "red_noise": 1,
        "seed": 1,
    },
    "/get_lomb_scargle_results": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "freq_range": [0.001, 0.03],
        "nyquist_factor": 1,
        "ls_norm": "standard",
        "samples_per_peak": 5,
    },
    "/get_fit_lomb_scargle_result": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "freq_range": [0.001, 0.03],
        "nyquist_factor": 1,
        "ls_norm": "standard",
        "samples_per_peak": 5,
        "models": [{"type": "Const", "amplitude": 1.0}],
    },
    "/get_pulse_search": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "freq_range": [0.1, 0.2],
        "mode": "z_n_search",
        "oversampling": 5,
        "nharm": 1,
        "nbin": 16,
        "segment_size": 5000,
    },
    "/get_phaseogram": {
        "filename": "SRC",
        "bck_filename": "BCK",
        "gti_filename": "GTI",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
        "f": 0.15,
        "nph": 8,
        "nt": 4,
        "fdot": 0.0,
        "fddot": 0.0,
    },
}


def _payload(route, source, background, gti):
    payload = dict(ANALYSIS_REQUESTS[route])
    for key, value in payload.items():
        if value == "SRC":
            payload[key] = source
        elif value == "BCK":
            payload[key] = background
        elif value == "GTI":
            payload[key] = gti
    return payload


@pytest.mark.parametrize("route", sorted(ANALYSIS_REQUESTS))
def test_analysis_routes_reject_unknown_source_file(client, route):
    """Every analysis route refuses an unresolvable source filename."""
    response = client.post(route, json=_payload(route, "ghost.evt", "", ""))
    assert response.status_code == 400
    assert "source data" in response.get_json()["error"]


@pytest.mark.parametrize("route", sorted(ANALYSIS_REQUESTS))
def test_analysis_routes_reject_unknown_background_file(client, route):
    """Every analysis route refuses an unresolvable background filename."""
    response = client.post(route, json=_payload(route, "test.evt", "ghost_bck.evt", ""))
    assert response.status_code == 400
    assert "backgrund data" in response.get_json()["error"]


@pytest.mark.parametrize("route", sorted(ANALYSIS_REQUESTS))
def test_analysis_routes_reject_unknown_gti_file(client, route):
    """Every analysis route refuses an unresolvable GTI filename."""
    response = client.post(route, json=_payload(route, "test.evt", "", "ghost_gti.evt"))
    assert response.status_code == 400
    assert "gti data" in response.get_json()["error"]


CROSS_SPECTRUM_SLOTS = [
    ("filename1", "source data 1"),
    ("bck_filename1", "backgrund data 1"),
    ("gti_filename1", "gti data 1"),
    ("filename2", "source data 2"),
    ("bck_filename2", "backgrund data 2"),
    ("gti_filename2", "gti data 2"),
]


@pytest.mark.parametrize(("slot", "expected"), CROSS_SPECTRUM_SLOTS)
def test_cross_spectrum_validates_every_filename_slot(client, slot, expected):
    """The cross-spectrum route validates all six filename slots."""
    payload = {
        "filename1": "test.evt",
        "bck_filename1": "",
        "gti_filename1": "",
        "filters1": [],
        "axis1": EVENTS_AXIS,
        "dt1": 16.0,
        "filename2": "test.evt",
        "bck_filename2": "",
        "gti_filename2": "",
        "filters2": [],
        "axis2": EVENTS_AXIS,
        "dt2": 16.0,
        "nsegm": 1,
        "segment_size": 0,
        "norm": "leahy",
        "type": "Sng",
    }
    payload[slot] = "ghost.evt"
    response = client.post("/get_cross_spectrum", json=payload)
    assert response.status_code == 400
    assert expected in response.get_json()["error"]


def test_upload_rejects_valid_extension_with_invalid_content(client):
    """A .evt upload whose content is not FITS/ASCII is refused after save."""
    response = client.post(
        "/upload",
        data={"file": (BytesIO(b"\xff\xfe\x00\x01\x80\x81"), "binary_garbage.bin")},
        content_type="multipart/form-data",
    )
    assert response.status_code == 400
    assert "All uploads failed" in response.get_json()["error"]


def test_append_file_rejects_invalid_next_file_content(client, uploads):
    """A staged nextfile with unreadable content is rejected."""
    (uploads / "garbage.bin").write_bytes(b"\xff\xfe\x00\x01")
    response = client.post(
        "/append_file_to_dataset", json={"filename": "test.evt", "nextfile": "garbage.bin"}
    )
    assert response.status_code == 400
    assert response.get_json()["error"] == "Invalid next file"


def test_fit_powerspectrum_route_accepts_priors_and_sampling(client):
    """The route forwards optional priors and sampling parameters to the
    engine (the Bayesian branch itself is asserted in the engine tests)."""
    response = client.post(
        "/get_fit_powerspectrum_result",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "nsegm": 1,
            "segment_size": 0,
            "norm": "leahy",
            "type": "Sng",
            "df": 0,
            "models": [{"type": "Const", "amplitude": 2.0}],
            "priors": [{"amplitude": {"type": "uniform", "min": 0.1, "max": 10.0}}],
            "sampling_params": {
                "nwalkers": 8,
                "niter": 10,
                "burnin": 5,
                "threads": 1,
                "nsamples": 10,
            },
        },
    )
    assert response.status_code == 200


def test_fit_lomb_scargle_route_accepts_priors(client):
    """The Lomb-Scargle fit route forwards optional priors."""
    response = client.post(
        "/get_fit_lomb_scargle_result",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "freq_range": [0.001, 0.03],
            "nyquist_factor": 1,
            "ls_norm": "standard",
            "samples_per_peak": 2,
            "models": [{"type": "Const", "amplitude": 0.05}],
            "priors": [{"amplitude": {"type": "uniform", "min": 0.0, "max": 1.0}}],
        },
    )
    assert response.status_code == 200


def test_phaseogram_route_accepts_binary_parameters(client):
    """The phaseogram route forwards optional binary orbit parameters."""
    response = client.post(
        "/get_phaseogram",
        json={
            "filename": "test.evt",
            "bck_filename": "",
            "gti_filename": "",
            "filters": [],
            "axis": EVENTS_AXIS,
            "dt": 16.0,
            "f": 0.15,
            "nph": 8,
            "nt": 4,
            "fdot": 0.0,
            "fddot": 0.0,
            "binary_params": [500.0, 0.5, 100.0],
        },
    )
    assert response.status_code == 200
    assert len(response.get_json()[3]["values"]) == 16


LC_PAIR_ROUTES = {
    "/get_joined_lightcurves": {
        "lc0_filename": "LC0",
        "lc1_filename": "LC1",
        "lc0_bck_filename": "BCK0",
        "lc1_bck_filename": "BCK1",
        "filters": [],
        "axis": EVENTS_AXIS,
        "dt": 16.0,
    },
    "/get_divided_lightcurve_ds": {
        "lc0_filename": "LC0",
        "lc1_filename": "LC1",
        "lc0_bck_filename": "BCK0",
        "lc1_bck_filename": "BCK1",
    },
}


@pytest.mark.parametrize("route", sorted(LC_PAIR_ROUTES))
@pytest.mark.parametrize(
    ("slot", "expected"),
    [
        ("LC0", "lc0 data"),
        ("LC1", "lc1 data"),
        ("BCK0", "lc0_bck data"),
        ("BCK1", "lc1_bck data"),
    ],
)
def test_lightcurve_pair_routes_validate_every_filename_slot(client, route, slot, expected):
    """Both light-curve-pair routes validate each of their four filenames."""
    payload = {}
    for key, marker in LC_PAIR_ROUTES[route].items():
        if marker == slot:
            payload[key] = "ghost.evt"
        elif marker in ("LC0", "LC1"):
            payload[key] = "test.evt"
        elif marker in ("BCK0", "BCK1"):
            payload[key] = ""
        else:
            payload[key] = marker
    response = client.post(route, json=payload)
    assert response.status_code == 400
    assert expected in response.get_json()["error"]
