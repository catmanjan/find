define([
    'backbone',
    'underscore',
    'jquery',
    'i18n!find/nls/bundle',
    'js-whatever/js/list-view',
    'find/app/util/collapsible',
    'find/app/page/search/filters/parametric/parametric-select-modal',
    'find/app/page/search/filters/parametric/parametric-value-view'
], function(Backbone, _, $, i18n, ListView, Collapsible, ParametricModal, ValueView) {

    var MAX_SIZE = 5;

    var ValuesView = Backbone.View.extend({
        className: 'table parametric-fields-table',
        tagName: 'table',
        seeAllButtonTemplate: _.template('<tr class="show-all clickable"><td></td><td> <span class="toggle-more-text text-muted"><%-i18n["app.seeAll"]%></span></td></tr>'),

        events: {
            'click .show-all': function() {
                new ParametricModal({
                    collection: this.model.fieldValues,
                    currentFieldGroup: this.model.id,
                    parametricCollection: this.parametricCollection,
                    parametricDisplayCollection: this.parametricDisplayCollection,
                    selectedParametricValues: this.selectedParametricValues
                });
            }
        },

        initialize: function(options) {
            this.parametricDisplayCollection = options.parametricDisplayCollection;
            this.selectedParametricValues = options.selectedParametricValues;
            this.parametricCollection = options.parametricCollection;

            this.listView = new ListView({
                collection: this.collection,
                ItemView: ValueView,
                maxSize: MAX_SIZE,
                tagName: 'tbody',
                collectionChangeEvents: {
                    count: 'updateCount',
                    selected: 'updateSelected'
                }
            });
        },

        render: function() {
            this.$el.empty().append(this.listView.render().$el);

            this.$('tbody').append(this.seeAllButtonTemplate({i18n:i18n}));
        },

        remove: function() {
            this.listView.remove();
            Backbone.View.prototype.remove.call(this);
        }
    });

    return Backbone.View.extend({
        className: 'animated fadeIn',
        subtitleTemplate: _.template('<span class="selection-length"><%-length%></span> <%-i18n["app.selected"]%> <i class="hp-icon hp-warning selected-warning hidden"></i>'),

        initialize: function(options) {
            this.$el.attr('data-field', this.model.id);
            this.$el.attr('data-field-display-name', this.model.get('displayName'));
            this.parametricDisplayCollection = options.parametricDisplayCollection;
            this.selectedParametricValues = options.selectedParametricValues;
            this.parametricCollection = options.parametricCollection;

            this.collapsible = new Collapsible({
                collapsed: true,
                title: this.model.get('displayName') + ' (' + this.model.fieldValues.length +')',
                subtitle: this.subtitleTemplate({
                    i18n: i18n,
                    length: this.getFieldSelectedValuesLength()
                }),
                view: new ValuesView({
                    collection: this.model.fieldValues,
                    model: this.model,
                    parametricCollection:this.parametricCollection,
                    parametricDisplayCollection: this.parametricDisplayCollection,
                    selectedParametricValues: this.selectedParametricValues
                })
            });

            this.listenTo(this.selectedParametricValues, 'update', function() {
                this.collapsible.$('.selection-length').text(this.getFieldSelectedValuesLength());
                this.toggleWarning();
            });

            this.listenTo(this.collapsible, 'show', function() {
                this.collapsible.toggleSubtitle(true);
            });

            this.listenTo(this.collapsible, 'hide', function() {
                this.toggleSubtitle();
            });
        },

        render: function() {
            this.$el.empty().append(this.collapsible.$el);
            this.collapsible.render();

            this.$warning = this.collapsible.$('.selected-warning');

            this.$warning.tooltip({
                title: i18n['search.parametric.selected.notAllVisible']
            });

            this.toggleSubtitle();
            this.toggleWarning();
        },

        toggleSubtitle: function() {
            this.collapsible.toggleSubtitle(this.getFieldSelectedValuesLength() !== 0);
        },

        toggleWarning: function() {
            var currentValues = this.selectedParametricValues.where({field: this.model.id});
            var toggle = true;

            if(currentValues.length > 0) {
                var firstFiveValues = this.model.fieldValues.chain()
                    .first(MAX_SIZE)
                    .pluck('id')
                    .value();

                var fieldsArray = _.invoke(currentValues, 'get', 'value');

                toggle = !_.difference(fieldsArray, firstFiveValues).length;
            }

            this.$warning.toggleClass('hidden', toggle);
        },

        getFieldSelectedValuesLength: function() {
            return this.selectedParametricValues.where({field: this.model.id}).length;
        },

        remove: function() {
            this.$warning.tooltip('destroy');
            this.collapsible.remove();

            Backbone.View.prototype.remove.call(this);
        }
    });
});