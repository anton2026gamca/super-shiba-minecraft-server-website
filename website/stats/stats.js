const API_BASE = '/api';
let charts = {};
let autoRefresh = true;
let refreshInterval = null;

Chart.defaults.color = '#ecf0f1';
Chart.defaults.borderColor = '#34495e';

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#ecf0f1'
      }
    }
  },
  scales: {
    x: {
      ticks: { color: '#95a5a6' },
      grid: { color: '#34495e' }
    },
    y: {
      ticks: { color: '#95a5a6' },
      grid: { color: '#34495e' },
      beginAtZero: true
    }
  }
};

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getStatClass(value, warningThreshold = 70, dangerThreshold = 90) {
  if (value >= dangerThreshold) return 'danger';
  if (value >= warningThreshold) return 'warning';
  return '';
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

function updateSystemStats(data) {
  const system = data.system;
  const statsHtml = `
    <div class="stat-card ${getStatClass(system.cpu)}">
      <div class="stat-icon"><i class="fa-solid fa-microchip"></i></div>
      <div class="stat-value">${system.cpu.toFixed(1)}%</div>
      <div class="stat-label">CPU Usage</div>
    </div>
    <div class="stat-card ${getStatClass(system.ram)}">
      <div class="stat-icon"><i class="fa-solid fa-memory"></i></div>
      <div class="stat-value">${system.ram.toFixed(1)}%</div>
      <div class="stat-label">RAM Usage</div>
      <div class="text-muted" style="font-size: 0.8rem; margin-top: 5px;">
        ${system.ram_used_mb.toFixed(0)} / ${system.ram_total_mb.toFixed(0)} MB
      </div>
    </div>
    <div class="stat-card ${getStatClass(system.disk)}">
      <div class="stat-icon"><i class="fa-solid fa-hard-drive"></i></div>
      <div class="stat-value">${system.disk.toFixed(1)}%</div>
      <div class="stat-label">Disk Usage</div>
      <div class="text-muted" style="font-size: 0.8rem; margin-top: 5px;">
        ${system.disk_used_gb.toFixed(1)} / ${system.disk_total_gb.toFixed(1)} GB
      </div>
    </div>
    <div class="stat-card ${system.temperature ? getStatClass(system.temperature, 60, 75) : ''}">
      <div class="stat-icon"><i class="fa-solid fa-temperature-half"></i></div>
      <div class="stat-value">${system.temperature ? system.temperature.toFixed(1) + '°C' : 'N/A'}</div>
      <div class="stat-label">CPU Temp</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon"><i class="fa-solid fa-arrow-down"></i></div>
      <div class="stat-value">${system.network_rx_mb.toFixed(1)}</div>
      <div class="stat-label">Network RX (MB)</div>
    </div>
    <div class="stat-card">
      <div class="stat-icon"><i class="fa-solid fa-arrow-up"></i></div>
      <div class="stat-value">${system.network_tx_mb.toFixed(1)}</div>
      <div class="stat-label">Network TX (MB)</div>
    </div>
  `;
  document.getElementById('system-stats').innerHTML = statsHtml;
}

function updateContainers(containers) {
  if (!containers || containers.length === 0) {
    document.getElementById('containers').innerHTML = '<p class="text-muted text-center">No containers running</p>';
    return;
  }

  const containersHtml = containers.map(c => `
    <div class="container-item">
      <h4>
        <i class="fa-brands fa-docker"></i>
        ${c.name}
        <span class="status-badge ${c.status}">${c.status}</span>
      </h4>
      <div class="container-stats">
        <div class="container-stat">
          <i class="fa-solid fa-microchip"></i> CPU: <strong>${c.cpu_percent.toFixed(1)}%</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-memory"></i> Memory: <strong>${c.memory_usage_mb.toFixed(0)} MB (${c.memory_percent.toFixed(1)}%)</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-arrow-down"></i> RX: <strong>${c.network_rx_mb.toFixed(2)} MB</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-arrow-up"></i> TX: <strong>${c.network_tx_mb.toFixed(2)} MB</strong>
        </div>
      </div>
    </div>
  `).join('');

  document.getElementById('containers').innerHTML = containersHtml;
}

function createCharts(history) {
  const labels = history.map(d => {
    const date = new Date(d.timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  
  if (charts.cpu) charts.cpu.destroy();
  charts.cpu = new Chart(document.getElementById('cpu-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'CPU Usage (%)',
        data: history.map(d => d.system.cpu),
        borderColor: '#3498db',
        backgroundColor: 'rgba(52, 152, 219, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          max: 100
        }
      }
    }
  });

  if (charts.memory) charts.memory.destroy();
  charts.memory = new Chart(document.getElementById('memory-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'RAM Usage (%)',
        data: history.map(d => d.system.ram),
        borderColor: '#2ecc71',
        backgroundColor: 'rgba(46, 204, 113, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: {
      ...chartOptions,
      scales: {
        ...chartOptions.scales,
        y: {
          ...chartOptions.scales.y,
          max: 100
        }
      }
    }
  });

  if (charts.temp) charts.temp.destroy();
  charts.temp = new Chart(document.getElementById('temp-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'CPU Temperature (°C)',
        data: history.map(d => d.system.temperature || null),
        borderColor: '#e74c3c',
        backgroundColor: 'rgba(231, 76, 60, 0.1)',
        tension: 0.4,
        fill: true
      }]
    },
    options: chartOptions
  });

  if (charts.network) charts.network.destroy();
  charts.network = new Chart(document.getElementById('network-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'RX (MB)',
          data: history.map(d => d.system.network_rx_mb),
          borderColor: '#3498db',
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'TX (MB)',
          data: history.map(d => d.system.network_tx_mb),
          borderColor: '#9b59b6',
          backgroundColor: 'rgba(155, 89, 182, 0.1)',
          tension: 0.4,
          fill: true
        }
      ]
    },
    options: chartOptions
  });
}

async function loadStats() {
  try {
    const [nowResponse, historyResponse] = await Promise.all([
      fetch(`${API_BASE}/stats/now`),
      fetch(`${API_BASE}/stats/history`)
    ]);

    if (!nowResponse.ok || !historyResponse.ok) {
      throw new Error('Failed to fetch stats');
    }

    const nowData = await nowResponse.json();
    const historyData = await historyResponse.json();

    if (!nowData || !historyData.data || historyData.data.length === 0) {
      throw new Error('No data available yet. Please wait for stats to be collected.');
    }

    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('stats-content').style.display = 'block';

    updateSystemStats(nowData);
    updateContainers(nowData.containers);
    createCharts(historyData.data);

    document.getElementById('last-update').textContent = new Date().toLocaleString();
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('stats-content').style.display = 'none';
    document.getElementById('error').style.display = 'block';
    document.getElementById('error-message').textContent = error.message;
  }
}

function toggleAutoRefresh() {
  autoRefresh = !autoRefresh;
  const btn = document.getElementById('toggle-auto-refresh');
  
  if (autoRefresh) {
    btn.innerHTML = '<i class="fa-solid fa-pause" aria-hidden="true"></i> Auto-Refresh: ON';
    btn.classList.remove('btn-primary');
    btn.classList.add('btn-secondary');
    startAutoRefresh();
  } else {
    btn.innerHTML = '<i class="fa-solid fa-play" aria-hidden="true"></i> Auto-Refresh: OFF';
    btn.classList.remove('btn-secondary');
    btn.classList.add('btn-primary');
    stopAutoRefresh();
  }
}

function startAutoRefresh() {
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(loadStats, 60000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

document.getElementById('refresh-btn').addEventListener('click', loadStats);
document.getElementById('toggle-auto-refresh').addEventListener('click', toggleAutoRefresh);

loadStats();
startAutoRefresh();