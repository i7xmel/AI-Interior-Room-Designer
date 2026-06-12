import http from "http";

const BACKEND_HOST = "localhost";
const BACKEND_PORT = 8080;

export const maxDuration = 2400;

function proxyToFlask(endpoint, bodyStr) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: BACKEND_HOST,
      port: BACKEND_PORT,
      path: "/" + endpoint,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(bodyStr) },
    };
    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, buffer: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.setTimeout(0);
    req.write(bodyStr);
    req.end();
  });
}

export async function POST(req) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get("endpoint") || "generate";
  try {
    const body = await req.json();
    const bodyStr = JSON.stringify(body);
    const { status, buffer } = await proxyToFlask(endpoint, bodyStr);
    if (status !== 200) {
      return Response.json({ error: "Backend error: " + buffer.toString() }, { status });
    }
    return new Response(buffer, {
      status: 200,
      headers: { "Content-Type": "model/gltf-binary" },
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 502 });
  }
}
