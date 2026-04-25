import os
import shutil
from datetime import datetime

class BackupManager:
    """
    Handles creating backups of a monitored directory and restoring them.
    Uses shutil to securely copy files to an isolated backup folder.
    """
    def __init__(self, source_dir, backup_dir="backups"):
        self.source_dir = source_dir
        self.backup_dir = backup_dir
        os.makedirs(self.backup_dir, exist_ok=True)

    def create_backup(self):
        """Creates a timestamped backup of the source directory."""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        target_dir = os.path.join(self.backup_dir, f"backup_{timestamp}")
        
        try:
            # shutil.copytree requires the destination directory to not exist
            shutil.copytree(self.source_dir, target_dir)
            return {"status": "success", "message": f"Backup created successfully.", "backup_id": f"backup_{timestamp}"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to create backup: {str(e)}"}

    def restore_backup(self, backup_id=None):
        """Restores a specific backup by ID, or the most recent backup if no ID is provided."""
        try:
            backups = sorted(os.listdir(self.backup_dir))
        except FileNotFoundError:
            return {"status": "error", "message": "Backup directory not found."}

        if not backups:
            return {"status": "error", "message": "No backups found to restore."}
            
        if backup_id and backup_id in backups:
            target_backup = backup_id
        else:
            target_backup = backups[0] # Fallback to the FIRST (clean baseline) backup

        backup_path = os.path.join(self.backup_dir, target_backup)
        
        try:
            # 1. Clear the compromised source directory
            for filename in os.listdir(self.source_dir):
                file_path = os.path.join(self.source_dir, filename)
                if os.path.isfile(file_path) or os.path.islink(file_path):
                    os.unlink(file_path)
                elif os.path.isdir(file_path):
                    shutil.rmtree(file_path)

            # 2. Copy the safe files back from the backup
            for filename in os.listdir(backup_path):
                s = os.path.join(backup_path, filename)
                d = os.path.join(self.source_dir, filename)
                if os.path.isdir(s):
                    shutil.copytree(s, d)
                else:
                    shutil.copy2(s, d)
                    
            return {"status": "success", "message": f"System safely restored from {target_backup}"}
        except Exception as e:
            return {"status": "error", "message": f"Failed to restore system: {str(e)}"}
