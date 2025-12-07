import os
import psutil
import docker
from dataclasses import dataclass
from collections import deque
from datetime import datetime
import threading
import time
from dotenv import load_dotenv
from typing import Any


@dataclass
class ResourceUsageDetail:
    total: float
    used: float
    free: float
    percent: float

@dataclass
class NetworkDetail:
    bytes_sent: float
    bytes_recv: float

@dataclass
class SystemStats:
    cpu: ResourceUsageDetail
    memory: ResourceUsageDetail
    swap: ResourceUsageDetail
    disk: ResourceUsageDetail
    network: NetworkDetail
    temp: float

@dataclass
class ContainerStats:
    name: str
    cpu_percent: float
    memory_usage_mb: float
    memory_percent: float
    network: NetworkDetail

@dataclass
class Stats:
    timestamp: str
    system: SystemStats
    containers: list[ContainerStats]

@dataclass
class StatsHistory:
    data: list[Stats]
    interval_seconds: int
    max_points: int

load_dotenv()

STATS_HISTORY_MAX_LENGTH = int(os.getenv('STATS_HISTORY_MAX_LENGTH', '60'))
STATS_COLLECTION_INTERVAL = int(os.getenv('STATS_COLLECTION_INTERVAL', '60'))
THERMAL_ZONE_PATH = os.getenv('THERMAL_ZONE_PATH', '/sys/class/thermal/thermal_zone0/temp')

MB = 1024 * 1024
GB = 1024 * 1024 * 1024

history: deque[Stats] = deque(maxlen=STATS_HISTORY_MAX_LENGTH)
history_lock: threading.Lock = threading.Lock()
docker_client: docker.DockerClient = docker.from_env()


def get_temp() -> float:
    try:
        with open(THERMAL_ZONE_PATH, 'r') as f:
            temp = float(f.read().strip()) / 1000.0
            return round(temp, 1)
    except:
        return 0

def get_container_memory_usage(container: Any) -> float:
    try:
        pid: int = container.attrs['State']['Pid']
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

def get_container_cpu_percent(stats: dict[str, Any]) -> float:
    cpu_delta: float = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
    system_delta: float = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
    
    if system_delta > 0 and cpu_delta > 0:
        num_cpus = len(stats['cpu_stats']['cpu_usage'].get('percpu_usage', [1]))
        return (cpu_delta / system_delta) * num_cpus * 100.0
    return 0.0

def get_container_memory_stats(stats: dict[str, Any], container: Any) -> tuple[float, float]:
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

def get_container_network_stats(stats: dict[str, Any]) -> NetworkDetail:
    networks: dict[str, Any] = stats.get('networks', {})
    net_rx: float = sum(net['rx_bytes'] for net in networks.values()) if networks else 0
    net_tx: float = sum(net['tx_bytes'] for net in networks.values()) if networks else 0
    return NetworkDetail(
        bytes_sent=round(net_tx / MB, 2),
        bytes_recv=round(net_rx / MB, 2)
    )

def get_container_stats() -> list[ContainerStats]:
    containers_stats: list[ContainerStats] = []
    try:
        containers = docker_client.containers.list()
        for container in containers:
            stats: dict[str, Any] = container.stats(stream=False) # type: ignore
            
            cpu_percent = get_container_cpu_percent(stats)
            mem_usage_mb, mem_percent = get_container_memory_stats(stats, container)
            network_stats = get_container_network_stats(stats)

            containers_stats.append(ContainerStats(
                name=container.name or '',
                cpu_percent=round(cpu_percent, 2),
                memory_usage_mb=round(mem_usage_mb, 2),
                memory_percent=round(mem_percent, 2),
                network=network_stats
            ))
    except Exception as e:
        print(f"Error getting container stats: {e}")
    
    return containers_stats

def get_system_stats() -> SystemStats:
    cpu = psutil.cpu_percent(interval=1)
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    disk = psutil.disk_usage("/")
    net = psutil.net_io_counters()
    temp = get_temp()

    return SystemStats(
        cpu=ResourceUsageDetail(
            total=100.0,
            used=cpu,
            free=100.0 - cpu,
            percent=cpu
        ),
        memory=ResourceUsageDetail(
            total=round(mem.total / MB, 2),
            used=round(mem.used / MB, 2),
            free=round(mem.free / MB, 2),
            percent=mem.percent
        ),
        swap=ResourceUsageDetail(
            total=round(swap.total / MB, 2),
            used=round(swap.used / MB, 2),
            free=round(swap.free / MB, 2),
            percent=swap.percent
        ),
        disk=ResourceUsageDetail(
            total=round(disk.total / GB, 2),
            used=round(disk.used / GB, 2),
            free=round(disk.free / GB, 2),
            percent=disk.percent
        ),
        network=NetworkDetail(
            bytes_sent=round(net.bytes_sent / MB, 2),
            bytes_recv=round(net.bytes_recv / MB, 2)
        ),
        temp=temp
    )

def get_stats() -> Stats:
    return Stats(
        timestamp=datetime.now().isoformat(),
        system=get_system_stats(),
        containers=get_container_stats()
    )

def get_history() -> StatsHistory:
    with history_lock:
        return StatsHistory(
            data=list(history),
            interval_seconds=STATS_COLLECTION_INTERVAL,
            max_points=STATS_HISTORY_MAX_LENGTH
        )

def get_last_history_entry() -> Stats | None:
    with history_lock:
        return history[-1] if history else None

def collect_stats() -> None:
    while True:
        start_time = time.time()
        try:
            data_point = get_stats()
            with history_lock:
                history.append(data_point)
        except Exception as e:
            print(f"Error collecting stats: {e}")
        elapsed = time.time() - start_time
        sleep_time = max(0, STATS_COLLECTION_INTERVAL - elapsed)
        time.sleep(sleep_time)

def start_stats_collection() -> threading.Thread:
    stats_thread = threading.Thread(target=collect_stats, daemon=True)
    stats_thread.start()
    return stats_thread
