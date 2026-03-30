export default function HelloPage() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>👋 Hello World</h1>
      <p style={{ color: "#666", fontSize: "1.1rem" }}>
        Pockaa deployment test — this page has no auth, no database, no external
        dependencies.
      </p>
      <p style={{ color: "#999", fontSize: "0.875rem", marginTop: "1rem" }}>
        Server rendered at: {new Date().toISOString()}
      </p>
    </div>
  );
}
