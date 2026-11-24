export type Ref = { book: string; chapter: number; verse: number | null; endChapter: number; endVerse: number | null; text: string };
export const BOOK_NAME: Record<string, string>;
export function parseReference(input: string): Ref | null;
export function findReferences(text: string): Ref[];
export function formatReference(r: Ref): string;
