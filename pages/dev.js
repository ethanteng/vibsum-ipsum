import { useSession } from 'next-auth/react';
import { useState } from 'react';

export default function DevPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState('');
  const [result, setResult] = useState(null);

  // Configurable amounts
  const [mailchimpSubs, setMailchimpSubs] = useState(5);
  const [mailchimpCampaigns, setMailchimpCampaigns] = useState(2);
  const [intercomUsers, setIntercomUsers] = useState(5);
  const [intercomConvos, setIntercomConvos] = useState(2);

  const isAdmin = session?.user?.email === 'ethan+vybescript@ethanteng.com';

  async function handleFakeData(type) {
    setLoading(type);
    setResult(null);
    let body = {};
    if (type === 'mailchimp') {
      body = { subscribers: mailchimpSubs, campaigns: mailchimpCampaigns };
    } else if (type === 'intercom') {
      body = { users: intercomUsers, conversations: intercomConvos };
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
    <div style={{ maxWidth: 600, margin: '40px auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <h1>Dev Tools</h1>
      <p>Populate your dev Mailchimp and Intercom accounts with fake data for testing.</p>
      <div style={{ margin: '24px 0', padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
        <h3>Mailchimp</h3>
        <label>
          Subscribers:
          <input type="number" min={1} max={100} value={mailchimpSubs} onChange={e => setMailchimpSubs(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
        </label>
        <label style={{ marginLeft: 16 }}>
          Campaigns:
          <input type="number" min={1} max={20} value={mailchimpCampaigns} onChange={e => setMailchimpCampaigns(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
        </label>
        <button onClick={() => handleFakeData('mailchimp')} disabled={loading === 'mailchimp'} style={{ marginLeft: 16 }}>
          {loading === 'mailchimp' ? 'Populating...' : 'Populate Mailchimp'}
        </button>
      </div>
      <div style={{ margin: '24px 0', padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
        <h3>Intercom</h3>
        <label>
          Users:
          <input type="number" min={1} max={100} value={intercomUsers} onChange={e => setIntercomUsers(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
        </label>
        <label style={{ marginLeft: 16 }}>
          Conversations:
          <input type="number" min={1} max={20} value={intercomConvos} onChange={e => setIntercomConvos(Number(e.target.value))} style={{ marginLeft: 8, width: 60 }} />
        </label>
        <button onClick={() => handleFakeData('intercom')} disabled={loading === 'intercom'} style={{ marginLeft: 16 }}>
          {loading === 'intercom' ? 'Populating...' : 'Populate Intercom'}
        </button>
      </div>
      {result && (
        <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
} 