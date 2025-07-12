import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("mailchimp");
  const [history, setHistory] = useState([]); // array of { prompt, result }
  const [selectedCanonical, setSelectedCanonical] = useState(null);
  const [status, setStatus] = useState("");

  const handleSubmit = async () => {
    setStatus("Processing...");

    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, platform, previous: selectedCanonical })
    });

    const data = await res.json();
    console.log("🔥 API response:", data);

    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Done!");
      // Prepend just the canonical result
      setHistory((prev) => [{ prompt, result: data.result }, ...prev]);
      setSelectedCanonical(data.result); // auto-select most recent
    }
  };

  const handleSelect = (result) => {
    setSelectedCanonical(result);
  };

  const handleCreate = async (result) => {
    setStatus("Creating in Mailchimp...");
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, platform, canonical: result })
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus(`Created! View: ${data.campaignDetailsUrl}`);
      window.open(data.campaignDetailsUrl, "_blank");
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
            <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="mailchimp">Mailchimp</option>
              <option value="klaviyo">Klaviyo</option>
            </select>
          </label>
        </div>

        <button onClick={handleSubmit} style={{ marginTop: "8px" }}>
          Submit
        </button>

        <p>{status}</p>
      </div>

      {history.length > 0 && (
        <div style={{ maxWidth: "900px", margin: "20px auto" }}>
          <h3>Generated Versions</h3>
          {history.map((entry, index) => (
            <div
              key={index}
              style={{
                border: "1px solid #333",
                borderRadius: "4px",
                background: "#1e1e1e",
                padding: "12px",
                marginBottom: "16px"
              }}
            >
              <strong>Prompt:</strong> {entry.prompt}
              <div
                style={{
                  marginTop: "8px",
                  maxHeight: "400px",
                  overflowY: "auto",
                  fontFamily: "monospace"
                }}
              >
                <JSONPretty
                  data={entry.result}
                  style={{
                    fontSize: "14px",
                    lineHeight: "1.4"
                  }}
                />
              </div>
              <div style={{ marginTop: "8px" }}>
                <button onClick={() => handleSelect(entry.result)}>
                  {selectedCanonical === entry.result ? "✅ Selected" : "Select this Version"}
                </button>
                <button
                  onClick={() => handleCreate(entry.result)}
                  style={{ marginLeft: "8px" }}
                >
                  Create in Mailchimp
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}