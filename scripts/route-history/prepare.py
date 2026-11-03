"""Prepare a private ZIP of PDFs. Never overwrite a different file or follow archive paths."""
import os,sys,pathlib,zipfile,hashlib,json,subprocess
root=pathlib.Path(os.environ['ROUTE_ARCHIVE_DIR']); source=root/'source'
for name in ['source','pages','extracted','verified']:(root/name).mkdir(parents=True,exist_ok=True)
archive=pathlib.Path(sys.argv[1])
with zipfile.ZipFile(archive) as z:
 for info in z.infolist():
  if info.is_dir() or not info.filename.lower().endswith('.pdf'):continue
  name=pathlib.PurePosixPath(info.filename).name
  if name.startswith('._'):continue
  data=z.read(info);target=source/name
  if target.exists() and target.read_bytes()!=data:raise ValueError(f'Conflicting archive filename: {name}')
  target.write_bytes(data);target.chmod(0o600)
(root/'archive-metadata.json').write_text(json.dumps({'name':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}))
rows=[]
for p in sorted(source.glob('*.pdf')):
 r=subprocess.run(['pdfinfo',str(p)],capture_output=True,text=True,timeout=30)
 count=next((int(line.split(':')[1]) for line in r.stdout.splitlines() if line.startswith('Pages:')),0)
 rows.append(dict(file=p.name,pages=count,sha256=hashlib.sha256(p.read_bytes()).hexdigest(),size=p.stat().st_size))
(root/'inventory.json').write_text(json.dumps(rows,indent=2))
print(json.dumps({'files':len(rows),'pages':sum(r['pages'] for r in rows),'unreadable':[r['file'] for r in rows if not r['pages']]}))
