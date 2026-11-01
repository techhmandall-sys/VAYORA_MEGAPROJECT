package com.dypcet.vayora.identity;

/**
 * One way of writing a member's phone number, so the same number typed two ways is one
 * account. Numbers without a country code are taken to be Indian (+91): the platform serves
 * India.
 */
public final class Phones {

    private Phones() {
    }

    /** Spaces and hyphens dropped; a 10-digit number, or one with a leading 0 or 91, gets +91. Blank is null. */
    public static String normalise(String phone) {
        if (phone == null) {
            return null;
        }
        String digits = phone.replaceAll("[\\s-]", "");
        if (digits.isEmpty()) {
            return null;
        }
        if (digits.matches("0?[0-9]{10}")) {
            return "+91" + digits.substring(digits.length() - 10);
        }
        if (digits.matches("91[0-9]{10}")) {
            return "+" + digits;
        }
        return digits;
    }
}
