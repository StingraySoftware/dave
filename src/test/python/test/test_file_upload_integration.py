"""
Integration tests for file upload and download cycles.
Tests various file formats and edge cases.
"""
import json
import os
import tempfile
from io import BytesIO


class TestFileUploadDownloadCycles:
    """Test complete upload/process/download cycles."""

    def test_text_file_upload_process_download(self, client, sample_text_file):
        """Test full cycle for text lightcurve files."""
        # Step 1: Upload file
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test_data.txt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        data = response.get_json()
        file_id = data['id']

        # Step 2: Get schema to verify upload
        response = client.get(f'/get_dataset_schema?id={file_id}')
        assert response.status_code == 200
        schema_data = response.get_json()
        assert schema_data['success'] is True
        assert 'tables' in schema_data['dataset']

        # Step 3: Process data (create lightcurve)
        params = {
            'id': file_id,
            'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                    {'table': 'EVENTS', 'column': 'PI'}],
            'dt': 1.0
        }
        response = client.post('/get_lightcurve',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        lc_data = response.get_json()
        assert lc_data['success'] is True

        # Step 4: Verify we can get plot data
        response = client.post('/get_plot_data',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        plot_data = response.get_json()
        assert plot_data['success'] is True

    def test_fits_file_upload_process_download(self, client, sample_evt_file):
        """Test full cycle for FITS event files."""
        # Step 1: Upload FITS file
        with open(sample_evt_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test.evt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        data = response.get_json()
        file_id = data['id']

        # Step 2: Get header info
        response = client.get(f'/get_dataset_header?id={file_id}')
        assert response.status_code == 200
        header_data = response.get_json()
        assert header_data['success'] is True

        # Step 3: Create power spectrum
        params = {
            'id': file_id,
            'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                    {'table': 'EVENTS', 'column': 'PI'}],
            'dt': 1.0,
            'nsegm': 1,
            'segm_size': 10,
            'norm': 'leahy',
            'pds_type': 'Sng'
        }
        response = client.post('/get_power_density_spectrum',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        pds_data = response.get_json()
        assert pds_data['success'] is True

    def test_multiple_file_append(self, client, sample_text_file):
        """Test appending multiple files."""
        # Upload first file
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test1.txt')},
                                 content_type='multipart/form-data')

        file_id = response.get_json()['id']

        # Append second file
        with open(sample_text_file, 'rb') as f:
            response = client.post(f'/append_file_to_dataset?id={file_id}',
                                 data={'file': (f, 'test2.txt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

        # Verify combined dataset
        response = client.get(f'/get_dataset_schema?id={file_id}')
        assert response.status_code == 200
        schema_data = response.get_json()
        assert schema_data['success'] is True

    def test_color_band_file_processing(self, client, test_data_path):
        """Test processing files with color/energy bands."""
        # Create a test file with color bands
        color_data = """# Column 1: TIME
# Column 2: RATE
# Column 3: ERROR
# Column 4: FRACEXP
# Column 5: COLOR1_RATE
# Column 6: COLOR1_ERROR
# Column 7: COLOR2_RATE
# Column 8: COLOR2_ERROR
1.0 100.0 1.0 1.0 50.0 0.5 50.0 0.5
2.0 110.0 1.1 1.0 55.0 0.6 55.0 0.6
3.0 105.0 1.0 1.0 52.0 0.5 53.0 0.5
"""

        with tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False) as f:
            f.write(color_data)
            temp_file = f.name

        try:
            # Upload file
            with open(temp_file, 'rb') as f:
                response = client.post('/upload',
                                     data={'file': (f, 'color_data.txt')},
                                     content_type='multipart/form-data')

            assert response.status_code == 200
            file_id = response.get_json()['id']

            # Test color band division
            params = {
                'id': file_id,
                'axis': [{'table': 'EVENTS', 'column': 'TIME'},
                        {'table': 'EVENTS', 'column': 'RATE'}],
                'dt': 1.0,
                'colors': [
                    {'table': 'EVENTS', 'column': 'COLOR1_RATE'},
                    {'table': 'EVENTS', 'column': 'COLOR2_RATE'}
                ]
            }
            response = client.post('/get_divided_lightcurves_from_colors',
                                 data=json.dumps(params),
                                 content_type='application/json')

            assert response.status_code == 200
            data = response.get_json()
            assert data['success'] is True

        finally:
            os.unlink(temp_file)


class TestEdgeCases:
    """Test edge cases and error conditions."""

    def test_corrupted_file_upload(self, client):
        """Test uploading a corrupted file."""
        corrupted_content = b'\x00\x01\x02\x03\xFF\xFE\xFD'

        response = client.post('/upload',
                             data={'file': (BytesIO(corrupted_content), 'corrupted.dat')},
                             content_type='multipart/form-data')

        # Should either succeed or fail gracefully
        assert response.status_code in [200, 400]
        data = response.get_json()
        if response.status_code == 400:
            assert 'error' in data

    def test_empty_file_upload(self, client):
        """Test uploading an empty file."""
        response = client.post('/upload',
                             data={'file': (BytesIO(b''), 'empty.txt')},
                             content_type='multipart/form-data')

        assert response.status_code == 400
        data = response.get_json()
        assert 'error' in data

    def test_special_characters_filename(self, client, sample_text_file):
        """Test uploading files with special characters in filename."""
        with open(sample_text_file, 'rb') as f:
            response = client.post('/upload',
                                 data={'file': (f, 'test@#$%^&*().txt')},
                                 content_type='multipart/form-data')

        assert response.status_code == 200
        data = response.get_json()
        assert 'id' in data

    def test_concurrent_uploads(self, client, sample_text_file):
        """Test handling concurrent file uploads."""
        file_ids = []

        # Upload multiple files quickly
        for i in range(5):
            with open(sample_text_file, 'rb') as f:
                response = client.post('/upload',
                                     data={'file': (f, f'test_{i}.txt')},
                                     content_type='multipart/form-data')

            assert response.status_code == 200
            file_ids.append(response.get_json()['id'])

        # Verify all uploads are accessible
        for file_id in file_ids:
            response = client.get(f'/get_dataset_schema?id={file_id}')
            assert response.status_code == 200
            assert response.get_json()['success'] is True

    def test_missing_columns_in_analysis(self, client, uploaded_file_id):
        """Test analysis with non-existent columns."""
        params = {
            'id': uploaded_file_id,
            'axis': [{'table': 'EVENTS', 'column': 'NONEXISTENT_TIME'},
                    {'table': 'EVENTS', 'column': 'NONEXISTENT_PI'}],
            'dt': 1.0
        }

        response = client.post('/get_lightcurve',
                             data=json.dumps(params),
                             content_type='application/json')

        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is False
        assert 'error' in data
