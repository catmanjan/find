define([
    'find/app/find-pages',
    'find/app/page/find-search',
    'find/app/page/find-settings-page',
    'i18n!find/nls/bundle'
], function(FindPages, FindSearch, SettingsPage) {

    return FindPages.extend({

        initializePages: function() {
            this.pages = [
                {
                    constructor: FindSearch
                    , pageName: 'search'
                    , classes: ''
                }, {
                    constructor: SettingsPage
                    , pageName: 'settings'
                    , classes: 'hide-from-non-useradmin'
                }
            ];
        }

    });

});