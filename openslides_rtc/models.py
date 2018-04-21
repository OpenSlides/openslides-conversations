from django.db import models

class Conversations(models.Model):

    class Meta:
        default_permissions = ()
        permissions = (
            ('can_use_conversations', 'Can use conversation tool'),
            ('can_create_groups', 'Can create group channels'),
            ('can_moderate', 'Can moderate discussions'),
        )