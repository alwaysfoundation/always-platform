/**
 * Message templates. Warm, short, no faith details in staff alerts (PV-8), no personal
 * data beyond what the message needs. SMS to minors only 8am to 8pm (enforced by the sender).
 */
export const TEMPLATES: Record<string, { subject: string; body: string }> = {
  'offer.new': { subject: 'Someone is waiting to hear from you', body: 'Someone near you has asked for a next step and your church has been offered the chance to welcome them. You have 2 staffed hours to accept or pass.\n\nOpen your inbox: {inboxUrl}' },
  'offer.reminder': { subject: 'Reminder: someone is still waiting', body: 'An introduction is waiting in your inbox. Please accept or pass so they are not left waiting.\n\n{inboxUrl}' },
  'offer.expired': { subject: 'An introduction has moved on', body: 'An introduction offered to your church has moved on to the next church so the person is not left waiting. No action needed.' },
  'offer.returned': { subject: 'An introduction has been returned', body: 'First contact was not recorded within 24 hours, so this introduction has been returned to the network. If you did make contact, please let the care team know.' },
  'care.hello': { subject: 'Care team: send a hello', body: 'A person has not been accepted by a church within the first staffed hour. Please send a warm hello.\n\n{inboxUrl}' },
  'care.assign': { subject: 'Care team: a person needs you', body: 'A person has been passed to the care team. Please make contact.\n\n{inboxUrl}' },
  'person.thanks': { subject: '', body: "Thanks for reaching out. Someone will be in touch soon. You can see what's happening, or change your mind, here: {link}" },
  'person.church_will_contact': { subject: '', body: '{church} would love to welcome you and will be in touch within a day. See details or change your mind: {link}' },
  'parent.confirm': { subject: '', body: 'Your child asked to be connected with a local church youth group through Always. Please confirm here if you are happy for this: {link}' },
};
