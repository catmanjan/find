/*
 * Copyright 2017 Hewlett Packard Enterprise Development Company, L.P.
 * Licensed under the MIT License (the "License"); you may not use this file except in compliance with the License.
 */

package com.hp.autonomy.frontend.find.idol.dashboards.widgets;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;
import com.fasterxml.jackson.databind.annotation.JsonPOJOBuilder;
import com.google.common.collect.ImmutableSet;
import com.hp.autonomy.frontend.configuration.ConfigException;
import com.hp.autonomy.frontend.configuration.SimpleComponent;
import com.hp.autonomy.types.requests.idol.actions.tags.TagName;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@SuppressWarnings("MismatchedQueryAndUpdateOfCollection")
@Builder
@Data
@EqualsAndHashCode(callSuper = false)
@JsonDeserialize(builder = TrendingWidgetSettings.TrendingWidgetSettingsBuilder.class)
public class TrendingWidgetSettings extends SimpleComponent<TrendingWidgetSettings> implements WidgetSettings<TrendingWidgetSettings> {
    private static final String SECTION = "Trending Dashboard";
    private static final Set<String> VALID_COLOURS = ImmutableSet.of("blue", "light-blue", "orange", "pink", "light-pink", "green", "light-green", "red", "purple", "yellow");
    private final Map<String, Object> widgetSettings;
    private final TagName parametricField;
    private final TagName dateField;
    private final Integer maxValues;
    private final Integer numberOfBuckets;
    private final List<TrendingValue> values;

    @Override
    public void basicValidate(final String section) throws ConfigException {
        if (parametricField == null) {
            throw new ConfigException(SECTION, "Trending dashboard config must specify a parametric field");
        }

        if (values != null) {
            final List<TrendingValue> invalidValues = values.stream()
                    .filter(v -> !VALID_COLOURS.contains(v.color))
                    .collect(Collectors.toList());
            if (!invalidValues.isEmpty()) {
                throw new ConfigException(SECTION, "The following parametric values have invalid colours associated: " + invalidValues);
            }
        }

        super.basicValidate(section);
    }

    @Override
    @JsonAnyGetter
    public Map<String, Object> getWidgetSettings() {
        return Collections.unmodifiableMap(widgetSettings);
    }

    @SuppressWarnings({"WeakerAccess", "unused"})
    @Data
    public static class TrendingValue {
        @JsonProperty("name")
        private final String name;
        @JsonProperty("color")
        private final String color;
    }

    @SuppressWarnings({"FieldMayBeFinal", "WeakerAccess", "unused"})
    @JsonPOJOBuilder(withPrefix = "")
    public static class TrendingWidgetSettingsBuilder {
        private Map<String, Object> widgetSettings = new HashMap<>();
        private TagName parametricField;
        private TagName dateField;
        private Integer maxValues;
        private Integer numberOfBuckets;
        private List<TrendingValue> values;

        @SuppressWarnings("unused")
        @JsonAnySetter
        public TrendingWidgetSettingsBuilder widgetSetting(final String key, final Object value) {
            widgetSettings.put(key, value);
            return this;
        }
    }
}
