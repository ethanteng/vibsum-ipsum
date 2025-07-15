export default function EmailPreview({ html }) {
  return (
    <iframe
      className="w-full border rounded"
      style={{ minHeight: "300px" }}
      sandbox=""
      srcDoc={html}
    />
  );
}