const BACKEND_URL = (process.env.BACKEND_API_URL || process.env.VITE_API_URL || "").replace(/\/$/, "");

export default async function handler(request: Request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  if (!BACKEND_URL) {
    return new Response(JSON.stringify({ error: "BACKEND_API_URL is not configured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  const targetUrl = new URL("/api/upload", BACKEND_URL).toString();
  const incomingForm = await request.formData();
  const forwardedForm = new FormData();

  for (const [key, value] of incomingForm.entries()) {
    if (value instanceof File) {
      forwardedForm.append(key, value, value.name);
    } else {
      forwardedForm.append(key, value);
    }
  }

  const upstream = await fetch(targetUrl, {
    method: "POST",
    body: forwardedForm
  });

  return new Response(await upstream.arrayBuffer(), {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("content-type") || "application/json"
    }
  });
}