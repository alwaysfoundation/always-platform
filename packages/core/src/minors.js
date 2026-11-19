export function rulesFor(band) {
    // CY-1: no band given is treated as under 13.
    const b = band ?? 'under13';
    switch (b) {
        case 'under13':
            return { collectOwnDetails: false, requiresParentConfirmation: true, requiresChildAssent: true, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
        case '13-14':
            return { collectOwnDetails: true, requiresParentConfirmation: true, requiresChildAssent: true, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
        case '15-17':
            return { collectOwnDetails: true, requiresParentConfirmation: false, requiresChildAssent: false, youthPartnersOnly: true, aiAllowed: false, bulkAllowed: false, isMinor: true };
        case '18+':
            return { collectOwnDetails: true, requiresParentConfirmation: false, requiresChildAssent: false, youthPartnersOnly: false, aiAllowed: true, bulkAllowed: true, isMinor: false };
    }
}
/** CY-3: if there is reason to believe a stated age is wrong, the lower band applies. */
export function lowerBand(a, b) {
    const order = ['under13', '13-14', '15-17', '18+'];
    return order[Math.min(order.indexOf(a), order.indexOf(b))];
}
