import base64, os, unittest
os.environ.setdefault('CUSTOMER_SYNC_SECRET','test-only')
from sync import decode
class DecoderTests(unittest.TestCase):
    def test_unicode(self):
        text='Hello, café 👋';data=text.encode()
        archive=b'\x04\x0bstreamtyped\x81\xe8\x03\x84\x01@\x84\x84\x84\x08NSString\x01\x84\x84\x08NSObject\x00\x85\x84\x01+'+bytes([len(data)])+data+b'\x86'
        self.assertEqual(decode(base64.b64encode(archive)),text)
    def test_malformed_is_explicit(self):
        with self.assertRaises(Exception): decode(base64.b64encode(b'not a typedstream'))
        with self.assertRaises(ValueError): decode(base64.b64encode(b'x'*2000001))
    def test_empty(self): self.assertIsNone(decode(None))
if __name__=='__main__': unittest.main()
