// pages/index.js
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import EmailPreview from "@/components/EmailPreview";
import Logo from "@/components/Logo";
import ReactMarkdown from "react-markdown";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { applyTemplateToPreview } from "@/lib/extractMailchimpTemplate";

export default function Home() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState("");
  const [showJson, setShowJson] = useState(false);
  const [mailchimpTemplates, setMailchimpTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateHtml, setSelectedTemplateHtml] = useState("");
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [loadingTemplateHtml, setLoadingTemplateHtml] = useState(false);

  // Fetch history on login/page load
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetch("/api/history")
        .then((res) => res.json())
        .then((data) => {
          if (data.campaigns) {
            setHistory(data.campaigns.map(c => ({
              ...c,
              // Parse result JSON string if needed
              result: typeof c.result === "string" ? safeParseJson(c.result) : c.result
            })));
          }
        });
    }
  }, [sessionStatus]);

  // Fetch Mailchimp templates when user is authenticated
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchMailchimpTemplates();
    }
  }, [sessionStatus]);

  // Fetch template HTML when template is selected
  useEffect(() => {
    if (selectedTemplateId) {
      fetchTemplateHtml(selectedTemplateId);
    } else {
      setSelectedTemplateHtml("");
    }
  }, [selectedTemplateId]);

  // Helper to safely parse JSON
  function safeParseJson(str) {
    try { return JSON.parse(str); } catch { return str; }
  }

  // Fetch Mailchimp templates
  const fetchMailchimpTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch("/api/mailchimp/campaigns");
      if (res.ok) {
        const data = await res.json();
        setMailchimpTemplates(data.campaigns || []);
        // Auto-select the most recent template if available
        if (data.campaigns && data.campaigns.length > 0) {
          setSelectedTemplateId(data.campaigns[0].id);
        }
      } else {
        console.error("Failed to fetch templates:", await res.text());
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  // Fetch template HTML for preview
  const fetchTemplateHtml = async (templateId) => {
    setLoadingTemplateHtml(true);
    try {
      const res = await fetch(`/api/mailchimp/template?templateId=${templateId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedTemplateHtml(data.html);
      } else {
        console.error("Failed to fetch template HTML:", await res.text());
      }
    } catch (error) {
      console.error("Error fetching template HTML:", error);
    } finally {
      setLoadingTemplateHtml(false);
    }
  };

  // Get the HTML to display in preview
  const getPreviewHtml = () => {
    if (!selected?.mailchimp?.html_body) {
      return "";
    }

    if (showTemplatePreview && selectedTemplateHtml && selectedTemplateId) {
      return applyTemplateToPreview(selectedTemplateHtml, selected.mailchimp.html_body);
    }

    return selected.mailchimp.html_body;
  };

  // Redirect to sign in if not authenticated
  if (sessionStatus === "loading") {
    return <div>Loading...</div>;
  }

  if (sessionStatus === "unauthenticated") {
    router.push("/auth/signin");
    return null;
  }

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
      // Save to DB
      const saveRes = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, result: data.result }),
      });
      const saveData = await saveRes.json();
      if (saveData.campaign) {
        setHistory((h) => [
          {
            ...saveData.campaign,
            result: typeof saveData.campaign.result === "string"
              ? safeParseJson(saveData.campaign.result)
              : saveData.campaign.result
          },
          ...h,
        ]);
        setSelected(
          typeof saveData.campaign.result === "string"
            ? safeParseJson(saveData.campaign.result)
            : saveData.campaign.result
        );
      } else {
        // fallback: just update local state
        const newEntry = { prompt, result: data.result };
        setHistory((h) => [newEntry, ...h]);
        setSelected(data.result);
      }
      setStatus("");
    }
    setPrompt("");
  };

  const handleCreate = async (canonical, channels) => {
    setStatus(`Creating in ${channels.map(channel => channel.charAt(0).toUpperCase() + channel.slice(1)).join(", ")}...`);
    
    // Include template ID if Mailchimp is selected and a template is chosen
    const requestBody = { canonical, channels };
    if (channels.includes("mailchimp") && selectedTemplateId) {
      requestBody.templateId = selectedTemplateId;
    }
    
    const res = await fetch("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
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
        
        // Format the message more clearly
        const channelName = ch.charAt(0).toUpperCase() + ch.slice(1);
        const status = r.status || "created";
        const url = r.url ? `See ${r.url}.` : null;
        
        // Handle different channel types with appropriate naming
        let successMessage;
        if (ch === "intercom") {
          successMessage = "Intercom News created.";
        } else {
          if (status === "scheduled_successfully") {
            successMessage = `${channelName} campaign created and scheduled successfully.`;
          } else if (status === "not_requested") {
            successMessage = `${channelName} campaign created (not scheduled).`;
          } else {
            successMessage = `${channelName} campaign created.`;
          }
        }
        if (url) successMessage += ` ${url}`;
        
        // Build error messages separately
        const errorMessages = [];
        if (status !== "created" && status !== "success" && status !== "scheduled_successfully" && status !== "not_requested") {
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
            <a
              href="/connections"
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              Connections
            </a>
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
          
          {/* Mailchimp Template Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mailchimp Template To Use (Optional)
            </label>
            {loadingTemplates ? (
              <div className="text-sm text-gray-500">Loading templates...</div>
            ) : mailchimpTemplates.length > 0 ? (
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 text-sm"
              >
                <option value="">Use default styling</option>
                {mailchimpTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.title} - {template.subject_line} ({new Date(template.send_time).toLocaleDateString()})
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-sm text-gray-500">
                No previous campaigns found. Campaigns will use default styling.
              </div>
            )}
            <button
              onClick={fetchMailchimpTemplates}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800"
            >
              Refresh Templates
            </button>
          </div>
          
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
                  "All subscribers"
                  }
                  <br />
                  <strong>From:</strong> {selected.mailchimp.from_name} ({selected.mailchimp.reply_to})
                  <br />
                  <strong>Subject:</strong> {selected.mailchimp.subject_line}
                  <br />
                  <strong>Scheduled for:</strong>{" "}
                  {selected.mailchimp.scheduled_time || "(default: 24 hours in the future)"}
                  {selectedTemplateId && (
                    <>
                      <br />
                      <strong>Template applied:</strong>{" "}
                      {mailchimpTemplates.find(t => t.id === selectedTemplateId)?.title || "Selected template"}
                    </>
                  )}
                </p>
                
                {/* Template Preview Toggle */}
                {selectedTemplateId && (
                  <div className="mb-3">
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">
                        Preview Mode:
                      </label>
                      <button
                        onClick={() => setShowTemplatePreview(!showTemplatePreview)}
                        className={`px-3 py-1 text-xs rounded ${
                          showTemplatePreview
                            ? "bg-blue-600 text-white"
                            : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                      >
                        {showTemplatePreview ? "With Template" : "No Template"}
                      </button>
                      {loadingTemplateHtml && (
                        <span className="text-xs text-gray-500">Loading template...</span>
                      )}
                    </div>
                    {showTemplatePreview && (
                      <p className="text-xs text-gray-600 mt-1">
                        How your content will look with the selected template applied.
                      </p>
                    )}
                  </div>
                )}
                
                <EmailPreview html={getPreviewHtml()} />
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
                        `https://app.intercom.com/a/apps/${process.env.NEXT_PUBLIC_INTERCOM_APP_ID}/outbound/all`,
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

        {/* JSON View */}
        {selected && showJson && (
          <div className="mt-6 bg-white shadow border border-gray-200 p-4 rounded">
            <h3 className="text-lg font-semibold mb-2">JSON View</h3>
            <JsonView data={selected} />
          </div>
        )}

        {/* Toggle JSON View */}
        {selected && (
          <div className="mt-4">
            <button
              className="text-sm text-gray-600 hover:text-gray-800"
              onClick={() => setShowJson(!showJson)}
            >
              {showJson ? "Hide" : "Show"} JSON
            </button>
          </div>
        )}
      </main>
    </div>
  );
}