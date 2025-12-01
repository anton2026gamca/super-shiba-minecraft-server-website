import psutil
import docker
from collections import deque
from datetime import datetime
import threading
import time


HISTORY_MAX_LENGTH = 60
STATS_COLLECTION_INTERVAL = 60
MB = 1024 * 1024
GB = 1024 * 1024 * 1024
THERMAL_ZONE_PATH = '/sys/class/thermal/thermal_zone0/temp'

history = deque(maxlen=HISTORY_MAX_LENGTH)
history_lock = threading.Lock()
docker_client = docker.from_env()


def get_temp():
    try:
        with open(THERMAL_ZONE_PATH, 'r') as f:
            temp = float(f.read().strip()) / 1000.0
            return round(temp, 1)
    except:
        return None

def get_container_memory_usage(container):
        pid = container.attrs['State']['Pid']
        if not pid or pid <= 0:
            return 0.0
        
        main_proc = psutil.Process(pid)
        mem_bytes = main_proc.memory_info().rss
        
        for child in main_proc.children(recursive=True):
            try:
                mem_bytes += child.memory_info().rss
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        
        return mem_bytes / MB
    except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
        print(f"Error accessing process for {container.name}: {e}")
        return 0.0
    except Exception as e:
        print(f"Error getting memory for {container.name}: {e}")
        return 0.0

def calculate_cpu_percent(stats):
    cpu_delta = stats['cpu_stats']['cpu_usage']['total_usage'] - \
                stats['precpu_stats']['cpu_usage']['total_usage']
    system_delta = stats['cpu_stats']['system_cpu_usage'] - \
                   stats['precpu_stats']['system_cpu_usage']
    
    if system_delta > 0 and cpu_delta > 0:
        num_cpus = len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1]))
        return (cpu_delta / system_delta) * num_cpus * 100.0
    return 0.0

def get_container_memory_stats(stats, container):
    mem_stats = stats.get('memory_stats', {})
    mem_usage_cgroup = mem_stats.get('usage', 0)
    mem_limit = mem_stats.get('limit', 0)
    
    if mem_usage_cgroup > 0:
        mem_usage_mb = mem_usage_cgroup / MB
        mem_percent = (mem_usage_cgroup / mem_limit) * 100.0 if mem_limit > 0 else 0.0
    else:
        mem_usage_mb = get_container_memory_usage(container)
        system_mem_total = psutil.virtual_memory().total
        mem_percent = (mem_usage_mb * MB / system_mem_total) * 100.0 if system_mem_total > 0 else 0.0
    
    return mem_usage_mb, mem_percent

def get_network_stats(stats):
    networks = stats.get('networks', {})
    net_rx = sum(net['rx_bytes'] for net in networks.values()) if networks else 0
    net_tx = sum(net['tx_bytes'] for net in networks.values()) if networks else 0
    return round(net_rx / MB, 2), round(net_tx / MB, 2)

def get_container_stats():
    containers_stats = []
    try:
        containers = docker_client.containers.list()
        for container in containers:
            stats = container.stats(stream=False)
            
            cpu_percent = calculate_cpu_percent(stats)
            mem_usage_mb, mem_percent = get_container_memory_stats(stats, container)
            net_rx_mb, net_tx_mb = get_network_stats(stats)
            
            containers_stats.append({
                "name": container.name,
                "cpu_percent": round(cpu_percent, 2),
                "memory_usage_mb": round(mem_usage_mb, 2),
                "memory_percent": round(mem_percent, 2),
                "network_rx_mb": net_rx_mb,
                "network_tx_mb": net_tx_mb,
                "status": container.status
            })
    except Exception as e:
        print(f"Error getting container stats: {e}")
    
    return containers_stats

def get_system_stats():
    mem = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    
    return {
        "cpu": psutil.cpu_percent(interval=0.5),
        "ram": mem.percent,
        "ram_used_mb": round(mem.used / MB, 2),
        "ram_total_mb": round(mem.total / MB, 2),
        "disk": disk.percent,
        "disk_used_gb": round(disk.used / GB, 2),
        "disk_total_gb": round(disk.total / GB, 2),
        "network_rx_mb": round(net.bytes_recv / MB, 2),
        "network_tx_mb": round(net.bytes_sent / MB, 2),
        "temperature": get_temp(),
    }

def get_stats():
    stats_data = {
        "timestamp": datetime.now().isoformat(),
        "system": get_system_stats(),
        "containers": get_container_stats()
    }
    
    return stats_data

def get_history():
    with history_lock:
        return {
            "data": list(history),
            "interval_seconds": STATS_COLLECTION_INTERVAL,
            "max_points": HISTORY_MAX_LENGTH
        }

def get_last_history_entry():
    with history_lock:
        return history[-1] if history else None

def collect_stats():
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
        sleep_time = max(0, STATS_COLLECTION_INTERVAL - elapsed)
        time.sleep(sleep_time)

def start_stats_collection():
    stats_thread = threading.Thread(target=collect_stats, daemon=True)
    stats_thread.start()
    return stats_thread
