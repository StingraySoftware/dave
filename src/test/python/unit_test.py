import hashlib
import unittest


def md5(fname):
    hash_md5 = hashlib.md5()
    with open(fname, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()	


class MyTest(unittest.TestCase):
	def test_cube(self):
		self.assertEqual(md5('./plot_image.jpeg'),'82627e7532667b99e2de89d748f63b6d')
unittest.main()