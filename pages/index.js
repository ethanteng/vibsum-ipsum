// pages/index.js
import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import EmailPreview from "@/components/EmailPreview";
import Logo from "@/components/Logo";
import ReactMarkdown from "react-markdown";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  // Redirect to sign in if not authenticated
  if (sessionStatus === "loading") {
    return <div>Loading...</div>;
  }

  if (sessionStatus === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [showJson, setShowJson] = useState(false);

  const handleSubmit = async () => {
    setStatus("Working on it...");
    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, previous: selected }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Something went wrong. See below for details. " + data.error);
    } else {
      const newEntry = { prompt, result: data.result };
      setHistory((h) => [newEntry, ...h]);
      setSelected(data.result);
      setStatus(""); // Clear the status when generation is successful
    }
    setPrompt("");
  };

  const handleCreate = async (canonical, channels) => {
    setStatus(`Creating in ${channels.map(channel => channel.charAt(0).toUpperCase() + channel.slice(1)).join(", ")}...`);
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ canonical, channels }),
    });
    const data = await res.json();
    if (data.error) {
      setStatus("Something went wrong. See below for details. " + data.error);
    } else {
      const messages = Object.entries(data.results).map(([ch, r]) => {
        const warnings = [];
        if (r.unresolvedSegments?.length) {
          warnings.push(`No matching segment could be found for: ${r.unresolvedSegments.join(", ")}`);
        }
        if (r.unresolvedTags?.length) {
          warnings.push(`No matching tag could be found for: ${r.unresolvedTags.join(", ")}`);
        }
        
        // Format the message more clearly
        const channelName = ch.charAt(0).toUpperCase() + ch.slice(1);
        const status = r.status || "created";
        const url = r.url ? `See ${r.url}.` : null;
        
        // Handle different channel types with appropriate naming
        let successMessage;
        if (ch === "intercom") {
          successMessage = "Intercom News created.";
        } else {
          successMessage = `${channelName} campaign created.`;
        }
        if (url) successMessage += ` ${url}`;
        
        // Build error messages separately
        const errorMessages = [];
        if (status !== "created" && status !== "success") {
          errorMessages.push(`${status} error occurred`);
        }
        if (warnings.length) {
          errorMessages.push(...warnings);
        }
        
        return {
          success: successMessage,
          errors: errorMessages
        };
      });

      // Separate success and error messages
      const successMessages = messages.map(m => m.success).filter(Boolean);
      const allErrors = messages.flatMap(m => m.errors).filter(Boolean);
      
      let statusMessage = successMessages.join("\n");
      if (allErrors.length > 0) {
        statusMessage += "\n\nErrors:\n" + allErrors.join("\n");
      }
      
      setStatus(statusMessage);

      Object.values(data.results).forEach((r) => {
        if (r.url) window.open(r.url, "_blank");
      });
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-3 z-10">
        <div className="flex justify-between items-center">
          <Logo className="h-8 w-auto" />
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">{session?.user?.email}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-gray-600 hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="w-72 border-r border-gray-200 bg-white p-4 flex flex-col mt-16">
        <h2 className="text-xl font-bold mb-4">Prompt History</h2>
        {history.length === 0 && (
          <p className="text-gray-500 text-sm mb-4">
            Select or generate a prompt to see details.
          </p>
        )}
        <ul className="space-y-2 flex-1 overflow-y-auto">
          {history.map(({ prompt, result }, i) => (
            <li key={i}>
              <button
                className={`w-full text-left px-3 py-2 rounded ${
                  selected === result
                    ? "bg-indigo-100 font-semibold"
                    : "hover:bg-gray-100"
                }`}
                onClick={() => setSelected(result)}
              >
                {prompt.slice(0, 40)}...
              </button>
            </li>
          ))}
        </ul>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6 overflow-y-auto mt-16">
        {/* Prompt Box */}
        <div className="bg-white shadow border border-gray-200 p-4 rounded mb-6">
          <h1 className="text-2xl font-bold mb-2">Create Your Multi-Channel Campaign</h1>
          <textarea
            rows={3}
            className="w-full border border-gray-300 rounded p-2 mb-2"
            placeholder="Describe your campaign..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <div className="flex items-center justify-between mt-2">
            <div>
              {status && (
                <div className="text-xs px-3 py-1 rounded text-gray-700 bg-gray-50">
                  {status.split('\n').map((line, index) => {
                    if (line.startsWith('Errors:')) {
                      return (
                        <div key={index} className="text-red-700 font-semibold mt-2">
                          {line}
                        </div>
                      );
                    } else if (line.startsWith('No matching') || line.includes('error occurred')) {
                      return (
                        <div key={index} className="text-red-700 ml-4">
                          {line}
                        </div>
                      );
                    } else {
                      return (
                        <div key={index}>
                          {line}
                        </div>
                      );
                    }
                  })}
                </div>
              )}
            </div>
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={handleSubmit}
            >
              Generate
            </button>
          </div>
        </div>

        {!selected ? (
          <></>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Mailchimp */}
            {selected.channels.includes("mailchimp") && (
              <section className="border border-gray-200 rounded p-4 bg-white">
                <h3 className="text-lg font-semibold mb-2">Mailchimp Campaign</h3>
                <p className="text-sm mb-2">
                  <strong>To:</strong>{" "}
                  {selected.mailchimp.audience?.segments?.join(", ") ||
                    selected.mailchimp.audience?.tags?.join(", ") ||
                    "None"}
                  <br />
                  <strong>From:</strong> {selected.mailchimp.from_name} ({selected.mailchimp.reply_to})
                  <br />
                  <strong>Subject:</strong> {selected.mailchimp.subject_line}
                  <br />
                  <strong>Scheduled for:</strong>{" "}
                  {selected.mailchimp.scheduled_time || "(default: 24 hours in the future)"}
                </p>
                <EmailPreview html={selected.mailchimp.html_body} />
                <button
                  className="mt-3 bg-gray-700 text-white px-3 py-1 rounded hover:bg-blue-600"
                  onClick={() => handleCreate(selected, ["mailchimp"])}
                >
                  Create Campaign
                </button>
              </section>
            )}

            {/* Intercom */}
            {selected.channels.includes("intercom") && (
              <section className="space-y-6">
                {/* News */}
                <div className="border border-gray-200 rounded p-4 bg-white">
                  <h4 className="text-md font-semibold mb-2">Intercom News</h4>
                  <p className="text-sm mb-2">
                    <strong>Title:</strong> {selected.intercom.news_title}
                  </p>
                  <div className="border border-gray-300 bg-gray-50 p-3 rounded mb-2">
                    <ReactMarkdown>
                      {selected.intercom.news_markdown}
                    </ReactMarkdown>
                  </div>
                  <button
                    className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-blue-600"
                    onClick={() => handleCreate(selected, ["intercom"])}
                  >
                    Create News
                  </button>
                </div>

                {/* Post */}
                <div className="border border-gray-200 rounded p-4 bg-white">
                  <h4 className="text-md font-semibold mb-2">Intercom Post</h4>
                  <div className="border border-gray-300 bg-gray-50 p-3 rounded mb-2 text-sm text-gray-800 whitespace-pre-wrap">
                    {selected.intercom.post_plaintext}
                  </div>
                  <button
                    className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800 mr-2"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selected.intercom.post_plaintext
                      );
                      window.open(
                        `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/all`,
                        "_blank"
                      );
                    }}
                  >
                    Copy & Paste to Post
                  </button>
                </div>

                {/* Banner */}
                <div className="border border-gray-200 rounded p-4 bg-white">
                  <h4 className="text-md font-semibold mb-2">Intercom Banner</h4>
                  <div className="border border-gray-300 bg-gray-50 p-3 rounded mb-2 text-sm text-gray-800">
                    {selected.intercom.banner_text}
                  </div>
                  <button
                    className="bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-800"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        selected.intercom.banner_text
                      );
                      window.open(
                        `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/banners/new`,
                        "_blank"
                      );
                    }}
                  >
                    Copy & Paste to Banner
                  </button>
                </div>
              </section>
            )}
          </div>
        )}

        {selected && (
          <>
            {showJson && (
              <div className="mt-4 max-h-72 overflow-y-auto">
                <JsonView data={selected} />
              </div>
            )}
            <button
              className="mt-2 text-sm text-gray-600 underline"
              onClick={() => setShowJson((s) => !s)}
            >
              {showJson ? "Hide JSON" : "Show JSON"}
            </button>
          </>
        )}
      </main>
    </div>
  );
}