from flask import Flask, jsonify
from stats import get_last_history_entry, get_history, start_stats_collection

app = Flask(__name__)

@app.get("/stats/now")
def get_stats_now():
    """Get current system and container stats"""
    return jsonify(get_last_history_entry())

@app.get("/stats/history")
def get_stats_history():
    """Get historical data for graphing"""
    return jsonify(get_history())

if __name__ == "__main__":
    start_stats_collection()
    app.run(host="0.0.0.0", port=5000)
