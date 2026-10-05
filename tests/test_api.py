import json
from unittest.mock import patch
import pytest
from planner.routing import RoutingError

POINTS = [dict(label='Chicago, IL',lat=41.88,lon=-87.63),dict(label='Indianapolis, IN',lat=39.77,lon=-86.16),dict(label='Dallas, TX',lat=32.78,lon=-96.8)]
BODY=dict(current=POINTS[0],pickup=POINTS[1],dropoff=POINTS[2],cycle_used=0,start='2026-10-05T08:00')

def test_health(client):
    assert client.get('/api/health').json()['status']=='ok'

@pytest.mark.parametrize('body',[[],{},dict(BODY,cycle_used='nan'),dict(BODY,cycle_used=71),dict(BODY,start='9999-01-01T00:00'),dict(BODY,start='2026-10-05T08:00+02:00'),dict(BODY,current=dict(POINTS[0],lat='nan'))])
def test_invalid_requests_never_call_routing(client,body):
    with patch('planner.views.route') as route:
        r=client.post('/api/plan',data=json.dumps(body),content_type='application/json')
        assert r.status_code==400
        route.assert_not_called()

def test_bad_json(client):
    assert client.post('/api/plan',data='{',content_type='application/json').status_code==400

def test_upstream_failure_is_visible(client):
    with patch('planner.views.route',side_effect=RoutingError('Map service unavailable')):
        r=client.post('/api/plan',data=json.dumps(BODY),content_type='application/json')
        assert r.status_code==503
        assert r.json()['error']=='Map service unavailable'

def test_plan_response(client):
    route=dict(legs=[dict(miles=200,hours=4),dict(miles=900,hours=18)],geometry=[[-87.63,41.88],[-86.16,39.77],[-96.8,32.78]])
    with patch('planner.views.route',return_value=route):
        r=client.post('/api/plan',data=json.dumps(BODY),content_type='application/json')
        assert r.status_code==200
        assert r.json()['miles']==1100
        assert len(r.json()['days'])>1
        assert all('coordinates' in e for e in r.json()['events'])

def test_search_validation(client):
    assert client.get('/api/locations?q=ab').status_code==400

def test_methods(client):
    assert client.get('/api/plan').status_code==405
