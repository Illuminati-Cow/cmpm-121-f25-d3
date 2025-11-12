import { Map } from "leaflet";
import { Coin } from "./generation.ts";

export function createCoinPopup(map: Map, coin: Coin): HTMLElement {
  const container = document.createElement("div");
  container.className = "coin-popup";
  container.innerHTML = `
    <h3>Coin</h3>
    <p>Value: ${coin.value}</p>
    <p>Position: (${coin.position.lat.toFixed(5)}, ${
    coin.position.lng.toFixed(5)
  })</p>
  `;
  map.openPopup(container, coin.position, {
    closeButton: false,
    autoClose: false,
    closeOnClick: true,
  });
  return container;
}

export function createMovementButtons(eventBus: EventTarget): HTMLElement {
  const container = document.createElement("div");
  container.className = "movement-buttons";

  const directions = [
    ["northwest", "↖"],
    ["north", "↑"],
    ["northeast", "↗"],
    ["southwest", "↙"],
    ["south", "↓"],
    ["southeast", "↘"],
  ];

  container.appendChild(
    createButton(directions[0][0], directions[0][1], eventBus),
  );
  container.appendChild(
    createButton(directions[1][0], directions[1][1], eventBus),
  );
  container.appendChild(
    createButton(directions[2][0], directions[2][1], eventBus),
  );

  container.appendChild(document.createElement("p"));
  container.appendChild(document.createElement("p"));
  container.appendChild(document.createElement("p"));

  container.appendChild(
    createButton(directions[3][0], directions[3][1], eventBus),
  );
  container.appendChild(
    createButton(directions[4][0], directions[4][1], eventBus),
  );
  container.appendChild(
    createButton(directions[5][0], directions[5][1], eventBus),
  );

  return container;

  function createButton(
    direction: string,
    symbol: string,
    eventBus: EventTarget,
  ): HTMLButtonElement {
    const button = document.createElement("button");
    button.textContent = symbol;
    button.onclick = () => {
      eventBus.dispatchEvent(
        new CustomEvent("move-player", { detail: { direction } }),
      );
    };
    return button;
  }
}
