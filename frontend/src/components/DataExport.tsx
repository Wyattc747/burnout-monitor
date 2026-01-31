'use client';

import { useState } from 'react';

export function DataExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportComplete, setExportComplete] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:3001/api/wellness/export', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error('Export failed');

      // Get the JSON data
      const data = await res.json();

      // Create a blob and download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wellness-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setExportComplete(true);
      setTimeout(() => setExportComplete(false), 3000);
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 dark:text-white">Export Your Data</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Download all your wellness data in JSON format. This includes health metrics,
            work metrics, check-ins, preferences, and zone history.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
                exportComplete
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
              }`}
            >
              {isExporting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Exporting...
                </>
              ) : exportComplete ? (
                <>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Downloaded!
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download My Data
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
            Your data is exported in a portable format that you can import into other services
            or keep for your records. This complies with data portability regulations.
          </p>
        </div>
      </div>
    </div>
  );
}

export default DataExport;
