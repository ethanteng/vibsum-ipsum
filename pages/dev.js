import { useSession } from 'next-auth/react';
import { useState } from 'react';

const labelStyle = { fontWeight: 500, marginRight: 8, minWidth: 120, display: 'inline-block' };
const inputStyle = { width: 60, marginRight: 16 };
const sectionStyle = { margin: '32px 0 24px 0', padding: 24, background: '#f9f9f9', borderRadius: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' };
const gridStyle = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'center' };

export default function DevPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState('');
  const [result, setResult] = useState(null);

  // Configurable amounts (all default to 0)
  const [mailchimpSubs, setMailchimpSubs] = useState(0);
  const [mailchimpCampaigns, setMailchimpCampaigns] = useState(0);
  const [mailchimpTemplates, setMailchimpTemplates] = useState(0);
  const [mailchimpSegments, setMailchimpSegments] = useState(0);

  const [intercomUsers, setIntercomUsers] = useState(0);
  const [intercomConvos, setIntercomConvos] = useState(0);
  const [intercomCompanies, setIntercomCompanies] = useState(0);
  const [intercomSegments, setIntercomSegments] = useState(0);
  const [intercomEvents, setIntercomEvents] = useState(0);
  const [intercomNotes, setIntercomNotes] = useState(0);
  const [intercomArticles, setIntercomArticles] = useState(0);
  const [intercomNews, setIntercomNews] = useState(0);

  const isAdmin = session?.user?.email === 'ethan+vybescript@ethanteng.com';

  async function handleFakeData(type) {
    setLoading(type);
    setResult(null);
    let body = {};
    if (type === 'mailchimp') {
      body = {
        subscribers: mailchimpSubs,
        campaigns: mailchimpCampaigns,
        templates: mailchimpTemplates,
        segments: mailchimpSegments,
      };
    } else if (type === 'intercom') {
      body = {
        users: intercomUsers,
        conversations: intercomConvos,
        companies: intercomCompanies,
        segments: intercomSegments,
        events: intercomEvents,
        notes: intercomNotes,
        articles: intercomArticles,
        news: intercomNews,
      };
    }
    try {
      const res = await fetch(`/api/dev/fake-${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading('');
    }
  }

  if (status === 'loading') return <div>Loading...</div>;
  if (!isAdmin) return <div>Unauthorized</div>;

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 32, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>Dev Tools</h1>
      <p style={{ color: '#444', marginBottom: 32 }}>Populate your dev Mailchimp and Intercom accounts with fake data for testing. Configure the amount and type of data below.</p>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Mailchimp</h2>
        <div style={gridStyle}>
          <div><span style={labelStyle}>Subscribers</span><input type="number" min={0} max={100} value={mailchimpSubs} onChange={e => setMailchimpSubs(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Campaigns</span><input type="number" min={0} max={20} value={mailchimpCampaigns} onChange={e => setMailchimpCampaigns(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Templates</span><input type="number" min={0} max={10} value={mailchimpTemplates} onChange={e => setMailchimpTemplates(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Segments</span><input type="number" min={0} max={10} value={mailchimpSegments} onChange={e => setMailchimpSegments(Number(e.target.value))} style={inputStyle} /></div>
        </div>
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button onClick={() => handleFakeData('mailchimp')} disabled={loading === 'mailchimp'} style={{ padding: '8px 24px', fontWeight: 600, fontSize: 16 }}>
            {loading === 'mailchimp' ? 'Populating...' : 'Populate Mailchimp'}
          </button>
        </div>
      </div>

      <div style={sectionStyle}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>Intercom</h2>
        <div style={gridStyle}>
          <div><span style={labelStyle}>Users</span><input type="number" min={0} max={100} value={intercomUsers} onChange={e => setIntercomUsers(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Conversations</span><input type="number" min={0} max={20} value={intercomConvos} onChange={e => setIntercomConvos(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Companies</span><input type="number" min={0} max={10} value={intercomCompanies} onChange={e => setIntercomCompanies(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Segments</span><input type="number" min={0} max={10} value={intercomSegments} onChange={e => setIntercomSegments(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Events</span><input type="number" min={0} max={20} value={intercomEvents} onChange={e => setIntercomEvents(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Notes</span><input type="number" min={0} max={20} value={intercomNotes} onChange={e => setIntercomNotes(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>Articles</span><input type="number" min={0} max={10} value={intercomArticles} onChange={e => setIntercomArticles(Number(e.target.value))} style={inputStyle} /></div>
          <div><span style={labelStyle}>News</span><input type="number" min={0} max={10} value={intercomNews} onChange={e => setIntercomNews(Number(e.target.value))} style={inputStyle} /></div>
        </div>
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <button onClick={() => handleFakeData('intercom')} disabled={loading === 'intercom'} style={{ padding: '8px 24px', fontWeight: 600, fontSize: 16 }}>
            {loading === 'intercom' ? 'Populating...' : 'Populate Intercom'}
          </button>
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 32, background: '#f5f5f5', borderRadius: 8, maxHeight: 400, overflow: 'auto', padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Result</div>
          <pre style={{ fontSize: 13, lineHeight: 1.5 }}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
} 