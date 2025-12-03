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

function parseStatKey(stat) {
  const parts = stat.split(':');
  let namespace = 'minecraft';
  let name = stat;
  
  if (parts.length > 1) {
    namespace = parts[0];
    name = parts.slice(1).join(':');
  }
  
  return { namespace, name };
}

function formatStatName(stat) {
  const { name } = parseStatKey(stat);
  
  const nameMap = {
    'walk_one_cm': 'Distance Walked',
    'sprint_one_cm': 'Distance Sprinted',
    'crouch_one_cm': 'Distance Crouched',
    'fly_one_cm': 'Distance Flown',
    'swim_one_cm': 'Distance Swam',
    'fall_one_cm': 'Distance Fallen',
    'climb_one_cm': 'Distance Climbed',
    'walk_on_water_one_cm': 'Distance Walked on Water',
    'walk_under_water_one_cm': 'Distance Walked Underwater',
    'boat_one_cm': 'Distance by Boat',
    'horse_one_cm': 'Distance by Horse',
    'pig_one_cm': 'Distance by Pig',
    'minecart_one_cm': 'Distance by Minecart',
    'aviate_one_cm': 'Distance by Elytra',
    'play_one_minute': 'Time Played',
    'time_since_death': 'Time Since Death',
    'time_since_rest': 'Time Since Rest',
    'sneak_time': 'Time Sneaking',
    'total_world_time': 'Total World Time',
    'jump': 'Jumps',
    'leave_game': 'Times Left Game',
    'mob_kills': 'Mob Kills',
    'player_kills': 'Player Kills',
    'damage_dealt': 'Damage Dealt',
    'damage_taken': 'Damage Taken',
    'deaths': 'Deaths',
    'animals_bred': 'Animals Bred',
    'fish_caught': 'Fish Caught',
    'talked_to_villager': 'Villager Interactions',
    'traded_with_villager': 'Villager Trades',
    'eat_cake_slice': 'Cake Slices Eaten',
    'fill_cauldron': 'Cauldrons Filled',
    'use_cauldron': 'Cauldron Uses',
    'clean_armor': 'Armor Cleaned',
    'clean_banner': 'Banners Cleaned',
    'interact_with_beacon': 'Beacon Interactions',
    'interact_with_brewingstand': 'Brewing Stand Uses',
    'interact_with_campfire': 'Campfire Interactions',
    'interact_with_crafting_table': 'Crafting Table Uses',
    'interact_with_furnace': 'Furnace Uses',
    'interact_with_blast_furnace': 'Blast Furnace Uses',
    'interact_with_smoker': 'Smoker Uses',
    'interact_with_lectern': 'Lectern Interactions',
    'interact_with_loom': 'Loom Uses',
    'interact_with_stonecutter': 'Stonecutter Uses',
    'open_chest': 'Chests Opened',
    'open_enderchest': 'Ender Chests Opened',
    'open_shulker_box': 'Shulker Boxes Opened',
    'open_barrel': 'Barrels Opened',
    'inspect_dispenser': 'Dispensers Inspected',
    'inspect_dropper': 'Droppers Inspected',
    'inspect_hopper': 'Hoppers Inspected',
    'trigger_trapped_chest': 'Trapped Chests Triggered',
    'enchant_item': 'Items Enchanted',
    'play_noteblock': 'Note Blocks Played',
    'tune_noteblock': 'Note Blocks Tuned',
    'pot_flower': 'Flowers Potted',
    'ring_bell': 'Bells Rung',
    'raid_trigger': 'Raids Triggered',
    'raid_win': 'Raids Won',
    'target_hit': 'Targets Hit',
  };
  
  if (nameMap[name]) {
    return nameMap[name];
  }
  
  return name
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatNumber(num) {
  return num.toLocaleString();
}

function formatTime(ticks) {
  const seconds = Math.floor(ticks / 20);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatDistance(cm) {
  const meters = cm / 100;
  const km = meters / 1000;
  
  if (km >= 1) {
    return `${km.toFixed(2)} km`;
  } else {
    return `${meters.toFixed(2)} m`;
  }
}

function renderStatsCategory(title, stats, categoryId) {
  if (!stats || Object.keys(stats).length === 0) return '';
  
  const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  
  const totalCount = entries.length;
  const hiddenCount = Math.max(0, totalCount - 10);
  
  const renderedEntries = entries.map(([key, value], index) => {
    const { namespace, name } = parseStatKey(key);
    let formattedValue = formatNumber(value);
    
    const isDeathStat = categoryId === 'killed' || categoryId === 'killed_by';
    
    if (!isDeathStat && (name.includes('one_minute') || name.includes('time') || name.includes('since'))) {
      formattedValue = formatTime(value);
    }
    
    else if ((categoryId == 'custom' || categoryId == 'overview') &&
            (name.includes('_cm') || name.includes('walk') || name.includes('climb') || 
              name.includes('fly') || name.includes('swim') || name.includes('sprint') ||
              name.includes('crouch') || name.includes('fall') || name.includes('boat') ||
              name.includes('horse') || name.includes('pig') || name.includes('minecart') ||
              name.includes('aviate'))) {
      formattedValue = formatDistance(value);
    }
    
    const isHidden = index >= 10 ? 'hidden' : '';
    const modBadge = namespace !== 'minecraft' ? `<span class="mod-badge">${namespace.replace('_', ' ')}</span>` : '';
    
    return /*html*/`
      <div class="stat-item ${isHidden}" data-category="${categoryId}">
        <span class="stat-name">
          ${formatStatName(key)}
          ${modBadge}
        </span>
        <span class="stat-value">${formattedValue}</span>
      </div>
    `;
  }).join('');
  
  const showMoreButton = totalCount > 10 ? /*html*/`
    <button class="show-more-btn" data-category="${categoryId}" data-hidden-count="${hiddenCount}" onclick="toggleCategory('${categoryId}')">
      Show ${hiddenCount} more
    </button>
  ` : '';
  
  return /*html*/`
    <div class="stats-category">
      <h3>${title} <span class="stats-count">(${totalCount})</span></h3>
      <div class="stats-grid">
        ${renderedEntries}
      </div>
      ${showMoreButton}
    </div>
  `;
}

function toggleCategory(categoryId) {
  const allItems = document.querySelectorAll(`.stat-item[data-category="${categoryId}"]`);
  const button = document.querySelector(`.show-more-btn[data-category="${categoryId}"]`);
  
  if (!button) return;
  
  const hiddenCount = parseInt(button.dataset.hiddenCount, 10);
  const isExpanded = button.classList.contains('expanded');
  
  allItems.forEach((item, index) => {
    if (index >= 10) {
      if (isExpanded) {
        item.classList.add('hidden');
      } else {
        item.classList.remove('hidden');
      }
    }
  });
  
  if (isExpanded) {
    button.textContent = `Show ${hiddenCount} more`;
    button.classList.remove('expanded');
  } else {
    button.textContent = 'Show less';
    button.classList.add('expanded');
  }
}

function extractGeneralStats(customStats) {
  if (!customStats) return null;
  
  const generalStats = {};
  const deathsCount = customStats['minecraft:deaths'] || 0;
  
  if (deathsCount > 0) {
    generalStats['deaths'] = deathsCount;
  }
  
  const keyStats = [
    'play_one_minute',
    'mob_kills',
    'player_kills',
    'deaths',
    'damage_dealt',
    'damage_taken',
    'jump',
    'animals_bred',
    'fish_caught',
    'raid_trigger',
    'raid_win',
  ];
  
  keyStats.forEach(stat => {
    const fullKey = `minecraft:${stat}`;
    if (customStats[fullKey] !== undefined) {
      generalStats[stat] = customStats[fullKey];
    }
  });
  
  return Object.keys(generalStats).length > 0 ? generalStats : null;
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
    <div id="stats-content" class="stats-content">
      <div class="loading-stats">Loading stats...</div>
    </div>
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
      const statsContent = playerStatsDiv.querySelector('#stats-content');
      
      let html = '';
      
      if (data.stats) {
        const generalStats = extractGeneralStats(data.stats['minecraft:custom']);
        if (generalStats) {
          html += renderStatsCategory('Overview', generalStats, 'overview');
        }
        html += renderStatsCategory('Mined Blocks', data.stats['minecraft:mined'], 'mined');
        html += renderStatsCategory('Used Items', data.stats['minecraft:used'], 'used');
        html += renderStatsCategory('Broken Items', data.stats['minecraft:broken'], 'broken');
        html += renderStatsCategory('Crafted Items', data.stats['minecraft:crafted'], 'crafted');
        html += renderStatsCategory('Picked Up Items', data.stats['minecraft:picked_up'], 'picked_up');
        html += renderStatsCategory('Dropped Items', data.stats['minecraft:dropped'], 'dropped');
        html += renderStatsCategory('Killed Mobs', data.stats['minecraft:killed'], 'killed');
        html += renderStatsCategory('Killed By', data.stats['minecraft:killed_by'], 'killed_by');
        html += renderStatsCategory('Other', data.stats['minecraft:custom'], 'custom');
      }
      
      if (html === '') {
        html = '<p class="no-stats">No stats available for this player.</p>';
      }
      
      statsContent.innerHTML = html;
    })
    .catch(error => {
      throw new Error('Error fetching player stats: ' + error);
    });
}

window.toggleCategory = toggleCategory;

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
