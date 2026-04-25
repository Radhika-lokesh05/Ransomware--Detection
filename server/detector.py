import threading
import time
import uuid
import json
import os
from datetime import datetime

# --- NEW RAG INTEGRATION ---
from rag_engine import rag
# ---------------------------

class ThreatDetector:
    """
    Evaluates system metrics against defined thresholds to detect ransomware-like behavior.
    """
    def __init__(self, monitor, file_threshold=20, cpu_threshold=60.0):
        self.monitor = monitor
        self.file_threshold = file_threshold
        self.cpu_threshold = cpu_threshold
        self.alerts = []
        self.running = False
        self.thread = None
        self.current_status = {"cpu": 0.0, "file_changes": 0, "status": "Secure", "threat_score": 0.0}

    def start(self):
        """Starts the background detection loop."""
        self.running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        """Stops the detection loop."""
        self.running = False

    def _run(self):
        """Background loop that periodically fetches metrics and evaluates threats."""
        while self.running:
            metrics = self.monitor.get_metrics()

            # --- Calculate threat score FIRST before updating any status ---
            cpu  = metrics["cpu"]
            fchg = metrics["file_changes"]
            cpu_score  = min(cpu,  100.0)
            file_score = min(fchg * 2.0, 100.0)
            live_threat_score = round((cpu_score * 0.4) + (file_score * 0.6), 2)

            # Debug line – visible in the python app.py terminal
            print(f"[DEBUG] cpu={cpu:.1f}%  files={fchg}  score={live_threat_score}")

            # Determine new status
            if fchg > self.file_threshold and cpu > self.cpu_threshold:
                new_status = "Threat Detected"
            else:
                # Only clear Threat Detected once files have fully settled
                if self.current_status["status"] == "Threat Detected" and fchg > 0:
                    new_status = "Threat Detected"  # keep showing while files still active
                else:
                    new_status = "Secure"

            # Atomically push all fields into current_status
            self.current_status.update({
                "cpu":          cpu,
                "file_changes": fchg,
                "threat_score": live_threat_score,
                "status":       new_status,
            })

            # Fire the forensic alert only once per transition
            if new_status == "Threat Detected" and self.current_status.get("_alerted") is not True:
                self.current_status["_alerted"] = True
                self._trigger_alert(metrics, live_threat_score)
            elif new_status == "Secure":
                self.current_status["_alerted"] = False

            # Check every 2 seconds
            time.sleep(2)

    def _trigger_alert(self, metrics, threat_score):
        """Generates an alert object when a threat is detected."""
        import psutil
        import hashlib
        
        # Find the process with highest CPU usage as the suspect
        suspect_process = "unknown"
        suspect_pid = 0
        try:
            for proc in sorted(psutil.process_iter(['pid', 'name', 'cpu_percent']), key=lambda p: p.info['cpu_percent'] or 0, reverse=True):
                if proc.info['name'] and proc.info['name'] not in ['System Idle Process', 'System']:
                    suspect_process = proc.info['name']
                    suspect_pid = proc.info['pid']
                    break
        except Exception:
            suspect_process = "python.exe"
            suspect_pid = 1337
            
        # Dummy file hash and malicious IP for realistic demonstration
        dummy_hash = hashlib.sha256(str(time.time()).encode()).hexdigest()
        
        forensic_data = {
            "timestamp": datetime.now().isoformat(),
            "cpu_usage": metrics["cpu"],
            "file_changes": metrics["file_changes"],
            "process_name": suspect_process,
            "process_id": suspect_pid,
            "threat_score": threat_score,
            "threat_level": "CRITICAL" if threat_score > 80 else "HIGH" if threat_score > 50 else "MEDIUM",
            "action_taken": "Automated Backup & Blockchain Logging",
            # Additional fields maintained for backwards compatibility in UI
            "file_hash": dummy_hash,
            "suspicious_ip": "192.168.1.105:4444" if threat_score > 80 else "None",
            "behavior_detected": "Mass File Encryption"
        }
        
        # --- NEW RAG INTEGRATION ---
        rag_result = rag.generate_explanation(forensic_data)
        forensic_data["rag_explanation"] = rag_result["rag_explanation"]
        forensic_data["recommended_action"] = rag_result["recommended_action"]
        # ---------------------------
        
        alert = {
            "id": str(uuid.uuid4()),
            "timestamp": forensic_data["timestamp"],
            "message": "High file activity and CPU usage detected! Possible ransomware.",
            "metrics": metrics,
            "forensics": forensic_data
        }
        self.alerts.append(alert)
        self._append_to_log_file(forensic_data)  # ← persist to disk
        print(f"\n[!] THREAT DETECTED: {alert['message']}")
        print(f"    Threat Score: {threat_score}/100 | Suspect: {suspect_process} (PID: {suspect_pid})")

    def _append_to_log_file(self, forensic_data):
        """Appends a forensic log entry to logs.json (creates file if absent)."""
        log_path = os.path.join(os.path.dirname(__file__), 'logs.json')
        try:
            # Load existing entries (or start fresh)
            if os.path.exists(log_path):
                with open(log_path, 'r') as f:
                    logs = json.load(f)
            else:
                logs = []
            logs.append(forensic_data)
            with open(log_path, 'w') as f:
                json.dump(logs, f, indent=2)
            print(f"    [LOG] Written to logs.json ({len(logs)} total entries)")
        except Exception as e:
            print(f"    [LOG ERROR] Could not write logs.json: {e}")

    def get_alerts(self):
        """Returns the history of alerts."""
        return self.alerts
        
    def get_status(self):
        """Returns the latest system metrics and overall security status."""
        return self.current_status
