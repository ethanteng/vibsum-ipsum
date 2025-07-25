// pages/index.js
import { useState, useEffect, useRef } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/router";
import EmailPreview from "@/components/EmailPreview";
import Logo from "@/components/Logo";
import ReactMarkdown from "react-markdown";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";
import { applyTemplateToPreview } from "@/lib/extractMailchimpTemplate";
import Fuse from "fuse.js";

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
  const [showTemplatePreview, setShowTemplatePreview] = useState(true); // Default to With Template
  const [loadingTemplateHtml, setLoadingTemplateHtml] = useState(false);
  const [mailchimpSegments, setMailchimpSegments] = useState([]);
  const [intercomSegments, setIntercomSegments] = useState([]);
  const [selectedMailchimpSegment, setSelectedMailchimpSegment] = useState("everyone");
  const [selectedIntercomSegment, setSelectedIntercomSegment] = useState("everyone");
  const [loadingSegments, setLoadingSegments] = useState(false);
  const [originalSelected, setOriginalSelected] = useState(null);
  const [jsonViewKey, setJsonViewKey] = useState(0);
  // Add state for advanced options and preview mode
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const mainContentRef = useRef(null);

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

  // Fetch Mailchimp templates and segments when user is authenticated
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      fetchMailchimpTemplates();
      fetchSegments();
    }
  }, [sessionStatus]);

  // Ensure segments are loaded when needed
  useEffect(() => {
    if (sessionStatus === "authenticated" && mailchimpSegments.length === 0) {
      console.log("Segments empty, refetching...");
      fetchSegments();
    }
  }, [sessionStatus, mailchimpSegments.length]);

  // Monitor mailchimpSegments changes
  useEffect(() => {
    console.log("mailchimpSegments changed:", mailchimpSegments);
    console.log("mailchimpSegments length:", mailchimpSegments.length);
    if (mailchimpSegments.length > 0) {
      console.log("First segment in state:", mailchimpSegments[0]);
      console.log("First segment id:", mailchimpSegments[0]?.id);
      console.log("First segment name:", mailchimpSegments[0]?.name);
    }
  }, [mailchimpSegments]);

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

  // Find best matching segment for Mailchimp
  const findBestMailchimpSegment = (promptSegments) => {
    if (!promptSegments || promptSegments.length === 0 || mailchimpSegments.length === 0) {
      return "everyone";
    }

    // Try exact matches first
    for (const promptSegment of promptSegments) {
      const exactMatch = mailchimpSegments.find(segment => 
        segment.name.toLowerCase() === promptSegment.toLowerCase()
      );
      if (exactMatch) {
        return exactMatch.id;
      }
    }

    // Try partial matches
    for (const promptSegment of promptSegments) {
      const partialMatch = mailchimpSegments.find(segment => 
        segment.name.toLowerCase().includes(promptSegment.toLowerCase()) ||
        promptSegment.toLowerCase().includes(segment.name.toLowerCase())
      );
      if (partialMatch) {
        return partialMatch.id;
      }
    }

    // Try fuzzy matching with Fuse.js
    const fuse = new Fuse(mailchimpSegments, { keys: ["name"], threshold: 0.4 });
    for (const promptSegment of promptSegments) {
      const fuzzyResults = fuse.search(promptSegment);
      if (fuzzyResults.length > 0) {
        return fuzzyResults[0].item.id;
      }
    }

    return "everyone";
  };

  // Update the selected campaign data when segments change
  const updateSelectedWithSegments = (newMailchimpSegment, newIntercomSegment) => {
    if (!selected) return;

    console.log("updateSelectedWithSegments called with:", { newMailchimpSegment, newIntercomSegment });
    console.log("Current selected:", selected);
    console.log("Available mailchimpSegments:", mailchimpSegments);

    const updatedSelected = { ...selected };
    
    // Update Mailchimp segments
    if (updatedSelected.channels?.includes("mailchimp") && updatedSelected.mailchimp?.audience) {
      console.log("Processing Mailchimp segments...");
      if (newMailchimpSegment !== "everyone") {
        console.log("Looking for segment with ID:", newMailchimpSegment);
        console.log("Available segments:", mailchimpSegments.map(s => ({ id: s.id, name: s.name })));
        const selectedSegment = mailchimpSegments.find(s => s.id == newMailchimpSegment); // Use == for type coercion
        console.log("Found selected segment:", selectedSegment);
        if (selectedSegment) {
          updatedSelected.mailchimp.audience.segments = [selectedSegment.name];
          console.log("Updated Mailchimp segments to:", selectedSegment.name);
        } else {
          console.log("Selected segment not found in mailchimpSegments");
        }
      } else {
        // When "everyone" is selected, clear the segments (target everyone)
        updatedSelected.mailchimp.audience.segments = [];
        console.log("Set Mailchimp segments to everyone (empty array)");
      }
    }

    // Update Intercom segments (informational only)
    if (updatedSelected.channels?.includes("intercom") && updatedSelected.intercom?.audience) {
      if (newIntercomSegment !== "everyone") {
        const selectedSegment = intercomSegments.find(s => s.id === newIntercomSegment);
        if (selectedSegment) {
          updatedSelected.intercom.audience.segments = [selectedSegment.name];
          console.log("Updated Intercom segments to:", selectedSegment.name);
        }
      } else {
        // When "everyone" is selected, clear the segments (target everyone)
        updatedSelected.intercom.audience.segments = [];
        console.log("Set Intercom segments to everyone (empty array)");
      }
    }

    console.log("Final updatedSelected object:", updatedSelected);
    console.log("Final mailchimp.audience.segments:", updatedSelected.mailchimp?.audience?.segments);
    setSelected(updatedSelected);
    setJsonViewKey(prev => prev + 1); // Force JSON view to re-render
  };

  // Fetch segments for both Mailchimp and Intercom
  const fetchSegments = async () => {
    setLoadingSegments(true);
    try {
      // Fetch Mailchimp segments
      const mailchimpRes = await fetch(`/api/mailchimp/segments?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (mailchimpRes.ok) {
        const mailchimpData = await mailchimpRes.json();
        console.log("Response status:", mailchimpRes.status);
        console.log("Response headers:", Object.fromEntries(mailchimpRes.headers.entries()));
        console.log("Raw mailchimpData from API:", mailchimpData);
        console.log("mailchimpData.segments:", mailchimpData.segments);
        console.log("mailchimpData.segments type:", typeof mailchimpData.segments);
        console.log("mailchimpData.segments length:", mailchimpData.segments?.length);
        console.log("First segment:", mailchimpData.segments?.[0]);
        console.log("Second segment:", mailchimpData.segments?.[1]);
        setMailchimpSegments(mailchimpData.segments || []);
        console.log("Setting mailchimpSegments to:", mailchimpData.segments);
        console.log("Available mailchimpSegments:", mailchimpData.segments);
      } else {
        console.error("Failed to fetch Mailchimp segments:", await mailchimpRes.text());
      }

      // Fetch Intercom segments
      const intercomRes = await fetch(`/api/intercom/segments?t=${Date.now()}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      if (intercomRes.ok) {
        const intercomData = await intercomRes.json();
        setIntercomSegments(intercomData.segments || []);
      } else {
        console.error("Failed to fetch Intercom segments:", await intercomRes.text());
      }
    } catch (error) {
      console.error("Error fetching segments:", error);
    } finally {
      setLoadingSegments(false);
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
        const parsedResult = typeof saveData.campaign.result === "string"
          ? safeParseJson(saveData.campaign.result)
          : saveData.campaign.result;
        const newPromptObj = {
          ...saveData.campaign,
          result: parsedResult
        };
        setHistory((h) => {
          const newHistory = [newPromptObj, ...h];
          setSelected({ ...parsedResult, _historyId: newPromptObj.id, _prompt: newPromptObj.prompt, _createdAt: newPromptObj.createdAt });
          return newHistory;
        });
        setOriginalSelected(parsedResult);
        if (mainContentRef.current) {
          mainContentRef.current.scrollIntoView({ behavior: "smooth" });
        }
        // Set best matching segment for Mailchimp
        if (parsedResult.channels?.includes("mailchimp") && parsedResult.mailchimp?.audience?.segments) {
          const bestSegment = findBestMailchimpSegment(parsedResult.mailchimp.audience.segments);
          setSelectedMailchimpSegment(bestSegment);
          updateSelectedWithSegments(bestSegment, selectedIntercomSegment);
        }
      } else {
        // fallback: just update local state
        const newEntry = { prompt, result: data.result };
        setHistory((h) => {
          const newHistory = [newEntry, ...h];
          setSelected({ ...data.result, _historyId: undefined, _prompt: prompt, _createdAt: undefined });
          return newHistory;
        });
        setOriginalSelected(data.result);
        if (mainContentRef.current) {
          mainContentRef.current.scrollIntoView({ behavior: "smooth" });
        }
        if (data.result.channels?.includes("mailchimp") && data.result.mailchimp?.audience?.segments) {
          const bestSegment = findBestMailchimpSegment(data.result.mailchimp.audience.segments);
          setSelectedMailchimpSegment(bestSegment);
          updateSelectedWithSegments(bestSegment, selectedIntercomSegment);
        }
      }
      setStatus("");
    }
    setPrompt("");
  };

  const handleCreate = async (canonical, channels) => {
    setStatus(`Creating in ${channels.map(channel => channel.charAt(0).toUpperCase() + channel.slice(1)).join(", ")}...`);
    
    // Include template ID and selected segments
    const requestBody = { canonical, channels };
    if (channels.includes("mailchimp") && selectedTemplateId) {
      requestBody.templateId = selectedTemplateId;
    }
    if (channels.includes("mailchimp")) {
      requestBody.selectedMailchimpSegment = selectedMailchimpSegment;
    }
    if (channels.includes("intercom")) {
      requestBody.selectedIntercomSegment = selectedIntercomSegment;
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
          // Add segment information for Intercom
          if (r.segmentInfo?.selectedSegment) {
            successMessage += ` Target segment: ${r.segmentInfo.selectedSegment}`;
          } else if (r.segmentInfo?.suggestedSegment) {
            successMessage += ` Suggested segment: ${r.segmentInfo.suggestedSegment} (please confirm in Intercom)`;
          }
        } else {
          if (status === "scheduled_successfully") {
            successMessage = `${channelName} campaign created and scheduled successfully.`;
          } else if (status === "not_requested") {
            successMessage = `${channelName} campaign created (not scheduled).`;
          } else {
            successMessage = `${channelName} campaign created.`;
          }
          // Add segment information for Mailchimp
          if (r.resolvedSegments?.length > 0) {
            const segmentNames = r.resolvedSegments.map(s => s.name || s.id).join(", ");
            successMessage += ` Target segment: ${segmentNames}`;
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
            {session?.user?.email === "ethan+vybescript@ethanteng.com" && (
              <a
                href="/admin"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Admin
              </a>
            )}
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
          {history.map((entry, i) => {
            const { prompt, result, id, createdAt } = entry;
            const isSelected = selected && selected._historyId === id;
            // Use _createdAt from selected if available, else createdAt from entry
            const timestamp = createdAt || (result && result._createdAt) || (selected && selected._createdAt);
            return (
              <li key={id || i}>
                {timestamp && (
                  <div className="text-xs text-gray-500 mb-1">
                    {new Date(timestamp).toLocaleString()}
                  </div>
                )}
                <button
                  className={`w-full text-left px-3 py-2 rounded ${
                    isSelected ? "bg-indigo-100 font-semibold" : "hover:bg-gray-100"
                  }`}
                  onClick={() => {
                    setOriginalSelected(result);
                    setSelected({ ...result, _historyId: id, _prompt: prompt, _createdAt: createdAt });
                  
                    // Find best matching segments for the selected campaign
                    if (result.channels?.includes("mailchimp") && result.mailchimp?.audience?.segments) {
                      // Ensure segments are loaded before finding best match
                      if (mailchimpSegments.length > 0) {
                        const bestMailchimpSegment = findBestMailchimpSegment(result.mailchimp.audience.segments);
                        setSelectedMailchimpSegment(bestMailchimpSegment);
                        console.log("History selection - Found best segment:", bestMailchimpSegment);
                      } else {
                        console.log("History selection - Segments not loaded yet, refetching...");
                        // Refetch segments if they're not available
                        fetchSegments().then(() => {
                          // After segments are loaded, find the best match
                          const bestMailchimpSegment = findBestMailchimpSegment(result.mailchimp.audience.segments);
                          setSelectedMailchimpSegment(bestMailchimpSegment);
                          console.log("History selection - After refetch, found best segment:", bestMailchimpSegment);
                        });
                      }
                    } else {
                      setSelectedMailchimpSegment("everyone");
                    }
                    
                    if (result.channels?.includes("intercom") && result.intercom?.audience?.segments) {
                      // For Intercom, we could implement similar logic if needed
                      setSelectedIntercomSegment("everyone");
                    } else {
                      setSelectedIntercomSegment("everyone");
                    }
                  }}
                  title={prompt}
                >
                  {prompt.slice(0, 40)}...
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Main content */}
      <main ref={mainContentRef} className="flex-1 p-6 overflow-y-auto mt-16">
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
          
          {/* Advanced Options Toggle */}
          <div className="mb-4">
            <button
              type="button"
              className="text-blue-600 underline text-sm focus:outline-none"
              onClick={() => setShowAdvancedOptions((v) => !v)}
            >
              {showAdvancedOptions ? 'Advanced Options (Hide)' : 'Advanced Options (Show)'}
            </button>
          </div>
          {showAdvancedOptions && (
            <div className="mb-4 space-y-4">
              {/* Mailchimp Template To Use (Optional) */}
              {mailchimpTemplates.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mailchimp Template To Use (Optional)
                  </label>
                  {loadingTemplates ? (
                    <div className="text-sm text-gray-500">Loading templates...</div>
                  ) : (
                    <select
                      value={selectedTemplateId || ''}
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
                  )}
                  <button
                    type="button"
                    className="text-xs text-blue-600 underline mt-1"
                    onClick={fetchMailchimpTemplates}
                  >
                    Refresh Templates
                  </button>
                </div>
              )}
              {/* Mailchimp Target Segment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mailchimp Target Segment
                </label>
                {loadingSegments ? (
                  <div className="text-sm text-gray-500">Loading segments...</div>
                ) : mailchimpSegments.length > 0 ? (
                  <select
                    value={selectedMailchimpSegment}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      console.log("Mailchimp segment changed to:", newValue);
                      setSelectedMailchimpSegment(newValue);
                      console.log("About to call updateSelectedWithSegments with:", newValue, selectedIntercomSegment);
                      updateSelectedWithSegments(newValue, selectedIntercomSegment);
                      console.log("updateSelectedWithSegments called");
                    }}
                    className="w-full border border-gray-300 rounded p-2 text-sm"
                  >
                    {mailchimpSegments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name} {segment.member_count ? `(${segment.member_count} members)` : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="text-sm text-gray-500">
                    No segments found. Will use "Everyone".
                  </div>
                )}
              </div>
            </div>
          )}
          
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
            {Array.isArray(selected.channels) && selected.channels.includes("mailchimp") && (
              <section className="border border-gray-200 rounded p-4 bg-white">
                <h3 className="text-lg font-semibold mb-2">Mailchimp Campaign</h3>
                <p className="text-sm mb-2">
                  <strong>To:</strong>{" "}
                  {selectedMailchimpSegment !== "everyone" 
                    ? mailchimpSegments.find(s => s.id === selectedMailchimpSegment)?.name || "Selected segment"
                    : (selected.mailchimp.audience?.segments?.length > 0 
                        ? selected.mailchimp.audience.segments.join(", ") 
                        : "Everyone")
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
            {Array.isArray(selected.channels) && selected.channels.includes("intercom") && (
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
            <JsonView 
              data={selected} 
              key={jsonViewKey} // Force re-render when data changes
            />
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