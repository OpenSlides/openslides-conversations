from django.conf.urls import url

from . import views

urlpatterns = [
    
    url(r'^rtc/private_conversations/$',
        views.PrivateConversationView.as_view(),
        name='private_conversations'),
    
    url(r'^rtc/group_conversations/$',
        views.GroupConversationsView.as_view(),
        name='group_conversations'),

    url(r'^rtc/moderated_discussion/$',
        views.ModeratedDiscussionView.as_view(),
        name='moderated_discussion'),
]
