// @deno-types="npm:@types/leaflet"
import leaflet, { LatLng } from "leaflet";
import "leaflet/dist/leaflet.css";
import "./_leafletWorkaround.ts";
import "./style.css";

import { config } from "./config.ts";
import { CoinGenerator, craftCoin, createCoinMemento } from "./generation.ts";
import { Inventory } from "./player.ts";
import { Positioning } from "./positioning.ts";
import { loadGameState, saveGameState } from "./serialization.ts";
import {
  createCoinPopup,
  createInventoryUI,
  createSettingsButton,
  createSettingsWindow,
  settingsWindow,
  updateInventoryUI,
} from "./ui.ts";
import { World } from "./world.ts";

const CLASSROOM_LATLNG = leaflet.latLng(
  36.997936938057016,
  -122.05703507501151,
);

// Tunable gameplay parameters
const GAMEPLAY_ZOOM_LEVEL = 19;
const PLAYER_REACH_DISTANCE = 60; // meters

const eventBus = new EventTarget();
const mapDiv = document.createElement("div");
mapDiv.id = "map";
document.body.append(mapDiv);

// Restore persisted config (and player position if in UI mode) on initial page load only
const restored = loadGameState();
let startLatLng = CLASSROOM_LATLNG;
if (restored) {
  config.debugMovement = restored.config.debugMovement;
  if (restored.player) {
    startLatLng = leaflet.latLng(restored.player.lat, restored.player.lng);
  }
}

const inventory = new Inventory(null, eventBus);
const inventoryUI = createInventoryUI();
mapDiv.append(inventoryUI);
updateInventoryUI(inventory);

const coinGenerator = new CoinGenerator();

const world = new World(leaflet.latLng(0, 0), coinGenerator);
// Restore persisted coins into the world before any updates/rendering
if (restored?.persistedCoins) {
  world.setPersistedEntries(restored.persistedCoins);
}
const map = leaflet.map(mapDiv, {
  center: startLatLng,
  zoom: GAMEPLAY_ZOOM_LEVEL,
  minZoom: GAMEPLAY_ZOOM_LEVEL,
  maxZoom: GAMEPLAY_ZOOM_LEVEL,
  zoomControl: false,
  scrollWheelZoom: false,
});

const initialCell = world.getCellAtLatLng(startLatLng);

const playerPosition = initialCell.center;
const mode: "gps" | "ui" = config.debugMovement ? "ui" : "gps";
// Populate the map with a background tile layer
leaflet
  .tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  })
  .addTo(map);

const settingsButton = createSettingsButton(eventBus);
settingsButton.style.position = "absolute";
settingsButton.style.top = "10px";
settingsButton.style.left = "10px";
settingsButton.style.zIndex = "1000";
mapDiv.append(settingsButton);
document.body.append(createSettingsWindow(eventBus));

const positioning = new Positioning(
  world,
  { position: playerPosition, reach: PLAYER_REACH_DISTANCE },
  {
    position: map.getCenter(),
    reach: map.getBounds().getNorthEast().distanceTo(map.getCenter()),
  },
  map,
  eventBus,
  mode,
);

if (restored?.inventoryCoin) {
  const m = restored.inventoryCoin;
  const cellInstance = world.getCell(m.q, m.r);
  const restoredCoin = {
    id: m.id,
    value: m.value,
    position: leaflet.latLng(m.lat, m.lng),
    cell: cellInstance,
    history: [...m.history],
  };
  inventory.swapItem(restoredCoin);
  updateInventoryUI(inventory);
}

//#region Game Logic

eventBus.addEventListener("inventory-changed", () => {
  updateInventoryUI(inventory);
});

eventBus.addEventListener("coin-hovered", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;
  if (coin.position.distanceTo(positioning.position) > positioning.reach) {
    return; // Out of reach
  }
  createCoinPopup(map, coin);
});

eventBus.addEventListener("coin-clicked", (event) => {
  const detail = (event as CustomEvent).detail;
  const coin = detail.coin;
  if (coin.position.distanceTo(positioning.position) > positioning.reach) {
    return; // Out of reach
  }

  if (inventory.hasItem() && inventory.coin!.value === coin.value) {
    const oldCoin = inventory.coin;
    inventory.swapItem(craftCoin(oldCoin!, coin));
    // Target coin consumed: remove from map and mark cell empty
    world.removeCoin(coin.id, map);
    world.persistRemovedCell(coin.cell.id);
    // Save updated game state including persisted coins
    saveGameState({
      config: { debugMovement: config.debugMovement },
      player: { lat: positioning.position.lat, lng: positioning.position.lng },
      persistedCoins: world.getPersistedEntries(),
      inventoryCoin: inventory.hasItem()
        ? createCoinMemento(inventory.coin!)
        : null,
    });
    if ((inventory.coin?.value ?? 0) >= 256) {
      alert("You have crafted a 256 coin and won the game!");
    }
  } else {
    // Pick up: remove from map and mark cell empty
    world.removeCoin(coin.id, map);
    world.persistRemovedCell(coin.cell.id);
    coin.history.push(`Picked up from cell ${coin.cell.id}`);
    const oldCoin = inventory.swapItem(coin);
    if (oldCoin) {
      oldCoin.position = coin.position;
      oldCoin.cell = coin.cell;
      oldCoin.history.push(`Placed in cell ${coin.cell.id}`);
      world.addCoin(
        oldCoin,
        positioning.position.distanceTo(oldCoin.position) <=
          positioning.reach,
        eventBus,
        map,
      );
      // Persist placed coin state immediately
      world.persistCoinSnapshot(oldCoin);
    }
    saveGameState({
      config: { debugMovement: config.debugMovement },
      player: {
        lat: positioning.position.lat,
        lng: positioning.position.lng,
      },
      persistedCoins: world.getPersistedEntries(),
      inventoryCoin: inventory.hasItem()
        ? createCoinMemento(inventory.coin!)
        : null,
    });
  }
  eventBus.dispatchEvent(new CustomEvent("coin-unhovered"));
});

eventBus.addEventListener("coin-unhovered", () => {
  map.closePopup();
});

map.addEventListener("click", (event: { latlng: LatLng }) => {
  const latlng = event.latlng;
  const cell = world.getCellAtLatLng(latlng);

  const distance = cell.center.distanceTo(positioning.position);
  if (distance > positioning.reach) return;

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
    const placed = inventory.removeItem()!;
    world.addCoin(
      placed,
      true,
      eventBus,
      map,
    );
    // Persist placed coin state immediately
    world.persistCoinSnapshot(placed);
    saveGameState({
      config: { debugMovement: config.debugMovement },
      player: { lat: positioning.position.lat, lng: positioning.position.lng },
      persistedCoins: world.getPersistedEntries(),
      inventoryCoin: inventory.hasItem()
        ? createCoinMemento(inventory.coin!)
        : null,
    });
  }
});

map.on("move", () => {
  // console.log(
  //   "Map moved to:",
  //   map.getCenter(),
  //   "Hex at center:",
  //   world.latLngToHex(map.getCenter().lat, map.getCenter().lng),
  // );
});
//#endregion

//#region Settings
eventBus.addEventListener("toggle-settings", () => {
  settingsWindow!.style.display = settingsWindow!.style.display === "none"
    ? "block"
    : "none";
});

eventBus.addEventListener("new-game", () => {
  inventory.clear();
  updateInventoryUI(inventory);
  world.clear(map);
  // if (mode === "ui") {
  // positioning.resetTo(initialCell.center, eventBus);
  // } else {
  positioning.resetTo(CLASSROOM_LATLNG, eventBus);
  // }
  // localStorage.removeItem("gameState");
});

eventBus.addEventListener("toggle-movement-mode", (event) => {
  const detail = (event as CustomEvent).detail;
  positioning.setMode(detail.mode, eventBus);
  config.debugMovement = detail.mode === "ui";
  saveGameState({
    config: { debugMovement: config.debugMovement },
    player: { lat: positioning.position.lat, lng: positioning.position.lng },
    persistedCoins: world.getPersistedEntries(),
    inventoryCoin: inventory.hasItem()
      ? createCoinMemento(inventory.coin!)
      : null,
  });
});
//#endregion

eventBus.addEventListener("player-moved", () => {
  saveGameState({
    config: { debugMovement: config.debugMovement },
    player: { lat: positioning.position.lat, lng: positioning.position.lng },
    persistedCoins: world.getPersistedEntries(),
    inventoryCoin: inventory.hasItem()
      ? createCoinMemento(inventory.coin!)
      : null,
  });
});
