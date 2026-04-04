import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function ExtensionAuthPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in?redirect_url=/extension-auth");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        background: "#fafafa",
        color: "#1a1a1a",
      }}
    >
      <div
        style={{
          textAlign: "center",
          padding: "48px",
          background: "white",
          borderRadius: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          maxWidth: "400px",
        }}
      >
        <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔖</div>
        <h1 style={{ fontSize: "24px", fontWeight: 600, marginBottom: "8px" }}>
          Pockaa Extension Connected
        </h1>
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "24px" }}>
          Your extension has been linked to your account. You can close this tab
          and return to the extension.
        </p>
        <div
          id="pockaa-extension-auth"
          data-user-id={userId}
          style={{
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: "8px",
            padding: "12px 16px",
            fontSize: "13px",
            color: "#166534",
          }}
        >
          ✓ Connected as <strong>{userId.slice(0, 12)}…</strong>
        </div>
      </div>
    </div>
  );
}
