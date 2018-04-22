import os

from django.apps import AppConfig

from . import (
    __description__,
    __license__,
    __url__,
    __verbose_name__,
    __version__,
)


class ConversationsPluginAppConfig(AppConfig):
    name = 'openslides_conversations'
    verbose_name = __verbose_name__
    description = __description__
    version = __version__
    license = __license__
    url = __url__
    angular_site_module = True
    angular_projector_module = False
    js_files = [
        'static/js/openslides_conversations/base.js',
        'static/js/openslides_conversations/site.js',
        'static/js/openslides_conversations/openslides-conversations.js',
        'static/js/openslides_conversations/templatehooks.js',
        'static/js/openslides_conversations/templates.js'
    ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        try:
            import settings
        except ImportError:
            # When testing, we cannot import settings here..
            pass
        else:
            # Add the staticfiles dir to OpenSlides
            base_path = os.path.realpath(os.path.dirname(os.path.abspath(__file__)))
            # remove the app folder 'openslides_protcol'
            base_path = os.path.dirname(base_path)
            settings.STATICFILES_DIRS.append(os.path.join(base_path, 'static'))

    def ready(self):
        from .urls import urlpatterns
        from openslides.core.config import config
        from openslides.core.signals import post_permission_creation
        from .config_variables import get_config_variables
        from .signals import (
            add_permissions_to_builtin_groups
        )
        self.urlpatterns = urlpatterns

        # Define config variables
        config.update_config_variables(get_config_variables())

        # Connect signals
        post_permission_creation.connect(
            add_permissions_to_builtin_groups,
            dispatch_uid='openslides_conversations_add_permissions_to_builtin_groups'
        )
