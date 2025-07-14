// pages/index.js
import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import EmailPreview from "@/components/EmailPreview";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [showJson, setShowJson] = useState(false);

  const handleSubmit = async () => {
    setStatus("Processing...");
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, previous: selected }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Done!");
      const newEntry = { prompt, result: data.result };
      setHistory((h) => [newEntry, ...h]);
      setSelected(data.result);
    }
    setPrompt("");
  };

  const handleCreate = async (canonical, channels) => {
    setStatus(`Creating in ${channels.join(", ")}...`);
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical, channels }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      const messages = Object.entries(data.results).map(([ch, r]) => {
        const warnings = [];
        if (r.unresolvedSegments?.length) {
          warnings.push(`Unresolved Segments: ${r.unresolvedSegments.join(", ")}`);
        }
        if (r.unresolvedTags?.length) {
          warnings.push(`Unresolved Tags: ${r.unresolvedTags.join(", ")}`);
        }

        return [
          `${ch}: ${r.status || "created"}`,
          r.url ? `URL: ${r.url}` : null,
          warnings.length ? `⚠️ ${warnings.join("; ")}` : null
        ]
          .filter(Boolean)
          .join(" | ");
      });

      setStatus(`Created:\n${messages.join("\n")}`);

      Object.values(data.results).forEach((r) => {
        if (r.url) window.open(r.url, "_blank");
      });
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", maxWidth: 1000, margin: "40px auto" }}>
      <h2>Prompt to Multi-Channel Campaign</h2>
      <textarea
        rows={4}
        style={{ width: "100%" }}
        placeholder="Describe your campaign..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button onClick={handleSubmit} style={{ marginTop: 8 }}>
        Submit
      </button>
      <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{status}</pre>

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

              <div
                style={{
                  display: "flex",
                  gap: "20px",
                  marginTop: "12px",
                  alignItems: "flex-start",
                }}
              >
                {result.channels.includes("mailchimp") && (
                  <div style={{ flex: 1 }}>
                    <h4>Mailchimp</h4>
                    <EmailPreview html={result.mailchimp.html_body} />
                    <p>
                      <strong>Subject:</strong> {result.mailchimp.subject_line}
                      <br />
                      <strong>From:</strong> {result.mailchimp.from_name} ({result.mailchimp.reply_to})
                      <br />
                      <strong>Scheduled:</strong>{" "}
                      {result.mailchimp.scheduled_time || "(default 24h)"}
                    </p>
                    {result.mailchimp.audience && (
                      <p>
                        <strong>Segments:</strong>{" "}
                        {result.mailchimp.audience.segments?.join(", ") || "None"}
                        <br />
                        <strong>Tags:</strong>{" "}
                        {result.mailchimp.audience.tags?.join(", ") || "None"}
                      </p>
                    )}
                  </div>
                )}

                {result.channels.includes("intercom") && (
                  <div style={{ flex: 1 }}>
                    <h4>Intercom</h4>
                    <div
                      style={{
                        border: "1px solid #ddd",
                        background: "#f9f9f9",
                        padding: "12px",
                        borderRadius: "4px",
                      }}
                      dangerouslySetInnerHTML={{
                        __html: `<p>${result.intercom.in_app_message}</p>`,
                      }}
                    />
                    <p>
                      <strong>Scheduled:</strong>{" "}
                      {result.intercom.scheduled_time || "(default 24h)"}
                    </p>
                    {result.intercom.audience && (
                      <p>
                        <strong>Segments:</strong>{" "}
                        {result.intercom.audience.segments?.join(", ") || "None"}
                        <br />
                        <strong>Tags:</strong>{" "}
                        {result.intercom.audience.tags?.join(", ") || "None"}
                      </p>
                    )}
                  </div>
                )}
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
                {result.channels.includes("mailchimp") && (
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => handleCreate(result, ["mailchimp"])}
                  >
                    Create in Mailchimp
                  </button>
                )}
                {result.channels.includes("intercom") && (
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => handleCreate(result, ["intercom"])}
                  >
                    Create in Intercom
                  </button>
                )}
                {result.channels.length > 1 && (
                  <button
                    style={{ marginLeft: 8 }}
                    onClick={() => handleCreate(result, result.channels)}
                  >
                    Create All
                  </button>
                )}
                <button
                  style={{ marginLeft: 8 }}
                  onClick={() => setSelected(result)}
                  disabled={selected === result}
                >
                  {selected === result
                    ? "✅ Selected for Refinement"
                    : "Select for Refinement"}
                </button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}