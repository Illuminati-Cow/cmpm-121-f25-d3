// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import { World } from "./world.ts";

export type Direction =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest";

const directionDeltas: Record<Direction, { dq: number; dr: number }> = {
  north: { dq: 0, dr: -1 }, // Approximate north as northwest
  northeast: { dq: 1, dr: -1 },
  east: { dq: 1, dr: 0 },
  southeast: { dq: 0, dr: 1 },
  south: { dq: 0, dr: 1 }, // Approximate south as southeast
  southwest: { dq: -1, dr: 1 },
  west: { dq: -1, dr: 0 },
  northwest: { dq: 0, dr: -1 }, // Same as north
};

export class Positioning {
  private currentPosition: leaflet.LatLng;
  private world: World;

  constructor(world: World, initialPosition: leaflet.LatLng) {
    this.world = world;
    this.currentPosition = initialPosition;
  }

  get position(): leaflet.LatLng {
    return this.currentPosition;
  }

  // Move to adjacent cell in the specified direction
  move(direction: Direction): void {
    const currentCell = this.world.getCellAtLatLng(this.currentPosition);
    if (!currentCell) return;
    const delta = directionDeltas[direction];
    const newCell = this.world.getCell(
      currentCell.q + delta.dq,
      currentCell.r + delta.dr,
    );
    if (newCell) {
      this.currentPosition = newCell.center;
    }
  }

  // Stub for GPS update
  updateFromGPS(lat: number, lng: number): void {
    // TODO: Implement GPS positioning
    // For now, snap to the cell at the given lat/lng
    const cell = this.world.getCellAtLatLng(leaflet.latLng(lat, lng));
    if (cell) {
      this.currentPosition = cell.center;
    }
  }
}
