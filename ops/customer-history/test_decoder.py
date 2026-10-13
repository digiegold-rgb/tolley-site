import base64, os, unittest, json
from unittest.mock import patch
os.environ.setdefault('CUSTOMER_SYNC_SECRET','test-only')
import sync
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
class RetractionTests(unittest.TestCase):
    def test_retracted_photos_are_not_reuploaded(self):
        def mac(args):
            if args['mode']=='candidates': return b'{"threads":[]}'
            self.assertEqual(args['mode'],'events','Retracted media must not be read again')
            return json.dumps({'events':[{'guid':'retracted','rowId':1,'at':'2026-10-13T00:00:00Z','body':'old text','direction':'in','kind':'message','service':'iMessage','edited':False,'retracted':True,'attachments':[{'guid':'photo','name':'photo.jpg','mime':'image/jpeg','size':10,'downloaded':True}]}],'calls':[],'hasMore':False,'after':1,'scan':1}).encode()
        def api(path,payload=None,**kwargs):
            self.assertNotIn('attachment',path)
            if payload is None: return {'threads':[{'id':'test','phone':'+19135550123','checkpoint':None}]}
            if payload['type']=='events' and payload['events']:
                self.assertIsNone(payload['events'][0]['body'])
                return {'saved':[{'sourceKey':'retracted','id':'event','attachments':[]}]}
            return {'saved':[]}
        with patch.object(sync,'mac',mac),patch.object(sync,'api',api): sync.run()
if __name__=='__main__': unittest.main()
