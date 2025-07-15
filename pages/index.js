// pages/index.js
import { useState } from "react";
import EmailPreview from "@/components/EmailPreview";
import ReactMarkdown from "react-markdown";
import { ReactJson } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

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
    <div className="max-w-3xl mx-auto py-12 px-4 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Multi-Channel Campaign Builder
        </h1>
        <p className="text-gray-500 mt-1">
          Generate and preview campaigns for Mailchimp and Intercom.
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <textarea
          rows={4}
          className="w-full border border-gray-300 rounded-md p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Describe your campaign..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <div className="flex justify-end mt-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition"
            onClick={handleSubmit}
          >
            Generate
          </button>
        </div>
        {status && (
          <pre className="whitespace-pre-wrap mt-3 text-sm text-gray-700">{status}</pre>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Generated Versions
          </h2>
          <div className="space-y-6">
            {history.map(({ prompt, result }, i) => (
              <div
                key={i}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm"
              >
                <div className="mb-4">
                  <h3 className="text-base font-semibold text-gray-800 mb-1">
                    Prompt
                  </h3>
                  <p className="text-gray-700 text-sm">{prompt}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Mailchimp */}
                  {result.channels.includes("mailchimp") && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">Mailchimp</h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        <p><strong>Subject:</strong> {result.mailchimp.subject_line}</p>
                        <p><strong>From:</strong> {result.mailchimp.from_name} ({result.mailchimp.reply_to})</p>
                        <p><strong>Scheduled:</strong> {result.mailchimp.scheduled_time || "(24 hours from now)"}</p>
                        {result.mailchimp.audience && (
                          <>
                            <p><strong>Segments:</strong> {result.mailchimp.audience.segments?.join(", ") || "None"}</p>
                            <p><strong>Tags:</strong> {result.mailchimp.audience.tags?.join(", ") || "None"}</p>
                          </>
                        )}
                      </div>
                      <div className="mt-3">
                        <EmailPreview html={result.mailchimp.html_body} />
                      </div>
                    </div>
                  )}

                  {/* Intercom */}
                  {result.channels.includes("intercom") && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-2">Intercom</h4>
                      <div className="space-y-2 text-sm text-gray-700">
                        {result.intercom.news_title && (
                          <p><strong>News Title:</strong> {result.intercom.news_title}</p>
                        )}
                        {result.intercom.audience && (
                          <>
                            <p><strong>Segments:</strong> {result.intercom.audience.segments?.join(", ") || "None"}</p>
                            <p><strong>Tags:</strong> {result.intercom.audience.tags?.join(", ") || "None"}</p>
                          </>
                        )}
                      </div>
                      <div className="border border-gray-200 bg-gray-50 p-3 rounded-md mt-3 text-sm text-gray-800">
                        <ReactMarkdown>
                          {result.intercom.in_app_message_markdown}
                        </ReactMarkdown>
                      </div>
                      <textarea
                        readOnly
                        value={result.intercom.in_app_message_markdown}
                        className="w-full border border-gray-300 rounded-md p-2 mt-2 text-sm bg-gray-50"
                        rows={6}
                      />
                      <button
                        className="mt-2 bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition"
                        onClick={() => {
                          navigator.clipboard.writeText(result.intercom.in_app_message_markdown);
                          alert("✅ Copied Intercom message to clipboard!");
                        }}
                      >
                        Copy to Clipboard
                      </button>
                    </div>
                  )}
                </div>

                {showJson && (
                  <div className="mt-4 max-h-72 overflow-y-auto bg-gray-50 border border-gray-200 rounded-md p-3 text-sm">
                    <ReactJson data={result} />
                  </div>
                )}

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md transition"
                    onClick={() => setShowJson((s) => !s)}
                  >
                    {showJson ? "Hide JSON" : "Show JSON"}
                  </button>
                  {result.channels.includes("mailchimp") && (
                    <button
                      className="bg-green-500 text-white px-3 py-1 rounded-md hover:bg-green-600 transition"
                      onClick={() => handleCreate(result, ["mailchimp"])}
                    >
                      Create in Mailchimp
                    </button>
                  )}
                  {result.channels.includes("intercom") && (
                    <button
                      className="bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition"
                      onClick={() => handleCreate(result, ["intercom"])}
                    >
                      Create in Intercom
                    </button>
                  )}
                  <button
                    className={`px-3 py-1 rounded-md ${
                      selected === result
                        ? "bg-gray-300 cursor-not-allowed"
                        : "bg-gray-100 hover:bg-gray-200 transition"
                    }`}
                    onClick={() => setSelected(result)}
                    disabled={selected === result}
                  >
                    {selected === result
                      ? "✅ Selected"
                      : "Select for Refinement"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}