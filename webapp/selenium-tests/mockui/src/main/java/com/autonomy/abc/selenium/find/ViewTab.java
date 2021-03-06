package com.autonomy.abc.selenium.find;

public enum ViewTab {
    LIST("list"),
    TOPIC_MAP("topic-map"),
    SUNBURST("sunburst"),
    TABLE("table"),
    MAP("map");

    private final String tab;

    ViewTab(final String tab) {
        this.tab = tab;
    }

    public String css() {
        return tab;
    }
}
