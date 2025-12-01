import psutil
import docker
from collections import deque
from datetime import datetime
import threading
import time

history = deque(maxlen=60)
history_lock = threading.Lock()
docker_client = docker.from_env()

def get_temp():
    try:
        with open('/sys/class/thermal/thermal_zone0/temp', 'r') as f:
            temp = float(f.read().strip()) / 1000.0
            return round(temp, 1)
    except:
        return None

def get_container_stats():
    """Get resource usage for each Docker container"""
    containers_stats = []
    try:
        containers = docker_client.containers.list()
        for container in containers:
            stats = container.stats(stream=False)
            
            cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                       stats['precpu_stats']['cpu_usage']['total_usage']
            system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                          stats['precpu_stats']['system_cpu_usage']
            cpu_percent = 0.0
            if system_delta > 0 and cpu_delta > 0:
                cpu_percent = (cpu_delta / system_delta) * len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1])) * 100.0
            
            mem_usage = stats['memory_stats'].get('usage', 0)
            mem_limit = stats['memory_stats'].get('limit', 1)
            mem_percent = (mem_usage / mem_limit) * 100.0 if mem_limit > 0 else 0
            
            networks = stats.get('networks', {})
            net_rx = sum(net['rx_bytes'] for net in networks.values()) if networks else 0
            net_tx = sum(net['tx_bytes'] for net in networks.values()) if networks else 0
            
            containers_stats.append({
                "name": container.name,
                "cpu_percent": round(cpu_percent, 2),
                "memory_usage_mb": round(mem_usage / (1024 * 1024), 2),
                "memory_percent": round(mem_percent, 2),
                "network_rx_mb": round(net_rx / (1024 * 1024), 2),
                "network_tx_mb": round(net_tx / (1024 * 1024), 2),
                "status": container.status
            })
    except Exception as e:
        print(f"Error getting container stats: {e}")
    
    return containers_stats

def get_stats():
    """Get current system and container stats"""
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    
    stats_data = {
        "timestamp": datetime.now().isoformat(),
        "system": {
            "cpu": psutil.cpu_percent(interval=0.5),
            "ram": mem.percent,
            "ram_used_mb": round(mem.used / (1024 * 1024), 2),
            "ram_total_mb": round(mem.total / (1024 * 1024), 2),
            "disk": disk.percent,
            "disk_used_gb": round(disk.used / (1024 * 1024 * 1024), 2),
            "disk_total_gb": round(disk.total / (1024 * 1024 * 1024), 2),
            "network_rx_mb": round(net.bytes_recv / (1024 * 1024), 2),
            "network_tx_mb": round(net.bytes_sent / (1024 * 1024), 2),
            "temperature": get_temp(),
        },
        "containers": get_container_stats()
    }
    
    return stats_data

def get_history():
    with history_lock:
        return {
            "data": list(history),
            "interval_seconds": 60,
            "max_points": 60
        }

def get_last_history_entry():
    with history_lock:
        if history:
            return history[-1]
        else:
            return None

def collect_stats():
    """Background thread to collect stats every minute"""
    while True:
        start_time = time.time()
        try:
            data_point = get_stats()
            
            with history_lock:
                history.append(data_point)
            
            print(f"Collected stats at {data_point['timestamp']}")
        except Exception as e:
            print(f"Error collecting stats: {e}")
        
        elapsed = time.time() - start_time
        sleep_time = max(0, 60 - elapsed)
        time.sleep(sleep_time)

def start_stats_collection():
    """Start the background stats collection thread"""
    stats_thread = threading.Thread(target=collect_stats, daemon=True)
    stats_thread.start()
    return stats_thread
