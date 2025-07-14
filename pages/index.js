// pages/index.js
import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";
import EmailPreview from "@/components/EmailPreview";
import ReactMarkdown from "react-markdown";

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
          warnings.length ? `⚠️ ${warnings.join("; ")}` : null,
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
      <h2>Create your multi-channel campaign</h2>
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
                  gap: 20,
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                {/* Mailchimp */}
                {result.channels.includes("mailchimp") && (
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <h4>Mailchimp</h4>
                    <p>
                      <strong>Subject:</strong> {result.mailchimp.subject_line}
                      <br />
                      <strong>From:</strong> {result.mailchimp.from_name} ({result.mailchimp.reply_to})
                      <br />
                      <strong>Scheduled:</strong>{" "}
                      {result.mailchimp.scheduled_time || "(default: 24 hours in the future)"}
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
                    <EmailPreview html={result.mailchimp.html_body} />
                  </div>
                )}

                {/* Intercom */}
                {result.channels.includes("intercom") && (
                  <div style={{ flex: 1, minWidth: 300 }}>
                    <h4>Intercom</h4>
                    {result.intercom.news_title && (
                      <p>
                        <strong>News Title:</strong> {result.intercom.news_title}
                      </p>
                    )}
                    {result.intercom.audience && (
                      <p>
                        <strong>Segments:</strong>{" "}
                        {result.intercom.audience.segments?.join(", ") || "None"}
                        <br />
                        <strong>Tags:</strong>{" "}
                        {result.intercom.audience.tags?.join(", ") || "None"}
                      </p>
                    )}
                    <div
                      style={{
                        border: "1px solid #ddd",
                        background: "#f9f9f9",
                        padding: "12px",
                        borderRadius: "4px",
                        marginTop: 8,
                      }}
                    >
                      <ReactMarkdown>{result.intercom.in_app_message_markdown}</ReactMarkdown>
                    </div>
                    <textarea
                      readOnly
                      value={result.intercom.in_app_message_markdown}
                      style={{ width: "100%", height: 150, marginTop: 8 }}
                    />
                    <button
                      style={{ marginTop: 8 }}
                      onClick={() => {
                        navigator.clipboard.writeText(result.intercom.in_app_message_markdown);
                        alert("✅ Copied Intercom message to clipboard!");
                      }}
                    >
                      Copy to Clipboard
                    </button>
                    <div style={{ marginTop: 8, display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <a
                        href={`https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/banners/new`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button>Start New Banner</button>
                      </a>
                      <a
                        href={`https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/all`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button>Start New Post</button>
                      </a>
                    </div>
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
                    onClick={() => handleCreate(result, ["intercom"])}
                  >
                    Create in Intercom
                  </button>
                )}
                <button
                  onClick={() => setSelected(result)}
                  disabled={selected === result}
                >
                  {selected === result
                    ? "✅ Select This Prompt"
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