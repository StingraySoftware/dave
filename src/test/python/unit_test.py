import util
import unittest


class MyTest(unittest.TestCase):
	def test_cube(self):
		self.assertEqual(util.md5('./plot_image.jpeg'),'82627e7532667b99e2de89d748f63b6d')
