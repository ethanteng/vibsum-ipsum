import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { JsonView } from "react-json-view-lite";
import "react-json-view-lite/dist/index.css";

export default function Admin() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [showJson, setShowJson] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.email !== "ethan+vybescript@ethanteng.com") {
      router.replace("/");
      return;
    }
    fetch("/api/admin/users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data.users || []);
        setLoading(false);
      })
      .catch((err) => {
        setError("Failed to load users");
        setLoading(false);
      });
  }, [session, status, router]);

  const toggleExpand = (userId) => {
    setExpanded((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const toggleShowJson = (promptId) => {
    setShowJson((prev) => ({ ...prev, [promptId]: !prev[promptId] }));
  };

  const handleDelete = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user and all their data?")) return;
    await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    setUsers((prev) => prev.filter((u) => u.id !== userId));
  };

  if (status === "loading" || loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-3xl font-bold mb-2">Admin Panel</h1>
      <div className="text-gray-700 mb-8 text-lg">Total users: <b>{users.length}</b></div>
      <div className="space-y-6">
        {users.map((user) => (
          <div key={user.id} className="bg-white rounded shadow p-6">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-semibold text-lg">{user.name || "(no name)"}</div>
                <div className="text-gray-600">{user.email}</div>
                <div className="text-sm mt-2">
                  Prompts: <b>{user.promptCount}</b> | Mailchimp: <b>{user.mailchimpConnected ? "Yes" : "No"}</b> | Intercom: <b>{user.intercomConnected ? "Yes" : "No"}</b>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Most recent prompt: {user.mostRecentPromptAt ? new Date(user.mostRecentPromptAt).toLocaleString() : "N/A"}
                </div>
              </div>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => toggleExpand(user.id)}
                  className="text-blue-600 hover:underline"
                >
                  {expanded[user.id] ? "Hide" : "Show"} Prompts
                </button>
                <button
                  onClick={() => handleDelete(user.id)}
                  className="text-red-600 hover:underline"
                >
                  Delete User
                </button>
              </div>
            </div>
            {expanded[user.id] && (
              <div className="mt-4 bg-gray-50 p-4 rounded">
                {user.prompts && user.prompts.length > 0 ? (
                  <ul className="space-y-2">
                    {user.prompts.map((p) => (
                      <li key={p.id} className="border-b pb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 mr-2">{p.createdAt ? new Date(p.createdAt).toLocaleString() : "N/A"}</span>
                          <button
                            className="text-xs text-blue-600 hover:underline ml-2"
                            onClick={() => toggleShowJson(p.id)}
                          >
                            {showJson[p.id] ? "Hide JSON" : "Show JSON"}
                          </button>
                        </div>
                        <div className="font-mono text-xs text-gray-700 mt-1">{p.prompt}</div>
                        {showJson[p.id] && (
                          <pre className="bg-gray-100 p-2 rounded text-xs overflow-x-auto mt-1">
                            <JsonView data={typeof p.result === "string" ? JSON.parse(p.result) : p.result} />
                          </pre>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-gray-500">No prompts</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
} 