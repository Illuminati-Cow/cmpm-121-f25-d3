// @deno-types="npm:@types/leaflet"
import leaflet from "leaflet";
import {
  addCoinEventListeners,
  Coin,
  CoinGenerator,
  CoinMemento,
  createCoinMarker,
  createCoinMemento,
} from "./generation.ts";
import { PlayerRadius } from "./player.ts";

export type HexCoord = {
  q: number;
  r: number;
};
export function HexCoord(q: number, r: number): HexCoord {
  return { q, r };
}

export type Range = {
  min: number;
  max: number;
};
export function Range(min: number, max: number): Range {
  return { min, max };
}

export interface Cell {
  id: string;
  coord: HexCoord;
  center: leaflet.LatLng;
  bounds: leaflet.LatLngBounds;
}

export class SharedCellData {
  constructor(
    public origin: leaflet.LatLng,
    public size: number = 0.00005, // Approximate radius for hex cells, ~0.0001 degrees bounding box
  ) {}

  getCenter(q: number, r: number): leaflet.LatLng {
    // Using flat-top hex coordinates for lat/lng approximation
    // x (lng) = size * (3/2 * q)
    // y (lat) = size * (√3/2 * q + √3 * r)
    const sqrt3 = Math.sqrt(3);
    const lng = this.origin.lng + this.size * (3 / 2 * q);
    const lat = this.origin.lat + this.size * ((sqrt3 / 2) * q + sqrt3 * r);
    return leaflet.latLng(lat, lng);
  }

  getCorners(q: number, r: number): leaflet.LatLng[] {
    const center = this.getCenter(q, r);
    const corners: leaflet.LatLng[] = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i;
      const cornerLng = center.lng + this.size * Math.cos(angle);
      const cornerLat = center.lat + this.size * Math.sin(angle);
      corners.push(leaflet.latLng(cornerLat, cornerLng));
    }
    return corners;
  }

  getBounds(q: number, r: number): leaflet.LatLngBounds {
    const corners = this.getCorners(q, r);
    return leaflet.latLngBounds(corners);
  }
}

export class CellInstance {
  public coord: HexCoord;

  constructor(
    q: number,
    r: number,
    private shared: SharedCellData,
  ) {
    this.coord = { q, r };
  }

  get q(): number {
    return this.coord.q;
  }

  get r(): number {
    return this.coord.r;
  }

  get id(): string {
    return `${this.q},${this.r}`;
  }

  get center(): leaflet.LatLng {
    return this.shared.getCenter(this.q, this.r);
  }

  get bounds(): leaflet.LatLngBounds {
    return this.shared.getBounds(this.q, this.r);
  }

  get corners(): leaflet.LatLng[] {
    return this.shared.getCorners(this.q, this.r);
  }
}

export class World {
  private static readonly CELL_SIZE = 4;
  private static readonly CELL_Q_OFFSET = 0;
  private static readonly CELL_R_OFFSET = 1;
  private static readonly CELL_LAT_OFFSET = 2;
  private static readonly CELL_LNG_OFFSET = 3;
  private cellBuffer: Float32Array;
  private cellCount: number = 0;
  private bufferSize: number = 1000; // initial size
  private sharedData: SharedCellData;
  private activeCoins: Map<
    string,
    { coin: Coin; marker: leaflet.CircleMarker }
  > = new Map();
  private coinsByCell: Map<string, Coin> = new Map();
  private persistedCoins: Map<string, CoinMemento> = new Map();
  private overlays: Map<string, leaflet.ImageOverlay> = new Map();

  constructor(origin: leaflet.LatLng, private coinGenerator: CoinGenerator) {
    this.sharedData = new SharedCellData(origin);
    this.cellBuffer = new Float32Array(this.bufferSize * World.CELL_SIZE);
  }

  restoreCoinFromMemento(memento: CoinMemento): Coin {
    const cell = new CellInstance(memento.q, memento.r, this.sharedData);
    return {
      id: memento.id,
      value: memento.value,
      position: leaflet.latLng(memento.lat, memento.lng),
      cell,
      history: [...memento.history],
    };
  }

  getPersistedCoinForCell(cellId: string): CoinMemento | undefined {
    return this.persistedCoins.get(cellId);
  }

  removePersisted(cellId: string): void {
    this.persistedCoins.delete(cellId);
  }

  private drawHexPath(
    ctx: CanvasRenderingContext2D,
    qr: { q: number; r: number },
    map: leaflet.Map,
    nw: leaflet.Point,
  ): void {
    ctx.beginPath();
    const corners = this.sharedData.getCorners(qr.q, qr.r);
    const firstPoint = map.latLngToContainerPoint(corners[0]);
    ctx.moveTo(firstPoint.x - nw.x, firstPoint.y - nw.y);
    for (let i = 1; i < corners.length; i++) {
      const point = map.latLngToContainerPoint(corners[i]);
      ctx.lineTo(point.x - nw.x, point.y - nw.y);
    }
    ctx.closePath();
  }

  private createHexOverlay(
    map: leaflet.Map,
    qrs: { q: number; r: number }[],
    drawCell: (
      ctx: CanvasRenderingContext2D,
      qr: { q: number; r: number },
      nw: leaflet.Point,
    ) => void,
  ): leaflet.ImageOverlay | undefined {
    if (qrs.length === 0) return;
    performance.mark("create-hex-overlay-start");
    const allCorners = qrs.flatMap((qr) =>
      this.sharedData.getCorners(qr.q, qr.r)
    );
    const bounds = leaflet.latLngBounds(allCorners);
    performance.mark("calculate-bounds-end");

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nw = map.latLngToContainerPoint(bounds.getNorthWest());
    const se = map.latLngToContainerPoint(bounds.getSouthEast());
    const width = Math.abs(se.x - nw.x);
    const height = Math.abs(se.y - nw.y);

    canvas.width = width;
    canvas.height = height;
    performance.mark("setup-canvas-end");

    for (const qr of qrs) {
      drawCell(ctx, qr, nw);
    }
    performance.mark("draw-cells-end");

    const imgUrl = canvas.toDataURL();
    const imageOverlay = leaflet.imageOverlay(imgUrl, bounds);
    imageOverlay.addTo(map);
    performance.mark("create-hex-overlay-end");
    return imageOverlay;
  }

  updateCellsAround(
    centerCoord: HexCoord,
    range: number,
    map: leaflet.Map,
    playerRadius: PlayerRadius,
    eventBus: EventTarget,
  ): void {
    const existingCellIds = this.collectCurrentCellIds();
    const addedCells = this.generateCellsAround(centerCoord, range);

    pruneCoins(this);
    generateCoins(this);
    this.updateCoinReaches(playerRadius);

    function generateCoins(world: World) {
      for (const coord of addedCells.difference(existingCellIds)) {
        const [qStr, rStr] = coord.split(",");
        const cell = new CellInstance(
          Number(qStr),
          Number(rStr),
          world.sharedData,
        );
        const persisted = world.getPersistedCoinForCell(cell.id);
        let coin: Coin | undefined = undefined;
        if (persisted) {
          coin = world.restoreCoinFromMemento(persisted);
          world.removePersisted(cell.id);
        } else {
          coin = world.coinGenerator.generateCoinForCell(cell);
        }
        if (coin) {
          const withinReach = playerRadius.position.distanceTo(coin.position) <=
            playerRadius.reach;
          world.addCoin(coin, withinReach, eventBus, map);
        }
      }
    }

    function pruneCoins(world: World) {
      for (const cellId of existingCellIds.difference(addedCells)) {
        const coin = world.coinsByCell.get(cellId);
        if (coin) {
          if (coin.history.length > 1) { // interacted
            const memento = createCoinMemento(coin);
            world.persistedCoins.set(cellId, memento);
          }
          world.removeCoin(coin.id, map);
        }
      }
    }
  }

  private collectCurrentCellIds(): Set<string> {
    const existingCellIds = new Set<string>();
    for (
      let index = 0;
      index < this.cellCount * World.CELL_SIZE;
      index += World.CELL_SIZE
    ) {
      const q = this.cellBuffer[index + World.CELL_Q_OFFSET];
      const r = this.cellBuffer[index + World.CELL_R_OFFSET];
      existingCellIds.add(`${q},${r}`);
    }
    return existingCellIds;
  }

  private generateCellsAround(
    centerCoord: HexCoord,
    range: number,
  ): Set<string> {
    this.cellCount = 0;
    const addedCells = new Set<string>();
    // Generate new cells within range
    for (let q = centerCoord.q - range; q <= centerCoord.q + range; q++) {
      for (let r = centerCoord.r - range; r <= centerCoord.r + range; r++) {
        const distance =
          (Math.abs(q - centerCoord.q) + Math.abs(r - centerCoord.r) +
            Math.abs((q - centerCoord.q) + (r - centerCoord.r))) / 2;
        if (distance <= range) {
          // Check if buffer needs resizing
          if (this.cellCount * World.CELL_SIZE >= this.cellBuffer.length) {
            const newBuffer = new Float32Array(this.cellBuffer.length * 2);
            newBuffer.set(this.cellBuffer);
            this.cellBuffer = newBuffer;
          }
          const index = this.cellCount * World.CELL_SIZE;
          this.cellBuffer[index + World.CELL_Q_OFFSET] = q;
          this.cellBuffer[index + World.CELL_R_OFFSET] = r;
          const center = this.sharedData.getCenter(q, r);
          this.cellBuffer[index + World.CELL_LAT_OFFSET] = center.lat;
          this.cellBuffer[index + World.CELL_LNG_OFFSET] = center.lng;
          this.cellCount++;
          addedCells.add(`${q},${r}`);
        }
      }
    }
    return addedCells;
  }

  getCell(q: number, r: number): CellInstance {
    return new CellInstance(q, r, this.sharedData);
  }

  getCellAtLatLng(latlng: leaflet.LatLng): CellInstance {
    const coord = this.latLngToHex(latlng.lat, latlng.lng);
    return this.getCell(coord.q, coord.r);
  }

  latLngToHex(lat: number, lng: number): HexCoord {
    const size = this.sharedData.size;
    const origin = this.sharedData.origin;
    const x = lng - origin.lng;
    const y = lat - origin.lat;
    const sqrt3 = Math.sqrt(3);
    const q = (2 / 3) * x / size;
    const r = (-1 / 3 * x + (sqrt3 / 3) * y) / size;
    return { q: Math.round(q), r: Math.round(r) };
  }

  getNearbyCells(
    playerPos: leaflet.LatLng,
    reachDistance: number,
  ): CellInstance[] {
    const nearby: CellInstance[] = [];
    for (
      let index = 0;
      index < this.cellCount * World.CELL_SIZE;
      index += World.CELL_SIZE
    ) {
      const lat = this.cellBuffer[index + World.CELL_LAT_OFFSET];
      const lng = this.cellBuffer[index + World.CELL_LNG_OFFSET];
      const center = leaflet.latLng(lat, lng);
      if (playerPos.distanceTo(center) < reachDistance) {
        const q = this.cellBuffer[index + World.CELL_Q_OFFSET];
        const r = this.cellBuffer[index + World.CELL_R_OFFSET];
        nearby.push(new CellInstance(q, r, this.sharedData));
      }
    }
    return nearby;
  }

  private renderNearbyCells(
    map: leaflet.Map,
    playerRadius: PlayerRadius,
  ): void {
    const nearbyCells = this.getNearbyCells(
      playerRadius.position,
      playerRadius.reach,
    );

    const opacityFunction = (
      distance: number,
      distanceRange: Range,
      weightRange: Range,
    ) => {
      const clamped = Math.min(
        Math.max(distance, distanceRange.min),
        distanceRange.max,
      );
      const range = distanceRange.max - distanceRange.min;
      if (range === 0) return weightRange.min;
      const t = 1 - (clamped - distanceRange.min) / range;
      return weightRange.min + t * (weightRange.max - weightRange.min);
    };

    const nearbyQRs = nearbyCells.map((cell) => ({ q: cell.q, r: cell.r }));
    const overlay = this.createHexOverlay(map, nearbyQRs, (ctx, qr, nw) => {
      const distance = playerRadius.position.distanceTo(
        this.sharedData.getCenter(qr.q, qr.r),
      );
      const weight = opacityFunction(
        distance,
        { min: 10, max: 60 },
        { min: 0.1, max: 0.4 },
      );
      ctx.lineWidth = weight;
      ctx.fillStyle = "rgba(128, 128, 128, 0.1)";
      ctx.strokeStyle = "grey";

      this.drawHexPath(ctx, qr, map, nw);
      ctx.fill();
      ctx.stroke();
    });
    if (overlay) {
      this.overlays.set("nearby", overlay);
    }
  }

  private renderHexGrid(
    map: leaflet.Map,
    playerRadius: PlayerRadius,
  ): void {
    const centerCoord = this.latLngToHex(
      playerRadius.position.lat,
      playerRadius.position.lng,
    );
    const renderRange = 30;
    const allVisibleQRs: HexCoord[] = [];
    for (
      let q = centerCoord.q - renderRange;
      q <= centerCoord.q + renderRange;
      q++
    ) {
      for (
        let r = centerCoord.r - renderRange;
        r <= centerCoord.r + renderRange;
        r++
      ) {
        const distance =
          (Math.abs(q - centerCoord.q) + Math.abs(r - centerCoord.r) +
            Math.abs((q - centerCoord.q) + (r - centerCoord.r))) / 2;
        if (distance <= renderRange) {
          allVisibleQRs.push({ q, r });
        }
      }
    }
    const overlay = this.createHexOverlay(map, allVisibleQRs, (ctx, qr, nw) => {
      ctx.strokeStyle = "lightgrey";
      ctx.lineWidth = 1;

      this.drawHexPath(ctx, qr, map, nw);
      ctx.stroke();
    });
    if (overlay) {
      this.overlays.set("grid", overlay);
    }
  }

  renderHexes(
    map: leaflet.Map,
    playerRadius: PlayerRadius,
    cameraRadius: PlayerRadius,
  ) {
    const nearbyOverlay = this.overlays.get("nearby");
    const gridOverlay = this.overlays.get("grid");
    const hexRadiusM = this.sharedData.size * 10 ** 5; // rough conversion to meters
    const margin = 0.9;
    const apothem = cameraRadius.reach * Math.cos(Math.PI / 6) * margin;
    const distanceToCameraCenter = cameraRadius.position.distanceTo(
      playerRadius.position,
    );
    const playerDistanceToNearbyCenter = nearbyOverlay
      ? nearbyOverlay.getCenter().distanceTo(playerRadius.position)
      : Infinity;
    const cameraDistanceToGridCenter = gridOverlay
      ? gridOverlay.getCenter().distanceTo(cameraRadius.position)
      : Infinity;
    const cameraDistanceToNearbyCenter = nearbyOverlay
      ? nearbyOverlay.getCenter().distanceTo(cameraRadius.position)
      : Infinity;
    if (
      !nearbyOverlay ||
      playerDistanceToNearbyCenter > hexRadiusM ||
      distanceToCameraCenter < cameraRadius.reach &&
        cameraDistanceToNearbyCenter > cameraRadius.reach
    ) {
      this.overlays.forEach((overlay) => map.removeLayer(overlay));
      this.overlays.clear();
      this.renderHexGrid(map, cameraRadius);
      this.renderNearbyCells(map, playerRadius);
    } else if (!gridOverlay || cameraDistanceToGridCenter >= apothem) {
      if (gridOverlay) {
        map.removeLayer(gridOverlay);
        this.overlays.delete("grid");
      }
      this.renderHexGrid(map, cameraRadius);
    }
  }

  addCoin(
    coin: Coin,
    withinReach: boolean,
    eventBus: EventTarget,
    map: leaflet.Map,
  ): void {
    const marker = createCoinMarker(coin, withinReach);
    marker.addTo(map);
    addCoinEventListeners(marker, coin, eventBus);
    this.activeCoins.set(coin.id, { coin, marker });
    this.coinsByCell.set(coin.cell.id, coin);
  }

  removeCoin(id: string, map: leaflet.Map): void {
    const entry = this.activeCoins.get(id);
    if (entry) {
      map.removeLayer(entry.marker);
      this.coinsByCell.delete(entry.coin.cell.id);
      this.activeCoins.delete(id);
    }
  }

  getCoinInCell(cell: CellInstance): Coin | undefined {
    return this.coinsByCell.get(cell.id);
  }

  private updateCoinReaches(playerRadius: PlayerRadius): void {
    for (const [_id, entry] of this.activeCoins) {
      const withinReach =
        playerRadius.position.distanceTo(entry.coin.position) <=
          playerRadius.reach;
      entry.marker.setStyle({
        color: withinReach ? "gold" : "gray",
        fillColor: withinReach ? "yellow" : "white",
        fillOpacity: withinReach ? 0.8 : 0.4,
        opacity: withinReach ? 0.8 : 0.4,
      });
    }
  }

  clear(map: leaflet.Map): void {
    // Remove all active coins from map
    for (const [id, _entry] of this.activeCoins) {
      this.removeCoin(id, map);
    }
    this.activeCoins.clear();
    this.coinsByCell.clear();
    this.persistedCoins.clear();
    this.cellCount = 0;
    this.overlays.forEach((overlay) => map.removeLayer(overlay));
    this.overlays.clear();
  }
}
