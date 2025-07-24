import { useState } from 'react';

export default function SmartSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [channel, setChannel] = useState('all');
  const [error, setError] = useState(null);
  const [ingestStatus, setIngestStatus] = useState('');
  const [ingestLoading, setIngestLoading] = useState(false);

  // Placeholder for search handler
  const handleSearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, dateFrom, dateTo, channel }),
      });
      if (!res.ok) throw new Error('Search failed');
      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      setError(err.message || 'Unknown error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleIngest = async () => {
    setIngestStatus('Ingestion started...');
    setIngestLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/ingest', { method: 'POST' });
      if (!res.ok) throw new Error('Ingestion failed');
      setIngestStatus('Ingestion complete.');
    } catch (err) {
      setIngestStatus('');
      setError('Ingestion error: ' + (err.message || 'Unknown error'));
    } finally {
      setIngestLoading(false);
    }
  };

  // Group results by channel/type
  const groupedResults = results.reduce((acc, item) => {
    const group = item.channel || 'Other';
    if (!acc[group]) acc[group] = [];
    acc[group].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="max-w-3xl mx-auto py-10 px-4">
        <h1 className="text-2xl font-bold mb-6 text-center">Smart Search</h1>
        <div className="flex justify-end mb-4">
          <button
            className={`bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 ${ingestLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleIngest}
            disabled={ingestLoading}
          >
            {ingestLoading ? 'Refreshing...' : 'Refresh Content'}
          </button>
        </div>
        {ingestStatus && <div className="text-center text-blue-600 mb-2">{ingestStatus}</div>}
        <form onSubmit={handleSearch} className="bg-white rounded shadow p-4 mb-8 flex flex-col gap-4">
          <input
            type="text"
            className="border border-gray-300 rounded p-2 text-lg"
            placeholder="Search your content (e.g. 'Vybescript launch last 30 days')"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <div className="flex gap-4 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" className="border border-gray-300 rounded p-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" className="border border-gray-300 rounded p-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Channel</label>
              <select className="border border-gray-300 rounded p-1" value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="all">All</option>
                <option value="mailchimp">Mailchimp</option>
                <option value="intercom">Intercom</option>
                <option value="history">Prompt History</option>
              </select>
            </div>
          </div>
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 w-32 self-end" disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <div className="text-center text-red-500 mb-4">{error}</div>}
        {loading && <div className="text-center text-gray-500">Searching...</div>}
        {!loading && results.length === 0 && (
          <div className="text-center text-gray-400 mt-10">No results yet. Try a search!</div>
        )}
        {!loading && results.length > 0 && (
          <div className="space-y-8">
            {Object.entries(groupedResults).map(([group, items]) => (
              <div key={group}>
                <h2 className="text-lg font-semibold mb-2 capitalize">{group}</h2>
                <div className="space-y-4">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded p-4 shadow-sm">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-500">{item.date || 'Unknown date'}</span>
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">{item.channel}</span>
                      </div>
                      <div className="font-medium mb-1">{item.title || item.subject || item.prompt || 'Untitled'}</div>
                      <div className="text-sm text-gray-700 mb-2 line-clamp-3">{item.preview || item.body || item.content || item.snippet}</div>
                      {/* Optionally, add a preview/expand button here */}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 