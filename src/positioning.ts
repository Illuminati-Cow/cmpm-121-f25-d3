// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import { PlayerRadius } from "./player.ts";
import { createMovementButtons } from "./ui.ts";
import { World } from "./world.ts";

export type Direction =
  | "north"
  | "northeast"
  | "east"
  | "southeast"
  | "south"
  | "southwest"
  | "west"
  | "northwest"
  | "none";

const directionDeltas: Record<Direction, { dq: number; dr: number }> = {
  north: { dq: 0, dr: 1 },
  northeast: { dq: 1, dr: 0 },
  east: { dq: 1, dr: 0 },
  southeast: { dq: 1, dr: -1 },
  south: { dq: 0, dr: -1 },
  southwest: { dq: -1, dr: 0 },
  west: { dq: -1, dr: 0 },
  northwest: { dq: -1, dr: 1 },
  none: { dq: 0, dr: 0 },
};

export class Positioning {
  private mode: "gps" | "ui" = "gps";
  private watchId: number | null = null;
  public playerMarker: leaflet.Marker;

  constructor(
    private world: World,
    public playerRadius: PlayerRadius,
    private map: leaflet.Map,
    eventBus: EventTarget,
    initialMode: "gps" | "ui" = "gps",
  ) {
    this.playerMarker = leaflet.marker(this.playerRadius.position);
    this.playerMarker.bindTooltip("That's you!");
    this.playerMarker.addTo(this.map);
    this.setMode(initialMode, eventBus);

    eventBus.addEventListener("move-player", (event) => {
      if (this.mode !== "ui") return;
      const detail = (event as CustomEvent).detail;
      const direction = detail.direction as Direction;
      this.move(direction);
      this.onMove(this.playerRadius.position, eventBus);
    });

    this.onMove(this.playerRadius.position, eventBus);
  }

  get position(): leaflet.LatLng {
    return this.playerRadius.position;
  }

  get reach(): number {
    return this.playerRadius.reach;
  }

  // Move to adjacent cell in the specified direction
  private move(direction: Direction): void {
    const currentCell = this.world.getCellAtLatLng(this.playerRadius.position);
    const delta = directionDeltas[direction];
    const newCell = this.world.getCell(
      currentCell.q + delta.dq,
      currentCell.r + delta.dr,
    );
    this.playerRadius.position = newCell.center;
  }

  private onMove(position: leaflet.LatLng, eventBus: EventTarget): void {
    const cell = this.world.getCellAtLatLng(position);
    if (this.playerRadius.position.distanceTo(cell.center) > 1) {
      this.map.panTo(cell.center);
      this.playerRadius.position = cell.center;
    }
    this.playerMarker.setLatLng(this.position);
    const coord = this.world.latLngToHex(
      this.position.lat,
      this.position.lng,
    );
    this.world.updateCellsAround(
      coord,
      10,
      this.map,
      this.playerRadius,
      eventBus,
    );
    this.world.renderHexes(this.map, this.playerRadius);
  }

  setMode(mode: "gps" | "ui", eventBus: EventTarget): void {
    this.mode = mode;
    if (mode === "ui") {
      this.stopGPS();
      this.playerMarker.bindPopup(createMovementButtons(eventBus));
      this.playerMarker.openPopup();
    } else {
      this.playerMarker.closePopup();
      this.playerMarker.unbindPopup();
      this.startGPS(eventBus);
    }
  }

  private startGPS(eventBus: EventTarget): void {
    if (this.watchId) return;
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        this.onMove(
          leaflet.latLng(pos.coords.latitude, pos.coords.longitude),
          eventBus,
        );
      },
      null,
      { enableHighAccuracy: true },
    );
  }

  private stopGPS(): void {
    if (this.watchId) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  resetTo(position: leaflet.LatLng, eventBus: EventTarget): void {
    this.onMove(position, eventBus);
  }
}
