import { describe, it, expect } from "vitest";
import request from "supertest";
import backend from "./index.cjs";

const { app } = backend;
describe("LiveConnect API Tests", () => {
  it("1. Health endpoint returns OK", async () => {
    const response = await request(app).get("/api/health");
    expect(response.status).toBe(200);
  });

  it("2. Creates a session", async () => {
    const response = await request(app)
      .post("/api/sessions")
      .send({ title: "Test Session" });

    expect([200, 201]).toContain(response.status);
    expect(response.body.code).toBeDefined();
  });

  it("3. Rejects an empty session title", async () => {
    const response = await request(app)
      .post("/api/sessions")
      .send({ title: "" });

    expect(response.status).toBe(400);
  });

  it("4. Returns 404 for an unknown session", async () => {
    const response = await request(app).get("/api/sessions/ZZZZZZ");
    expect(response.status).toBe(404);
  });

  it("5. Allows an audience member to join", async () => {
    const created = await request(app)
      .post("/api/sessions")
      .send({ title: "Join Test" });

    const joined = await request(app)
      .post("/api/sessions/" + created.body.code + "/join")
      .send({ displayName: "Test Audience" });

    expect([200, 201]).toContain(joined.status);
  });
});
