/*
 * Copyright 2016 Hewlett-Packard Enterprise Development Company, L.P.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

define([
    'jquery',
    'find/app/util/generate-error-support-message'
], function($, generateErrorHtml) {
    'use strict';

    function generateDummyError(xhr) {
        return generateErrorHtml({
            errorDetails: xhr.responseJSON.message,
            errorUUID: xhr.responseJSON.uuid,
            errorLookup: xhr.responseJSON.backendErrorCode
        });
    }

    var DUMMY_UUID = 'dummyuuid';
    var DUMMY_MESSAGE_FOR_USER = 'Message for user';
    var KNOWN_USER_ERROR_CODE = 'DUMMYERRORCODE123';
    var KNOWN_USER_PRETTY_ERROR_MESSAGE = 'Prettified dummy error message';
    var UNKNOWN_ERROR = 'Unknown error';

    describe("The error-generating function", function() {
        describe("when passed a user-caused error", function() {
            beforeEach(function() {
                this.xhr = {
                    responseJSON: {
                        backendErrorCode: KNOWN_USER_ERROR_CODE,
                        uuid: DUMMY_UUID
                    }
                };
                this.testErrorMessage = generateDummyError(this.xhr);
            });
            it("prints prettified error details", function() {
                expect($(this.testErrorMessage)).toContainText(KNOWN_USER_PRETTY_ERROR_MESSAGE);
            });
            it("does not print the error code", function() {
                expect($(this.testErrorMessage).find('.error-details-for-techsupport')).not.toContainText(KNOWN_USER_ERROR_CODE);
            });
            it("does not print a 'call support' message", function() {
                expect($(this.testErrorMessage).find('.error-contact-support')).not.toContainText('support');
            });
        });

        describe("when passed a non-user-caused error", function() {
            beforeEach(function() {
                this.xhr = {
                    responseJSON: {
                        backendErrorCode: 'SOME.ERROR.NOT.IN.errors.js',
                        message: DUMMY_MESSAGE_FOR_USER,
                        uuid: DUMMY_UUID
                    }
                };
                this.testErrorMessage = generateDummyError(this.xhr);
            });
            it("prints a 'call support' message", function() {
                expect($(this.testErrorMessage).find('.error-contact-support')).toContainText('support');
            });
        });

        describe("when passed an unknown error", function() {
            beforeEach(function() {
                this.xhr = {
                    responseJSON: {
                        backendErrorCode: 'SOME.ERROR.NOT.IN.CORE.errors.js',
                        // message: null,
                        uuid: DUMMY_UUID
                    }
                };
                this.testErrorMessage = generateDummyError(this.xhr);
            });
            it("prints a 'call support' message", function() {
                expect($(this.testErrorMessage).find('.error-contact-support')).toContainText('support');
            });
            it("prints an 'Unknown error' message as details", function() {
                expect($(this.testErrorMessage)).toContainText(UNKNOWN_ERROR);
            });
        });
        describe("when given no error information", function() {
            beforeEach(function() {
                this.testErrorMessageNull = generateErrorHtml(null);
                this.testErrorMessageUndefined = generateErrorHtml(undefined);
                this.testErrorMessageEmpty = generateErrorHtml({});
            });
            it("prints a 'call support' message", function() {
                expect($(this.testErrorMessageNull).find('.error-contact-support')).toContainText('support');
                expect($(this.testErrorMessageUndefined).find('.error-contact-support')).toContainText('support');
                expect($(this.testErrorMessageEmpty).find('.error-contact-support')).toContainText('support');
            });
            it("prints an 'Unknown error' message", function() {
                expect($(this.testErrorMessageNull)).toContainText(UNKNOWN_ERROR);
                expect($(this.testErrorMessageUndefined)).toContainText(UNKNOWN_ERROR);
                expect($(this.testErrorMessageEmpty)).toContainText(UNKNOWN_ERROR);
            });
        });
    });
});
