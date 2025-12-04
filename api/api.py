import os
from flask import Flask, jsonify
from dotenv import load_dotenv
import resource_usage
import player_stats


load_dotenv()

API_HOST = os.getenv('API_HOST', '0.0.0.0')
API_PORT = int(os.getenv('API_PORT', '5000'))


api = Flask(__name__)

@api.get("/resource-usage/now")
def get_stats_now():
    return jsonify(resource_usage.get_last_history_entry())

@api.get("/resource-usage/history")
def get_stats_history():
    return jsonify(resource_usage.get_history())


@api.get("/player-stats/list")
def get_player_stats_list():
    list, status = player_stats.get_player_list()
    return jsonify(list), status

@api.route("/player-stats/<player_uuid>")
def get_player_stats(player_uuid):
    stats, status = player_stats.get_player_stats(player_uuid)
    return jsonify(stats), status

if __name__ == "__main__":
    resource_usage.start_stats_collection()
    api.run(host=API_HOST, port=API_PORT)
