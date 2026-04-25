import csv
import random
import os

def generate_synthetic_data(num_samples=1000, filename="ransomware_dataset.csv"):
    filepath = os.path.join(os.path.dirname(__file__), filename)
    with open(filepath, mode='w', newline='') as file:
        writer = csv.writer(file)
        # Header
        writer.writerow(["cpu_usage", "file_changes", "process_count", "label"])

        for _ in range(num_samples):
            # Let's make 85% normal behavior, 15% ransomware attack
            is_attack = random.random() < 0.15

            if is_attack:
                # Ransomware behavior: High CPU, mass file modifications, elevated background processes
                cpu_usage = round(random.uniform(65.0, 100.0), 2)
                file_changes = random.randint(20, 200)
                process_count = random.randint(90, 150)
                label = "attack"
            else:
                # Normal behavior: Low/Idle CPU, minimal file I/O, normal OS processes
                cpu_usage = round(random.uniform(1.0, 35.0), 2)
                file_changes = random.randint(0, 8)
                process_count = random.randint(40, 80)
                label = "normal"

            writer.writerow([cpu_usage, file_changes, process_count, label])
    
    print(f"Dataset of {num_samples} records generated successfully at {filepath}")

if __name__ == "__main__":
    generate_synthetic_data(1000, "ransomware_dataset.csv")
