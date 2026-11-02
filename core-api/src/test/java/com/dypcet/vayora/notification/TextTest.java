package com.dypcet.vayora.notification;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import org.junit.jupiter.api.Test;

class TextTest {

    private static final Text SEATS = Text.of("{n} seats, {from} to {to}", "n", "2", "from", "Kolhapur", "to", "Pune");

    @Test
    void rendersNestedTextsAndListsAsTheEnglishItReplaces() {
        Text notice = Text.of("The driver cancelled the ride you booked for {seats}. You owe nothing."
                        + " {more}", "seats", SEATS,
                "more", Text.of("Other rides that could take you: {rides}. Search again to book one.", "rides", List.of(
                        Text.of("{time} from {stop} with {driver}", "time", "07:15", "stop", "Kolhapur", "driver", "Meera"),
                        Text.of("{time} from {stop} with {driver}", "time", "10:30", "stop", "Kolhapur", "driver", "Sunil"))));

        assertThat(notice.render()).isEqualTo("The driver cancelled the ride you booked for 2 seats, Kolhapur to Pune."
                + " You owe nothing. Other rides that could take you: 07:15 from Kolhapur with"
                + " Meera; 10:30 from Kolhapur with Sunil. Search again to book one.");
    }

    @Test
    void survivesTheTripThroughTheStore() {
        Text notice = Text.of("A {seats} and {list}", "seats", SEATS, "list", List.of(SEATS, SEATS));
        assertThat(Text.fromDocument(notice.toDocument())).isEqualTo(notice);
    }

    @Test
    void aValueTakenLiterallyEvenWithDollarSignsAndBraces() {
        assertThat(Text.of("Note: {note}", "note", "costs $5 {not a placeholder}").render())
                .isEqualTo("Note: costs $5 {not a placeholder}");
    }

    @Test
    void aMomentIsEnglishInTheCorridorsTimeAndStaysAnInstantForTheApp() {
        Text reminder = Text.of("Your seat leaves {when}.", "when", "2026-10-23T02:00:00Z");

        assertThat(reminder.render()).isEqualTo("Your seat leaves Fri 23 Oct, 07:30.");
        assertThat(Text.fromDocument(reminder.toDocument()).values()).containsEntry("when", "2026-10-23T02:00:00Z");
        // A date, or anything else that is not an instant, is taken as it is.
        assertThat(Text.of("On {date}: {note}", "date", "2026-10-27", "note", "2026-10-23T02:00").render())
                .isEqualTo("On 2026-10-27: 2026-10-23T02:00");
    }

    @Test
    void refusesAMissingValueRatherThanSendingABrokenSentence() {
        assertThatThrownBy(() -> Text.of("{name} cancelled.").render()).isInstanceOf(IllegalStateException.class);
    }
}
