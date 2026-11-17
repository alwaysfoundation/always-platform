/**
 * Message templates. Warm, short, no faith details in staff alerts (PV-8), no personal
 * data beyond what the message needs. SMS to minors only 8am to 8pm (enforced by the sender).
 */
export const TEMPLATES: Record<string, { subject: string; body: string }> = {
  'offer.new': { subject: 'Someone near you is looking for a next step', body: 'Someone near you has asked for a next step, and your church has been offered the chance to welcome them. Open your inbox to accept or pass.\n\n{inboxUrl}\n\nYou receive this because your church is a verified partner on Always.' },
  'offer.reminder': { subject: 'Someone is still waiting to hear from you', body: 'An introduction is waiting in your inbox. Please accept or pass, so it can move on to another church if you can\'t take it.\n\n{inboxUrl}' },
  'offer.expired': { subject: 'An introduction has moved on', body: 'An introduction offered to your church has moved on to another church or ministry nearby. No action needed.' },
  'offer.returned': { subject: 'An introduction has been returned', body: 'We didn\'t see first contact logged for an introduction you accepted, so it has been returned to the network. If you did get in touch, let us know at hello@alwaysfoundation.org.' },
  'claim.approved': { subject: 'Your church page is ready', body: 'Thanks for claiming your church on Always. You can now sign in, set up your page and choose the next steps you offer.\n\n{appUrl}\n\nTo receive introductions, your connect lead completes the welcoming course and we confirm your church with your denomination or network.' },
  'claim.declined': { subject: 'About your church claim', body: 'Thanks for your request to manage a church page on Always. We weren\'t able to confirm it this time. Reply to hello@alwaysfoundation.org and we\'ll help.' },
  'care.hello': { subject: 'Someone could use a hello', body: 'A person hasn\'t been accepted by a church yet. Please send them a warm hello.\n\n{inboxUrl}' },
  'care.assign': { subject: 'Someone needs a next step', body: 'No church or ministry nearby could take this person. Please get in touch and help them find a next step.\n\n{inboxUrl}' },
  'person.thanks': { subject: '', body: "Thanks for reaching out. A church nearby will be in touch. See what's happening, or change your mind, here: {link}" },
  'person.church_will_contact': { subject: '', body: '{church} would love to welcome you and will be in touch. See details or change your mind: {link}' },
  'parent.confirm': { subject: '', body: 'Your child asked to be connected with a local church youth group through Always. Please confirm here if you are happy for this: {link}' },
};
