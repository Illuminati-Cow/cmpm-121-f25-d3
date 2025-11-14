// @deno-types="npm:@types/leaflet"
import leaflet, { LatLng } from "leaflet";

import "leaflet/dist/leaflet.css";
import "./style.css";

import "./_leafletWorkaround.ts";

import { World } from "./world.ts";

// Import coin generation
import { CoinGenerator, craftCoin } from "./generation.ts";
import { Inventory, PlayerRadius } from "./player.ts";
import { Direction, Positioning } from "./positioning.ts";
import {
  createCoinPopup,
  createInventoryUI,
  createMovementButtons,
  updateInventoryUI,
} from "./ui.ts";

const inventory = new Inventory();

// Create basic UI elements

const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);
const inventoryUI = createInventoryUI();
mapDiv.append(inventoryUI);

updateInventoryUI(inventory);

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const PLAYER_REACH_DISTANCE = 60; // meters

const eventBus = new EventTarget();

const world = new World(leaflet.latLng(0, 0));

// Snap player position to the center of the nearest cell
const initialCell = world.getCellAtLatLng(CLASSROOM_LATLNG);
const playerPosition = initialCell ? initialCell.center : CLASSROOM_LATLNG;

const positioning = new Positioning(world, playerPosition);

const playerRadius: PlayerRadius = {
  position: positioning.position,
  reach: PLAYER_REACH_DISTANCE,
};

eventBus.addEventListener("coin-hovered", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;
  createCoinPopup(map, coin);
});

eventBus.addEventListener("coin-clicked", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;

  if (inventory.hasItem() && inventory.coin!.value === coin.value) {
    const oldCoin = inventory.coin;
    inventory.swapItem(craftCoin(oldCoin!, coin));
    if ((inventory.coin?.value ?? 0) >= 256) {
      alert("You have crafted a 256 coin and won the game!");
    }
  } else {
    const oldCoin = inventory.swapItem(coin);
    if (oldCoin) {
      oldCoin.position = coin.position;
      oldCoin.cell = coin.cell;
      oldCoin.history.push(`Placed in cell ${coin.cell.id}`);
      world.addCoin(
        oldCoin,
        playerRadius.position.distanceTo(oldCoin.position) <=
          playerRadius.reach,
        eventBus,
        map,
      );
    }
  }
  updateInventoryUI(inventory);
  world.removeCoin(coin.id, map);
  eventBus.dispatchEvent(new CustomEvent("coin-unhovered"));
});

eventBus.addEventListener("coin-unhovered", () => {
  map.closePopup();
});

const coinGenerator = new CoinGenerator();

eventBus.addEventListener("move-player", (event) => {
  const detail = (event as CustomEvent).detail;
  const direction = detail.direction as Direction;
  positioning.move(direction);
  playerRadius.position = positioning.position;
  playerMarker.setLatLng(positioning.position);
  map.panTo(positioning.position);
  const coord = world.latLngToHex(
    positioning.position.lat,
    positioning.position.lng,
  );
  const addedCells = world.updateCellsAround(coord, 10, map);
  for (const cell of addedCells) {
    const coin = coinGenerator.generateCoinForCell(cell);
    if (coin) {
      const withinReach =
        playerRadius.position.distanceTo(coin.position) <= playerRadius.reach;
      world.addCoin(coin, withinReach, eventBus, map);
    }
  }
  world.updateCoinReaches(playerRadius);
  world.clearOverlays(map);
  world.renderNearbyCells(map, playerRadius);
  world.renderHexGrid(map, playerRadius);
});

const map = leaflet.map(mapDiv, {
  center: playerPosition,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

map.addEventListener("click", (event: { latlng: LatLng }) => {
  const latlng = event.latlng;
  const cell = world.getCellAtLatLng(latlng);
  if (!cell) return;

  const distance = cell.center.distanceTo(playerRadius.position);
  if (distance > PLAYER_REACH_DISTANCE) return;

  const coinInCell = world.getCoinInCell(cell);
  console.log(coinInCell);
  if (coinInCell) {
    eventBus.dispatchEvent(
      new CustomEvent("coin-clicked", { detail: { coin: coinInCell } }),
    );
  } else if (inventory.hasItem()) {
    inventory.coin!.position = cell.center;
    inventory.coin!.cell = cell;
    inventory.coin!.history.push(`Placed in cell ${cell.id}`);
    world.addCoin(
      inventory.removeItem()!,
      true,
      eventBus,
      map,
    );
    updateInventoryUI(inventory);
  }
});

const playerMarker = leaflet.marker(playerPosition);
playerMarker.bindTooltip("That's you!");
playerMarker.addTo(map);

playerMarker.bindPopup(createMovementButtons(eventBus));
playerMarker.openPopup();

eventBus.dispatchEvent(
  new CustomEvent("move-player", { detail: { direction: "none" } }),
);
