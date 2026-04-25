import axios from 'axios';

const API_BASE_URL = 'http://127.0.0.1:5000';

// Create an Axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchStatus = async () => {
  try {
    const response = await apiClient.get('/status');
    return response.data;
  } catch (error) {
    console.error("Error fetching status:", error);
    return null;
  }
};

export const fetchAlerts = async () => {
  try {
    const response = await apiClient.get('/alerts');
    return response.data;
  } catch (error) {
    console.error("Error fetching alerts:", error);
    return [];
  }
};

export const simulateAttack = async () => {
  try {
    const response = await apiClient.post('/simulate-attack');
    return response.data;
  } catch (error) {
    console.error("Error simulating attack:", error);
    return { status: 'error', message: 'Failed to connect to the server.' };
  }
};

export const triggerBackup = async () => {
  try {
    const response = await apiClient.post('/backup');
    return response.data;
  } catch (error) {
    console.error("Error triggering backup:", error);
    return { status: 'error', message: 'Failed to trigger backup.' };
  }
};

export const restoreBackup = async (backupId = null) => {
  try {
    const payload = backupId ? { backup_id: backupId } : {};
    const response = await apiClient.post('/restore', payload);
    return response.data;
  } catch (error) {
    console.error("Error restoring backup:", error);
    return { status: 'error', message: 'Failed to restore files.' };
  }
};

/** Save a forensic log to the server-side in-memory store (works without Ganache). */
export const addForensicLog = async (logObj) => {
  try {
    const response = await apiClient.post('/forensic-logs', logObj);
    return response.data;
  } catch (error) {
    console.error("Error saving forensic log:", error);
    return null;
  }
};

/** Retrieve all server-side forensic logs. */
export const getForensicLogs = async () => {
  try {
    const response = await apiClient.get('/forensic-logs');
    return response.data;
  } catch (error) {
    console.error("Error fetching forensic logs:", error);
    return [];
  }
};
