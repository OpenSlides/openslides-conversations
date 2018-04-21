(function () {
    
'use strict';

angular.module('OpenSlidesApp.openslides_rtc.templatehooks', ['OpenSlidesApp.openslides_rtc'])

.run([
    'templateHooks',
    function (templateHooks) {
        templateHooks.registerHook({
            Id: 'indexHeaderAdditionalOptions',
            templateUrl: 'static/templates/openslides_rtc/userbar-hook.html',
        });
    }
]);
    
}());