import bisect
import json
import math
from functools import lru_cache
from pathlib import Path
import requests
import os
import threading
import time

HEADERS = {'User-Agent': 'DutyRoute-assessment/1.0 (https://github.com/dixonfrederick/dutyroute)'}
_route_lock = threading.Lock()
_last_route_call = 0.0

@lru_cache(maxsize=128)
def road_data(coords):
    global _last_route_call
    with _route_lock:
        delay = max(0, 1.1 - (time.monotonic() - _last_route_call))
        if delay:
            time.sleep(delay)
        base = os.environ.get('ROUTING_BASE_URL', 'https://routing.openstreetmap.de/routed-car/route/v1/driving/')
        _last_route_call = time.monotonic()
        return fetch(base + coords, {'overview': 'full', 'geometries': 'geojson', 'steps': 'true'})

class RoutingError(Exception):
    pass

def fetch(url, params=None):
    try:
        r = requests.get(url, params=params, headers=HEADERS, timeout=20)
        r.raise_for_status()
        return r.json()
    except (requests.RequestException, ValueError) as exc:
        raise RoutingError('The map service is temporarily unavailable. Please try again.') from exc

@lru_cache(maxsize=256)
def search(query):
    data = fetch('https://photon.komoot.io/api/', {'q': query, 'limit': 8, 'lang': 'en', 'bbox': '-125,24,-66,50'})
    results = []
    for f in data.get('features', []):
        p = f['properties']
        if p.get('countrycode', '').upper() != 'US':
            continue
        label = ', '.join(dict.fromkeys(str(p[k]) for k in ('name', 'city', 'state') if p.get(k)))
        lon, lat = f['geometry']['coordinates']
        results.append(dict(label=label, lat=lat, lon=lon))
    return results[:6]

def haversine(a, b):
    x, y = math.radians(a[1]), math.radians(b[1])
    dlat, dlon = y-x, math.radians(b[0]-a[0])
    return 3958.7613 * 2 * math.asin(min(1, math.sqrt(math.sin(dlat/2)**2 + math.cos(x)*math.cos(y)*math.sin(dlon/2)**2)))

@lru_cache(maxsize=1)
def places():
    return json.loads((Path(__file__).parent / 'us_places.json').read_text())

def nearby(point):
    lon, lat = point
    factor = math.cos(math.radians(lat))**2
    city = min(places(), key=lambda p: (p[2]-lat)**2 + (p[3]-lon)**2*factor)
    return f'Near {city[0]}, {city[1]}'

def route(locations):
    coords = ';'.join(f"{p['lon']},{p['lat']}" for p in locations)
    data = road_data(coords)
    if data.get('code') != 'Ok' or not data.get('routes'):
        raise RoutingError('No road route was found between these locations.')
    item = data['routes'][0]
    for waypoint, original in zip(data['waypoints'], locations):
        if haversine(waypoint['location'], [original['lon'], original['lat']]) > 10:
            raise RoutingError('A location is too far from a routable road. Choose a nearby city or address.')
    geometry = item['geometry']['coordinates']
    legs = [dict(miles=l['distance']/1609.344, hours=l['duration']/3600,
                 steps=[dict(name=s.get('name') or 'unnamed road', miles=s['distance']/1609.344,
                             maneuver=s['maneuver']['type'], modifier=s['maneuver'].get('modifier', ''),
                             exit=s['maneuver'].get('exit')) for s in l['steps']]) for l in item['legs']]
    return dict(geometry=geometry, legs=legs, source='OpenStreetMap / OSRM')

def locate_events(plan, geometry, locations=None):
    cumulative = [0.0]
    for a, b in zip(geometry, geometry[1:]):
        cumulative.append(cumulative[-1] + haversine(a, b))
    route_miles = sum(e['mile_end']-e['mile_start'] for e in plan['events'])
    for e in plan['events']:
        position = (e['mile_start']/route_miles*cumulative[-1]) if route_miles else 0
        i = min(len(geometry)-1, max(1, bisect.bisect_left(cumulative, position)))
        span = cumulative[i]-cumulative[i-1]
        ratio = (position-cumulative[i-1])/span if span else 0
        a, b = geometry[i-1], geometry[i]
        point = [a[0]+(b[0]-a[0])*ratio, a[1]+(b[1]-a[1])*ratio]
        e['coordinates'] = point
        if e['location'].startswith('Route mile'):
            e['location'] = nearby(point)
        if locations and e['mile_start'] < 1e-6:
            e['coordinates'] = [locations[0]['lon'], locations[0]['lat']]
            e['location'] = locations[0]['label']
        if locations and e['reason'] in ('Pickup', 'Delivery'):
            p = locations[1 if e['reason'] == 'Pickup' else 2]
            e['coordinates'] = [p['lon'], p['lat']]
    for day in plan['days']:
        for s in day['segments']:
            if 'event_index' in s:
                s['location'] = plan['events'][s['event_index']]['location']
