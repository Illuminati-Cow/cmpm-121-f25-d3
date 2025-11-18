import { LatLng } from "leaflet";
import { Coin } from "./generation.ts";

export interface PlayerRadius {
  position: LatLng;
  reach: number;
}

export class Inventory {
  public constructor(private item: Coin | null = null) {}

  public hasItem() {
    return this.item != null;
  }

  public get coin(): Coin | null {
    return this.item;
  }

  public swapItem(newItem: Coin): Coin | null {
    const oldItem = this.item;
    this.item = newItem;
    return oldItem;
  }

  public removeItem(): Coin | null {
    const item = this.item;
    this.item = null;
    return item;
  }

  public clear(): void {
    this.item = null;
  }
}
