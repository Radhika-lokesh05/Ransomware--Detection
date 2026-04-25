import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';

function App() {
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <nav className="bg-gray-800 p-4 shadow-lg border-b border-gray-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-red-500 flex items-center gap-2">
            🛡️ Ransomware<span className="text-white">Shield</span>
          </h1>
          <div className="text-sm text-gray-400">Security Dashboard v1.0</div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-8 px-4">
        <Dashboard />
      </main>
    </div>
  );
}

export default App;
