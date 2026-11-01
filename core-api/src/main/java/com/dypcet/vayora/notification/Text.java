package com.dypcet.vayora.notification;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.bson.Document;

/**
 * A sentence as an English template and the values that fill it, so the web app can show
 * it in the reader's language. The template is the key of the app's translation tables;
 * {@link #render()} gives the English, which is what email and SMS copies carry.
 *
 * <p>A value is a {@code String}, another {@code Text} (a phrase that is itself translated,
 * such as "2 seats, Kolhapur to Pune"), or a {@code List<Text>}, rendered joined by "; ".
 * A string that is an ISO-8601 instant, such as {@code 2026-10-23T02:00:00Z}, is a moment:
 * the English gives it in India's time ("Fri 23 Oct, 07:30"), and the app in the
 * reader's language. An ISO date, such as {@code 2026-10-27}, is left as it is here.
 */
public record Text(String template, Map<String, Object> values) {

    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(\\w+)\\}");
    private static final Pattern INSTANT = Pattern.compile("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d+)?Z");
    private static final DateTimeFormatter MOMENT =
            DateTimeFormatter.ofPattern("EEE d MMM, HH:mm", Locale.ENGLISH).withZone(ZoneId.of("Asia/Kolkata"));

    public Text {
        values = Map.copyOf(values);
        for (Object value : values.values()) {
            if (!(value instanceof String || value instanceof Text || value instanceof List<?>)) {
                throw new IllegalArgumentException("A value is a string, a text or a list of texts");
            }
        }
    }

    /** The template, then its values as name, value pairs: {@code of("{name} cancelled.", "name", "Asha")}. */
    public static Text of(String template, Object... pairs) {
        if (pairs.length % 2 != 0) {
            throw new IllegalArgumentException("Values come in name, value pairs");
        }
        Map<String, Object> values = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            values.put((String) pairs[i], pairs[i + 1]);
        }
        return new Text(template, values);
    }

    /** The English. */
    public String render() {
        Matcher matcher = PLACEHOLDER.matcher(template);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            Object value = values.get(matcher.group(1));
            if (value == null) {
                throw new IllegalStateException("No value for {" + matcher.group(1) + "} in: " + template);
            }
            matcher.appendReplacement(out, Matcher.quoteReplacement(english(value)));
        }
        return matcher.appendTail(out).toString();
    }

    private static String english(Object value) {
        if (value instanceof Text text) {
            return text.render();
        }
        if (value instanceof List<?> list) {
            return list.stream().map(Text.class::cast).map(Text::render).collect(Collectors.joining("; "));
        }
        String text = (String) value;
        return INSTANT.matcher(text).matches() ? MOMENT.format(Instant.parse(text)) : text;
    }

    Document toDocument() {
        Document values = new Document();
        this.values.forEach((name, value) -> values.append(name, value instanceof Text text ? text.toDocument()
                : value instanceof List<?> list ? list.stream().map(Text.class::cast).map(Text::toDocument).toList()
                : value));
        return new Document("template", template).append("values", values);
    }

    static Text fromDocument(Document document) {
        Map<String, Object> values = new LinkedHashMap<>();
        Document stored = document.get("values", Document.class);
        stored.forEach((name, value) -> {
            if (value instanceof Document nested) {
                values.put(name, fromDocument(nested));
            } else if (value instanceof List<?> list) {
                List<Text> texts = new ArrayList<>();
                list.forEach(item -> texts.add(fromDocument((Document) item)));
                values.put(name, texts);
            } else {
                values.put(name, String.valueOf(value));
            }
        });
        return new Text(document.getString("template"), values);
    }
}
