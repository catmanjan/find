package com.autonomy.abc.selenium.page.analytics;

import org.openqa.selenium.By;
import org.openqa.selenium.NoSuchElementException;
import org.openqa.selenium.WebElement;

import java.util.*;

public class Container implements Iterable<ContainerItem> {
    private WebElement container;

    Container(WebElement element) {
        container = element;
    }

    public String getTitle() {
        return container.findElement(By.tagName("h3")).getText();
    }

    public Period getSelectedPeriod() {
        return Period.fromString(periodDropdown().getText());
    }

    public void selectPeriod(Period period) {
        WebElement periodDropdown = periodDropdown();
        periodDropdown.click();
        periodDropdown.findElement(period.locator).click();
    }

    private WebElement periodDropdown() {
        return container.findElement(By.className("chooseLastPeriodDropdown"));
    }

    public void toggleSortDirection() {
        container.findElement(By.className("sort-top")).click();
    }

    public ContainerItem get(int i) {
        try {
            return getItems().get(i);
        } catch (IndexOutOfBoundsException e) {
            throw new NoSuchElementException("looking for item " + (i+1) + " but there were only " + getItems().size());
        }
    }

    public ContainerItem get(String substring) {
        for (ContainerItem item : this) {
            if (item.getTerm().contains(substring)) {
                return item;
            }
        }
        throw new NoSuchElementException("could not find item containing " + substring + " in " + container);
    }

    public List<ContainerItem> getItems() {
        final List<ContainerItem> items = new ArrayList<>();
        for (WebElement term : container.findElements(By.className("list-group-item"))) {
            items.add(new ContainerItem(term));
        }
        return items;
    }

    @Override
    public Iterator<ContainerItem> iterator() {
        return getItems().iterator();
    }

    public enum Period {
        DAY("Last 24 hours"),
        WEEK("Last week"),
        MONTH("Last month");

        private final String linkText;
        private final By locator;
        private final static Map<String, Period> INVERSE = new HashMap<>();

        static {
            for (Period period : Period.values()) {
                INVERSE.put(period.linkText, period);
            }
        }

        Period(String linkText) {
            this.linkText = linkText;
            this.locator = By.linkText(linkText);
        }

        private static Period fromString(String value) {
            return INVERSE.get(value);
        }

        @Override
        public String toString() {
            return linkText;
        }
    }

}
