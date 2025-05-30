# Reference Outputs for Regression Testing

This directory contains reference outputs generated from the modernized DAVE stack (Python 3.13, NumPy 2.2, Stingray 2.2.7) for regression testing purposes.

## Purpose

These reference outputs serve as a baseline to detect regressions in future versions of DAVE. By comparing outputs from new versions against these references, we can ensure that scientific accuracy is maintained.

## Stack Information

- **Python**: 3.13
- **NumPy**: 2.2+
- **Stingray**: 2.2.7+
- **HENDRICS**: 8.1+
- **Astropy**: 7.0+
- **Flask**: 3.1+

## Reference Test Data

The reference outputs are generated from standardized test datasets in `src/test/resources/pytest/`:

- `Test_Input_1.txt` - Basic text lightcurve file
- `Test_Input_2.lc` - Lightcurve file  
- `test.evt` - FITS event list file
- `test_Gtis.evt` - FITS event file with GTIs
- `PN_source_lightcurve_raw.lc` - Real XMM-Newton PN data

## Test Coverage

The comprehensive validation test suites created during Phase 4 serve as the actual regression tests:

1. **Core Scientific Functions** (`test_lightcurve_validation.py`, `test_pds_validation.py`, etc.)
   - Lightcurve analysis: rebinning, GTI filtering, background subtraction
   - Power Density Spectra: all normalizations
   - Cross-correlation and cross-spectrum analysis
   - Timing analysis: Z2n pulse search, epoch folding, phaseogram
   - Model fitting: PowerLaw, Gaussian, Lorentzian, etc.

2. **FITS File Handling** (`test_fits_handling_validation.py`)
   - Event list loading with/without headers
   - Lightcurve FITS files
   - Multiple HDU handling
   - Astropy 7.0 compatibility

3. **Edge Cases** (`test_edge_cases_validation.py`)
   - Empty files, invalid formats
   - Extreme parameter values
   - NaN/infinite values
   - Unicode filenames
   - NumPy 2.0 compatibility

4. **Plot Types** (`test_plot_types_validation.py`)
   - All plot endpoint functionality
   - Data type validation
   - Filter handling

## Usage

To validate against these references:

1. **Run the existing test suites** - The 50+ validation tests serve as regression tests
2. **Compare key outputs** - For critical analyses, compare numerical outputs
3. **Check API compatibility** - Ensure endpoints still accept the same parameters

## Tolerance Guidelines

- **Exact matches**: Use `1e-10` tolerance for identical inputs
- **Floating point**: Use `1e-6` tolerance for numerical precision differences
- **Array shapes**: Must match exactly
- **JSON structure**: Must maintain same hierarchy

## Maintenance

- Update references when making intentional scientific improvements
- Document any changes in STINGRAY_API_CHANGES.md
- Increment version number when updating references
- Test against multiple input datasets to ensure robustness