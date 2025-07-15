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
    <div className="max-w-4xl mx-auto my-10 px-4 font-sans">
      <h1 className="text-3xl font-bold underline text-pink-500">
        Hello Tailwind!
      </h1>
      <h2 className="text-xl font-semibold mt-2 mb-4">
        Create your multi-channel campaign
      </h2>
      <textarea
        rows={4}
        className="w-full border border-gray-300 rounded p-2 mb-2"
        placeholder="Describe your campaign..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
        onClick={handleSubmit}
      >
        Submit
      </button>
      <pre className="whitespace-pre-wrap mt-4 text-sm text-gray-700">{status}</pre>

      {history.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mt-8 mb-4">Generated Versions</h3>
          {history.map(({ prompt, result }, i) => (
            <div
              key={i}
              className="border border-gray-300 rounded p-4 mb-6"
            >
              <strong className="block mb-2">Prompt:</strong>
              <p className="mb-4">{prompt}</p>

              <div className="flex flex-wrap gap-5 items-start">
                {/* Mailchimp */}
                {result.channels.includes("mailchimp") && (
                  <div className="flex-1 min-w-[300px]">
                    <h4 className="text-md font-semibold mb-2">Mailchimp</h4>
                    <p className="text-sm mb-2">
                      <strong>Subject:</strong> {result.mailchimp.subject_line}
                      <br />
                      <strong>From:</strong> {result.mailchimp.from_name} ({result.mailchimp.reply_to})
                      <br />
                      <strong>Scheduled:</strong>{" "}
                      {result.mailchimp.scheduled_time || "(default: 24 hours in the future)"}
                    </p>
                    {result.mailchimp.audience && (
                      <p className="text-sm mb-2">
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
                  <div className="flex-1 min-w-[300px]">
                    <h4 className="text-md font-semibold mb-2">Intercom</h4>
                    {result.intercom.news_title && (
                      <p className="text-sm mb-2">
                        <strong>News Title:</strong> {result.intercom.news_title}
                      </p>
                    )}
                    {result.intercom.audience && (
                      <p className="text-sm mb-2">
                        <strong>Segments:</strong>{" "}
                        {result.intercom.audience.segments?.join(", ") || "None"}
                        <br />
                        <strong>Tags:</strong>{" "}
                        {result.intercom.audience.tags?.join(", ") || "None"}
                      </p>
                    )}
                    <div className="border border-gray-300 bg-gray-50 p-3 rounded mb-2">
                      <ReactMarkdown>
                        {result.intercom.in_app_message_markdown}
                      </ReactMarkdown>
                    </div>
                    <textarea
                      readOnly
                      value={result.intercom.in_app_message_markdown}
                      className="w-full border border-gray-300 rounded p-2 mb-2 text-sm"
                      rows={6}
                    />
                    <button
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 mb-2"
                      onClick={() => {
                        navigator.clipboard.writeText(result.intercom.in_app_message_markdown);
                        alert("✅ Copied Intercom message to clipboard!");
                      }}
                    >
                      Copy to Clipboard
                    </button>
                    <div className="flex gap-2 flex-wrap mt-2">
                      <a
                        href={`https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/banners/new`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">
                          Start New Banner
                        </button>
                      </a>
                      <a
                        href={`https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/all`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <button className="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded">
                          Start New Post
                        </button>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {showJson && (
                <div className="mt-2 max-h-72 overflow-y-auto">
                  <ReactJson data={result} />
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  className="bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded"
                  onClick={() => setShowJson((s) => !s)}
                >
                  {showJson ? "Hide JSON" : "Show JSON"}
                </button>
                {result.channels.includes("mailchimp") && (
                  <button
                    className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    onClick={() => handleCreate(result, ["mailchimp"])}
                  >
                    Create in Mailchimp
                  </button>
                )}
                {result.channels.includes("intercom") && (
                  <button
                    className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                    onClick={() => handleCreate(result, ["intercom"])}
                  >
                    Create in Intercom
                  </button>
                )}
                <button
                  className={`px-3 py-1 rounded ${
                    selected === result
                      ? "bg-gray-300 cursor-not-allowed"
                      : "bg-gray-100 hover:bg-gray-200"
                  }`}
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