import time
import psutil
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

class RansomwareMonitorHandler(FileSystemEventHandler):
    """
    Handles file system events and counts modifications, creations, and deletions.
    """
    def __init__(self):
        self.file_changes = 0

    def on_modified(self, event):
        if not event.is_directory:
            self.file_changes += 1

    def on_created(self, event):
        if not event.is_directory:
            self.file_changes += 1

    def on_deleted(self, event):
        if not event.is_directory:
            self.file_changes += 1

class SystemMonitor:
    """
    Monitors a specific directory for file changes and tracks system CPU usage.
    """
    def __init__(self, watch_dir="."):
        self.watch_dir = watch_dir
        self.handler = RansomwareMonitorHandler()
        self.observer = Observer()
        self.simulation_end_time = 0
        
    def trigger_simulation(self, duration_seconds=6):
        """Forces the monitor to output high ransomware metrics for a set duration."""
        self.simulation_end_time = time.time() + duration_seconds

    def start(self):
        """Starts the directory observer and initializes CPU monitoring."""
        self.observer.schedule(self.handler, self.watch_dir, recursive=True)
        self.observer.start()
        # Initialize psutil cpu percent measurement (first call returns 0.0)
        psutil.cpu_percent(interval=None)

    def stop(self):
        """Stops the directory observer."""
        self.observer.stop()
        self.observer.join()

    def trigger_simulation(self, duration_seconds=12):
        """Forces the monitor to output high ransomware metrics for a set duration."""
        self.simulation_end_time = time.time() + duration_seconds

    def get_metrics(self):
        """
        Returns the CPU usage and the number of file changes since the last call.
        Resets the file changes counter.
        Uses interval=1 so psutil always returns a real, non-zero CPU reading.
        """
        # interval=1 blocks 1 second but guarantees a real measurement (never returns 0.0)
        cpu_usage = psutil.cpu_percent(interval=1)

        # Get current file changes and reset counter
        changes = self.handler.file_changes
        self.handler.file_changes = 0

        # Override metrics if a simulated attack is active (for reliable demo impact)
        if time.time() < self.simulation_end_time:
            import random
            cpu_usage = random.uniform(88.0, 99.9)
            changes += random.randint(40, 70)

        return {
            "cpu": round(cpu_usage, 2),
            "file_changes": changes
        }
