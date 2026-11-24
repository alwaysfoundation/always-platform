/** Line icons used across the app. 24px grid, 1.8 stroke, inherit colour. */
const PATHS: Record<string, string> = {
  home: 'M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z',
  inbox: 'M4 13.5 6.5 5h11L20 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM4 13.5h4.5l1.5 2.5h4l1.5-2.5H20',
  ai: 'M12 3.5c.8 4.6 3.1 6.9 7.7 7.7-4.6.8-6.9 3.1-7.7 7.7-.8-4.6-3.1-6.9-7.7-7.7 4.6-.8 6.9-3.1 7.7-7.7z',
  reports: 'M5 20V10M10 20V5M15 20v-7M20 20v-4',
  settings: 'M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.4 7.4 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 2.6-1.5l2.4 1 2-3.4z',
  foundation: 'M4 20h16M6 20V9l6-4 6 4v11M10 20v-5h4v5',
  arrow: 'M5 12h13M13 6l6 6-6 6',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
  chat: 'M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3.5V6a1 1 0 0 1 1-1z',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6.5 6.5 0 0 1 3.5 6',
  shield: 'M12 3 5 6v5.5c0 4.4 3 7.8 7 9.5 4-1.7 7-5.1 7-9.5V6z',
  paint: 'M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1.2-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3zM7.5 12h.01M9.5 7.5h.01M14.5 7.5h.01',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  out: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
};

export function Icon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="ic" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
