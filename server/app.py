from flask import Flask, jsonify, request
from flask_cors import CORS
from monitor import SystemMonitor
from detector import ThreatDetector
from backup import BackupManager
import os
import threading
import time
import shutil

app = Flask(__name__)
CORS(app) # Enable CORS so the React frontend can fetch data

# Ensure the watch directory exists for the hackathon simulation
WATCH_DIR = os.path.join(os.path.dirname(__file__), 'test_dir')
os.makedirs(WATCH_DIR, exist_ok=True)

# Ensure backup directory exists
BACKUP_DIR = os.path.join(os.path.dirname(__file__), 'backups')

# Initialize Monitor, Detector, and Backup Manager
# Note: Thresholds are set low here for easier hackathon demonstration purposes
monitor = SystemMonitor(watch_dir=WATCH_DIR)
monitor.start()

detector = ThreatDetector(monitor, file_threshold=10, cpu_threshold=30.0) 
detector.start()

backup_manager = BackupManager(source_dir=WATCH_DIR, backup_dir=BACKUP_DIR)

# Automatically create a CLEAN baseline backup on startup if none exists.
# Always wipe test_dir first so leftover .enc files from previous sessions
# don't get included in the baseline (which would make Restore useless).
if not os.path.exists(BACKUP_DIR) or len(os.listdir(BACKUP_DIR)) == 0:
    print("[*] Wiping test_dir to ensure a clean baseline...")
    for f in os.listdir(WATCH_DIR):
        fp = os.path.join(WATCH_DIR, f)
        try:
            os.unlink(fp) if os.path.isfile(fp) else shutil.rmtree(fp)
        except Exception:
            pass
    print("[*] Creating initial clean baseline backup...")
    backup_manager.create_backup()

@app.route('/status', methods=['GET'])
def get_status():
    """API Endpoint: Returns current system metrics and overall security status."""
    return jsonify(detector.get_status())

@app.route('/alerts', methods=['GET'])
def get_alerts():
    """API Endpoint: Returns a list of all detected threats."""
    return jsonify(detector.get_alerts())

@app.route('/backup', methods=['POST'])
def trigger_backup():
    """API Endpoint: Creates a secure backup of the monitored directory."""
    result = backup_manager.create_backup()
    return jsonify(result)

@app.route('/restore', methods=['POST'])
def trigger_restore():
    """API Endpoint: Restores the directory from a backup (latest by default)."""
    data = request.get_json(silent=True) or {}
    backup_id = data.get('backup_id')
    result = backup_manager.restore_backup(backup_id)
    return jsonify(result)

# ── In-memory forensic log store (fallback for when Ganache is unavailable) ──
forensic_logs = []

@app.route('/forensic-logs', methods=['GET'])
def get_forensic_logs():
    """Returns all forensic logs — reads from logs.json on disk (persists across restarts)."""
    import json as _json
    log_path = os.path.join(os.path.dirname(__file__), 'logs.json')
    try:
        if os.path.exists(log_path):
            with open(log_path, 'r') as f:
                disk_logs = _json.load(f)
        else:
            disk_logs = []
    except Exception:
        disk_logs = []
    # Merge: disk logs are the ground truth; in-memory list catches any not yet flushed
    seen_timestamps = {l.get('timestamp') for l in disk_logs}
    extras = [l for l in forensic_logs if l.get('timestamp') not in seen_timestamps]
    return jsonify(disk_logs + extras)

@app.route('/forensic-logs', methods=['POST'])
def add_forensic_log():
    """Receives a forensic log object from the frontend and persists it server-side."""
    data = request.get_json(silent=True)
    if data:
        import time as _time
        data['server_timestamp'] = _time.time()
        forensic_logs.append(data)
        print(f"[FORENSIC LOG SAVED] threat_score={data.get('threat_score')} level={data.get('threat_level')}")
    return jsonify({"status": "ok", "total": len(forensic_logs)})

@app.route('/simulate-attack', methods=['POST'])
def simulate_attack():
    """API Endpoint: Simulates a ransomware attack by artificially spiking metrics and creating files."""
    def attack():
        print("[*] Starting simulated attack...")
        
        # 1. Trigger the metric overrides in the monitor for 12 seconds
        monitor.trigger_simulation(duration_seconds=12)
        
        # 2. Clear previous simulation files
        for filename in os.listdir(WATCH_DIR):
            file_path = os.path.join(WATCH_DIR, filename)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
            except Exception as e:
                pass
                
        # 3. Create dummy encrypted files to actually trigger filesystem events too
        for i in range(50):
            file_path = os.path.join(WATCH_DIR, f"dummy_encrypted_{i}.enc")
            with open(file_path, "w") as f:
                f.write("YOUR FILES HAVE BEEN ENCRYPTED!" * 50) 
            time.sleep(0.05) # Space out file creation slightly for realism
                
        print("[*] Simulated attack finished.")

    # Run attack in a separate thread so the API responds immediately
    thread = threading.Thread(target=attack)
    thread.start()
    
    return jsonify({
        "status": "success",
        "message": "Attack simulation started. High file I/O and CPU usage generated.",
        "duration_expected": "6 seconds"
    })

if __name__ == '__main__':
    try:
        print(f"[*] Starting Ransomware Detection API...")
        print(f"[*] Monitoring directory: {WATCH_DIR}")
        # Run the Flask app on port 5000
        # debug=False is important so Flask doesn't spawn two processes and mess up our threads
        app.run(port=5000, debug=False) 
    finally:
        print("[*] Shutting down monitor and detector...")
        monitor.stop()
        detector.stop()
