import os
import json
from dotenv import load_dotenv


load_dotenv()

MINECRAFT_SERVER_DIR = os.getenv('MINECRAFT_SERVER_DIR', '/mcserver')

STATS_DIR = os.path.join(MINECRAFT_SERVER_DIR, 'world', 'stats')
USERCACHE_FILE = os.path.join(MINECRAFT_SERVER_DIR, 'usercache.json')


def get_uuid_to_name_map():
    try:
        if os.path.exists(USERCACHE_FILE):
            with open(USERCACHE_FILE, 'r') as f:
                usercache = json.load(f)
                uuid_map = {}
                for entry in usercache:
                    uuid = entry.get('uuid', '').replace('-', '')
                    name = entry.get('name', '')
                    if uuid and name:
                        uuid_map[uuid] = name
                return uuid_map
        return {}
    except Exception as e:
        print(f"Error reading usercache: {e}")
        return {}

def get_player_list():
    try:
        if not os.path.exists(STATS_DIR):
            return {"error": "Stats directory not found"}, 500
        uuids = [f[:-5].replace('-', '') for f in os.listdir(STATS_DIR) if f.endswith('.json')]
        uuid_to_name = get_uuid_to_name_map()
        players = []
        for uuid in uuids:
            players.append({
                "uuid": uuid,
                "name": uuid_to_name.get(uuid, uuid)
            })
        return {"players": players}, 200
    except Exception as e:
        return {"error": str(e)}, 500

def get_player_stats(player_uuid):
    try:
        try_paths = [
            player_uuid,
            player_uuid[0:8] + '-' + player_uuid[8:12] + '-' + player_uuid[12:16] + '-' + player_uuid[16:20] + '-' + player_uuid[20:32]
        ]
        for try_uuid in try_paths:
            stats_file = os.path.join(STATS_DIR, f"{try_uuid}.json")
            if os.path.exists(stats_file):
                with open(stats_file, 'r') as f:
                    stats_data = json.load(f)
                return stats_data, 200
        return {"error": "Player stats not found"}, 404
    except Exception as e:
        return {"error": str(e)}, 500
    except Exception as e:
        return {"error": str(e)}, 500
