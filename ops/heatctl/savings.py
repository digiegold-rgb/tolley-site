"""Observed comfort and marginal-cost accounting; never changes heat settings."""
from datetime import datetime
from common import TZ, stamp, number, fresh


def update(daily, previous, event, obs, cfg, now):
    dt=datetime.fromtimestamp(now,TZ)
    wake_text=cfg['weekend_wake'] if dt.weekday()>=5 else cfg['wake']
    wh,wm=map(int,wake_text.split(':'))
    wake=dt.replace(hour=wh,minute=wm,second=0,microsecond=0).timestamp()
    eh,em=map(int,cfg['earliest_warmup'].split(':'))
    start=dt.replace(hour=eh,minute=em,second=0,microsecond=0).timestamp()
    s=daily.setdefault('savings',{'version':1,'coverage_since':stamp(now),
        'comfort_observed_min':0,'below_target_min':0,'shortfall_degree_h':0,
        'above_target_degree_h':0,'morning':{'start':stamp(start),'end':stamp(wake),
            'observed_h':0,'upstairs_h':0,'nest_h':0,'basement_min_f':None,'basement_max_f':None}})
    m=s['morning']
    # Freeze the first warm-up forecast; never score a 06:59 prediction as a
    # prediction of the entire recovery. Explicitly label late process starts.
    if event.get('period')=='warmup' and 'prediction_at' not in s:
        s.update(prediction_at=stamp(now),prediction_f=event['plan'].get('predicted_wake_f'),
                 prediction_basis='first observed warmup decision',
                 prediction_lead_min=max(0,(wake-now)/60))
    if 0<=now-wake<=600 and 'wake_actual_f' not in s:
        temp=number(obs['sensors'].get('living_f'))
        observed_at=obs['sensors'].get('living_f_ts')
        if temp is not None and fresh(observed_at,now,300):
            target=event['plan'].get('wake_target_f')
            s.update(wake_actual_f=temp,wake_sample_at=stamp(observed_at),wake_target_f=target,
                     wake_shortfall_f=max(0,target-temp) if target is not None else None)
    if start<=now<=wake:
        basement=obs['thermostats']['nest']
        value=number(basement.get('ambient_f'))
        if basement.get('fresh') and value is not None:
            m['basement_min_f']=value if m['basement_min_f'] is None else min(value,m['basement_min_f'])
            m['basement_max_f']=value if m['basement_max_f'] is None else max(value,m['basement_max_f'])
    if previous and previous.get('date')==daily['date'] and 0<now-previous['t']<=180:
        h=(now-previous['t'])/3600;old=previous['obs'];plan=previous['event']['plan']
        f=number(old['sensors'].get('living_f'));target=number(plan.get('target_f'))
        if (f is not None and target is not None and previous['event']['period'] in ('day','evening')
                and fresh(old['sensors'].get('living_f_ts'),previous['t'],cfg['sensor_max_age_s'])):
            s['comfort_observed_min']+=h*60
            s['below_target_min']+=h*60*(f<target)
            s['shortfall_degree_h']+=h*max(0,target-f)
            s['above_target_degree_h']+=h*max(0,f-target)
        mh=max(0,min(now,wake)-max(previous['t'],start))/3600
        up,down=(old['thermostats'][k].get('calling') for k in ('honeywell','nest'))
        if up is not None and down is not None:
            m['observed_h']+=mh;m['upstairs_h']+=mh*bool(up);m['nest_h']+=mh*bool(down)
    rate=cfg['gas_usd_per_ccf']/1.037
    up_low,up_high,down=.84*rate,1.2*rate,.4*rate
    s['costs']={'basis':'Observed burner calls × assumed input ratings; not metered gas',
        'gas_usd_per_ccf':cfg['gas_usd_per_ccf'],'electric_usd_per_kwh':cfg['electric_usd_per_kwh'],
        'upstairs_usd_per_h_low':up_low,'upstairs_usd_per_h_high':up_high,'nest_usd_per_h':down,
        'upstairs_gas_usd_low':daily['upstairs_h']*up_low,
        'upstairs_gas_usd_high':daily['upstairs_h']*up_high,'nest_gas_usd':daily['nest_h']*down,
        'basement_break_even_upstairs_min_low':60*.4/1.2,
        'basement_break_even_upstairs_min_high':60*.4/.84,
        'missing':['Metered gas and furnace stage','Furnace blower electricity',
                   'Fireplace electricity and wood cost','Humidifier water/sewer price and measured flow',
                   'Verified current utility tariffs and matched comfort/weather comparison'],
        'savings_verified':False}
    m.update(gas_usd_low=m['upstairs_h']*up_low+m['nest_h']*down,
             gas_usd_high=m['upstairs_h']*up_high+m['nest_h']*down,nest_gas_usd=m['nest_h']*down)
    s['supplement']={'boost_f':cfg['supp_high'],'idle_f':cfg['supp_idle'],
                     'basis':'Fixed policy; not a demonstrated least-cost choice'}
    return s
