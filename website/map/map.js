const WORLDS_CONFIG = [
  {
    worldName: 'world',
    displayName: 'Overworld',
    defaultZoom: 0,
    maps: [
      { mapName: 'flat', displayName: 'Flat', disabled: false },
      { mapName: 'surface', displayName: '3D', disabled: true }
    ]
  },
  {
    worldName: 'DIM-1',
    displayName: 'Nether',
    defaultZoom: 2,
    maps: [
      { mapName: 'flat', displayName: 'Flat', disabled: false },
      { mapName: 'nether', displayName: '3D', disabled: true }
    ]
  },
  {
    worldName: 'DIM1',
    displayName: 'The End',
    defaultZoom: 2,
    maps: [
      { mapName: 'flat', displayName: 'Flat', disabled: true },
      { mapName: 'the_end', displayName: '3D', disabled: true }
    ]
  }
];

const iframe = document.querySelector('iframe');
const mapButtonsContainer = document.getElementById('map-buttons');
const loadingText = document.getElementById('map-loading');
const playersListContainer = document.getElementById('players-list');
const playerCountElement = document.getElementById('player-count');
const locationWorldElement = document.getElementById('location-world');
const locationXElement = document.getElementById('location-x');
const locationYElement = document.getElementById('location-y');
const locationZElement = document.getElementById('location-z');
let currentMapIndex = 0;
let worldPositions = {};
let currentWorldName = null;
let currentMapName = null;

const url = new URL(window.location.href);

iframe.addEventListener('load', function() {
  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    
    const style = iframeDoc.createElement('style');
    style.textContent = `
      .sidebar,
      .chat,
      .chatbox,
      .chatinput,
      .players,
      .playerlist,
      .compass,
      .coord-control,
      .coordbox,
      .clock,
      .timeofday,
      .weather,
      .link-control,
      .dynmap-playerlist,
      .dynmap-chat,
      .largeclock,
      .dynmap .sidebar,
      .dynmap .compass,
      .digitalsignature,
      div.clock,
      div.link-control,
      div.compass,
      .leaflet-control-layers,
      .leaflet-control-zoom,
      .leaflet-bar,
      a.leaflet-control-zoom-in,
      a.leaflet-control-zoom-out,
      .leaflet-control,
      .dynmap-link-control {
        display: none !important;
      }
    `;

    iframeDoc.head.appendChild(style);
    
    setTimeout(() => {
      updateCurrentPosition();
    }, 1000);
  } catch (e) {
    console.error('Cannot access iframe content (likely cross-origin):', e);
  }
  
  updatePlayers();
  setInterval(updatePlayers, 1000);
  
  initChat(iframe, () => currentWorldName);
  
  setInterval(updateCurrentPosition, 1000);
  
  let _locUpdateScheduled = false;
  const scheduleLocationUpdate = () => {
    if (_locUpdateScheduled) return;
    _locUpdateScheduled = true;
    requestAnimationFrame(() => {
      try { updateLocationDisplay(); } finally { _locUpdateScheduled = false; }
    });
  };

  document.addEventListener('mousemove', scheduleLocationUpdate);
  document.addEventListener('pointermove', scheduleLocationUpdate);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  if (iframeDoc) {
    iframeDoc.addEventListener('mousemove', scheduleLocationUpdate);
    iframeDoc.addEventListener('pointermove', scheduleLocationUpdate);
  }
});

function displayMapsFromConfig() {
  mapButtonsContainer.innerHTML = '';
  loadingText.style.display = 'none';

  let selectedWorldName = url.searchParams.get('world') || WORLDS_CONFIG[0].displayName;
  let selectedWorld = WORLDS_CONFIG.find(w => w.displayName.toLowerCase() === selectedWorldName.toLowerCase().replace('_', ' ')) || WORLDS_CONFIG[0];
  let selectedMap = selectedWorld?.maps.find(m => m.displayName.toLowerCase() === url.searchParams.get('map')?.toLowerCase().replace('_', ' ')) || selectedWorld.maps[0];

  const urlX = url.searchParams.get('x');
  const urlZ = url.searchParams.get('z');
  const urlZoom = url.searchParams.get('zoom');

  WORLDS_CONFIG.forEach((world) => {
    const worldHeader = document.createElement('div');
    worldHeader.classList.add('world-header');
    worldHeader.textContent = world.displayName;
    mapButtonsContainer.appendChild(worldHeader);
    
    world.maps.forEach((map) => {
      const button = document.createElement('button');
      button.className = 'map-button';
      button.textContent = map.displayName;
      button.dataset.worldName = world.worldName;
      button.dataset.mapName = map.mapName;
      button.dataset.defaultZoom = world.defaultZoom;
      const isSelected = selectedWorld.displayName === world.displayName && selectedMap.displayName === map.displayName;
      
      if (map.disabled) {
        button.disabled = true;
        const lock = document.createElement('i');
        lock.className = 'fa-solid fa-lock lock-icon';
        lock.setAttribute('aria-hidden', 'true');
        button.appendChild(lock);
      } else {
        button.addEventListener('click', () => {
          switchToMap(world.worldName, map.mapName, world.defaultZoom);
          document.querySelectorAll('.map-button').forEach(b => b.classList.remove('active'));
          button.classList.add('active');
        });
      }

      if (isSelected) {
        button.classList.add('active');
        currentWorldName = world.worldName;
        currentMapName = map.mapName;
        
        if (urlX !== null && urlZ !== null) {
          worldPositions[world.worldName] = {
            x: parseFloat(urlX),
            z: parseFloat(urlZ),
            zoom: urlZoom !== null ? parseInt(urlZoom) : world.defaultZoom
          };
        }
        
        switchToMap(world.worldName, map.mapName, world.defaultZoom);
      }
      
      mapButtonsContainer.appendChild(button);
    });
  });
}

function switchToMap(worldName, mapName, defaultZoom) {
  if (currentWorldName) {
    updateCurrentPosition();
  }
  
  let position = worldPositions[worldName] || { x: 0, z: 0, zoom: defaultZoom };
  
  const link = `dynmap/?worldname=${encodeURIComponent(worldName)}&mapname=${encodeURIComponent(mapName)}&zoom=${position.zoom}&x=${position.x}&z=${position.z}&y=64`;
  
  currentWorldName = worldName;
  currentMapName = mapName;
  
  iframe.src = link;
}

function updateCurrentPosition() {
  if (!currentWorldName) return;
  
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.dynmap && iframeWindow.dynmap.map) {
      const map = iframeWindow.dynmap.map;
      const center = map.getCenter();
      const zoom = map.getZoom();
      
      if (center && iframeWindow.dynmap.getProjection) {
        const projection = iframeWindow.dynmap.getProjection();
        if (projection && projection.fromLatLngToLocation) {
          const location = projection.fromLatLngToLocation(center, 64);
          worldPositions[currentWorldName] = {
            x: Math.round(location.x),
            z: Math.round(location.z),
            zoom: zoom || 0
          };
        }
      }
    } else {
      const iframeUrl = iframe.contentWindow.location.href;
      const url = new URL(iframeUrl);
      const x = url.searchParams.get('x');
      const z = url.searchParams.get('z');
      const zoom = url.searchParams.get('zoom');
      
      if (x !== null && z !== null) {
        if (!worldPositions[currentWorldName]) {
          worldPositions[currentWorldName] = { x: 0, z: 0, zoom: 0 };
        }
        worldPositions[currentWorldName].x = parseFloat(x);
        worldPositions[currentWorldName].z = parseFloat(z);
        if (zoom !== null) {
          worldPositions[currentWorldName].zoom = parseInt(zoom);
        }
      }
    }
  } catch (e) {
    console.debug('Could not update position:', e.message);
  }
}

function updateLocationDisplay() {
  const dynmapSpans = (iframe.contentDocument).getElementsByClassName('coord-control-value');
  if (dynmapSpans.length <= 0) {
    if (locationXElement) locationXElement.textContent = '---';
    if (locationYElement) locationYElement.textContent = '---';
    if (locationZElement) locationZElement.textContent = '---';
  } else {
    const values = dynmapSpans[0].innerHTML.split(',')
    if (locationXElement) locationXElement.textContent = values[0] || '---';
    if (locationYElement) locationYElement.textContent = values[1] || '---';
    if (locationZElement) locationZElement.textContent = values[2] || '---';
  }

  if (locationWorldElement && currentWorldName) {
    const world = WORLDS_CONFIG.find(w => w.worldName === currentWorldName);
    if (world) {
      locationWorldElement.textContent = world.displayName;
    }
  }
}

displayMapsFromConfig();

function updatePlayers() {
  fetch('dynmap/up/world/world/' + Date.now())
    .then(response => response.json())
    .then(data => {
      displayPlayers(data.players || []);
    })
    .catch(err => {
      fetch('dynmap/up/configuration')
        .then(response => response.json())
        .then(config => {
          if (config.players) {
            displayPlayers(config.players);
          }
        })
        .catch(e => {
          console.error('Error fetching players:', e);
          playerCountElement.textContent = 'Unable to fetch players';
        });
    });
}

function displayPlayers(players) {
  playerCountElement.textContent = `${players.length} player${players.length !== 1 ? 's' : ''} online`;
  
  const currentPlayerNames = new Set(players.map(p => p.name || p.account));
  
  const existingPlayerItems = playersListContainer.querySelectorAll('.player-item');
  existingPlayerItems.forEach(item => {
    const playerName = item.dataset.playerName;
    if (!currentPlayerNames.has(playerName)) {
      item.remove();
    }
  });
  
  players.forEach(player => {
    const playerName = player.name || player.account;
    
    const escapedPlayerName = playerName.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    let playerItem = playersListContainer.querySelector(`.player-item[data-player-name="${escapedPlayerName}"]`);

    if (playerItem) {
      const worldElement = playerItem.querySelector('.player-world');
      const newWorldText = WORLDS_CONFIG.find(w => w.worldName === player.world)?.displayName || '';
      if (worldElement && worldElement.textContent !== newWorldText) {
        worldElement.textContent = newWorldText;
      }
      playerItem.dataset.playerX = player.x !== undefined ? player.x : '';
      playerItem.dataset.playerY = player.y !== undefined ? player.y : '';
      playerItem.dataset.playerZ = player.z !== undefined ? player.z : '';
      playerItem.dataset.playerWorld = player.world || '';
      playerItem.onclick = () => {
        centerOnPlayer({
          name: playerName,
          x: player.x,
          y: player.y,
          z: player.z,
          world: player.world,
          account: player.account
        });
      };
    } else {
      playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      playerItem.dataset.playerName = playerName;
      playerItem.dataset.playerX = player.x !== undefined ? player.x : '';
      playerItem.dataset.playerY = player.y !== undefined ? player.y : '';
      playerItem.dataset.playerZ = player.z !== undefined ? player.z : '';
      playerItem.dataset.playerWorld = player.world || '';

      const avatarPlaceholder = document.createElement('div');
      avatarPlaceholder.classList.add('player-avatar');
      avatarPlaceholder.classList.add('player-avatar-placeholder');
      avatarPlaceholder.textContent = playerName.charAt(0).toUpperCase();

      const avatar = document.createElement('img');
      avatar.className = 'player-avatar';
      avatar.src = `https://mc-heads.net/avatar/${playerName}/24`;
      avatar.alt = playerName.charAt(0).toUpperCase();
      avatar.onload = function() {
        avatarPlaceholder.replaceWith(avatar);
      };
      
      const nameContainer = document.createElement('div');
      nameContainer.style.flex = '1';
      
      const name = document.createElement('div');
      name.className = 'player-name';
      name.textContent = playerName;
      
      const world = document.createElement('div');
      world.className = 'player-world';
      world.textContent = WORLDS_CONFIG.find(w => w.worldName === player.world)?.displayName || '';
      
      nameContainer.appendChild(name);
      if (player.world) {
        nameContainer.appendChild(world);
      }
      
      playerItem.appendChild(avatarPlaceholder);
      playerItem.appendChild(nameContainer);
      
      playerItem.onclick = () => {
        centerOnPlayer({
          name: playerName,
          x: player.x,
          y: player.y,
          z: player.z,
          world: player.world,
          account: player.account
        });
      };
      
      playersListContainer.appendChild(playerItem);
    }
  });
}

function centerOnPlayer(player) {
  try {
    const iframeWindow = iframe.contentWindow;
    
    if (iframeWindow.dynmap && iframeWindow.dynmap.panToPlayer) {
      iframeWindow.dynmap.panToPlayer(player.name || player.account);
    } else if (player.x !== undefined && player.z !== undefined) {
      if (iframeWindow.dynmap && iframeWindow.dynmap.map) {
        const map = iframeWindow.dynmap.map;
        if (map.panTo) {
          const projection = iframeWindow.dynmap.getProjection();
          if (projection) {
            const latlng = projection.fromLocationToLatLng({ x: player.x, y: player.y || 64, z: player.z });
            map.panTo(latlng);
          }
        }
      }
    }
  } catch (e) {
    console.error('Error centering on player:', e);
  }
}

(function() {
  const closeSidebarBtn = document.getElementById('close-sidebar');
  const openSidebarBtn = document.getElementById('open-sidebar');
  const sidebarEl = document.getElementById('sidebar');
  const iframeContainerEl = document.getElementById('iframe-container');

  function closeSidebar() {
    if (!sidebarEl) return;
    sidebarEl.style.display = 'none';
    if (openSidebarBtn) openSidebarBtn.style.display = 'inline-block';
    if (iframeContainerEl) iframeContainerEl.style.flex = '1';
    document.body.classList.add('sidebar-hidden');
    try { localStorage.setItem('ss_sidebar_hidden', '1'); } catch (e) {}
  }

  function openSidebar() {
    if (!sidebarEl) return;
    sidebarEl.style.display = '';
    if (openSidebarBtn) openSidebarBtn.style.display = 'none';
    document.body.classList.remove('sidebar-hidden');
    try { localStorage.removeItem('ss_sidebar_hidden'); } catch (e) {}
  }

  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeSidebar);
  if (openSidebarBtn) openSidebarBtn.addEventListener('click', openSidebar);

  try {
    if (localStorage.getItem('ss_sidebar_hidden')) {
      closeSidebar();
    } else {
      document.body.classList.remove('sidebar-hidden');
    }
  } catch (e) {
    // ignore storage errors
  }
})();

(function() {
  const togglePlayers = document.getElementById('toggle-players');
  const toggleMarkers = document.getElementById('toggle-markers');
  const toggleBorder = document.getElementById('toggle-border');

  function toggleDynmapLayer(layerName, visible) {
    try {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow.dynmap) return;

      const layerManager = iframeWindow.dynmap.layercontrol;
      if (!layerManager) return;

      const layers = layerManager._layers;
      for (let layerId in layers) {
        const layer = layers[layerId];
        if (layer.name && layer.name.toLowerCase().includes(layerName.toLowerCase())) {
          if (visible) {
            if (!iframeWindow.dynmap.map.hasLayer(layer.layer)) {
              iframeWindow.dynmap.map.addLayer(layer.layer);
            }
          } else {
            if (iframeWindow.dynmap.map.hasLayer(layer.layer)) {
              iframeWindow.dynmap.map.removeLayer(layer.layer);
            }
          }
        }
      }
    } catch (e) {
      console.debug('Could not toggle layer:', layerName, e);
    }
  }

  if (togglePlayers) {
    togglePlayers.addEventListener('change', function() {
      toggleDynmapLayer('players', this.checked);
      try {
        localStorage.setItem('ss_show_players', this.checked ? '1' : '0');
      } catch (e) {}
    });

    try {
      const savedState = localStorage.getItem('ss_show_players');
      if (savedState === '0') {
        togglePlayers.checked = false;
      }
    } catch (e) {}
  }

  if (toggleMarkers) {
    toggleMarkers.addEventListener('change', function() {
      toggleDynmapLayer('markers', this.checked);
      try {
        localStorage.setItem('ss_show_markers', this.checked ? '1' : '0');
      } catch (e) {}
    });

    try {
      const savedState = localStorage.getItem('ss_show_markers');
      if (savedState === '0') {
        toggleMarkers.checked = false;
      }
    } catch (e) {}
  }

  if (toggleBorder) {
    toggleBorder.addEventListener('change', function() {
      toggleDynmapLayer('border', this.checked);
      try {
        localStorage.setItem('ss_show_border', this.checked ? '1' : '0');
      } catch (e) {}
    });

    try {
      const savedState = localStorage.getItem('ss_show_border');
      if (savedState === '1') {
        toggleBorder.checked = true;
      }
    } catch (e) {}
  }

  iframe.addEventListener('load', function() {
    setTimeout(() => {
      if (togglePlayers && !togglePlayers.checked) {
        toggleDynmapLayer('players', false);
      }
      if (toggleMarkers && !toggleMarkers.checked) {
        toggleDynmapLayer('markers', false);
      }
      if (toggleBorder && !toggleBorder.checked) {
        toggleDynmapLayer('border', false);
      }
    }, 1500);
  });
})();

(function() {
  function copyLink() {
    const link = new URL(window.location.href);
    if (currentWorldName) {
      link.searchParams.set('world', WORLDS_CONFIG.find(w => w.worldName === currentWorldName)?.displayName.toLowerCase().replace(' ', '_') || '');
      link.searchParams.set('map', currentMapName ? WORLDS_CONFIG.find(w => w.worldName === currentWorldName)?.maps.find(m => m.mapName === currentMapName)?.displayName.toLowerCase().replace(' ', '_') : '');
      const pos = worldPositions[currentWorldName];
      if (pos) {
        link.searchParams.set('x', Math.round(pos.x));
        link.searchParams.set('z', Math.round(pos.z));
        link.searchParams.set('zoom', pos.zoom);
      }
    }
    console.log(link.toString(), link);
    navigator.clipboard.writeText(link.toString())

    const copiedText = document.getElementById('copied-text');
    copiedText.style.animation = 'copied-text-show 1s ease-in-out';
    setTimeout(() => {
      copiedText.style.animation = '';
    }, 1000);
  }

  const copyLinkBtn = document.getElementById('copy-link-btn');
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener('click', copyLink);
  }
})();