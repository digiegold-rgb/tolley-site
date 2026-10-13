"""Read-only Apple database extraction. Only selected one-to-one threads expose bodies.
Invoked over SSH with base64 JSON arguments; never opens Messages UI or sends.
"""
import base64, datetime, json, os, re, sqlite3, sys, tempfile, subprocess
args=json.loads(base64.b64decode(sys.argv[1]))
def db(path):
    c=sqlite3.connect('file:'+os.path.expanduser(path)+'?mode=ro', uri=True, timeout=10);c.row_factory=sqlite3.Row;return c
c=db('~/Library/Messages/chat.db')
def date(v): return datetime.datetime.fromtimestamp((v or 0)/1e9+978307200,datetime.timezone.utc).isoformat()
def phone(v):
    n=re.sub(r'\D','',v or '')
    return '+1'+n if len(n)==10 else '+'+n if len(n)==11 and n[0]=='1' else None
if args['mode']=='candidates':
    rows=c.execute('''SELECT c.guid,c.chat_identifier,max(m.date) AS last_date FROM chat c
    JOIN chat_message_join j ON j.chat_id=c.ROWID JOIN message m ON m.ROWID=j.message_id
    WHERE (SELECT count(*) FROM chat_handle_join h WHERE h.chat_id=c.ROWID)=1
    GROUP BY c.ROWID HAVING last_date > ? ORDER BY last_date DESC LIMIT 500''',((datetime.datetime.now().timestamp()-30*86400-978307200)*1e9,)).fetchall()
    print(json.dumps({'threads':[{'id':r['guid'],'phone':phone(r['chat_identifier']),'lastMessageAt':date(r['last_date'])} for r in rows if phone(r['chat_identifier'])]}));sys.exit()
thread=c.execute('SELECT ROWID,chat_identifier FROM chat WHERE guid=? AND (SELECT count(*) FROM chat_handle_join h WHERE h.chat_id=chat.ROWID)=1',(args['threadId'],)).fetchone()
if not thread or phone(thread['chat_identifier']) != args['phone']: raise ValueError('Selected thread does not match phone')
if args['mode']=='attachment':
    row=c.execute('''SELECT a.filename,a.mime_type,a.transfer_name,a.total_bytes FROM attachment a JOIN message_attachment_join ma ON ma.attachment_id=a.ROWID JOIN chat_message_join cm ON cm.message_id=ma.message_id WHERE a.guid=? AND cm.chat_id=? LIMIT 1''',(args['guid'],thread['ROWID'])).fetchone()
    if not row or not row['filename']: raise FileNotFoundError('Attachment not downloaded')
    path=os.path.realpath(os.path.expanduser(row['filename']));root=os.path.realpath(os.path.expanduser('~/Library/Messages/Attachments'))
    if not path.startswith(root+os.sep): raise ValueError('Attachment outside Messages')
    if args.get('preview'):
        with tempfile.TemporaryDirectory(prefix='tolley-photo-') as tmp:
            target=os.path.join(tmp,'preview.jpg')
            subprocess.run(['/usr/bin/sips','-s','format','jpeg','-Z','1200',path,'--out',target],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=30)
            data=open(target,'rb').read()
    else:
        if os.path.getsize(path)>4000000: raise ValueError('Attachment exceeds 4MB upload limit')
        data=open(path,'rb').read()
    sys.stdout.buffer.write(data);sys.exit()
checkpoint=int(args.get('after',0));scan=int(args.get('scan',0));recent=(datetime.datetime.now().timestamp()-7*86400-978307200)*1e9
rows=c.execute('''SELECT m.* FROM message m JOIN chat_message_join cm ON cm.message_id=m.ROWID WHERE cm.chat_id=? AND (m.ROWID>? OR m.date>? OR m.date_edited>? OR m.date_retracted>?) AND m.ROWID>? ORDER BY m.ROWID LIMIT 100''',(thread['ROWID'],checkpoint,recent,recent,recent,scan)).fetchall()
events=[]
for r in rows:
    atts=c.execute('''SELECT a.guid,a.filename,a.mime_type,a.transfer_name,a.total_bytes FROM attachment a JOIN message_attachment_join ma ON ma.attachment_id=a.ROWID WHERE ma.message_id=?''',(r['ROWID'],)).fetchall()
    events.append({'guid':r['guid'],'rowId':r['ROWID'],'at':date(r['date']),'body':r['text'],'attributed':base64.b64encode(r['attributedBody']).decode() if r['attributedBody'] and len(r['attributedBody'])<=2000000 else None,'direction':'out' if r['is_from_me'] else 'in','service':r['service'],'kind':'reaction' if r['associated_message_type'] else 'message','reactionTo':r['associated_message_guid'],'edited':bool(r['date_edited']),'retracted':bool(r['date_retracted']),'attachments':[{'guid':a['guid'],'name':a['transfer_name'] or 'Customer photo','mime':a['mime_type'],'size':a['total_bytes'],'downloaded':bool(a['filename'] and os.path.isfile(os.path.expanduser(a['filename'])))} for a in atts]})
calls=[]
try:
    callsdb=db('~/Library/Application Support/CallHistoryDB/CallHistory.storedata')
    for r in callsdb.execute('SELECT ZUNIQUE_ID,ZADDRESS,ZDATE,ZORIGINATED,ZANSWERED,ZDURATION FROM ZCALLRECORD WHERE ZADDRESS IN (?,?)',(args['phone'],args['phone'][2:])):
        calls.append({'guid':'call:'+str(r['ZUNIQUE_ID']),'at':date(r['ZDATE']*1e9),'kind':'call','direction':'out' if r['ZORIGINATED'] else 'in','service':'Phone','answered':bool(r['ZANSWERED']),'duration':r['ZDURATION'],'attachments':[]})
except sqlite3.OperationalError as e: raise RuntimeError('Call history unavailable') from e
print(json.dumps({'events':events,'calls':calls,'hasMore':len(rows)==100,'after':max([checkpoint]+[r['ROWID'] for r in rows]),'scan':max([scan]+[r['ROWID'] for r in rows])}))
