"""Deterministic property-carrier HOS planning, independent of HTTP and maps."""
from datetime import datetime, timedelta
import math

EPS = 1e-7

def schedule(legs, cycle_used, start, labels):
    if not math.isfinite(cycle_used) or not 0 <= cycle_used <= 70:
        raise ValueError('Cycle hours must be between 0 and 70.')
    events = []
    now = start
    shift_start = start
    shift_drive = 0.0
    break_drive = 0.0
    cycle = cycle_used
    miles = 0.0
    fuel_miles = 0.0

    def add(status, duration, reason, location, distance=0):
        nonlocal now, cycle, break_drive, shift_drive, miles, fuel_miles
        if duration <= EPS:
            return
        end = now + timedelta(hours=duration)
        events.append(dict(status=status, start=now.isoformat(), end=end.isoformat(),
                           hours=duration, reason=reason, location=location,
                           mile_start=miles, mile_end=miles + distance))
        now = end
        if status in ('driving', 'on_duty'):
            cycle += duration
        if status == 'driving':
            shift_drive += duration
            break_drive += duration
            miles += distance
            fuel_miles += distance
        elif duration >= .5 - EPS:
            break_drive = 0.0

    def rest(restart=False):
        nonlocal cycle, shift_start, shift_drive, break_drive
        add('off_duty' if restart else 'sleeper', 34 if restart else 10,
            '34-hour cycle restart' if restart else '10-hour rest', 'Route mile %.1f' % miles)
        if restart:
            cycle = 0.0
        shift_start = now
        shift_drive = break_drive = 0.0

    def work(duration, reason, location):
        # Non-driving work is legal beyond 14 hours, but this planner starts a
        # fresh shift before it when necessary to keep the next drive feasible.
        if cycle + duration > 70 + EPS:
            rest(True)
        if (now - shift_start).total_seconds() / 3600 + duration > 14 + EPS:
            rest()
        add('on_duty', duration, reason, location)

    work(.25, 'Pre-trip inspection', labels[0])
    for leg_index, leg in enumerate(legs):
        remaining = float(leg['miles'])
        if remaining < 0 or not math.isfinite(remaining):
            raise ValueError('Invalid route distance.')
        hours = max(float(leg['hours']), remaining / 55)
        if not math.isfinite(hours) or hours < 0:
            raise ValueError('Invalid route duration.')
        speed = remaining / hours if hours > EPS else 55
        while remaining > EPS:
            if cycle >= 70 - EPS:
                rest(True)
                continue
            elapsed = (now - shift_start).total_seconds() / 3600
            if shift_drive >= 11 - EPS or elapsed >= 14 - EPS:
                rest()
                continue
            if fuel_miles >= 1000 - EPS:
                work(.5, 'Fuel stop', 'Route mile %.1f' % miles)
                fuel_miles = 0.0
                continue
            if break_drive >= 8 - EPS:
                add('off_duty', .5, '30-minute driving break', 'Route mile %.1f' % miles)
                continue
            duration = min(remaining / speed, 11 - shift_drive, 14 - elapsed,
                           8 - break_drive, 70 - cycle, (1000 - fuel_miles) / speed)
            distance = min(remaining, duration * speed)
            add('driving', duration, 'Drive to ' + labels[leg_index + 1],
                'Route mile %.1f' % miles, distance)
            remaining = max(0.0, remaining - distance)
        work(1, 'Pickup' if leg_index == 0 else 'Delivery', labels[leg_index + 1])
    return dict(events=events, arrival=now.isoformat(), miles=round(miles, 1),
                elapsed_hours=(now - start).total_seconds() / 3600,
                driving_hours=sum(e['hours'] for e in events if e['status'] == 'driving'),
                cycle_at_finish=round(cycle, 2), days=daily_logs(events, start, now, cycle_used))

def daily_logs(events, start, end, initial_cycle=0):
    days = []
    cycle_at_midnight = initial_cycle
    midnight = start.replace(hour=0, minute=0, second=0, microsecond=0)
    while midnight < end:
        tomorrow = midnight + timedelta(days=1)
        segments = []
        cursor = midnight
        totals = dict(off_duty=0.0, sleeper=0.0, driving=0.0, on_duty=0.0)
        miles = 0.0
        for event in events:
            a, b = datetime.fromisoformat(event['start']), datetime.fromisoformat(event['end'])
            left, right = max(a, midnight), min(b, tomorrow)
            if right <= left:
                continue
            if cursor < left:
                segments.append(dict(status='off_duty', start_hour=(cursor-midnight).total_seconds()/3600,
                                     end_hour=(left-midnight).total_seconds()/3600, reason='Off duty', location=event['location']))
            fraction = (right-left).total_seconds()/(b-a).total_seconds()
            miles += (event['mile_end']-event['mile_start'])*fraction
            if event['status'] in ('driving', 'on_duty'):
                cycle_at_midnight += (right-left).total_seconds()/3600
            if event['reason'] == '34-hour cycle restart' and b <= tomorrow:
                cycle_at_midnight = 0
            segments.append(dict(status=event['status'], start_hour=(left-midnight).total_seconds()/3600,
                                 end_hour=(right-midnight).total_seconds()/3600,
                                 reason=event['reason'], location=event['location'], event_index=events.index(event)))
            cursor = right
        if cursor < tomorrow:
            segments.append(dict(status='off_duty', start_hour=(cursor-midnight).total_seconds()/3600,
                                 end_hour=24, reason='Off duty after delivery', location=events[-1]['location']))
        for segment in segments:
            totals[segment['status']] += segment['end_hour']-segment['start_hour']
        days.append(dict(date=midnight.date().isoformat(), segments=segments, totals=totals,
                         miles=round(miles, 1), cycle_used_end=cycle_at_midnight,
                         cycle_available_end=max(0, 70-cycle_at_midnight)))
        midnight = tomorrow
    return days
