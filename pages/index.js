import { useState } from "react";
import JSONPretty from "react-json-pretty";
import "react-json-pretty/themes/monikai.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("mailchimp");
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("");

  const handleSubmit = async () => {
    setStatus("Processing...");
    setResult(null);

    const res = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, platform })
    });

    const data = await res.json();
    console.log("🔥 API response:", data);

    if (data.error) {
      setStatus("Error: " + data.error);
    } else {
      setStatus("Done!");
      setResult(data);
    }
  };

  return (
    <div style={{ maxWidth: "600px", margin: "40px auto", fontFamily: "sans-serif" }}>
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
            {/* Add more platforms here */}
          </select>
        </label>
      </div>
      <button onClick={handleSubmit} style={{ marginTop: "8px" }}>
        Submit
      </button>
      <p>{status}</p>
      {result && <JSONPretty data={result}></JSONPretty>}
    </div>
  );
}