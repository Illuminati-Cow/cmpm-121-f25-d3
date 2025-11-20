import type { CoinMemento } from "./generation.ts";
export interface GameConfig {
  debugMovement: boolean;
}

export interface PlayerState {
  lat: number;
  lng: number;
}

export interface PersistedCoinEntry {
  cellId: string;
  memento: CoinMemento | null;
}

export interface GameState {
  config: GameConfig;
  player: PlayerState;
  persistedCoins?: PersistedCoinEntry[];
  inventoryCoin?: CoinMemento | null;
}

const STORAGE_KEY = "gameState";

export function loadGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const state: GameState = {
        config: {
          debugMovement: Boolean(parsed.config.debugMovement),
        },
        player: parsed.player,
      };
      if (Array.isArray(parsed.persistedCoins)) {
        const entries: PersistedCoinEntry[] = [];
        for (const e of parsed.persistedCoins) {
          if (e && typeof e.cellId === "string") {
            if (e.memento === null) {
              entries.push({ cellId: e.cellId, memento: null });
            } else if (e.memento && typeof e.memento === "object") {
              const m = e.memento;
              if (
                typeof m.id === "string" &&
                typeof m.value === "number" &&
                typeof m.lat === "number" &&
                typeof m.lng === "number" &&
                typeof m.q === "number" &&
                typeof m.r === "number" &&
                Array.isArray(m.history)
              ) {
                entries.push({ cellId: e.cellId, memento: m as CoinMemento });
              }
            }
          }
        }
        state.persistedCoins = entries;
      }
      if (parsed.inventoryCoin) {
        const m = parsed.inventoryCoin;
        if (
          m === null ||
          (typeof m === "object" &&
            typeof m.id === "string" &&
            typeof m.value === "number" &&
            typeof m.lat === "number" &&
            typeof m.lng === "number" &&
            typeof m.q === "number" &&
            typeof m.r === "number" &&
            Array.isArray(m.history))
        ) {
          state.inventoryCoin = m as CoinMemento | null;
        }
      }
      return state;
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function saveGameState(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) {
    // Ignore storage errors (quota, privacy mode, etc.)
  }
}
