(function () {
    
'use strict';

angular.module('OpenSlidesApp.openslides_conversations.templatehooks', ['OpenSlidesApp.openslides_conversations'])

.run([
    'templateHooks',
    function (templateHooks) {
        templateHooks.registerHook({
            Id: 'indexHeaderAdditionalOptions',
            templateUrl: 'static/templates/openslides_conversations/userbar-hook.html',
        });
    }
]);
    
}());