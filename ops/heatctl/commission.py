"""One supervised cutover verification. No test temperature excursion."""
import asyncio,fcntl,json,time
from common import ROOT,load,atomic,stamp
from io_live import HouseIO
from journal import Journal

async def main():
    gate=load(ROOT/'cutover.json',{}) or {}
    if not all(gate.get(k) is True for k in ('owner_go','cloud_control_jobs_paused','cloud_nest_refresh_stopped')):
        raise SystemExit('Commissioning requires owner go and confirmed retirement of competing cloud controls.')
    if load(ROOT/'heatctl.json',{}).get('mode')!='shadow':
        raise SystemExit('Commission only with the continuous controller stopped in shadow mode.')
    with (ROOT/'controller.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        backend=HouseIO();journal=Journal();result={'started_at':stamp(time.time()),'ok':False}
        try:
            result['step']='poll'
            for attempt in range(3):
                await backend.poll()
                if backend.hw.device is not None and backend.last.get('nest_ok'):break
                if attempt<2:await asyncio.sleep(15*(attempt+1))
            result['step']='initial_readback'
            before={n:await backend.read_device(n) for n in ('honeywell','nest')}
            result['before']=before
            # Stop water first; then return the furnace blower to AUTO.
            result['step']='humidifier_off';await backend.humidifier(False)
            result['step']='fan_auto';await backend.write_device('honeywell',{'fan':'auto'})
            await asyncio.sleep(20)
            result['step']='fan_readback';hw=await backend.read_device('honeywell')
            assert hw['fan']=='auto' and hw['fresh'],'Fan AUTO readback failed'
            journal.emit({'kind':'write_attempt','mode':'live','season':'heat','device':'honeywell','attempt':1,
                'desired':{'fan':'auto'},'result':'ok','readback_ok':True,'why':'Owner-approved cutover: furnace fan AUTO verified.'})
            # Exercise the pinned Nest command path using its current target.
            # Do not provoke a heat cycle merely to test the API.
            desired={k:before['nest'][k] for k in ('mode','heat_sp') if before['nest'].get(k) is not None}
            result['step']='nest_command';await backend.write_device('nest',desired)
            await asyncio.sleep(20)
            result['step']='nest_readback';nest=await backend.read_device('nest')
            assert nest['fresh'] and nest['mode']==desired['mode'],'Nest mode readback failed'
            if 'heat_sp' in desired:assert abs(nest['heat_sp']-desired['heat_sp'])<0.4,'Nest target readback failed'
            journal.emit({'kind':'write_attempt','mode':'live','season':'heat','device':'nest','attempt':1,
                'desired':desired,'result':'ok','readback_ok':True,'why':'Cutover command-path check at the existing target; no temperature excursion.'})
            result.update(ok=True,after={'honeywell':hw,'nest':nest,'humidifier_on':False},finished_at=stamp(time.time()))
            state=load(ROOT/'state.json',{})
            # Include commissioning sends in the same hourly write budget.
            for name,reading in (('honeywell',hw),('nest',nest)):
                state.setdefault('actuator',{}).setdefault(name,{'writes':[]})['writes'].append(time.time())
                state.setdefault('confirmed',{})[name]={k:reading[k] for k in ('heat_sp','mode','fan') if k in reading}
            atomic(ROOT/'state.json',state)
            gate=load(ROOT/'cutover.json',{});gate.update(commissioning='passed',commissioned_at=stamp(time.time()))
            atomic(ROOT/'cutover.json',gate)
        except Exception as exc:
            result['error']=type(exc).__name__
            if hasattr(exc,'code'):result['http_status']=exc.code
            if hasattr(exc,'read'):
                try:
                    error=json.loads(exc.read()).get('error',{})
                    result['api_error_status']=error.get('status')
                    result['api_error_message']=error.get('message','')[:200]
                except Exception:pass
            try:await backend.humidifier(False)
            except Exception:result['humidifier_off_retry']='failed'
        finally:
            atomic(ROOT/'commissioning-result.json',result)
            await backend.close();journal.db.close()
        print(json.dumps(result,indent=2))
        if not result['ok']:raise SystemExit(1)

if __name__=='__main__':asyncio.run(main())
