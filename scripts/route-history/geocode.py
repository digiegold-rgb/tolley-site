import os
import pathlib,json,re,time,urllib.request,urllib.parse
ROOT=pathlib.Path(os.environ['ROUTE_ARCHIVE_DIR']);cachefile=ROOT/'geocodes.json';cache=json.loads(cachefile.read_text()) if cachefile.exists() else {}
key=os.environ.get('GOOGLE_MAPS_API_KEY','')
ps=[p for f in (ROOT/'extracted').glob('*.json') for p in json.loads(f.read_text())['pages']]
def canonical(a):
 a=re.sub(r'ATTN[:\s][^0-9]*','',a.upper());a=re.sub(r'\b(\d{5})-\d{4}\b',r'\1',a);a=re.sub(r'[^A-Z0-9 ]',' ',a);a=re.sub(r'\s+',' ',a).strip()
 for x,y in [('STREET','ST'),('ROAD','RD'),('AVENUE','AVE'),('BOULEVARD','BLVD'),('DRIVE','DR'),('PARKWAY','PKWY'),('HIGHWAY','HWY'),('NORTH','N'),('SOUTH','S'),('WEST','W'),('EAST','E')]:a=re.sub(r'\b'+x+r'\b',y,a)
 return a
input_rows=json.loads((ROOT/'archive.json').read_text())['deliveries'] if (ROOT/'archive.json').exists() else [d for p in ps for d in p.get('deliveries',[])]
addresses=sorted(set(canonical(d['address']) for d in input_rows if d.get('address')))
print('Addresses',len(addresses),'Google configured',bool(key),flush=True)
for i,a in enumerate(addresses):
 if a in cache:continue
 geo=None
 if key:
  try:
   with urllib.request.urlopen('https://maps.googleapis.com/maps/api/geocode/json?'+urllib.parse.urlencode({'address':a,'key':key}),timeout=20) as r:j=json.load(r)
   if j.get('results'):
    x=j['results'][0];g=x['geometry'];geo=dict(lat=g['location']['lat'],lng=g['location']['lng'],precision=g['location_type'],formatted=x['formatted_address'],partial=x.get('partial_match',False))
   elif j.get('status')=='REQUEST_DENIED':key=''
  except Exception:pass
 if not geo:
  time.sleep(1.1)
  try:
   req=urllib.request.Request('https://nominatim.openstreetmap.org/search?'+urllib.parse.urlencode({'q':a,'format':'jsonv2','limit':1,'countrycodes':'us','addressdetails':1}),headers={'User-Agent':'TolleyRouteHistory/1.0 (jared@yourkchomes.com)'})
   with urllib.request.urlopen(req,timeout=20) as r:res=json.load(r)
   if res:
    x=res[0];ad=x.get('address',{});prec='address' if ad.get('house_number') else 'street' if x.get('addresstype') in ['road','street'] else 'approximate';geo=dict(lat=float(x['lat']),lng=float(x['lon']),precision=prec,formatted=x['display_name'],partial=False)
  except Exception:pass
 cache[a]=geo;cachefile.write_text(json.dumps(cache,indent=2));print(i+1,len(addresses),'matched' if geo else 'unmatched',flush=True)
