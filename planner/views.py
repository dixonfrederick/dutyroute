import json
import math
from datetime import datetime
from pathlib import Path
from django.conf import settings
from django.http import JsonResponse, FileResponse, HttpResponse
from django.views.decorators.http import require_GET, require_POST
from .routing import search, route, locate_events, RoutingError
from .scheduler import schedule

@require_GET
def health(request):
    return JsonResponse({'status': 'ok', 'service': 'DutyRoute Django API'})

@require_GET
def locations(request):
    q = request.GET.get('q', '').strip()
    if not 3 <= len(q) <= 200:
        return JsonResponse({'error': 'Enter a city or address (3 to 200 characters).'}, status=400)
    try:
        return JsonResponse({'locations': search(q)})
    except RoutingError as exc:
        return JsonResponse({'error': str(exc)}, status=503)

@require_POST
def plan(request):
    try:
        body = json.loads(request.body)
        if not isinstance(body, dict):
            raise ValueError('Expected trip details as a JSON object.')
        points = [body[k] for k in ('current', 'pickup', 'dropoff')]
        for p in points:
            if not isinstance(p, dict) or not isinstance(p.get('label'), str) or not 1 <= len(p['label']) <= 200:
                raise ValueError('Choose a search result for each location.')
            for key, bounds in (('lat', (24, 50)), ('lon', (-125, -66))):
                v = float(p[key])
                if not math.isfinite(v) or not bounds[0] <= v <= bounds[1]:
                    raise ValueError('Choose a location in the contiguous United States.')
                p[key] = v
        cycle = float(body['cycle_used'])
        if not math.isfinite(cycle) or not 0 <= cycle <= 70:
            raise ValueError('Current cycle hours must be between 0 and 70.')
        start = datetime.fromisoformat(body['start'])
        if start.tzinfo is not None or start.second or start.microsecond:
            raise ValueError('Use a date and time in the home-terminal time zone, without seconds.')
        # Bound dates to avoid arithmetic overflow on very long trips.
        if not 2000 <= start.year <= 2099:
            raise ValueError('Choose a start date between 2000 and 2099.')
        result = route(points)
        output = schedule(result['legs'], cycle, start, [p['label'] for p in points])
        locate_events(output, result['geometry'], points)
        output['route'] = result
        output['locations'] = points
        output['start'] = start.isoformat()
        return JsonResponse(output)
    except (KeyError, TypeError, ValueError, OverflowError) as exc:
        return JsonResponse({'error': str(exc) if isinstance(exc, ValueError) else 'Check all trip details and select each location.'}, status=400)
    except RoutingError as exc:
        return JsonResponse({'error': str(exc)}, status=503)

@require_GET
def index(request):
    file = Path(settings.BASE_DIR) / 'dist' / 'index.html'
    if not file.exists():
        return HttpResponse('Run npm run build to build the React frontend.', status=503)
    return FileResponse(file.open('rb'), content_type='text/html')

@require_GET
def favicon(request):
    file = Path(settings.BASE_DIR) / 'public' / 'favicon.svg'
    return FileResponse(file.open('rb'), content_type='image/svg+xml')
