const API_BASE = '/api';

const playerList = document.getElementById('player-list');
let players = [];

const url = new URL(window.location.href);

async function createPlayerList() {
  playerList.innerHTML = '';
  await fetch(`${API_BASE}/player-stats/list`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      players = data.players;
      players.sort((a, b) => a.name.localeCompare(b.name));
      players.forEach(player => {
        playerList.innerHTML += /*html*/`
          <a href="?player=${player.name}" class="player">
            <div class="player-header">
              <img src="https://api.mineatar.io/face/${player.uuid}?scale=16" class="player-avatar" alt="" />
              <h4>${player.name}</h4>
            </div>
            <p class="player-uuid">UUID: ${player.uuid}</p>
          </a>
        `;
      });
    })
    .catch(error => {
      throw new Error('Error fetching player list: ' + error);
    });
}

async function displayPlayer(player) {
  const playerStatsDiv = document.getElementById('player-stats');
  playerStatsDiv.style.display = 'block';
  playerStatsDiv.innerHTML = /*html*/`
    <div class="player-header">
      <div id="player-avatar-placeholder" class="player-avatar-placeholder">${player.name[0].toUpperCase()}</div>
      <h2 id="player-name">${player.name}</h2>
    </div>
    <p class="player-uuid">UUID: ${player.uuid}</p>
    <p>Raw player stats:</p>
    <pre id="player-stats" class="player-stats"></pre>
  `;

  const img = document.createElement('img');
  img.src = `https://api.mineatar.io/face/${player.uuid}?scale=32`;
  img.alt = '';
  img.className = 'player-avatar';
  img.onload = () => {
    playerStatsDiv.querySelector('#player-avatar-placeholder').replaceWith(img);
  };

  await fetch(`${API_BASE}/player-stats/${player.uuid}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      const stats = playerStatsDiv.querySelector('#player-stats');
      stats.textContent = JSON.stringify(data, null, 2);
    })
    .catch(error => {
      throw new Error('Error fetching player stats: ' + error);
    });
}

async function displayPlayerFromURL() {
  const playerName = url.searchParams.get('player');
  if (playerName) {
    const player = players.find(p => p.name.toLowerCase() === playerName.toLowerCase() || p.uuid.toLowerCase() === playerName.toLowerCase().replace(/-/g, ''));
    if (player) {
      await displayPlayer(player);
    } else {
      throw new Error(`Player "${playerName}" not found.`);
    }
  }
}

async function init() {
  try {
    await createPlayerList();
    await displayPlayerFromURL();
  } catch (error) {
    const errorDiv = document.getElementById('error');
    const errorMessage = document.getElementById('error-message');
    errorDiv.style.display = 'block';
    errorMessage.textContent = error.message;
  } finally {
    const loadingDiv = document.getElementById('loading');
    loadingDiv.style.display = 'none';
  }
}

init();
