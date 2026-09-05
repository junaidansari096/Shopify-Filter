import { describe, it, expect } from "vitest";
import { loader } from "../app/routes/health";

describe("Health check & Keep-Alive endpoint (/health)", () => {
  it("returns 200 OK with valid status and timestamp", async () => {
    const request = new Request("http://localhost:3000/health");
    const response = await loader({ request, params: {}, context: {} });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    const data = await response.json();
    expect(data.status).toBe("ok");
    expect(typeof data.uptime).toBe("number");
    expect(new Date(data.timestamp).getTime()).not.toBeNaN();
  });
});