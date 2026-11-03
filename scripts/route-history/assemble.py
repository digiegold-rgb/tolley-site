import os
import pathlib,json,re,datetime,hashlib,collections
ROOT=pathlib.Path(os.environ['ROUTE_ARCHIVE_DIR'])
def readpages(folder):return {p['source']['id']:p for f in (ROOT/folder).glob('*.json') for p in json.loads(f.read_text())['pages']}
def parsedate(s):
 m=re.search(r'\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b',s or '')
 if not m:return None
 try:return datetime.date(int(m[3])+(2000 if len(m[3])==2 else 0),int(m[1]),int(m[2])).isoformat()
 except:return None
def weight(s):
 m=re.search(r'\d[\d,]*(?:\.\d+)?',s or '');return float(m[0].replace(',','')) if m else None
def norm(s):return re.sub(r'[^A-Z0-9]','',(s or '').upper())
def canonical(a):
 a=re.sub(r'ATTN[:\s][^0-9]*','',a.upper());a=re.sub(r'\b(\d{5})-\d{4}\b',r'\1',a);a=re.sub(r'[^A-Z0-9 ]',' ',a);a=re.sub(r'\s+',' ',a).strip()
 for x,y in [('STREET','ST'),('ROAD','RD'),('AVENUE','AVE'),('BOULEVARD','BLVD'),('DRIVE','DR'),('PARKWAY','PKWY'),('HIGHWAY','HWY'),('NORTH','N'),('SOUTH','S'),('WEST','W'),('EAST','E')]:a=re.sub(r'\b'+x+r'\b',y,a)
 return a
if __name__=='__main__':
 ps=readpages('extracted');vs=readpages('verified');sources=json.loads((ROOT/'pages.json').read_text());inventory=json.loads((ROOT/'inventory.json').read_text());geos=json.loads((ROOT/'geocodes.json').read_text());manual=json.loads((ROOT/'manual-review.json').read_text()) if (ROOT/'manual-review.json').exists() else {}
 if len(vs)!=len(ps):raise Exception(f'Verification incomplete {len(vs)}/{len(ps)}')
 records=[];conflicts=[];unrelated=0;byImage=collections.defaultdict(list)
 for s in sources:byImage[s.get('duplicateOf',s['id'])].append({k:s[k] for k in ['file','page','sha256']})
 for key,p in ps.items():
  v=vs[key]; d=(p.get('deliveries') or [{}])[0]
  if v['kind'] not in ['delivery','continuation'] or not v.get('destination'):
   unrelated+=len(byImage[key]);continue
  supplier=v.get('supplier') or d.get('supplier') or 'Unknown'
  supplier='Buckeye' if supplier.lower() in ['buckeye','cleaning centers'] else 'Aramsco' if 'aramsco' in supplier.lower() else supplier
  addr=canonical(v.get('address') or d.get('address') or '');geo=geos.get(addr)
  if geo and geo.get('partial'):geo=None
  issues=[]; basis='shipped';ship=parsedate(v.get('shipDateRaw'));first=parsedate(d.get('rawDate'));received=parsedate(v.get('receivedDateRaw'));date=ship;raw=v.get('shipDateRaw')
  if d.get('dateBasis')=='delivered' and received and first==received:date=received;raw=v['receivedDateRaw'];basis='delivered'
  elif d.get('dateBasis')=='shipped' and first and ship and first!=ship:
   conflicts.append({'id':key,'field':'date','first':first,'second':ship,'file':p['source']['file']});issues.append('Date: independent readings disagree; needs review.');date=None;basis='unknown'
  if date and not ('2000-01-01'<=date<=datetime.date.today().isoformat()):
   conflicts.append({'id':key,'field':'date-outlier','first':first,'second':date,'file':p['source']['file']});issues.append('Date: printed year needs review.');date=None;basis='unknown'
  if not date and not issues:issues.append('Date: no confirmed delivery or ship date.');basis='unknown'
  wt=weight(v.get('weightRaw'));firstwt=d.get('weight');rawWeight=v.get('weightRaw')
  if wt is not None and firstwt is not None and abs(wt-firstwt)>0.01:
   conflicts.append({'id':key,'field':'weight','first':firstwt,'second':wt,'file':p['source']['file']});issues.append('Weight: independent readings disagree.');wt=None
  if wt is not None and supplier!='Buckeye' and not re.search(r'\b(lb|lbs|pound|pounds)\b',rawWeight or '',re.I):wt=None
  if wt is None:issues.append('Weight: total pounds not printed or not readable.')
  if not geo or geo['precision'] not in ['ROOFTOP','RANGE_INTERPOLATED','address','street']:issues.append('Map: precise destination coordinates unavailable.')
  order=v.get('orderNumber') or d.get('orderNumber');doc=v.get('documentNumber') or d.get('documentNumber')
  if supplier=='Aramsco':doc=doc or order;order=doc
  r=dict(id=key,supplier=supplier,destination=v.get('destination') or d.get('destination') or '',address=addr,city=v.get('city') or d.get('city') or '',state=v.get('state') or d.get('state') or '',zip=v.get('zip') or d.get('zip') or '',date=date,dateBasis=basis,rawDate=raw,weightLbs=wt,rawWeight=rawWeight,documentNumber=doc,orderNumber=order,lat=geo['lat'] if geo else None,lng=geo['lng'] if geo else None,geoPrecision=geo['precision'] if geo else None,sources=byImage[key],issues=issues,notes='',_type=d.get('documentType',''),_page=p['source']['page'])
  if key in manual:
   r.update(manual[key]);r['issues']=[i for i in r['issues'] if not ('date' in manual[key] and i.startswith('Date:')) and not ('weightLbs' in manual[key] and i.startswith('Weight:'))]
  if r['date'] and 'WESCO' in r['destination'].upper() and r['date']=='2026-10-28':r['routingNote']='Wesco first · closes at noon (driver confirmed)'
  records.append(r)
 # Same printed shipment ID across scans/continuations. Do not merge distinct orders merely because destination/date match.
 grouped=collections.defaultdict(list)
 for r in records:
  key=r['supplier']+'|'+('doc:'+norm(r['documentNumber']) if r['documentNumber'] else 'page:'+r['id'])
  grouped[key].append(r)
 out=[]
 for key,rr in grouped.items():
  r=dict(rr[0]);r['id']=hashlib.sha256(key.encode()).hexdigest()[:24];r['sources']=list({(s['file'],s['page']):s for x in rr for s in x['sources']}.values());r['issues']=sorted(set(i for x in rr for i in x['issues']))
  dates=set(x['date'] for x in rr if x['date']);weights=set(x['weightLbs'] for x in rr if x['weightLbs'] is not None)
  if len(dates)==1:r['date']=next(iter(dates));r['dateBasis']=next(x['dateBasis'] for x in rr if x['date']==r['date']);r['rawDate']=next(x['rawDate'] for x in rr if x['date']==r['date']);r['issues']=[i for i in r['issues'] if not i.startswith('Date:')]
  elif len(dates)>1:r['date']=None;r['dateBasis']='unknown';r['issues'].append('Date: repeated shipment pages have conflicting dates.');conflicts.append({'id':key,'field':'groupdate','values':list(dates),'pages':[x['id'] for x in rr]})
  if len(weights)==1:r['weightLbs']=next(iter(weights));r['rawWeight']=next(x['rawWeight'] for x in rr if x['weightLbs']==r['weightLbs']);r['issues']=[i for i in r['issues'] if not i.startswith('Weight:')]
  elif len(weights)>1:r['weightLbs']=None;r['issues'].append('Weight: shipment pages disagree; total requires review.');conflicts.append({'id':key,'field':'groupweight','values':list(weights),'pages':[x['id'] for x in rr]})
  r['_members']=[x['id'] for x in rr];out.append(r)
 # Find supporting BOL + packing-list pairs by same supplier/order/date. Flag instead of counting twice.
 orders=collections.defaultdict(list)
 for r in out:
  if r['orderNumber'] and r['date']:orders[(r['supplier'],norm(r['orderNumber']),r['date'])].append(r)
 for key,rr in orders.items():
  if len(rr)>1:conflicts.append({'id':'|'.join(key),'field':'multiple_documents_order','docs':[(r['documentNumber'],r['_type'],r['weightLbs'],r['address'],r['_members']) for r in rr]})
 (ROOT/'assembly-conflicts.json').write_text(json.dumps(conflicts,indent=2));(ROOT/'assembly-details.json').write_text(json.dumps(out,indent=2))
 for r in out:
  for k in list(r):
   if k.startswith('_'):del r[k]
 archive=dict(version=1,importedAt=datetime.datetime.now(datetime.timezone.utc).isoformat(),sourceArchive=json.loads((ROOT/'archive-metadata.json').read_text()).get('name','Delivery archive') if (ROOT/'archive-metadata.json').exists() else os.environ.get('ROUTE_ARCHIVE_NAME','Delivery archive'),files=len(inventory),pages=sum(x['pages'] for x in inventory),duplicatePages=sum(len(r['sources'])-1 for r in out),unrelatedPages=unrelated,unreadableFiles=[x['file'] for x in inventory if not x['pages']],deliveries=out)
 (ROOT/'archive.json').write_text(json.dumps(archive,indent=2)); print('Orders',len(out),'dateKnown',sum(bool(r['date']) for r in out),'weightKnown',sum(r['weightLbs'] is not None for r in out),'pounds',sum(r['weightLbs'] or 0 for r in out),'date range',min(r['date'] for r in out if r['date']),max(r['date'] for r in out if r['date']));print('conflicts',len(conflicts),collections.Counter(c['field'] for c in conflicts));print('suppliers',collections.Counter(r['supplier'] for r in out))
