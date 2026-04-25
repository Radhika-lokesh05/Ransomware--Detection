import React, { useState, useEffect, useRef } from 'react';
import { fetchStatus, fetchAlerts, simulateAttack, triggerBackup, restoreBackup, addForensicLog, getForensicLogs } from '../services/api';
import { storeLog, getLogs } from '../services/blockchain';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

const Dashboard = () => {
  const [status, setStatus] = useState({ cpu: 0, file_changes: 0, status: 'Unknown' });
  const [alerts, setAlerts] = useState([]);
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [serverForensicLogs, setServerForensicLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState({ text: '', type: '' });
  const [securedPopup, setSecuredPopup] = useState(false); // New state for system secured toast
  
  // Keep history for the charts
  const [history, setHistory] = useState([]);

  // Ref to track the number of alerts we've already logged to avoid duplicate blockchain transactions
  const lastAlertCountRef = useRef(0);

  // Polling for live status and alerts
  useEffect(() => {
    let isMounted = true;
    let timerId;

    const pollData = async () => {
      try {
        const currentStatus = await fetchStatus();
        if (isMounted && currentStatus) {
          setStatus(currentStatus);
          
          setHistory(prev => {
            const newEntry = {
              time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
              cpu: currentStatus.cpu,
              files: currentStatus.file_changes
            };
            const updatedHistory = [...prev, newEntry];
            if (updatedHistory.length > 20) updatedHistory.shift();
            return updatedHistory;
          });
        }
        
        const currentAlerts = await fetchAlerts();
        if (isMounted && currentAlerts) {
          setAlerts(currentAlerts);
          
          // Trigger automated mitigation flow if a NEW alert is received
          if (currentAlerts.length > lastAlertCountRef.current) {
            console.log("New threat detected! Executing automated defense protocols...");
            
            // Immediately update ref to prevent duplicate triggers
            lastAlertCountRef.current = currentAlerts.length;

            // 1. Save forensic log to Flask server (always works, no Ganache needed)
            const latestAlert = currentAlerts[currentAlerts.length - 1];
            const forensicObj = latestAlert.forensics || {
              behavior_detected: latestAlert.message || "Unknown Threat",
              threat_score: 0,
              threat_level: "UNKNOWN",
            };
            addForensicLog(forensicObj).then(async () => {
              const sLogs = await getForensicLogs();
              if (isMounted) setServerForensicLogs(sLogs);
            });

            // 2. ALSO attempt blockchain logging (best-effort, may fail if Ganache reset)
            console.log("Attempting blockchain ledger entry...");
            const forensicPayload = JSON.stringify(forensicObj);
            storeLog(forensicPayload)
              .then(async (receipt) => {
                if (receipt) {
                  const bLogs = await getLogs();
                  if (isMounted && bLogs) setBlockchainLogs(bLogs);
                }
              })
              .catch(err => console.warn("Blockchain log skipped (Ganache unavailable):", err));
            
            // 2. AUTOMATIC BACKUP (Isolate & protect system)
            console.log("Triggering automatic backup...");
            triggerBackup().then(backupRes => {
              if (backupRes) {
                const msgText = backupRes.status === 'success' 
                  ? `System Auto-Backup completed: ${backupRes.backup_id}`
                  : `Backup Error: ${backupRes.message}`;
                setActionMessage({ text: msgText, type: backupRes.status });
                setSecuredPopup(true);
                setTimeout(() => setSecuredPopup(false), 7000); // Auto-hide after 7s
                setTimeout(() => setActionMessage({ text: '', type: '' }), 8000);
              }
            });
          }
        }

        // Poll server forensic logs (always available)
        const sLogs = await getForensicLogs();
        if (isMounted) setServerForensicLogs(sLogs);

        // Also attempt blockchain sync (best-effort)
        getLogs().then(bLogs => {
          if (isMounted && bLogs && bLogs.length > 0) setBlockchainLogs(bLogs);
        }).catch(() => {});

      } catch (error) {
        console.error("Polling error:", error);
      } finally {
        // Schedule next poll only AFTER current poll finishes
        if (isMounted) {
          timerId = setTimeout(pollData, 1000); // Changed to 1 second for ultra-fast UX
        }
      }
    };

    pollData(); // Initial call

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, []);

  const handleSimulate = async () => {
    setLoading(true);
    const res = await simulateAttack();
    if (res) setActionMessage({ text: res.message, type: res.status || 'success' });
    setLoading(false);
    setTimeout(() => setActionMessage({ text: '', type: '' }), 5000);
  };

  const handleBackup = async () => {
    setLoading(true);
    const res = await triggerBackup();
    if (res) setActionMessage({ text: res.message, type: res.status });
    setLoading(false);
    setTimeout(() => setActionMessage({ text: '', type: '' }), 5000);
  };

  const handleRestore = async () => {
    setLoading(true);
    const res = await restoreBackup();
    if (res) setActionMessage({ text: res.message, type: res.status });
    setLoading(false);
    setTimeout(() => setActionMessage({ text: '', type: '' }), 5000);
  };

  const isThreat = status.status === 'Threat Detected';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
      
      {/* THREAT DETECTED BANNER */}
      {isThreat && (
        <div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-start pt-10">
          <div className="bg-red-700 text-white px-12 py-4 rounded-xl shadow-[0_0_50px_rgba(239,68,68,1)] border-4 border-red-400 flex items-center gap-6 animate-pulse scale-110">
            <span className="text-5xl animate-bounce">⚠️</span>
            <div>
              <p className="text-4xl font-black tracking-widest drop-shadow-md">THREAT DETECTED</p>
              <p className="text-lg text-red-200 font-bold uppercase tracking-widest text-center">Ransomware Behavior Identified</p>
            </div>
            <span className="text-5xl animate-bounce">⚠️</span>
          </div>
        </div>
      )}

      {/* Screen Red Overlay for Attack Animation */}
      {isThreat && (
        <div className="fixed inset-0 border-[8px] border-red-600/60 animate-pulse pointer-events-none z-30"></div>
      )}

      {/* SYSTEM SECURED POPUP */}
      {securedPopup && (
        <div className="fixed top-1/3 left-1/2 transform -translate-x-1/2 z-50 bg-green-900/90 text-white px-12 py-8 rounded-2xl shadow-[0_0_60px_rgba(34,197,94,0.6)] border-2 border-green-500 flex flex-col items-center gap-4 animate-bounce backdrop-blur-md">
          <span className="text-6xl animate-pulse">🛡️</span>
          <div className="text-center">
            <p className="text-3xl font-black tracking-wider text-green-400 drop-shadow-lg">SYSTEM SECURED</p>
            <p className="text-md text-green-200 mt-2">Threat contained. Automatic backup created.</p>
            <p className="text-sm text-green-300 font-mono mt-1">Incident permanently logged to Blockchain.</p>
          </div>
        </div>
      )}

      {/* Metrics & Chart Panel */}
      <div className={`p-6 rounded-xl border ${isThreat ? 'bg-red-900/20 border-red-500' : 'bg-gray-800 border-gray-700'} lg:col-span-2 shadow-lg flex flex-col`}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold flex items-center gap-2">
            📊 Live System Metrics
          </h2>
          <span className={`px-4 py-1 rounded-full text-sm font-bold animate-pulse ${isThreat ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-green-500/20 text-green-400'}`}>
            {status.status.toUpperCase()}
          </span>
        </div>

        {/* Top Metric Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-inner">
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">CPU Usage</p>
            <p className={`text-4xl font-mono mt-2 ${status.cpu > 50 ? 'text-yellow-400' : 'text-green-400'}`}>
              {status.cpu.toFixed(1)}%
            </p>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-inner">
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">File I/O (/sec)</p>
            <p className={`text-4xl font-mono mt-2 ${status.file_changes > 10 ? 'text-red-400' : 'text-blue-400'}`}>
              {status.file_changes}
            </p>
          </div>
          <div className="bg-gray-900 p-4 rounded-lg border border-gray-700 shadow-inner relative overflow-hidden">
            <p className="text-gray-400 text-sm font-semibold uppercase tracking-wider">Threat Score</p>
            <p className={`text-4xl font-mono mt-2 ${status.threat_score > 70 ? 'text-red-500 animate-pulse' : status.threat_score > 30 ? 'text-yellow-500' : 'text-green-500'}`}>
              {status.threat_score || 0}/100
            </p>
          </div>
        </div>

        {/* Recharts Live Graph */}
        <div className="flex-grow bg-gray-900 rounded-lg border border-gray-700 p-4 min-h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" stroke="#9CA3AF" tick={{fontSize: 12}} />
              <YAxis yAxisId="left" stroke="#4ADE80" tick={{fontSize: 12}} domain={[0, 100]} />
              <YAxis yAxisId="right" orientation="right" stroke="#60A5FA" tick={{fontSize: 12}} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1F2937', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="cpu" name="CPU (%)" stroke="#4ADE80" strokeWidth={2} dot={false} isAnimationActive={false} />
              <Line yAxisId="right" type="monotone" dataKey="files" name="Files I/O" stroke="#60A5FA" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 shadow-lg flex flex-col justify-between h-full">
        <div>
          <h2 className="text-xl font-bold mb-6 border-b border-gray-700 pb-2">⚙️ Defenses</h2>
          <div className="space-y-4">
            <button 
              onClick={handleSimulate} 
              disabled={loading}
              className="w-full bg-red-600/90 hover:bg-red-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-red-500/50 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              ⚠️ Simulate Attack
            </button>
            <button 
              onClick={handleBackup} 
              disabled={loading}
              className="w-full bg-blue-600/90 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-blue-500/50 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              💾 Backup Files
            </button>
            <button 
              onClick={handleRestore} 
              disabled={loading}
              className="w-full bg-green-600/90 hover:bg-green-500 text-white font-bold py-3 px-4 rounded-lg shadow-lg hover:shadow-green-500/50 transition-all disabled:opacity-50 flex justify-center items-center gap-2"
            >
              ♻️ Restore Files
            </button>
          </div>
        </div>
        
        {actionMessage.text && (
          <div className={`mt-6 p-4 border text-sm rounded-lg text-center animate-fade-in shadow-inner ${
            actionMessage.type === 'error' ? 'bg-red-900/30 border-red-500/50 text-red-300' : 
            actionMessage.type === 'success' ? 'bg-green-900/30 border-green-500/50 text-green-300' :
            'bg-gray-900 border-indigo-500/50 text-indigo-300'
          }`}>
            {actionMessage.text}
          </div>
        )}
      </div>

      {/* Attack Timeline View */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 lg:col-span-1 shadow-lg h-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-gray-700 pb-2">
          ⏱️ Attack Event Timeline
        </h2>
        <div className="bg-gray-900 rounded-lg max-h-96 overflow-y-auto border border-gray-700 shadow-inner p-4">
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-gray-500">
              <span className="text-3xl mb-2">🛡️</span>
              <p className="italic text-center text-sm">System secure.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-gray-700 ml-3">
              {alerts.slice().reverse().map((alert, idx) => (
                <div key={alert.id || idx} className="mb-6 ml-6 relative">
                  <div className="absolute w-4 h-4 bg-red-500 rounded-full -left-[1.95rem] top-1 border-4 border-gray-900 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse"></div>
                  <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                    <span className="text-xs text-gray-400 block mb-1 font-mono">
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="font-bold text-red-400 text-sm block mb-2 leading-tight">
                      {alert.message}
                    </span>
                    <div className="text-xs text-gray-400 font-mono bg-black/50 p-2 rounded flex flex-col gap-1">
                      <span><span className="text-yellow-400">CPU:</span> {alert.metrics.cpu}%</span>
                      <span><span className="text-blue-400">Files I/O:</span> {alert.metrics.file_changes}/sec</span>
                      {alert.forensics && (
                        <span className="text-red-400 mt-1 border-t border-gray-700 pt-1">
                          Threat Score: {alert.forensics.threat_score}/100
                        </span>
                      )}
                    </div>
                    
                    {/* --- NEW RAG UI --- */}
                    {alert.forensics && alert.forensics.rag_explanation && (
                      <div className="mt-3 p-3 bg-indigo-900/30 border border-indigo-500/30 rounded-md shadow-inner">
                        <h4 className="text-sm font-bold text-indigo-400 mb-2 flex items-center gap-2">
                          🤖 AI Investigation Panel
                        </h4>
                        <p className="text-xs text-indigo-200 mb-2 leading-relaxed">
                          <span className="font-bold text-indigo-300">Explanation:</span> {alert.forensics.rag_explanation}
                        </p>
                        <p className="text-xs text-green-300 bg-green-900/20 p-1.5 rounded border border-green-800/50">
                          <span className="font-bold text-green-400">Recommendation:</span> {alert.forensics.recommended_action}
                        </p>
                      </div>
                    )}
                    {/* ------------------ */}
                    
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Forensic Investigation Panel — server-backed, always available */}
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700 lg:col-span-2 shadow-lg h-full">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-gray-700 pb-2 text-blue-400">
          🔬 Immutable Forensic Ledger
          {blockchainLogs.length > 0 && (
            <span className="ml-auto text-xs text-green-400 border border-green-700 px-2 py-1 rounded font-normal">
              ⛓️ {blockchainLogs.length} on-chain
            </span>
          )}
        </h2>
        <div className="bg-gray-900 rounded-lg max-h-96 overflow-y-auto border border-gray-700 shadow-inner">
          {serverForensicLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-gray-500">
              <span className="text-4xl mb-2">🔬</span>
              <p className="italic text-center">No forensic evidence yet.</p>
              <p className="text-xs mt-1 text-gray-600">Trigger a simulation to generate logs.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4 p-4">
              {serverForensicLogs.slice().reverse().map((log, idx) => {
                const chainEntry = blockchainLogs.find(b => {
                  try { return JSON.parse(b.message).timestamp === log.timestamp; } catch { return false; }
                });
                return (
                  <div key={idx} className="bg-black/40 border border-gray-800 rounded-lg p-4 hover:border-gray-600 transition shadow-md relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                    <div className="flex justify-between items-start mb-3 border-b border-gray-800 pb-2 ml-2">
                      <div>
                        <span className="text-red-400 font-bold uppercase text-sm tracking-wider">
                          {log.behavior_detected || "Ransomware Activity"}
                        </span>
                        <span className="text-gray-500 text-xs ml-3 font-mono bg-gray-800 px-2 py-1 rounded">
                          {log.timestamp ? new Date(log.timestamp).toLocaleString() : new Date(log.server_timestamp * 1000).toLocaleString()}
                        </span>
                      </div>
                      {chainEntry ? (
                        <span className="bg-green-900/30 text-green-400 border border-green-800/50 px-2 py-1 rounded text-xs flex items-center gap-1">
                          ✓ Verified on-chain
                        </span>
                      ) : (
                        <span className="bg-blue-900/30 text-blue-400 border border-blue-800/50 px-2 py-1 rounded text-xs flex items-center gap-1">
                          🗄️ Server log
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs font-mono text-gray-400 mt-3 ml-2">
                      <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <span className="text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">Threat Level</span>
                        <span className={log.threat_level === 'CRITICAL' ? 'text-red-500 font-black animate-pulse' : 'text-orange-400 font-bold'}>
                          {log.threat_level || '—'}<br/>
                          <span className="text-gray-500 font-normal">Score: {log.threat_score}/100</span>
                        </span>
                      </div>
                      <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <span className="text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">Suspect Process</span>
                        <span className="text-yellow-400 font-bold">
                          {log.process_name || '—'}<br/>
                          <span className="text-gray-500 font-normal">PID: {log.process_id || '—'}</span>
                        </span>
                      </div>
                      <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <span className="text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">CPU / Files</span>
                        <span className="text-yellow-300">{log.cpu_usage}%</span>
                        <span className="text-gray-500"> / </span>
                        <span className="text-blue-400">{log.file_changes} chg</span>
                      </div>
                      <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <span className="text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">Suspicious IP</span>
                        <span className={log.suspicious_ip && log.suspicious_ip !== 'None' ? 'text-red-400 font-bold' : 'text-gray-500'}>
                          {log.suspicious_ip || 'None'}
                        </span>
                      </div>
                      <div className="bg-gray-900 p-2 rounded border border-gray-800">
                        <span className="text-gray-500 block mb-1 uppercase tracking-wider text-[10px]">Action Taken</span>
                        <span className="text-green-400">{log.action_taken || 'Logged'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};

export default Dashboard;

