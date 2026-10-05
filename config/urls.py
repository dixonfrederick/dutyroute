from django.urls import path
from planner import views

urlpatterns = [
    path('api/health', views.health),
    path('api/locations', views.locations),
    path('api/plan', views.plan),
    path('', views.index),
    path('favicon.svg', views.favicon),
]
