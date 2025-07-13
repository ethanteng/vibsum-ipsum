export default function EmailPreview({ html }) {
  return (
    <iframe
      title="Email Preview"
      style={{
        width: "100%",
        height: "600px",
        border: "1px solid #ddd",
        background: "#fff"
      }}
      // This attribute sets the iframe content directly
      srcDoc={html}
    />
  );
}