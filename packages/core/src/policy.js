/**
 * Network policy constants. Changing any value here is a policy change:
 * it needs an RFC and approval by the Safeguarding, Privacy and Ethics committee.
 */
export const POLICY = {
    /** Staffed hours in Australia/Sydney local time, every day. */
    staffedHours: { startHour: 8, endHour: 21, timeZone: 'Australia/Sydney' },
    /** Each church has this many staffed minutes to accept or pass. */
    acceptWindowStaffedMinutes: 120,
    /** Remind the holding church at this many staffed minutes. */
    remindAtStaffedMinutes: 60,
    /** At most this many churches are offered in turn before the care team takes over. */
    maxSequentialOffers: 2,
    /** Hard ceiling for the whole network, in real hours, before the care team holds the person. */
    networkCeilingHours: 48,
    /** If no church has accepted within this many staffed minutes, the care team sends a human hello. */
    careHelloStaffedMinutes: 60,
    /** After acceptance, first contact is required within this many real hours. */
    firstContactHours: 24,
    /** Directory freshness: churches not re-confirmed within this many days are not routed to. */
    freshnessDays: 90,
    /** Follow-up attempt rules. */
    followUp: { secondAttemptMinHours: 8, secondAttemptMaxHours: 12, minAttempts: 3, windowDays: 7 },
    /** Contact hours for minors (local time). */
    minorContactHours: { startHour: 8, endHour: 20 },
    /** Retention, in days. */
    retention: {
        unreceivedAdultDays: 30,
        unreceivedMinorDays: 14,
        parentConfirmationDays: 7,
        activeAdultDays: 365,
        activeMinorTrimDays: 182,
        activeMinorDeleteDays: 365,
        withdrawalDeleteDays: 7,
    },
    /** Minimum group sizes for any aggregate figure. */
    minGroupSize: { adults: 10, minors: 20 },
};
