import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch
import httpx
from youtube_metrics import YouTubeLive, YouTubeMetrics
import automatic
import service
from source_metadata import youtube_page, YOUTUBE_CHANNEL

class AutomaticTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();service.DB_PATH=Path(self.tmp.name)/'test.sqlite3';service.WHATNOT_PATH=Path(self.tmp.name)/'whatnot.json';service.initialize();self.now=time.time()
    def tearDown(self):self.tmp.cleanup()
    def payload(self,**changes):
        meta={'verified':True,'liveNow':True,'checkedAt':self.now,'source':'https://www.youtube.com/watch?v=abcdefghijk','video':'https://www.youtube.com/watch?v=abcdefghijk','channelId':YOUTUBE_CHANNEL,'title':'Auto test','connected':True,**changes}
        return {'youtube':meta,'items':[]}
    def observe(self,p=None):
        with service.db() as c:automatic.observe(c,p or self.payload(),self.now)
    def test_starts_without_button_and_deduplicates_session(self):
        self.observe();self.observe();s=service.snapshot();self.assertEqual(len(s['sessions']),1);self.assertTrue(s['show']['automatic'])
    def test_unverified_stale_or_other_account_never_starts(self):
        for changes in [{'verified':False},{'liveNow':None},{'liveNow':False},{'checkedAt':self.now-1000},{'channelId':'another-account'}]:self.observe(self.payload(**changes))
        self.assertIsNone(service.snapshot()['activeId'])
    def test_offline_must_be_confirmed_for_three_minutes(self):
        self.observe();self.observe(self.payload(liveNow=False));self.now+=179;self.observe(self.payload(liveNow=False));self.assertIsNotNone(service.snapshot()['activeId'])
        self.now+=2;self.observe(self.payload(liveNow=False));self.assertIsNone(service.snapshot()['activeId'])
    def test_errors_never_end_tracking(self):
        self.observe();self.now+=900;self.observe(self.payload(liveNow=None,verified=False));self.assertIsNotNone(service.snapshot()['activeId'])
    def test_manual_finish_prevents_same_source_reopening(self):
        self.observe();sid=service.snapshot()['activeId'];service.action({'action':'end','sessionId':sid});self.observe();self.assertIsNone(service.snapshot()['activeId'])
        self.observe(self.payload(source='https://www.youtube.com/watch?v=newstreamid',video='https://www.youtube.com/watch?v=newstreamid'));self.assertIsNotNone(service.snapshot()['activeId'])
    def test_pause_persists(self):
        service.action({'action':'automation','enabled':False});service.initialize();self.observe();self.assertIsNone(service.snapshot()['activeId'])
    def test_zero_viewers_is_real_and_repeated_samples_deduplicate(self):
        self.observe();p=self.payload(viewers=0,viewersAt=self.now);self.observe(p);self.observe(p)
        row=service.snapshot()['automation']['viewers'][0];self.assertEqual(row['samples'],1);self.assertEqual(row['latest'],0)
    def test_missing_stale_and_foreign_viewers_not_used(self):
        self.observe()
        for changes in [{'viewers':None,'viewersAt':self.now},{'viewers':900,'viewersAt':self.now-200},{'viewers':900,'viewersAt':self.now,'source':'different-room'}]:self.observe(self.payload(**changes))
        self.assertEqual(service.snapshot()['automation']['viewers'],[])
    def test_first_buffered_message_is_kept(self):
        p=self.payload();p['items']=[{'id':1,'eventId':'source-event-1','source':p['youtube']['source'],'t':self.now-2,'p':'yt','u':'buyer','m':'How much?','k':'chat'}]
        service.ingest(p,self.now);p['items'][0]['id']=200;p['items'][0]['t']=self.now;service.ingest(p,self.now)
        self.assertEqual(service.snapshot()['metrics']['messages'],1)
    def test_previous_room_events_are_rejected(self):
        self.observe();p=self.payload();p['items']=[{'id':1,'source':'old-room','t':self.now,'p':'yt','u':'buyer','m':'How much?','k':'chat'}];service.ingest(p,self.now)
        self.assertEqual(service.snapshot()['metrics']['messages'],0)
    def test_youtube_archive_is_not_live_even_if_isLive_true(self):
        p={'videoDetails':{'videoId':'abcdefghijk','channelId':YOUTUBE_CHANNEL,'isLive':True},'microformat':{'playerMicroformatRenderer':{'liveBroadcastDetails':{'isLiveNow':False,'endTimestamp':'2026-09-21T01:00:00Z'}}}}
        self.assertIs(youtube_page('var ytInitialPlayerResponse = '+json.dumps(p))['liveNow'],False)
    def test_partial_youtube_player_never_proves_offline(self):
        p={'videoDetails':{'videoId':'abcdefghijk','channelId':YOUTUBE_CHANNEL}}
        self.assertIsNone(youtube_page('var ytInitialPlayerResponse = '+json.dumps(p))['liveNow'])
    def test_profile_lifetime_sales_do_not_enter_gross_sales(self):
        self.observe()
        with service.db() as c:automatic.profile(c,{'publicStatus':'connected','profile':{'handle':'treasure_hauls','followers':68,'sold':97,'observedAt':self.now}},self.now)
        self.assertEqual(service.snapshot()['metrics']['salesCents'],0)
        self.assertEqual(service.snapshot()['automation']['profileHistory'][0]['sold'],97)

class YouTubeApiTests(unittest.TestCase):
    def test_owner_api_confirms_only_live_broadcasts(self):
        api=YouTubeLive();api.token='test';api.expires=time.time()+60
        for status,expected in [('live',True),('testing',False),('complete',False)]:
            def handler(request):
                return httpx.Response(200,json={'items':[{'id':'abcdefghijk','snippet':{'channelId':YOUTUBE_CHANNEL,'title':'Auction'},'status':{'lifeCycleStatus':status}}]})
            client=httpx.Client(transport=httpx.MockTransport(handler))
            with patch('youtube_metrics.httpx.Client',return_value=client):self.assertIs(api.status()['liveNow'],expected)
    def test_owner_api_rejects_wrong_channel(self):
        api=YouTubeLive();api.token='test';api.expires=time.time()+60
        client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'items':[{'snippet':{'channelId':'other'},'status':{'lifeCycleStatus':'live'}}]})))
        with patch('youtube_metrics.httpx.Client',return_value=client),self.assertRaises(ValueError):api.status()
    def test_api_failure_is_not_offline(self):
        api=YouTubeLive();api.token='test';api.expires=time.time()+60
        client=httpx.Client(transport=httpx.MockTransport(lambda r:httpx.Response(403,json={'error':'quota'})))
        with patch('youtube_metrics.httpx.Client',return_value=client),self.assertRaises(httpx.HTTPStatusError):api.status()

class YouTubeAudienceTests(unittest.IsolatedAsyncioTestCase):
    async def test_actual_zero_is_saved_but_total_views_never_used(self):
        for live,expected in [({'concurrentViewers':'0'},0),({},None),({'concurrentViewers':'12','actualEndTime':'2026-09-21'},None)]:
            api=YouTubeMetrics();api.token='test';api.expires=time.time()+60
            meta={'liveNow':True,'channelId':YOUTUBE_CHANNEL,'video':'https://www.youtube.com/watch?v=abcdefghijk'}
            client=httpx.AsyncClient(transport=httpx.MockTransport(lambda r:httpx.Response(200,json={'items':[{'snippet':{'channelId':YOUTUBE_CHANNEL},'statistics':{'viewCount':'99999'},'liveStreamingDetails':live}]})))
            with patch('youtube_metrics.httpx.AsyncClient',return_value=client):await api.collect(meta)
            self.assertEqual(meta['viewers'],expected)

if __name__=='__main__':unittest.main()
