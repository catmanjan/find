/*
 * Copyright 2014-2016 Hewlett-Packard Development Company, L.P.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

package com.hp.autonomy.frontend.find.idol.customisations;

import lombok.Getter;

@Getter
enum AssetType {
    BIG_LOGO("big-logo"),
    SMALL_LOGO("small-logo");

    private final String directory;

    AssetType(final String directory) {
        this.directory = directory;
    }
}
