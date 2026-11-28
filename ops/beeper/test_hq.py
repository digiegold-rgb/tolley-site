import unittest,uuid,time,datetime as dt
from unittest.mock import patch
import test_worker
import hq,worker as w
class Commands(unittest.TestCase):
 tearDown = test_worker.Flow.tearDown
 def setUp(self):
  test_worker.Flow.setUp(self);self.c.execute('CREATE TABLE commands(id TEXT PRIMARY KEY,status TEXT,detail TEXT)');self.c.execute('INSERT INTO chats(id,title) VALUES("test","Buyer · Lamp")');self.c.commit()
 def cmd(self,action='send'):
  return {'id':str(uuid.uuid4()),'action':action,'chatId':'test','text':'See you tomorrow','expectedMessageId':'last','createdAt':dt.datetime.now(dt.timezone.utc).isoformat()}
 def test_send_idempotent(self):
  cmd=self.cmd()
  with patch.object(w,'transport',return_value={'pendingMessageID':'out'}) as send:
   self.assertEqual(hq.execute(self.c,cmd)['status'],'done');self.assertEqual(hq.execute(self.c,cmd)['status'],'done');self.assertEqual(send.call_count,1)
  self.assertEqual(self.c.execute('SELECT paused FROM chats').fetchone()[0],1)
 def test_send_uncertain(self):
  cmd=self.cmd()
  with patch.object(w,'transport',side_effect=TimeoutError) as send:
   self.assertEqual(hq.execute(self.c,cmd)['status'],'uncertain');self.assertEqual(hq.execute(self.c,cmd)['status'],'uncertain');self.assertEqual(send.call_count,1)
 def test_expired(self):
  cmd=self.cmd();cmd['createdAt']=dt.datetime.fromtimestamp(time.time()-1000,dt.timezone.utc).isoformat()
  with patch.object(w,'transport') as send:self.assertEqual(hq.execute(self.c,cmd)['status'],'error');send.assert_not_called()
 def test_changed_conversation(self):
  with patch.object(w,'transport',return_value={'error':'Conversation changed'}):self.assertEqual(hq.execute(self.c,self.cmd())['status'],'error')
 def test_global(self):
  cmd=self.cmd('pause');cmd.pop('chatId');hq.execute(self.c,cmd);self.assertEqual(w.setting(self.c,'paused'),'1')
 def test_item_pause(self):
  cmd=self.cmd('listing-pause');cmd['listing']='Lamp';hq.execute(self.c,cmd);self.assertEqual(self.c.execute('SELECT paused FROM listings').fetchone()[0],1)
if __name__=='__main__':unittest.main()
