from datetime import datetime
import math
import random
import pytest
from planner.scheduler import schedule

START = datetime(2026, 10, 5, 8)
LABELS = ['Chicago, IL', 'Indianapolis, IN', 'Dallas, TX']

def make(miles=(200, 900), cycle=0, start=START, speed=55):
    return schedule([{'miles':m, 'hours':m/speed} for m in miles], cycle, start, LABELS)

def assert_legal(plan, initial_cycle):
    cycle = initial_cycle
    shift_start = datetime.fromisoformat(plan['start']) if 'start' in plan else datetime.fromisoformat(plan['events'][0]['start'])
    driving = since_break = non_driving = 0.0
    since_fuel = 0.0
    last = None
    for e in plan['events']:
        a, b = datetime.fromisoformat(e['start']), datetime.fromisoformat(e['end'])
        assert b > a
        if last: assert a == last
        last = b
        h = (b-a).total_seconds()/3600
        if e['status'] == 'driving':
            if non_driving >= .5-1e-6: since_break = 0
            non_driving = 0
            driving += h
            since_break += h
            cycle += h
            since_fuel += e['mile_end']-e['mile_start']
            assert driving <= 11+1e-6
            assert since_break <= 8+1e-6
            assert (b-shift_start).total_seconds()/3600 <= 14+1e-6
            assert cycle <= 70+1e-6
            assert since_fuel <= 1000+1e-6
        else:
            non_driving += h
            if e['status'] == 'on_duty': cycle += h
            if e['reason'] == 'Fuel stop': since_fuel = 0
            if e['status'] in ('off_duty','sleeper') and h >= 10-1e-6:
                driving = since_break = 0
                shift_start = b
                if h >= 34-1e-6: cycle = 0
    for day in plan['days']:
        assert math.isclose(sum(day['totals'].values()), 24, abs_tol=1e-7)
        assert day['segments'][0]['start_hour'] == 0
        assert day['segments'][-1]['end_hour'] == 24
        for a,b in zip(day['segments'],day['segments'][1:]):
            assert math.isclose(a['end_hour'],b['start_hour'],abs_tol=1e-8)
    assert math.isclose(sum(d['miles'] for d in plan['days']),plan['miles'],abs_tol=.1*len(plan['days']))

@pytest.mark.parametrize('cycle', [0, 60, 69, 69.99, 70])
@pytest.mark.parametrize('miles', [(0,0),(1,1),(440,1),(605,1),(1000,1000),(2500,3000)])
def test_schedule_invariants(cycle,miles):
    assert_legal(make(miles,cycle),cycle)

def test_pickup_qualifies_as_break():
    p=make((440,55))
    assert not any(e['reason']=='30-minute driving break' for e in p['events'])
    assert p['driving_hours'] == 9

def test_delivery_is_a_full_hour():
    p=make((100,100))
    assert [e['hours'] for e in p['events'] if e['reason'] in ('Pickup','Delivery')] == [1,1]

def test_exact_eight_hours_needs_no_break_if_drive_finishes():
    p=make((0,440))
    assert not any(e['reason']=='30-minute driving break' for e in p['events'])

def test_fuel_resets_driving_break():
    p=make((0,2100))
    fuel=[e for e in p['events'] if e['reason']=='Fuel stop']
    assert [round(e['mile_start']) for e in fuel] == [1000,2000]
    assert all(e['hours']==.5 for e in fuel)

def test_cycle_70_restarts_before_work():
    p=make((100,100),70)
    assert p['events'][0]['reason']=='34-hour cycle restart'
    assert p['events'][0]['hours']==34

def test_midnight_split_preserves_mileage_and_24_hours():
    p=make((100,100),start=datetime(2026,10,5,23,45))
    assert len(p['days'])==2
    assert_legal(p,0)

def test_recap_resets_only_after_completed_restart():
    p=make((100,100),70)
    assert p['days'][0]['cycle_used_end'] == 70
    assert p['days'][1]['cycle_used_end'] < 70
    assert p['days'][-1]['cycle_used_end'] == pytest.approx(p['cycle_at_finish'],abs=.01)

def test_14_hour_window_under_slow_driving():
    p=make((300,300),speed=30)
    assert_legal(p,0)
    assert any(e['reason']=='10-hour rest' for e in p['events'])

@pytest.mark.parametrize('value', [-1,71,float('nan'),float('inf')])
def test_invalid_cycle(value):
    with pytest.raises(ValueError): make(cycle=value)

def test_varied_long_routes():
    rng=random.Random(395)
    for _ in range(100):
        c=rng.uniform(0,70)
        p=make((rng.uniform(0,3000),rng.uniform(0,3000)),c,speed=rng.uniform(25,70))
        assert_legal(p,c)
