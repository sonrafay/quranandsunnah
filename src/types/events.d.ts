// src/types/events.d.ts
export {};


declare global {
interface QsOpenNoteDetail { surah: number; ayah: number }
interface QsNoteDeletedDetail { surah: number; ayah: number }


interface WindowEventMap {
'qs-open-note': CustomEvent<QsOpenNoteDetail>;
'qs-note-deleted': CustomEvent<QsNoteDeletedDetail>;
}
}