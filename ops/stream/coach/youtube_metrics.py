"""Read-only audience measurements via the owner's existing YouTube connection."""
import re
import time
from pathlib import Path
import httpx
from source_metadata import YOUTUBE_CHANNEL

class YouTubeLive:
    """Owner-verified live discovery; no public search or broadcast mutations."""
    def __init__(self):self.token=None;self.expires=0
    def status(self,override=''):
        with httpx.Client(timeout=12) as client:
            if time.time()>=self.expires:
                env={}
                for line in (Path.home()/'.openclaw/workspace-socialite/credentials/youtube.env').read_text().splitlines():
                    if '=' in line and not line.startswith('#'):
                        k,v=line.split('=',1);env[k.strip()]=v.strip()
                r=client.post('https://oauth2.googleapis.com/token',data={'client_id':env['YOUTUBE_CLIENT_ID'],'client_secret':env['YOUTUBE_CLIENT_SECRET'],'refresh_token':env['YOUTUBE_REFRESH_TOKEN'],'grant_type':'refresh_token'})
                r.raise_for_status();token=r.json()['access_token']
                r=client.get('https://www.googleapis.com/youtube/v3/channels',headers={'Authorization':'Bearer '+token},params={'part':'id','mine':'true'});r.raise_for_status()
                if [i['id'] for i in r.json().get('items',[])]!=[YOUTUBE_CHANNEL]:raise ValueError('Channel mismatch')
                self.token=token;self.expires=time.time()+3000
            r=client.get('https://www.googleapis.com/youtube/v3/liveBroadcasts',headers={'Authorization':'Bearer '+self.token},params={'part':'snippet,status','broadcastStatus':'active','broadcastType':'all','maxResults':50})
            r.raise_for_status()
            items=r.json().get('items',[])
            if any(i.get('snippet',{}).get('channelId')!=YOUTUBE_CHANNEL for i in items):raise ValueError('Channel mismatch')
            live=[i for i in items if i.get('status',{}).get('lifeCycleStatus')=='live']
            if override:live=[i for i in live if override==f'https://www.youtube.com/watch?v={i["id"]}']
            if len(live)>1:raise ValueError('Multiple live shows; select a video')
            if not live:return {'verified':True,'liveNow':False,'channelId':YOUTUBE_CHANNEL,'error':''}
            item=live[0];url=f'https://www.youtube.com/watch?v={item["id"]}'
            return {'video':url,'source':url,'title':item['snippet'].get('title','YouTube live show')[:120],
                    'channelId':YOUTUBE_CHANNEL,'verified':True,'liveNow':True,'error':''}

class YouTubeMetrics:
    def __init__(self):self.token=None;self.expires=0;self.last_video=None;self.last_at=0;self.cached={}
    async def collect(self,meta):
        if meta.get('liveNow') is not True or meta.get('channelId')!=YOUTUBE_CHANNEL:return
        match=re.search(r'v=([A-Za-z0-9_-]{11})',meta.get('video',''))
        if not match:return
        now=time.time();video=match[1]
        if video==self.last_video and now-self.last_at<30:
            meta.update(self.cached);return
        self.last_video=video;self.last_at=now
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                if now>=self.expires:
                    path=Path.home()/'.openclaw/workspace-socialite/credentials/youtube.env'
                    env={}
                    for line in path.read_text().splitlines():
                        if '=' in line and not line.startswith('#'):
                            k,v=line.split('=',1);env[k.strip()]=v.strip()
                    r=await client.post('https://oauth2.googleapis.com/token',data={'client_id':env['YOUTUBE_CLIENT_ID'],'client_secret':env['YOUTUBE_CLIENT_SECRET'],'refresh_token':env['YOUTUBE_REFRESH_TOKEN'],'grant_type':'refresh_token'})
                    r.raise_for_status();token=r.json()['access_token']
                    headers={'Authorization':'Bearer '+token}
                    r=await client.get('https://www.googleapis.com/youtube/v3/channels',headers=headers,params={'part':'id','mine':'true'});r.raise_for_status()
                    if [i['id'] for i in r.json().get('items',[])]!=[YOUTUBE_CHANNEL]:raise ValueError('Channel mismatch')
                    self.token=token;self.expires=now+3000
                r=await client.get('https://www.googleapis.com/youtube/v3/videos',headers={'Authorization':'Bearer '+self.token},params={'part':'snippet,liveStreamingDetails','id':video});r.raise_for_status()
                item=r.json()['items'][0]
                if item['snippet']['channelId']!=YOUTUBE_CHANNEL:raise ValueError('Channel mismatch')
                live=item.get('liveStreamingDetails',{})
                value=live.get('concurrentViewers')
                if live.get('actualEndTime') or value is None:
                    self.cached={'viewers':None,'viewersAt':None,'metricsStatus':'unavailable'}
                else:
                    self.cached={'viewers':int(value),'viewersAt':now,'metricsStatus':'connected'}
        except Exception:
            self.cached={'viewers':None,'viewersAt':None,'metricsStatus':'unavailable'}
        meta.update(self.cached)
