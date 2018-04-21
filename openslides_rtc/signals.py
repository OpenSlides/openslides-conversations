from django.contrib.auth.models import Permission
from django.contrib.contenttypes.models import ContentType

from openslides.users.models import Group

from .models import Conversations

def add_permissions_to_builtin_groups(**kwargs):
    content_type = ContentType.objects.get(app_label='openslides_rtc', model='conversations')

    try:
        # Group with pk == 3 should be the staff group in OpenSlides 2.1
        admin = Group.objects.get(pk=4)
        staff = Group.objects.get(pk=3)
        delegates = Group.objects.get(pk=2)
        default = Group.objects.get(pk=1)
    except Group.DoesNotExist:
        pass
    else:
        perm_can_moderate = Permission.objects.get(content_type=content_type, codename='can_moderate')
        perm_can_create_groups = Permission.objects.get(content_type=content_type, codename='can_create_groups')
        perm_can_use_conversations = Permission.objects.get(content_type=content_type, codename='can_use_conversations')
        admin.permissions.add(perm_can_moderate)
        admin.permissions.add(perm_can_create_groups)
        admin.permissions.add(perm_can_use_conversations)
        staff.permissions.add(perm_can_moderate)
        staff.permissions.add(perm_can_create_groups)
        staff.permissions.add(perm_can_use_conversations)
        delegates.permissions.add(perm_can_create_groups)
        delegates.permissions.add(perm_can_use_conversations)
        default.permissions.add(perm_can_use_conversations)