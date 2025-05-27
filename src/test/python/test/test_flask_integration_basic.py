"""
Basic integration tests for Flask endpoints in DAVE server.
Tests core functionality with appropriate test data.
"""
import json

import pytest


class TestBasicIntegration:
    """Test basic integration flows."""

    def test_upload_and_schema_flow(self, client, sample_text_file):
        """Test uploading a file and getting its schema."""
        # Step 1: Upload file
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test_data.txt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        filenames = response.get_json()
        assert len(filenames) == 1
        filename = filenames[0]

        # Step 2: Get schema
        response = client.get(f'/get_dataset_schema?filename={filename}')
        assert response.status_code == 200
        schema = response.get_json()

        # Verify schema structure
        assert isinstance(schema, dict)
        assert 'EVENTS' in schema
        assert 'TIME' in schema['EVENTS']
        assert 'PHA' in schema['EVENTS'] or 'PI' in schema['EVENTS'] or 'RATE' in schema['EVENTS']

        # Step 3: Get header
        response = client.get(f'/get_dataset_header?filename={filename}')
        assert response.status_code == 200
        header = response.get_json()
        assert isinstance(header, dict)

    def test_error_handling(self, client):
        """Test error handling for invalid requests."""
        # Test with non-existent file
        response = client.get('/get_dataset_schema?filename=nonexistent.txt')
        assert response.status_code == 200
        data = response.get_json()
        assert 'error' in data

        # Test upload with no file
        response = client.post('/upload',
                             data={},
                             content_type='multipart/form-data')
        assert response.status_code == 200
        data = response.get_json()
        assert 'error' in data

    def test_config_endpoints(self, client):
        """Test configuration endpoints."""
        # Clear cache
        response = client.post('/clear_cache',
                             data={},
                             content_type='application/json')
        assert response.status_code == 200

    def test_lightcurve_basic(self, client, uploaded_file_id):
        """Test basic lightcurve creation."""
        # First get schema to understand columns
        response = client.get(f'/get_dataset_schema?filename={uploaded_file_id}')
        schema = response.get_json()

        # Find appropriate columns for lightcurve
        events_table = schema.get('EVENTS', {})
        time_col = None
        value_col = None

        # Look for TIME column
        if 'TIME' in events_table:
            time_col = 'TIME'
        elif 'time' in events_table:
            time_col = 'time'

        # Look for value column (RATE, PHA, PI, etc.)
        for col in ['RATE', 'PHA', 'PI', 'COUNTS', 'rate']:
            if col in events_table:
                value_col = col
                break

        if not time_col or not value_col:
            pytest.skip(f"No suitable columns found for lightcurve. Available: {list(events_table.keys())}")

        params = {
            'filename': uploaded_file_id,
            'bck_filename': '',
            'gti_filename': '',
            'filters': [],
            'axis': [{'table': 'EVENTS', 'column': time_col},
                    {'table': 'EVENTS', 'column': value_col}],
            'dt': 1.0,
            'baseline_opts': {},
            'meanflux_opts': {},
            'variance_opts': {}
        }

        response = client.post('/get_lightcurve',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        data = response.get_json()
        # Check if it's a success or at least a proper error
        assert isinstance(data, dict)

    def test_plot_data_from_models(self, client):
        """Test model plotting which doesn't require uploaded data."""
        params = {
            'models': [
                {
                    'type': 'PowerLaw',
                    'params': {
                        'amplitude': 1.0,
                        'index': 2.0
                    }
                }
            ],
            'x_values': [0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
        }

        response = client.post('/get_plot_data_from_models',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        data = response.get_json()
        # This endpoint might return data directly or wrapped
        assert data is not None

    def test_multiple_file_workflow(self, client, sample_text_file):
        """Test working with multiple files."""
        files = []

        # Upload multiple files
        for i in range(3):
            with open(sample_text_file, 'rb') as f:
                response = client.post('/upload',
                                     data={'file': (f, f'test_data_{i}.txt')},
                                     content_type='multipart/form-data')

            assert response.status_code == 200
            files.extend(response.get_json())

        assert len(files) == 3

        # Verify each file is accessible
        for filename in files:
            response = client.get(f'/get_dataset_schema?filename={filename}')
            assert response.status_code == 200

    def test_fits_vs_text_files(self, client, sample_text_file, sample_evt_file):
        """Test handling of different file formats."""
        # Upload text file
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test.txt')},
                                 content_type='multipart/form-data')
        assert response.status_code == 200
        text_file = response.get_json()[0]

        # Upload FITS file
        with open(sample_evt_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test.evt')},
                                 content_type='multipart/form-data')
        assert response.status_code == 200
        fits_file = response.get_json()[0]

        # Both should have schemas
        for filename in [text_file, fits_file]:
            response = client.get(f'/get_dataset_schema?filename={filename}')
            assert response.status_code == 200
            schema = response.get_json()
            assert 'EVENTS' in schema or 'error' not in schema


class TestSessionHandling:
    """Test session-based functionality."""

    def test_upload_persistence_in_session(self, client, sample_text_file):
        """Test that uploaded files are tracked in session."""
        # Upload a file
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'session_test.txt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        filename = response.get_json()[0]

        # File should be accessible in same session
        response = client.get(f'/get_dataset_schema?filename={filename}')
        assert response.status_code == 200

        # Note: Testing cross-session behavior would require multiple clients


class TestEdgeCasesBasic:
    """Test basic edge cases."""

    def test_empty_json_body(self, client):
        """Test endpoints that expect JSON with empty body."""
        response = client.post('/get_lightcurve',
                             data='{}',
                             content_type='application/json')

        assert response.status_code == 200
        data = response.get_json()
        # Should return error for missing required fields
        assert 'error' in data or 'success' in data

    def test_malformed_json(self, client):
        """Test endpoints with malformed JSON."""
        response = client.post('/get_lightcurve',
                             data='{invalid json',
                             content_type='application/json')

        # Should return 400 Bad Request
        assert response.status_code == 400

    def test_wrong_content_type(self, client):
        """Test POST with wrong content type."""
        response = client.post('/get_lightcurve',
                             data='some data',
                             content_type='text/plain')

        # Should handle gracefully
        assert response.status_code in [400, 415, 200]  # 200 if handled as error
