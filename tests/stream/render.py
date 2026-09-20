import importlib.util, json, subprocess, tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('worker',Path(__file__).resolve().parents[2]/'ops/stream/clip-worker.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 d=Path(d);source=d/'test.mp4'
 subprocess.run(['ffmpeg','-v','error','-y','-f','lavfi','-i','testsrc2=size=640x360:rate=30','-f','lavfi','-i','sine=frequency=440:duration=25','-t','25','-c:v','libx264','-threads','2','-c:a','aac',str(source)],check=True)
 video,_=m.render(source,{'start':0,'end':25},[{'start':0,'end':5,'text':'A useful garage find'},{'start':6,'end':8,'text':'oh shit'},{'start':9,'end':20,'text':'That was unexpected!'}],d)
 info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','stream=width,height:format=duration','-of','json',str(video)]))
 assert info['streams'][0]['width']==1080 and info['streams'][0]['height']==1920
 assert 24.9<float(info['format']['duration'])<25.2
 assert 'shit' not in (d/'captions.ass').read_text()
 assert '[bleep]' in (d/'captions.ass').read_text()
 print('Portrait containment, timed captions, bleep render and duration passed')
