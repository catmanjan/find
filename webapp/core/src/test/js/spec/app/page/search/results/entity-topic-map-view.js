/*
 * Copyright 2016-2017 Hewlett Packard Enterprise Development Company, L.P.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

define([
    'underscore',
    'backbone',
    'find/app/configuration',
    'find/app/page/search/results/entity-topic-map-view',
    'find/app/util/topic-map-view',
    'mock/model/entity-collection'
], function(_, Backbone, configuration, EntityTopicMapView, TopicMapView, EntityCollection) {
    'use strict';

    const originalDebounce = _.debounce;
    const DEFAULT_MAX_RESULTS = 300;
    const MINIMUM_ALLOWED_MAX_RESULTS = 51;

    function viewConstructionArgs(showSlider) {
        return _.extend({
                clickHandler: this.clickHandler,
                queryModel: this.queryModel,
                type: 'QUERY'
            },
            _.isUndefined(showSlider)
                ? {}
                : {showSlider: showSlider});
    }

    function testSlider(showSlider) {
        // Entity topic map displays the slider by default
        const sliderDisplayed = _.isUndefined(showSlider) || showSlider;

        return function() {
            describe('the slider DOM element', function() {
                if(sliderDisplayed) {
                    it('is present', function() {
                        this.createView(DEFAULT_MAX_RESULTS, sliderDisplayed);
                        expect(this.view.$('.speed-slider')).toHaveLength(1);
                    });

                    it('obeys the hard-coded minimum', function() {
                        this.createView(MINIMUM_ALLOWED_MAX_RESULTS - 20, sliderDisplayed);
                        expect(this.view.$('.speed-slider').val()).toBe(MINIMUM_ALLOWED_MAX_RESULTS + '');
                        expect(this.view.$('.speed-slider')).toHaveAttr('max', MINIMUM_ALLOWED_MAX_RESULTS + '');
                    });

                    it('uses the configured maximum', function() {
                        this.createView(17 * DEFAULT_MAX_RESULTS, sliderDisplayed);
                        expect(this.view.$('.speed-slider').val()).toBe(DEFAULT_MAX_RESULTS + '');
                        expect(this.view.$('.speed-slider')).toHaveAttr('max', (17 * DEFAULT_MAX_RESULTS) + '');
                    });

                    it('does not exceed the configured maximum', function() {
                        this.createView(DEFAULT_MAX_RESULTS - 11, sliderDisplayed);
                        expect(this.view.$('.speed-slider').val()).toBe((DEFAULT_MAX_RESULTS - 11) + '');
                        expect(this.view.$('.speed-slider')).toHaveAttr('max', (DEFAULT_MAX_RESULTS - 11) + '');
                    });
                } else {
                    it('is absent', function() {
                        this.createView(DEFAULT_MAX_RESULTS, sliderDisplayed);
                        expect(this.view.$('.speed-slider')).toHaveLength(0);
                    });
                }
            });
        };
    }

    describe('Entity Topic Map View', function() {
        beforeEach(function() {
            _.debounce = function(f) {
                return f;
            };

            this.clickHandler = jasmine.createSpy('clickHandler');
            this.queryModel = new Backbone.Model();
            this.queryModel.getIsoDate = jasmine.createSpy('getIsoDate');

            // this is for the error message generating function
            configuration.and.returnValue({errorCallSupportString: 'Custom call support message'});

            this.createView = function(maxResults, showSlider) {
                this.view = new EntityTopicMapView(_.extend(
                    viewConstructionArgs.call(this, showSlider),
                    {configuration: {topicMapMaxResults: maxResults}}
                ));

                // The view only updates when visible
                this.view.$el.appendTo(document.body);

                this.view.render();

                this.topicMap = TopicMapView.instances[0];
                this.entityCollection = EntityCollection.instances[0];
            }
        });

        afterEach(function() {
            configuration.and.stub();
            this.view.remove();
            TopicMapView.reset();
            EntityCollection.reset();
            _.debounce = originalDebounce;
        });

        // Configuration handling tested here
        describe('handles the speed slider and data model correctly:', function() {
            describe('the model', function() {
                it('obeys the hard-coded minimum', function() {
                    this.createView(1);
                    expect(this.view.model.get('maxResults')).toBe(MINIMUM_ALLOWED_MAX_RESULTS);
                });

                it('is initialised with the correct default value', function() {
                    this.createView(10 * DEFAULT_MAX_RESULTS);
                    expect(this.view.model.get('maxResults')).toBe(DEFAULT_MAX_RESULTS);
                });

                it('the default does not exceed the configured maximum', function() {
                    this.createView(DEFAULT_MAX_RESULTS - 22);
                    expect(this.view.model.get('maxResults')).toBe(DEFAULT_MAX_RESULTS - 22);
                });
            });

            describe('when the slider is enabled', testSlider(true));
            describe('when the slider is disabled', testSlider(false));
            describe('by default', testSlider());

            describe('when a constructor parameter maxResults is provided, it overrides the global configuration', function() {
                beforeEach(function() {
                    this.createView = function(maxResults, showSlider) {
                        this.view = new EntityTopicMapView(_.extend(
                            viewConstructionArgs.call(this, showSlider),
                            {
                                configuration: {topicMapMaxResults: 678},
                                maxResults: maxResults
                            }
                        ));

                        // The view only updates when visible
                        this.view.$el.appendTo(document.body);

                        this.view.render();

                        this.topicMap = TopicMapView.instances[0];
                        this.entityCollection = EntityCollection.instances[0];
                    };
                });

                // the constructor parameter is only used for a dashboard widget -- don't bother testing slider
                describe('the model', function() {
                    it('obeys the hard-coded minimum', function() {
                        this.createView(MINIMUM_ALLOWED_MAX_RESULTS - 20);
                        expect(this.view.model.get('maxResults')).toBe(MINIMUM_ALLOWED_MAX_RESULTS);
                    });

                    it('is initialised with the maximum value (smaller than default)', function() {
                        this.createView(DEFAULT_MAX_RESULTS - 33);
                        expect(this.view.model.get('maxResults')).toBe(DEFAULT_MAX_RESULTS - 33);
                    });

                    it('is initialised with the maximum value (larger than default)', function() {
                        this.createView(12 * DEFAULT_MAX_RESULTS);
                        expect(this.view.model.get('maxResults')).toBe(12 * DEFAULT_MAX_RESULTS);
                    });
                });
            });
        });

        // Typical results view usage tested here
        describe('configured sensibly', function() {
            beforeEach(function() {
                this.createView(2 * DEFAULT_MAX_RESULTS);
            });

            describe('when there are no entities in the collection', function() {
                it('contains a speed slider', function() {
                    expect(this.view.$('.speed-slider')).toHaveLength(1);
                });

                it('shows the empty message', function() {
                    expect(this.view.$('.entity-topic-map-empty')).not.toHaveClass('hide');
                });

                it('does not show the loading indicator', function() {
                    expect(this.view.$('.entity-topic-map-loading')).toHaveClass('hide');
                });

                it('does not show the error message', function() {
                    expect(this.view.$('.entity-topic-map-error')).toHaveClass('hide');
                });

                it('does not show the topic map', function() {
                    expect(this.view.$('.entity-topic-map')).toHaveClass('hide');
                });
            });

            describe('when there are entities in the collection', function() {
                beforeEach(function() {
                    this.entityCollection.add([
                        {text: 'gin', occurrences: 12, docsWithPhrase: 7, cluster: 0},
                        {text: 'siege', occurrences: 23, docsWithPhrase: 1, cluster: 0},
                        {text: 'pneumatic', occurrences: 2, docsWithPhrase: 2, cluster: 1}
                    ]);
                    this.entityCollection.trigger('sync');
                });

                it('contains a speed slider', function() {
                    expect(this.view.$('.speed-slider')).toHaveLength(1);
                });

                it('sets up the speed slider correctly', function() {
                    expect(this.view.model.get('maxResults')).toBe(DEFAULT_MAX_RESULTS);
                    expect(this.view.$('.speed-slider').val()).toBe(DEFAULT_MAX_RESULTS + '');
                    expect(this.view.$('.speed-slider')).toHaveAttr('max', (2 * DEFAULT_MAX_RESULTS) + '');
                });

                it('does not show the loading indicator', function() {
                    expect(this.view.$('.entity-topic-map-loading')).toHaveClass('hide');
                });

                it('does not show the error message', function() {
                    expect(this.view.$('.entity-topic-map-error')).toHaveClass('hide');
                });

                it('does not show the empty message', function() {
                    expect(this.view.$('.entity-topic-map-empty')).toHaveClass('hide');
                });

                it('updates the model maxResults attribute when the slider is moved', function() {
                    const currentSliderValue = +this.view.$('.speed-slider').val();
                    this.view.$('.speed-slider').val(currentSliderValue - 50).trigger('change');
                    expect(this.view.model.get('maxResults')).toBe((currentSliderValue - 50) + '');
                });

                it('renders a topic map with data from the entity collection', function() {
                    expect(this.topicMap.setData).toHaveBeenCalled();
                    expect(this.topicMap.draw).toHaveBeenCalled();

                    expect(this.topicMap.setData.calls.mostRecent().args[0]).toEqual([
                        {name: 'gin', size: 8, children: [{name: 'gin', size: 7}, {name: 'siege', size: 1}]},
                        {name: 'pneumatic', size: 2, children: [{name: 'pneumatic', size: 2}]}
                    ]);

                    expect(this.view.$('.entity-topic-map')).not.toHaveClass('hide');
                });

                describe('when the entities collection is fetched', function() {
                    beforeEach(function() {
                        this.entityCollection.trigger('request');
                    });

                    it('shows the loading indicator', function() {
                        expect(this.view.$('.entity-topic-map-loading')).not.toHaveClass('hide');
                    });

                    it('does not show the error message', function() {
                        expect(this.view.$('.entity-topic-map-error')).toHaveClass('hide');
                    });

                    it('does not show the empty message', function() {
                        expect(this.view.$('.entity-topic-map-empty')).toHaveClass('hide');
                    });

                    it('hides the topic map', function() {
                        expect(this.view.$('.entity-topic-map')).toHaveClass('hide');
                    });

                    describe('then the fetch succeeds with no results', function() {
                        beforeEach(function() {
                            this.entityCollection.reset();
                            this.entityCollection.trigger('sync');
                        });

                        it('hides the loading indicator', function() {
                            expect(this.view.$('.entity-topic-map-loading')).toHaveClass('hide');
                        });

                        it('does not show the error message', function() {
                            expect(this.view.$('.entity-topic-map-error')).toHaveClass('hide');
                        });

                        it('shows the empty message', function() {
                            expect(this.view.$('.entity-topic-map-empty')).not.toHaveClass('hide');
                        });

                        it('does not show the topic map', function() {
                            expect(this.view.$('.entity-topic-map')).toHaveClass('hide');
                        });
                    });

                    describe('then the fetch fails', function() {
                        beforeEach(function() {
                            this.entityCollection.reset();
                            this.entityCollection.trigger('error', this.entityCollection, {status: 400});
                        });

                        it('hides the loading indicator', function() {
                            expect(this.view.$('.entity-topic-map-loading')).toHaveClass('hide');
                        });

                        describe('then the error message', function() {
                            it('is displayed', function() {
                                expect(this.view.$('.entity-topic-map-error')).not.toHaveClass('hide');
                            });

                            it('contains the custom "call support string"', function() {
                                expect(this.view.$('.entity-topic-map-error')).toContainText(configuration().errorCallSupportString);
                            });
                        });

                        it('does not show the empty message', function() {
                            expect(this.view.$('.entity-topic-map-empty')).toHaveClass('hide');
                        });

                        it('does not show the topic map', function() {
                            expect(this.view.$('.entity-topic-map')).toHaveClass('hide');
                        });
                    });

                    describe('then the fetch is aborted', function() {
                        beforeEach(function() {
                            this.entityCollection.reset();
                            this.entityCollection.trigger('error', this.entityCollection, {status: 0});
                        });

                        it('does not hide the loading indicator', function() {
                            expect(this.view.$('.entity-topic-map-loading')).not.toHaveClass('hide');
                        });

                        it('does not show the error message', function() {
                            expect(this.view.$('.entity-topic-map-error')).toHaveClass('hide');
                        });

                        it('does not show the empty message', function() {
                            expect(this.view.$('.entity-topic-map-empty')).toHaveClass('hide');
                        });

                        it('does not show the topic map', function() {
                            expect(this.view.$('.entity-topic-map')).toHaveClass('hide');
                        });
                    });
                });

                it('exports data', function() {
                    this.view.exportData();
                    expect(this.topicMap.exportPaths).toHaveBeenCalled();
                });
            });
        });
    });
});
