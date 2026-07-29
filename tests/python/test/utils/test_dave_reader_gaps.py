"""Tests for the utils.dave_reader paths the original suite leaves untested:
file-type detection fallbacks (the Windows/no-magic world), the dispatch in
get_file_dataset for every supported input, the lightcurve guard clauses,
and the intermediate-file save/load error branches.
"""

import os
import shutil

import numpy as np
import pytest
from astropy.io import fits
from hendrics.io import HEN_FILE_EXTENSION
from stingray.crossspectrum import Crossspectrum
from stingray.events import EventList

import utils.dataset_cache as DsCache
import utils.dave_reader as DaveReader
import utils.file_utils as FileUtils
from test.fixture import DATA_RESOURCES, TEST_RESOURCES


@pytest.fixture(autouse=True)
def clean_cache():
    DsCache.clear()
    yield
    DsCache.clear()


@pytest.fixture
def no_magic(monkeypatch):
    """Simulate the Windows CI world where python-magic is unavailable, so
    file typing falls back to extension sniffing."""
    monkeypatch.setattr(DaveReader, "MAGIC_AVAILABLE", False)


def _resource(name):
    return os.path.join(TEST_RESOURCES, name)


def _data(name):
    return os.path.join(DATA_RESOURCES, name)


# ---------- get_file_type_from_extension ----------


@pytest.mark.parametrize(
    ("filename", "expected"),
    [
        ("f.txt", "ASCII text"),
        ("f.dat", "ASCII text"),
        ("f.lc", "FITS"),
        ("f.evt", "FITS"),
        ("f.fits", "FITS"),
        ("f.fit", "FITS"),
        ("f.fts", "FITS"),
        ("f.rmf", "FITS"),
        ("f.arf", "FITS"),
        ("f.pha", "FITS"),
        ("f.rsp", "FITS"),
        ("f.gz", "gzip compressed"),
    ],
)
def test_extension_map_covers_supported_types(filename, expected):
    """Known extensions map to the magic-compatible type strings."""
    assert DaveReader.get_file_type_from_extension(filename) == expected


def test_extensionless_fits_file_is_detected_by_content(tmp_path):
    """A FITS file without an extension is recognized by opening it."""
    target = tmp_path / "noextension"
    shutil.copy(_resource("test.evt"), target)
    assert DaveReader.get_file_type_from_extension(str(target)) == "FITS"


def test_extensionless_text_file_is_detected_by_content(tmp_path):
    """A readable text file without an extension is reported as ASCII text."""
    target = tmp_path / "plain"
    target.write_text("1.0 2.0\n")
    assert DaveReader.get_file_type_from_extension(str(target)) == "ASCII text"


def test_undecodable_extensionless_file_is_reported_as_data(tmp_path):
    """Binary content that is neither FITS nor text is classified as data."""
    target = tmp_path / "blob"
    target.write_bytes(b"\xff\xfe\x00\x01binary\x80\x81")
    assert DaveReader.get_file_type_from_extension(str(target)) == "data"


# ---------- get_cache_key_for_destination ----------


def test_cache_key_for_real_file_is_hashed_and_offset_dependent():
    """Real files hash to a stable key that also encodes the time offset."""
    destination = _resource("test.evt")
    key = DaveReader.get_cache_key_for_destination(destination, 0)
    assert key == DaveReader.get_cache_key_for_destination(destination, 0)
    assert key != DaveReader.get_cache_key_for_destination(destination, 10)
    assert key.isalnum()


# ---------- get_file_dataset dispatch ----------


def test_get_file_dataset_reads_text_events_and_adds_amplitude(no_magic):
    """A txt dataset gains the synthetic AMPLITUDE column used for scatter."""
    dataset, cache_key = DaveReader.get_file_dataset(_resource("Test_Input_1.txt"))
    table = dataset.tables["EVENTS"]
    assert len(table.columns["TIME"].values) == 10
    assert len(table.columns["AMPLITUDE"].values) == 10
    assert all(-1 <= value <= 1 for value in table.columns["AMPLITUDE"].values)
    assert DsCache.contains(cache_key)


def test_get_file_dataset_returns_cached_dataset_on_second_call(no_magic):
    """A repeated read is served from the cache, not re-parsed."""
    first, cache_key = DaveReader.get_file_dataset(_resource("test.evt"))
    second, same_key = DaveReader.get_file_dataset(_resource("test.evt"))
    assert second is first
    assert same_key == cache_key


def test_get_file_dataset_reads_events_fits(no_magic):
    """An EVENTS FITS file yields EVENTS+GTI tables with TSTART recorded.

    999 of the 1000 events survive: the GTI slicing is end-exclusive, so the
    event on the GTI boundary is dropped.
    """
    dataset, _ = DaveReader.get_file_dataset(_data("monol_testA.evt"))
    assert set(dataset.tables) == {"EVENTS", "GTI"}
    assert len(dataset.tables["EVENTS"].columns["TIME"].values) == 999
    assert dataset.tables["EVENTS"].columns["TIME"].get_extra("TSTART") == 80000000.0
    # Times are stored relative to TSTART.
    assert dataset.tables["EVENTS"].columns["TIME"].values[0] < 1.0


def test_get_file_dataset_reads_gzipped_events_with_alternative_hdu(no_magic):
    """A gzipped XTE file (XTE_SE HDU) is recognized as an events dataset."""
    dataset, _ = DaveReader.get_file_dataset(_data("xte_test.evt.gz"))
    assert "EVENTS" in dataset.tables
    assert len(dataset.tables["EVENTS"].columns["TIME"].values) > 0


def test_get_file_dataset_reads_lightcurve_fits(no_magic):
    """A RATE FITS file yields a lightcurve dataset with counts and GTIs."""
    dataset, _ = DaveReader.get_file_dataset(_resource("Test_Input_2.lc"))
    assert set(dataset.tables) == {"RATE", "GTI"}
    assert len(dataset.tables["RATE"].columns["RATE"].values) > 0
    assert dataset.tables["RATE"].columns["TIME"].get_extra("TSTART") > 0


def test_get_file_dataset_reads_rmf_ebounds(no_magic, rmf_file):
    """An EBOUNDS-only FITS file is read as an RMF dataset."""
    dataset, _ = DaveReader.get_file_dataset(rmf_file)
    assert "EBOUNDS" in dataset.tables
    assert len(dataset.tables["EBOUNDS"].columns["CHANNEL"].values) == 1024


def test_get_file_dataset_reads_gti_only_fits(no_magic, gti_file_relative):
    """A GTI-only FITS file yields a dataset with just the GTI table."""
    dataset, _ = DaveReader.get_file_dataset(gti_file_relative)
    assert list(dataset.tables) == ["GTI"]
    assert dataset.tables["GTI"].columns["START"].values == [100.0]


def test_get_file_dataset_warns_on_unsupported_fits(no_magic, tmp_path):
    """A FITS file with no recognized HDU produces no dataset."""
    target = tmp_path / "unsupported.fits"
    table = fits.BinTableHDU.from_columns(
        [fits.Column(name="SOMETHING", format="D", array=np.array([1.0]))], name="OTHER"
    )
    fits.HDUList([fits.PrimaryHDU(), table]).writeto(str(target))
    dataset, _ = DaveReader.get_file_dataset(str(target))
    assert dataset is None


def test_get_file_dataset_warns_on_unknown_extension(no_magic, tmp_path):
    """A file type DAVE cannot interpret yields no dataset."""
    target = tmp_path / "mystery.bin"
    target.write_bytes(b"\xff\xfe\x00\x01")
    dataset, _ = DaveReader.get_file_dataset(str(target))
    assert dataset is None


def test_get_file_dataset_with_empty_destination():
    """An empty destination is an error, reported as no dataset."""
    dataset, cache_key = DaveReader.get_file_dataset("")
    assert dataset is None
    assert cache_key == ""


def test_get_file_dataset_falls_back_when_magic_raises(monkeypatch):
    """A python-magic runtime failure falls back to extension detection."""
    if DaveReader.MAGIC_AVAILABLE:

        def explode(_destination):
            raise RuntimeError("could not find any valid magic files!")

        monkeypatch.setattr(DaveReader.magic, "from_file", explode)

    dataset, _ = DaveReader.get_file_dataset(_resource("test.evt"))
    assert dataset is not None
    assert "EVENTS" in dataset.tables


def test_get_file_dataset_reads_intermediate_file(no_magic, tmp_path):
    """A HENDRICS .nc intermediate file is loaded back into a dataset."""
    events = EventList(
        np.array([0.0, 1.0, 2.0]), pi=np.array([1, 2, 3]), gti=np.array([[0.0, 3.0]])
    )
    target = str(tmp_path / ("roundtrip" + HEN_FILE_EXTENSION))
    assert DaveReader.save_to_intermediate_file(events, target) is True

    dataset, _ = DaveReader.get_file_dataset(target)
    assert dataset is not None
    assert len(dataset.tables["EVENTS"].columns["TIME"].values) == 3


# ---------- lightcurve guard clauses ----------


def _lightcurve_fits(path, columns, hduclas1="LIGHTCURVE"):
    rate_hdu = fits.BinTableHDU.from_columns(fits.ColDefs(columns), name="RATE")
    if hduclas1 is not None:
        rate_hdu.header["HDUCLAS1"] = hduclas1
    gti_hdu = fits.BinTableHDU.from_columns(
        fits.ColDefs(
            [
                fits.Column(name="START", format="D", array=np.array([0.0])),
                fits.Column(name="STOP", format="D", array=np.array([3.0])),
            ]
        ),
        name="GTI",
    )
    fits.HDUList([fits.PrimaryHDU(), rate_hdu, gti_hdu]).writeto(str(path))
    return str(path)


TIME_COLUMN = fits.Column(name="TIME", format="D", array=np.array([0.0, 1.0, 2.0]))


def test_lightcurve_reader_requires_hduclas1(tmp_path):
    """A RATE HDU without HDUCLAS1 is not accepted as a lightcurve."""
    path = _lightcurve_fits(
        tmp_path / "no_class.lc",
        [TIME_COLUMN, fits.Column(name="RATE", format="D", array=np.array([1.0, 2.0, 3.0]))],
        hduclas1=None,
    )
    with fits.open(path) as hdulist:
        assert DaveReader.get_lightcurve_fits_dataset_with_stingray(path, hdulist) is None


def test_lightcurve_reader_requires_lightcurve_hduclas1(tmp_path):
    """A RATE HDU declaring some other HDUCLAS1 is rejected."""
    path = _lightcurve_fits(
        tmp_path / "wrong_class.lc",
        [TIME_COLUMN, fits.Column(name="RATE", format="D", array=np.array([1.0, 2.0, 3.0]))],
        hduclas1="SPECTRUM",
    )
    with fits.open(path) as hdulist:
        assert DaveReader.get_lightcurve_fits_dataset_with_stingray(path, hdulist) is None


def test_lightcurve_reader_requires_a_rate_column(tmp_path):
    """Without RATE, RATE1 or COUNTS there is nothing to plot."""
    path = _lightcurve_fits(
        tmp_path / "no_rate.lc",
        [TIME_COLUMN, fits.Column(name="FLUX", format="D", array=np.array([1.0, 2.0, 3.0]))],
    )
    with fits.open(path) as hdulist:
        assert DaveReader.get_lightcurve_fits_dataset_with_stingray(path, hdulist) is None


def test_lightcurve_reader_rejects_ambiguous_rate_columns(tmp_path):
    """Both RATE and COUNTS present is ambiguous and therefore rejected."""
    path = _lightcurve_fits(
        tmp_path / "ambiguous.lc",
        [
            TIME_COLUMN,
            fits.Column(name="RATE", format="D", array=np.array([1.0, 2.0, 3.0])),
            fits.Column(name="COUNTS", format="D", array=np.array([1.0, 2.0, 3.0])),
        ],
    )
    with fits.open(path) as hdulist:
        assert DaveReader.get_lightcurve_fits_dataset_with_stingray(path, hdulist) is None


def test_lightcurve_reader_rejects_vector_rate_column(tmp_path):
    """A multi-dimensional RATE column is not a scalar time series."""
    path = _lightcurve_fits(
        tmp_path / "vector.lc",
        [
            TIME_COLUMN,
            fits.Column(name="RATE", format="2D", array=np.array([[1.0, 2.0]] * 3)),
        ],
    )
    with fits.open(path) as hdulist:
        assert DaveReader.get_lightcurve_fits_dataset_with_stingray(path, hdulist) is None


# ---------- GTI reader ----------


def test_gti_reader_applies_time_offset(gti_file_relative):
    """A nonzero time offset shifts the GTI boundaries by that amount."""
    with fits.open(gti_file_relative) as hdulist:
        dataset = DaveReader.get_gti_fits_dataset_with_stingray(hdulist, time_offset=50.0)
    assert dataset.tables["GTI"].columns["START"].values == [50.0]
    assert dataset.tables["GTI"].columns["STOP"].values == [450.0]


def test_gti_reader_reports_missing_gti_hdu(tmp_path):
    """A file with no GTI-like HDU produces no GTI dataset."""
    target = tmp_path / "nogti.fits"
    table = fits.BinTableHDU.from_columns(
        [fits.Column(name="X", format="D", array=np.array([1.0]))], name="OTHER"
    )
    fits.HDUList([fits.PrimaryHDU(), table]).writeto(str(target))
    with fits.open(str(target)) as hdulist:
        assert DaveReader.get_gti_fits_dataset_with_stingray(hdulist) is None


# ---------- get_stingray_object ----------


def test_get_stingray_object_for_events_returns_eventlist(no_magic):
    """An events file yields a usable EventList with TSTART subtracted and
    PI values carried over (regression: this used to return a raw tuple
    that could never be saved to an intermediate file)."""
    events = DaveReader.get_stingray_object(_data("monol_testA.evt"))
    assert isinstance(events, EventList)
    assert len(events.time) == 1000
    assert events.time[0] < 1.0  # TSTART (80000000) was subtracted
    assert events.pi is not None and len(events.pi) == 1000


def test_get_stingray_object_for_lightcurve_returns_lightcurve(no_magic):
    """A lightcurve file yields a stingray Lightcurve with its counts."""
    from stingray.lightcurve import Lightcurve

    lightcurve = DaveReader.get_stingray_object(_resource("Test_Input_2.lc"))
    assert isinstance(lightcurve, Lightcurve)
    assert len(lightcurve.counts) > 0


def test_get_stingray_object_without_destination_returns_none():
    """No destination means no object."""
    assert DaveReader.get_stingray_object("") is None


def test_get_stingray_object_for_non_fits_returns_none(no_magic):
    """A text file is not a stingray object source."""
    assert DaveReader.get_stingray_object(_resource("Test_Input_1.txt")) is None


def test_get_stingray_object_for_unsupported_fits_returns_none(no_magic, rmf_file):
    """A FITS file with neither EVENTS nor RATE is unsupported."""
    assert DaveReader.get_stingray_object(rmf_file) is None


# ---------- intermediate files ----------


def test_save_to_intermediate_file_rejects_unknown_object(tmp_path):
    """Objects that are not lightcurves, events or spectra cannot be saved."""
    target = str(tmp_path / ("bad" + HEN_FILE_EXTENSION))
    assert DaveReader.save_to_intermediate_file({"not": "stingray"}, target) is False


def test_intermediate_crossspectrum_cannot_be_loaded_back(tmp_path):
    """Cross spectra can be written but are not a supported dataset source.

    The two inputs must differ: hendrics' writer cannot serialize the
    degenerate all-zero lag fields a self-cross-spectrum produces.
    """
    rng = np.random.default_rng(7)
    events1 = EventList(
        np.sort(rng.uniform(0, 100, 200)), pi=np.ones(200, dtype=int), gti=np.array([[0.0, 100.0]])
    )
    events2 = EventList(
        np.sort(rng.uniform(0, 100, 200)), pi=np.ones(200, dtype=int), gti=np.array([[0.0, 100.0]])
    )
    spectrum = Crossspectrum(
        data1=events1.to_lc(1.0), data2=events2.to_lc(1.0), norm="leahy"
    )
    target = str(tmp_path / ("xspec" + HEN_FILE_EXTENSION))
    assert DaveReader.save_to_intermediate_file(spectrum, target) is True
    assert DaveReader.load_dataset_from_intermediate_file(target) is None


# ---------- file_utils fallbacks ----------


def test_is_valid_file_extension_fallback_without_magic(monkeypatch):
    """With python-magic unavailable, validity is decided by extension."""
    monkeypatch.setattr(FileUtils, "MAGIC_AVAILABLE", False)
    assert FileUtils.is_valid_file(_resource("test.evt")) is True
    assert FileUtils.is_valid_file(_resource("Test_Input_1.txt")) is True


def test_is_valid_file_rejects_unknown_extension(monkeypatch, tmp_path):
    """An unlisted extension is not a valid DAVE input."""
    monkeypatch.setattr(FileUtils, "MAGIC_AVAILABLE", False)
    target = tmp_path / "data.xyz"
    target.write_text("content")
    assert FileUtils.is_valid_file(str(target)) is False


def test_is_valid_file_accepts_extensionless_text(monkeypatch, tmp_path):
    """Extensionless files are probed as text and accepted when readable."""
    monkeypatch.setattr(FileUtils, "MAGIC_AVAILABLE", False)
    target = tmp_path / "textfile"
    target.write_text("1.0 2.0\n")
    assert FileUtils.is_valid_file(str(target)) is True


def test_is_valid_file_rejects_extensionless_binary(monkeypatch, tmp_path):
    """Extensionless binary blobs fail the text probe and are rejected."""
    monkeypatch.setattr(FileUtils, "MAGIC_AVAILABLE", False)
    target = tmp_path / "binaryfile"
    target.write_bytes(b"\xff\xfe\x00\x01\x80\x81")
    assert FileUtils.is_valid_file(str(target)) is False


def test_is_valid_file_rejects_missing_and_empty_paths():
    """Nonexistent or empty destinations are never valid."""
    assert FileUtils.is_valid_file("") is False
    assert FileUtils.is_valid_file("/nonexistent/path/file.evt") is False


def test_get_destination_uses_secure_filename_for_remote_server(monkeypatch, tmp_path):
    """With IS_LOCAL_SERVER off, uploads are confined by secure_filename."""
    from config import CONFIG

    monkeypatch.setattr(CONFIG, "IS_LOCAL_SERVER", False)
    destination = FileUtils.get_destination(str(tmp_path), "../../etc/passwd")
    assert destination == os.path.join(str(tmp_path), "etc_passwd")

    # A filename that sanitizes to nothing has no valid destination.
    assert FileUtils.get_destination(str(tmp_path), "../") == ""


def test_get_destination_rejects_traversal_for_local_server(tmp_path):
    """Local-server mode confines relative paths to the uploads directory."""
    assert FileUtils.get_destination(str(tmp_path), "../../etc/passwd") == ""


def test_get_intermediate_filename_replaces_existing_file(tmp_path):
    """A stale intermediate file at the target path is removed first."""
    stale = tmp_path / "test.nc"
    stale.write_text("stale")
    destination = FileUtils.get_intermediate_filename(
        str(tmp_path), _resource("test.evt"), ".nc"
    )
    assert destination == str(stale)
    assert not os.path.exists(destination)


def test_get_intermediate_filename_creates_missing_target_dir(tmp_path):
    """A target directory that does not exist yet is created."""
    target = tmp_path / "fresh"
    FileUtils.get_intermediate_filename(str(target), _resource("test.evt"), ".nc")
    assert target.is_dir()


def test_save_file_rejects_invalid_upload(tmp_path):
    """save_file refuses a file that fails upload validation."""
    from io import BytesIO

    from werkzeug.datastructures import FileStorage

    upload = FileStorage(stream=BytesIO(b"data"), filename="virus.exe")
    assert FileUtils.save_file(str(tmp_path / "uploads"), upload) == ""


class _MagicDouble:
    """Stands in for libmagic, whose runtime behavior differs per machine
    (this dev box has no magic database, Windows CI has no libmagic at all).
    Returning canned type strings lets the magic-successful branches be
    exercised deterministically everywhere."""

    def __init__(self, answer):
        self.answer = answer

    def from_file(self, _destination):
        return self.answer


@pytest.mark.parametrize(
    ("magic_answer", "filename", "expected"),
    [
        ("ASCII text", "Test_Input_1.txt", True),
        ("FITS image data", "test.evt", True),
        ("gzip compressed data", "test.evt", True),
        ("data", "Test_Input_2_lc.nc", True),  # opaque data allowed for .p/.nc
        ("data", "test.evt", False),  # opaque data refused otherwise
        ("PNG image data", "test.evt", False),
    ],
)
def test_is_valid_file_interprets_magic_answers(monkeypatch, magic_answer, filename, expected):
    """is_valid_file accepts exactly ASCII/FITS/gzip magic types, plus
    opaque 'data' for intermediate-file extensions."""
    monkeypatch.setattr(FileUtils, "MAGIC_AVAILABLE", True)
    monkeypatch.setattr(FileUtils, "magic", _MagicDouble(magic_answer), raising=False)
    assert FileUtils.is_valid_file(_resource(filename)) is expected


def test_get_file_dataset_uses_magic_type_when_available(monkeypatch):
    """When libmagic answers successfully its type string drives dispatch."""
    monkeypatch.setattr(DaveReader, "MAGIC_AVAILABLE", True)
    monkeypatch.setattr(
        DaveReader, "magic", _MagicDouble("FITS image data, 8-bit"), raising=False
    )
    dataset, _ = DaveReader.get_file_dataset(_resource("test.evt"))
    assert dataset is not None
    assert "EVENTS" in dataset.tables


def test_get_stingray_object_uses_magic_type_when_available(monkeypatch):
    """get_stingray_object honors a successful magic answer the same way."""
    monkeypatch.setattr(DaveReader, "MAGIC_AVAILABLE", True)
    monkeypatch.setattr(
        DaveReader, "magic", _MagicDouble("FITS image data, 8-bit"), raising=False
    )
    events = DaveReader.get_stingray_object(_resource("test.evt"))
    assert isinstance(events, EventList)


def test_get_destination_accepts_absolute_path_on_posix():
    """On local-server mode an existing absolute path is passed through
    (this branch is keyed on a leading '/', so it is POSIX-only)."""
    if os.name == "nt":
        pytest.skip("absolute-path branch is keyed on POSIX '/' prefixes")
    absolute = os.path.abspath(_resource("test.evt"))
    assert FileUtils.get_destination("/ignored-target", absolute) == absolute
