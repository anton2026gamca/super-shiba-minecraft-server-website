import os
import json

STATS_DIR = "/mcserver/world/stats/"
USERCACHE_FILE = "/mcserver/usercache.json"

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
        stats_file = os.path.join(STATS_DIR, f"{player_uuid}.json")
        if not os.path.exists(stats_file):
            return {"error": "Player stats not found"}, 404
        with open(stats_file, 'r') as f:
            stats_data = json.load(f)
        return stats_data, 200
    except Exception as e:
        return {"error": str(e)}, 500
