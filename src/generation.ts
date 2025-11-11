// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";

// Import world generation
import { CellInstance, World } from "./world.ts";

// Import our luck function
import luck from "./_luck.ts";

export interface Coin {
  id: string;
  value: number;
  position: leaflet.LatLng;
  cell: CellInstance;
  history: string[];
  sprite?: string; // Placeholder for procedural sprite
}

export type CoinHoveredEventDetail = {
  coin: Coin;
};

export function craftCoin(coinA: Coin, coinB: Coin): Coin {
  const newValue = coinA.value + coinB.value;
  const newCoin: Coin = {
    id: `coin-${coinA.id}-${coinB.id}`,
    value: newValue,
    position: coinA.position, // For simplicity, use position of first coin
    cell: coinA.cell,
    history: [
      ...coinA.history,
      ...coinB.history,
      `Crafted new coin with value ${newValue}`,
    ],
  };
  return newCoin;
}

export class CoinGenerator {
  private coins: Map<string, Coin> = new Map();

  constructor(
    private world: World,
    private spawnProbability: number = 0.1,
  ) {}

  generateCoins(): void {
    for (const cell of this.world.getAllCells()) {
      if (luck(cell.id) < this.spawnProbability) {
        this.spawnCoin(cell);
      }
    }
  }

  private spawnCoin(cell: CellInstance): void {
    const value = Math.floor(luck([cell.q, cell.r, "value"].toString()) * 10) +
      1; // Values 1-10 for D3.a
    const coin: Coin = {
      id: `coin-${cell.id}`,
      value,
      position: cell.center,
      cell,
      history: [`Spawned in cell ${cell.id}`],
    };
    this.coins.set(coin.id, coin);
  }

  getCoins(): Coin[] {
    return Array.from(this.coins.values());
  }

  getCoin(id: string): Coin | undefined {
    return this.coins.get(id);
  }

  removeCoin(id: string): Coin | undefined {
    const coin = this.coins.get(id);
    this.coins.delete(id);
    return coin;
  }
}

export function createCoinMarker(
  coin: Coin,
  withinReach: boolean,
): leaflet.CircleMarker {
  return leaflet.circleMarker(coin.position, {
    color: withinReach ? "gold" : "gray",
    fillColor: withinReach ? "yellow" : "white",
    fillOpacity: withinReach ? 0.8 : 0.4,
    opacity: withinReach ? 0.8 : 0.4,
    radius: 5,
    className: "coin-spawn",
  });
}

export function addCoinEventListeners(
  marker: leaflet.CircleMarker,
  coin: Coin,
  eventBus: EventTarget,
): void {
  marker.addEventListener(
    "mouseover",
    () =>
      eventBus.dispatchEvent(
        new CustomEvent("coin-hovered", { detail: { coin } }),
      ),
  );
  marker.addEventListener(
    "mouseout",
    () =>
      eventBus.dispatchEvent(
        new CustomEvent("coin-unhovered", { detail: { coin } }),
      ),
  );
  marker.addEventListener("mousedown", () => {
    eventBus.dispatchEvent(
      new CustomEvent("coin-clicked", { detail: { coin } }),
    );
  });
}
