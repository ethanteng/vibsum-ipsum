import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("mailchimp");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");

  // Submit prompt to /api/parse
  const handleSubmit = async () => {
    setStatus("Processing...");
    setResult(null);

    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    console.log("🔥 API response:", data);

    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Ready to create!");
      setResult(data.result);
    }
  };

  // Create campaign in Mailchimp (or other platform)
  const handleCreate = async () => {
    setStatus(`Creating in ${platform}...`);

    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        platform,
        canonical: result
      })
    });

    const data = await res.json();
    console.log("🔥 Create response:", data);

    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Done!");
      setResult(data);
    }
  };

  return (
    <>
      <div
        style={{
          maxWidth: "600px",
          margin: "40px auto",
          fontFamily: "sans-serif"
        }}
      >
        <h2>Prompt to JSON</h2>

        <textarea
          rows={6}
          style={{ width: "100%" }}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe your campaign..."
        />

        <div style={{ marginTop: "8px" }}>
          <label>
            Platform:&nbsp;
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
            >
              <option value="mailchimp">Mailchimp</option>
              <option value="klaviyo">Klaviyo</option>
              {/* Add more platforms here */}
            </select>
          </label>
        </div>

        <button onClick={handleSubmit} style={{ marginTop: "8px" }}>
          Generate JSON
        </button>

        <p>{status}</p>
      </div>

      {result && (
        <>
          <div
            style={{
              width: "90%",
              maxWidth: "1200px",
              margin: "20px auto",
              border: "1px solid #333",
              borderRadius: "4px",
              background: "#1e1e1e",
              padding: "12px",
              overflowX: "auto",
              maxHeight: "600px",
              overflowY: "auto",
              fontFamily: "monospace"
            }}
          >
            <JSONPretty
              data={result}
              style={{
                fontSize: "14px",
                lineHeight: "1.4"
              }}
            />
          </div>

          <button
            onClick={handleCreate}
            style={{
              display: "block",
              margin: "20px auto",
              padding: "10px 20px",
              background: "#4fc3f7",
              color: "#000",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold"
            }}
          >
            Create Campaign in {platform.charAt(0).toUpperCase() + platform.slice(1)}
          </button>

          {result.campaignDetailsUrl && (
            <p style={{ textAlign: "center", marginTop: "12px" }}>
              <a
                href={result.campaignDetailsUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: "#4fc3f7",
                  textDecoration: "none",
                  fontWeight: "bold"
                }}
              >
                View Campaign in {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </a>
            </p>
          )}
        </>
      )}
    </>
  );
}