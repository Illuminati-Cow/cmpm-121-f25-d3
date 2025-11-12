# Development Plan for Geocoin Collection Game Demo

Based on the REQUIREMENTS.md document, this is a high-level development plan for the singleplayer geocoin collection game demo. The plan is structured around the key features and assignment details (focusing on D3.a and D3.b), with tasks split into logical sections for clarity. Each section includes a markdown checklist of actionable tasks. Tasks are designed to be incremental, starting from foundational setup and progressing to feature implementation. I've avoided any actual code, using pseudo-code only where it helps clarify a critical algorithm or data structure decision (e.g., for deterministic generation or crafting logic).

This plan assumes you're working in TypeScript with Leaflet, Deno, and Vite, as specified. Prioritize tasks that establish the game world and core mechanics first, then layer on UI and end conditions. Use feature flags (e.g., a boolean toggle) to enable/disable original game design elements during D3.a and D3.b development, allowing the base game to remain intact.

## 1. Project Setup and Technologies

- [x] Create basic project structure: Organize source files (e.g., separate modules for game logic, UI, and world generation) in the src/ directory, following a modular pattern like separating concerns into classes or functions for game entities, map handling, and UI components.
- [x] Use the example content of main.ts as a reference, but rewrite the project from scratch.

## 2. Game World (Map, Cells, and Player Positioning)

- [x] Initialize the Leaflet map: Create a scrollable map instance centered on the player's location, using real-world coordinates as the base layer.
- [x] Implement hexagonal cell division: Divide the map into cells with a bounding box of approximately 0.0001 degrees per side (roughly house-sized), using a hexagonal grid pattern for deterministic placement—pseudo-code: for each cell, calculate center from lat/lng offset, store as a data structure with id and bounds.
- [x] Add player positioning: Track the player's current location (e.g., via simulated or real GPS), ensuring the map auto-centers on them and cells generate only near the player to optimize performance.
- [x] Ensure deterministic world generation: Use a seeded random number generator (e.g., based on coordinates) to place objects consistently across loads, avoiding randomness that changes per session—pseudo-code: seed = hash(lat, lng); randomValue = seededRandom(seed).
- [x] Render map objects: Make all game objects (e.g., coins) visible on the map without clicking, using shared or unique sprites for performance.
- [x] Implement efficient cell grid rendering: Create `renderHexGrid` function using image overlay for distant cells, and modify `renderNearbyCells` to only render nearby cells with polygons for performance optimization.
- [x] Implement earth-spanning coordinate system: Anchor the grid at Null Island (0° latitude, 0° longitude) for consistent global positioning.
- [x] Add simulated player movement: Include UI buttons for moving north/south/east/west by one grid step, updating player position and map centering accordingly.
- [ ] Implement cell visibility and memorylessness: Cells spawn/despawn to keep the screen full as the player moves or scrolls; cells forget their state (e.g., coin placements) when out of visibility, allowing farming by moving in/out of range.
- [ ] Restrict interactions to nearby cells: Only cells near the player's current location are interactive; distant cells are visible but not manipulable.

## 3. Geocoins (Generation, Spawning, and History)

- [x] Design coin data structure: Define a coin as an object with properties like numeric value (for D3.a), position, sprite (64x64 bright pixelated texture), and history array (tracking pickups, placements, and combinations as simple event logs).
- [ ] Implement procedural texture generation: Generate coin sprites deterministically based on value or seed, using a pixelation algorithm similar to GitHub avatars—pseudo-code: for each pixel, color = hash(seed + pixelIndex) % brightColors; apply to 64x64 grid.
- [x] Handle coin spawning: Place coins deterministically within cells, ensuring one per cell or sparse distribution, and limit to visible/nearby areas for efficiency.
- [ ] Track coin history: Update the history array on interactions (e.g., pickup: add {action: 'picked_up', location: latLng}; placement: add {action: 'placed', location: latLng}).
- [ ] Enforce carrying limit: Prevent picking up more than one coin at a time, using a simple state check in the player's inventory.
- [ ] Implement memoryless coin state: When cells despawn, reset coin states (e.g., remove placed coins) so they regenerate on re-entry, enabling farming mechanics.

## 4. Inventory and UI

- [x] Create inventory UI: Design a persistent on-screen GUI element (e.g., a fixed panel) showing the single inventory slot, displaying the held coin's sprite and value if present.
- [ ] Implement coin pickup interaction: Detect proximity (set distance threshold), show a pop-up on click with coin details (value, history preview), and add a "Pick Up" button that moves the coin to inventory.
- [x] Visualize detection proximity radius by only rendering the cell overlay for cells within the player's reach, and render coins that are not within reach in grayscale.
- [ ] Handle inventory conflicts: If holding a coin, show swap/craft options in the pop-up for new coins, using conditional UI logic to display buttons based on current inventory state.
- [ ] Integrate with map: Ensure UI elements overlay the Leaflet map without interfering with scrolling or zooming.
- [ ] Add movement simulation buttons: Create UI buttons (e.g., north, south, east, west) to simulate player movement by one grid step, updating position and triggering cell updates.

## 5. Crafting

- [ ] Implement basic crafting logic: Allow placing a held coin on another by clicking near it, checking if values match (D3.a requirement)—pseudo-code: if heldCoin.value == targetCoin.value, newValue = heldCoin.value + targetCoin.value; else, deny.
- [ ] Merge coin sprites: On successful craft, combine textures visually (e.g., overlay or blend pixels), updating the resulting coin's sprite.
- [ ] Merge histories: Combine history arrays from both coins into the new coin's history, preserving chronological order.
- [ ] Update inventory post-craft: Replace held coin with the crafted result, removing the placed coin from the map.

## 6. End Condition and Polish

- [ ] Implement win condition: Check after crafting if the new coin's value equals 256, triggering a game-over screen or message.
- [ ] Add game state management: Use the memento pattern to track inventory, coins, and progress, ensuring persistence across sessions if needed.
- [ ] Test determinism and performance: Verify world generation consistency and optimize for large maps (e.g., lazy-load cells).
- [ ] Polish UI/UX: Ensure responsive design for mobile/touch, add loading states, and refine pop-ups for clarity.