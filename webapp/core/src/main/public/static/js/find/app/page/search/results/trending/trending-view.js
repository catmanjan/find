/*
 *  Copyright 2017 Hewlett Packard Enterprise Development Company, L.P.
 *  Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

define([
    'underscore',
    'jquery',
    'd3',
    'backbone',
    'i18n!find/nls/bundle',
    'find/app/configuration',
    'find/app/vent',
    'find/app/util/generate-error-support-message',
    'find/app/page/search/results/parametric-results-view',
    'find/app/page/search/results/field-selection-view',
    'find/app/page/search/filters/parametric/calibrate-buckets',
    'find/app/model/bucketed-parametric-collection',
    'find/app/model/parametric-field-details-model',
    'find/app/model/parametric-collection',
    'find/app/page/search/results/trending/trending',
    'find/app/page/search/results/trending/trending-strategy',
    'text!find/templates/app/page/loading-spinner.html',
    'text!find/templates/app/page/search/results/trending/trending-results-view.html'

], function(_, $, d3, Backbone, i18n, configuration, vent, generateErrorHtml, ParametricResultsView, FieldSelectionView,
            calibrateBuckets, BucketedParametricCollection, ParametricDetailsModel, ParametricCollection, Trending,
            trendingStrategy, loadingSpinnerHtml, template) {
    'use strict';

    const MILLISECONDS_TO_SECONDS = 1000;
    const SECONDS_IN_ONE_DAY = 86400;
    const DEBOUNCE_TIME = 500;
    const ERROR_MESSAGE_ARGUMENTS = {messageToUser: i18n['search.resultsView.trending.error.query']};

    const renderState = {
        RENDERING_NEW_DATA: 'RENDERING NEW DATA',
        ZOOMING: 'ZOOMING',
        DRAGGING: 'DRAGGING'
    };

    const dataState = {
        LOADING: 'LOADING',
        EMPTY: 'EMPTY',
        ERROR: 'ERROR',
        OK: 'OK'
    };

    const fetchState = {
        FETCHING_BUCKETS: 'FETCHING_BUCKETS',
        NOT_FETCHING: 'NOT_FETCHING'
    };

    function zoomCallback(min, max) {
        this.setMinMax(min, max);
        this.viewStateModel.set('currentState', renderState.ZOOMING);
        this.updateChart();
        this.debouncedFetchBucketingData();
    }

    function dragMoveCallback(min, max) {
        this.setMinMax(min, max);
        this.viewStateModel.set('currentState', renderState.DRAGGING);
        this.updateChart();
    }

    function dragEndCallback(min, max) {
        this.setMinMax(min, max);
        this.viewStateModel.set('currentState', renderState.DRAGGING);
        this.debouncedFetchBucketingData();
    }

    return Backbone.View.extend({
        template: _.template(template),
        loadingHtml: _.template(loadingSpinnerHtml),

        initialize: function(options) {
            const config = configuration();
            this.dateField = config.trending.dateField;
            //noinspection JSUnresolvedVariable
            this.targetNumberOfBuckets = config.trending.numberOfBuckets;
            //noinspection JSUnresolvedVariable
            this.numberOfValuesToDisplay = config.trending.numberOfValues;
            this.queryModel = options.queryModel;
            this.selectedParametricValues = options.queryState.selectedParametricValues;
            this.parametricFieldsCollection = options.parametricFieldsCollection;
            this.parametricCollection = options.parametricCollection;

            this.debouncedFetchBucketingData = _.debounce(this.fetchBucketingData, DEBOUNCE_TIME);
            this.bucketedValues = {};

            this.model = new Backbone.Model();
            this.viewStateModel = new Backbone.Model({
                currentState: renderState.RENDERING_NEW_DATA,
                searchStateChanged: false
            });

            this.listenTo(this.queryModel, 'change', function() {
                if(this.$el.is(':visible')) {
                    this.fetchFieldAndRangeData();
                } else {
                    this.viewStateModel.set('searchStateChanged', true);
                }
            });
            this.listenTo(vent, 'vent:resize', this.update);
            this.listenTo(this.viewStateModel, 'change:dataState', this.onDataStateChange);
            this.listenTo(this.parametricFieldsCollection, 'error', function(collection, xhr) {
                this.onDataError(xhr);
            });
            this.listenTo(this.model, 'change:field', this.fetchFieldAndRangeData);
            this.listenTo(this.parametricCollection, 'sync', this.setFieldSelector);
            this.listenTo(this.parametricCollection, 'error', function(collection, xhr) {
                this.onDataError(xhr);
            });
        },

        render: function() {
            this.$el.html(this.template({
                i18n: i18n,
                loadingHtml: this.loadingHtml
            }));
            this.$errorMessage = this.$('.trending-error');
            this.$chart = this.$('.trending-chart');

            this.viewStateModel.set('dataState', dataState.LOADING);

            if(this.trendingChart) {
                this.trendingChart.remove();
            }

            this.trendingChart = new Trending({
                el: this.$chart.get(0),
                tooltipText: i18n['search.resultsView.trending.tooltipText'],
                zoomEnabled: true,
                dragEnabled: true,
                hoverEnabled: true
            });

            if(!this.parametricCollection.isEmpty()) {
                this.setFieldSelector();
            }
        },

        remove: function() {
            this.$('[data-toggle="tooltip"]').tooltip('destroy');
            Backbone.View.prototype.remove.call(this);
        },

        update: function() {
            if(this.$el.is(':visible')) {
                if(this.viewStateModel.get('searchStateChanged')) {
                    this.setFieldSelector();
                    this.fetchFieldAndRangeData();
                    this.viewStateModel.set('searchStateChanged', false);
                } else {
                    if(!_.isEmpty(this.bucketedValues)) {
                        this.updateChart();
                    }
                }
            }
        },

        setFieldSelector: function() {
            if(this.$el.is(':visible')) {
                if(this.fieldSelector) {
                    this.fieldSelector.remove();
                }

                const fields = this.parametricFieldsCollection
                    .where({type: 'Parametric'})
                    .map(function(m) {
                        const id = m.get('id');
                        const field = this.parametricCollection.where({id: id})[0];
                        const totalValues = field
                            ? field.get('totalValues')
                            : 0;
                        return {
                            id: id,
                            displayName: m.get('displayName') + ' (' + totalValues + ')'
                        }
                    }.bind(this));

                this.fieldSelector = new FieldSelectionView({
                    model: this.model,
                    name: 'parametric-fields',
                    fields: fields,
                    allowEmpty: false
                });
                this.$('.trending-field-selector').prepend(this.fieldSelector.$el);
                this.fieldSelector.render();
            }
        },

        fetchFieldAndRangeData: function() {
            this.viewStateModel.set('dataState', dataState.LOADING);

            const fetchOptions = {
                queryModel: this.queryModel,
                selectedParametricValues: this.selectedParametricValues,
                field: this.model.get('field'),
                dateField: this.dateField,
                numberOfValuesToDisplay: this.numberOfValuesToDisplay
            };

            $.when(trendingStrategy.fetchField(fetchOptions))
                .then(function (values) {
                    this.selectedFieldValues = values;

                    if (this.selectedFieldValues.length === 0) {
                        this.viewStateModel.set('dataState', dataState.EMPTY);
                        return $.when();
                    } else {
                        return $.when(trendingStrategy.fetchRange(this.selectedFieldValues, fetchOptions))
                            .then(function (data) {
                                this.setMinMax(data.min, data.max);
                                this.fetchBucketingData();
                            }.bind(this));
                    }
                }.bind(this))
                .fail(function (xhr) {
                    this.onDataError(xhr);
                    this.viewStateModel.set('fetchState', fetchState.NOT_FETCHING);
                }.bind(this));
        },

        fetchBucketingData: function() {
            this.viewStateModel.set('fetchState', fetchState.FETCHING_BUCKETS);

            const minDate = this.model.get('currentMin'), maxDate = this.model.get('currentMax');
            if (minDate === maxDate) {
                this.setMinMax(minDate - SECONDS_IN_ONE_DAY, maxDate + SECONDS_IN_ONE_DAY);
            }

            const fetchOptions = {
                queryModel: this.queryModel,
                selectedFieldValues: this.selectedFieldValues,
                selectedParametricValues: this.selectedParametricValues,
                field: this.model.get('field'),
                currentMax: this.model.get('currentMax'),
                currentMin: this.model.get('currentMin'),
                dateField: this.dateField,
                numberOfValuesToDisplay: this.numberOfValuesToDisplay,
                targetNumberOfBuckets: this.targetNumberOfBuckets
            };

            return trendingStrategy.fetchBucketedData(fetchOptions)
                .done(_.bind(function () {
                    this.viewStateModel.set({
                        currentState: renderState.RENDERING_NEW_DATA,
                        dataState: dataState.OK,
                        fetchState: fetchState.NOT_FETCHING
                    });
                    this.bucketedValues = Array.prototype.slice.call(arguments);
                    this.updateChart();
                }, this)).fail(_.bind(function (xhr) {
                    this.onDataError(xhr);
                    this.viewStateModel.set('fetchState', fetchState.NOT_FETCHING);
                }, this));
        },

        updateChart: function() {
            if (this.viewStateModel.get('fetchState') !== fetchState.FETCHING_BUCKETS
                && !this.$chart.hasClass('hide')) {

                this.$('[data-toggle="tooltip"]').tooltip('destroy');

                const data = trendingStrategy.createChartData({
                    bucketedValues: this.bucketedValues,
                    currentMin: this.model.get('currentMin'),
                    currentMax: this.model.get('currentMax')
                });

                const reloaded = this.viewStateModel.get('currentState') === renderState.RENDERING_NEW_DATA;

                this.trendingChart.draw({
                    reloaded: reloaded,
                    data: data,
                    minDate: reloaded
                        ? data[0].points[0].mid
                        : new Date(this.model.get('currentMin') * MILLISECONDS_TO_SECONDS),
                    maxDate: reloaded
                        ? data[data.length - 1].points[data[0].points.length - 1].mid
                        : new Date(this.model.get('currentMax') * MILLISECONDS_TO_SECONDS),
                    xAxisLabel: i18n['search.resultsView.trending.xAxis'],
                    yAxisLabel: i18n['search.resultsView.trending.yAxis'],
                    zoomCallback: zoomCallback.bind(this),
                    dragMoveCallback: dragMoveCallback.bind(this),
                    dragEndCallback: dragEndCallback.bind(this)
                });
            }
        },

        setMinMax: function(min, max) {
            this.model.set({
                currentMin: Math.floor(min),
                currentMax: Math.floor(max)
            });
        },

        onDataStateChange: function() {
            const state = this.viewStateModel.get('dataState');

            this.$errorMessage.toggleClass('hide', state !== dataState.ERROR);
            this.$('.trending-empty').toggleClass('hide', state !== dataState.EMPTY);
            this.$('.trending-loading').toggleClass('hide', state !== dataState.LOADING);
            this.$chart.toggleClass('hide', state !== dataState.OK);

            if(state !== dataState.ERROR && this.$errorMessage) {
                this.$errorMessage.empty();
            }
        },

        onDataError: function(xhr) {
            if(xhr.status !== 0) {
                this.viewStateModel.set('dataState', dataState.ERROR);
                const messageArguments = _.extend({
                    errorDetails: xhr.responseJSON.message,
                    errorUUID: xhr.responseJSON.uuid
                }, ERROR_MESSAGE_ARGUMENTS);
                this.$errorMessage.html(generateErrorHtml(messageArguments));
            }
        }
    });
});