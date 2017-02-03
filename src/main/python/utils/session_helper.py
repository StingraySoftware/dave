from flask import session


# SESSION METHODS
def add_uploaded_file_to_session(filename):
    if 'uploaded_filenames' not in session:
        session['uploaded_filenames'] = []

    session['uploaded_filenames'].extend([filename])


def is_file_uploaded(filename):
    if 'uploaded_filenames' not in session:
        return False

    return filename in session['uploaded_filenames']
