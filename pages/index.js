import { useState } from "react";

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
      setHistory((prev) => [{ prompt, result: data.result }, ...prev]);
      setSelectedCanonical(data.result);
      setPrompt("");
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
      body: JSON.stringify({ platform, canonical: result })
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      let message = "";
      if (data.schedulingStatus === "scheduled_successfully") {
        message = "Created and scheduled!";
      } else if (data.schedulingStatus === "schedule_failed") {
        message = "Created, but scheduling failed—you need to manually set the send time.";
      } else if (data.schedulingStatus === "not_requested") {
        message = "Created as draft—no scheduled time set.";
      } else {
        message = "Created!";
      }
      setStatus(`${message} View: ${data.campaignDetailsUrl}`);
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

              <div style={{ fontFamily: "sans-serif", fontSize: "14px", lineHeight: "1.6", marginTop: "8px" }}>
                <p><strong>Campaign Name:</strong> {entry.result.campaign_name}</p>
                <p><strong>Subject Line:</strong> {entry.result.subject_line}</p>
                <p><strong>Preview Text:</strong> {entry.result.preview_text || "(none)"}</p>
                <p><strong>From:</strong> {entry.result.from_name} &lt;{entry.result.reply_to}&gt;</p>
                {entry.result.scheduled_time && (
                  <p><strong>Scheduled Time:</strong> {new Date(entry.result.scheduled_time).toLocaleString()}</p>
                )}
                <p><strong>HTML Preview:</strong></p>
                <div style={{
                  border: "1px solid #555",
                  marginTop: "8px",
                  maxHeight: "400px",
                  overflow: "auto",
                  background: "#fff"
                }}>
                  <iframe
                    srcDoc={entry.result.html_body}
                    style={{
                      width: "100%",
                      height: "400px",
                      border: "none"
                    }}
                    sandbox=""
                  />
                </div>
                <details style={{ marginTop: "12px" }}>
                  <summary style={{ cursor: "pointer" }}>Show raw JSON</summary>
                  <pre style={{
                    fontSize: "12px",
                    background: "#222",
                    padding: "8px",
                    borderRadius: "4px",
                    overflowX: "auto"
                  }}>
                    {JSON.stringify(entry.result, null, 2)}
                  </pre>
                </details>
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