from django.utils.translation import ugettext_noop

from openslides.core.config import ConfigVariable

def get_config_variables():
    """
    Generator which yields all config variables of this app.
    It has to be evaluated during app loading (see apps.py).
    """
    yield ConfigVariable(
        name='enable_video_streaming',
        default_value=False,
        input_type='boolean',
        label='Stream Video in moderated Conversations rather than Audio',
        weight=615,
        group='Conversations',
        subgroup='General'
    )