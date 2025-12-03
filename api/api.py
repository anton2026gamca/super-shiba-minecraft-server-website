from flask import Flask, jsonify
import resource_usage

api = Flask(__name__)

@api.get("/resource-usage/now")
def get_stats_now():
    return jsonify(resource_usage.get_last_history_entry())

@api.get("/resource-usage/history")
def get_stats_history():
    return jsonify(resource_usage.get_history())

if __name__ == "__main__":
    resource_usage.start_stats_collection()
    api.run(host="0.0.0.0", port=5000)
