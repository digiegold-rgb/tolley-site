"""Strict live-source parsing. A past broadcast must never start automatic tracking."""
import json
import re
from datetime import datetime, timezone

YOUTUBE_CHANNEL = 'UCd4bJKIvbGOIAT-GK4K-3_w'

def youtube_page(html):
    for match in re.finditer(r'(?:var\s+)?ytInitialPlayerResponse\s*=\s*', html):
        try:
            p,_ = json.JSONDecoder().raw_decode(html[match.end():])
            details=p.get('videoDetails') or {}
            live=(p.get('microformat') or {}).get('playerMicroformatRenderer',{}).get('liveBroadcastDetails') or {}
            vid=details.get('videoId','')
            if not re.fullmatch(r'[a-zA-Z0-9_-]{11}',vid):continue
            owner=details.get('channelId')
            is_live=live.get('isLiveNow') is True and not live.get('endTimestamp')
            started=None
            try:started=datetime.fromisoformat(live['startTimestamp'].replace('Z','+00:00')).timestamp()
            except (ValueError,KeyError,TypeError):pass
            return {'video':f'https://www.youtube.com/watch?v={vid}','source':f'https://www.youtube.com/watch?v={vid}',
                    'title':str(details.get('title','YouTube live show'))[:120], 'channelId':owner,
                    'verified':owner==YOUTUBE_CHANNEL, 'liveNow':bool(is_live and owner==YOUTUBE_CHANNEL),
                    'startedAt':started}
        except (ValueError,TypeError,AttributeError):continue
    # Absence of a recognized player is unknown, never proof a running show ended.
    return {'liveNow':None,'verified':False}

def source_id(platform,meta):
    if platform=='yt':return meta.get('source') or meta.get('video')
    if platform=='tt':return meta.get('source') or meta.get('user')
    return meta.get('source')
