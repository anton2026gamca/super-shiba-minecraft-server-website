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
  const statsHtml = /*html*/`
    <a href="#cpu-usage" class="stat-card ${getStatClass(system.cpu || 0)}">
      <div class="stat-icon"><i class="fa-solid fa-microchip"></i></div>
      <div class="stat-value">${system.cpu ? system.cpu.percent.toFixed(1) + '%' : 'N/A'}</div>
      <div class="stat-label">CPU Usage</div>
    </a>
    <a href="#ram-usage" class="stat-card ${getStatClass(system.ram)}">
      <div class="stat-icon"><i class="fa-solid fa-memory"></i></div>
      <div class="stat-value">${system.memory ? system.memory.percent.toFixed(1) + '%' : 'N/A'}</div>
      <div class="stat-label">RAM Usage</div>
      <div class="text-muted" style="font-size: 0.8rem; margin-top: 5px;">
        ${system.memory && system.memory.used ? system.memory.used.toFixed(0) : '0'} / ${system.memory && system.memory.total ? system.memory.total.toFixed(0) : '0'} MB
      </div>
    </a>
    <a href="#swap-usage" class="stat-card ${getStatClass(system.swap && system.swap.percent ? system.swap.percent : 0)}">
      <div class="stat-icon"><i class="fa-solid fa-memory"></i></div>
      <div class="stat-value">${system.swap && system.swap.percent ? system.swap.percent.toFixed(1) + '%' : '0%'}</div>
      <div class="stat-label">Swap Usage</div>
      <div class="text-muted" style="font-size: 0.8rem; margin-top: 5px;">
        ${system.swap && system.swap.used ? system.swap.used.toFixed(0) : '0'} / ${system.swap && system.swap.total ? system.swap.total.toFixed(0) : '0'} MB
      </div>
    </a>
    <a href="#disk-usage" class="stat-card ${getStatClass(system.disk && system.disk.percent ? system.disk.percent : 0)}">
      <div class="stat-icon"><i class="fa-solid fa-hard-drive"></i></div>
      <div class="stat-value">${system.disk && system.disk.percent ? system.disk.percent.toFixed(1) + '%' : '0%'}</div>
      <div class="stat-label">Disk Usage</div>
      <div class="text-muted" style="font-size: 0.8rem; margin-top: 5px;">
        ${system.disk && system.disk.used ? system.disk.used.toFixed(1) : '0'} / ${system.disk && system.disk.total ? system.disk.total.toFixed(1) : '0'} GB
      </div>
    </a>
    <a href="#cpu-temp" class="stat-card ${system.temp ? getStatClass(system.temp, 60, 75) : ''}">
      <div class="stat-icon"><i class="fa-solid fa-temperature-half"></i></div>
      <div class="stat-value">${system.temp ? system.temp.toFixed(1) + '°C' : 'N/A'}</div>
      <div class="stat-label">CPU Temp</div>
    </a>
    <a href="#network-traffic" class="stat-card">
      <div class="stat-icon"><i class="fa-solid fa-arrow-down"></i></div>
      <div class="stat-value">${system.network && system.network.bytes_recv ? system.network.bytes_recv.toFixed(1) : '0.0'}</div>
      <div class="stat-label">Network RX (MB)</div>
    </a>
    <a href="#network-traffic" class="stat-card">
      <div class="stat-icon"><i class="fa-solid fa-arrow-up"></i></div>
      <div class="stat-value">${system.network && system.network.bytes_sent ? system.network.bytes_sent.toFixed(1) : '0.0'}</div>
      <div class="stat-label">Network TX (MB)</div>
    </a>
  `;
  document.getElementById('system-stats').innerHTML = statsHtml;
}

function updateContainers(containers, history) {
  if (!containers || containers.length === 0) {
    document.getElementById('containers').innerHTML = '<p class="text-muted text-center">No containers running</p>';
    return;
  }

  Object.values(charts.containers || {}).forEach(chart => chart.destroy());
  charts.containers = {};

  const containersHtml = containers.map(c => /*html*/`
    <div class="container-item" data-container="${c.name}">
      <h4>
        <i class="fa-brands fa-docker"></i>
        ${c.name}
        <span class="status-badge ${c.status}">${c.status}</span>
        <i class="fa-solid fa-chevron-down expand-icon"></i>
      </h4>
      <div class="container-stats">
        <div class="container-stat">
          <i class="fa-solid fa-microchip"></i> CPU: <strong>${c.cpu_percent.toFixed(1)}%</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-memory"></i> Memory: <strong>${c.memory_usage_mb.toFixed(0)} MB (${c.memory_percent.toFixed(1)}%)</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-arrow-down"></i> RX: <strong>${c.network && c.network.bytes_recv ? c.network.bytes_recv.toFixed(2) : '0.00'} MB</strong>
        </div>
        <div class="container-stat">
          <i class="fa-solid fa-arrow-up"></i> TX: <strong>${c.network && c.network.bytes_sent ? c.network.bytes_sent.toFixed(2) : '0.00'} MB</strong>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="container-${c.name}-chart"></canvas>
      </div>
    </div>
  `).join('');
  document.getElementById('containers').innerHTML = containersHtml;
  document.querySelectorAll('.container-item').forEach(header => {
    header.addEventListener('click', function() {
      this.classList.toggle('expanded');
    });
  });

  const labels = history.map(d => {
    const date = new Date(d.timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  });
  containers.forEach((c, i) => {
    charts.containers[c.name] = new Chart(document.getElementById(`container-${c.name}-chart`), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'CPU Usage (%)',
            data: history.map(d => (d.containers && d.containers[i] ? d.containers[i].cpu_percent : null)),
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'RAM Usage (%)',
            data: history.map(d => (d.containers && d.containers[i] ? d.containers[i].memory_percent : null)),
            borderColor: '#2ecc71',
            backgroundColor: 'rgba(46, 204, 113, 0.1)',
            tension: 0.4,
            fill: true
          }
        ]
      },
      options: {
        ...chartOptions,
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          ...chartOptions.scales,
          y: {
            ...chartOptions.scales.y,
            max: 100
          }
        }
      }
    });
  });
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
        data: history.map(d => d.system.cpu ? d.system.cpu.percent : null),
        borderColor: '#f39c12',
        backgroundColor: 'rgba(243, 156, 18, 0.1)',
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
        data: history.map(d => (d.system && d.system.memory ? d.system.memory.percent : null)),
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

  if (charts.swap) charts.swap.destroy();
  charts.swap = new Chart(document.getElementById('swap-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Swap Usage (%)',
        data: history.map(d => (d.system && d.system.swap ? d.system.swap.percent : null)),
        borderColor: '#16a085',
        backgroundColor: 'rgba(22,160,133,0.1)',
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

  if (charts.disk) charts.disk.destroy();
  charts.disk = new Chart(document.getElementById('disk-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'Disk Usage (%)',
        data: history.map(d => (d.system && d.system.disk ? d.system.disk.percent : null)),
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

  if (charts.temp) charts.temp.destroy();
  charts.temp = new Chart(document.getElementById('temp-chart'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        label: 'CPU Temperature (°C)',
        data: history.map(d => (d.system ? (d.system.temp || null) : null)),
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
          data: history.map(d => (d.system && d.system.network ? d.system.network.bytes_recv : null)),
          borderColor: 'rgba(120, 79, 255, 1)',
          backgroundColor: 'rgba(120, 79, 255, 0.1)',
          tension: 0.4,
          fill: true
        },
        {
          label: 'TX (MB)',
          data: history.map(d => (d.system && d.system.network ? d.system.network.bytes_sent : null)),
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
      fetch(`${API_BASE}/resource-usage/now`),
      fetch(`${API_BASE}/resource-usage/history`)
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
    updateContainers(nowData.containers, historyData.data);
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