// pages/index.js
import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import EmailPreview from "@/components/EmailPreview";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("mailchimp");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [showJson, setShowJson] = useState(false);

  const handleSubmit = async () => {
    setStatus("Processing...");
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, platform, previous: selected }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Done!");
      const newEntry = { prompt, result: data.result };
      setHistory((h) => [newEntry, ...h]);
      setSelected(data.result); // Auto-select the new one
    }
    setPrompt("");
  };

  const handleCreate = async (canonical) => {
    setStatus(`Creating in ${platform}...`);
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, canonical }),
    });
    const data = await res.json();
    setStatus(data.error ? "Error: " + data.error : `${data.message || "Created!"} ${data.url ? `(${data.url})` : ""}`);
    if (data.url) window.open(data.url, "_blank");
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 900, margin: "40px auto" }}>
      <h2>Prompt to Email Campaign</h2>
      <textarea
        rows={4}
        style={{ width: "100%" }}
        placeholder="Describe your campaign..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div style={{ margin: "8px 0" }}>
        <label>
          Platform:{" "}
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="mailchimp">Mailchimp</option>
            <option value="klaviyo">Klaviyo</option>
          </select>
        </label>
      </div>
      <button onClick={handleSubmit}>Submit</button>
      <p>{status}</p>

      {history.length > 0 && (
        <>
          <h3>Generated Versions</h3>
          {history.map(({ prompt, result }, i) => (
            <div
              key={i}
              style={{
                border: "1px solid #ddd",
                padding: 16,
                margin: "16px 0",
                borderRadius: 4,
              }}
            >
              <strong>Prompt:</strong> {prompt}
              <div style={{ marginTop: 12 }}>
                <EmailPreview html={result.html_body} />
              </div>
              {showJson && (
                <div style={{ marginTop: 8, maxHeight: 300, overflowY: "auto" }}>
                  <JSONPretty data={result} />
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <button onClick={() => setShowJson((s) => !s)}>
                  {showJson ? "Hide JSON" : "Show JSON"}
                </button>
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => {
                    setSelected(result);
                    handleCreate(result);
                  }}
                >
                  Create in {platform.charAt(0).toUpperCase() + platform.slice(1)}
                </button>
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => setSelected(result)}
                  disabled={selected === result}
                >
                  {selected === result ? "✅ Selected" : "Select this Version"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}