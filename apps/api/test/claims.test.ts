import { describe, it, expect } from 'vitest';
import { emailMatchesWebsite, websiteHost } from '../src/claims.js';

describe('email matches website', () => {
  it('matches the exact host, ignoring www, case and a missing scheme', () => {
    expect(websiteHost('https://www.Hillview.org.au/about')).toBe('hillview.org.au');
    expect(emailMatchesWebsite('sam@hillview.org.au', 'www.hillview.org.au')).toBe(true);
    expect(emailMatchesWebsite('SAM@Hillview.org.au', 'http://hillview.org.au')).toBe(true);
  });
  it('refuses near misses, subdomains, shared hosts and missing websites', () => {
    expect(emailMatchesWebsite('sam@hillview.org', 'hillview.org.au')).toBe(false);
    expect(emailMatchesWebsite('sam@mail.hillview.org.au', 'hillview.org.au')).toBe(false);
    expect(emailMatchesWebsite('sam@hillview.org.au', 'kids.hillview.org.au')).toBe(false);
    expect(emailMatchesWebsite('sam@gmail.com', 'gmail.com')).toBe(false);
    expect(emailMatchesWebsite('sam@facebook.com', 'https://facebook.com/hillview')).toBe(false);
    expect(emailMatchesWebsite('sam@hillview.org.au', null)).toBe(false);
    expect(emailMatchesWebsite('sam@hillview.org.au', 'not a url')).toBe(false);
  });
});
