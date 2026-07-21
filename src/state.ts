// Shared mutable game state. One flat bag: modules mutate fields directly,
// mirroring the former IIFE's module-scope `let`s. Field initialization stays
// in game.ts (same order as before); this module imports nothing so it can
// never participate in an import cycle.
export const S: any = {};
