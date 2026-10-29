"use strict";

const http = require("node:http");

http
  .createServer(async (request, response) => {
    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200).end("OK");
      return;
    }
    if (request.method !== "POST" || request.url !== "/chat/completions") {
      response.writeHead(404).end("Not found");
      return;
    }

    let body = "";
    for await (const chunk of request) {
      body += chunk;
    }
    let data;
    try {
      data = JSON.parse(body);
    } catch {
      console.error("AI stub received invalid JSON");
      response.writeHead(400).end("Invalid JSON");
      return;
    }
    if (
      request.headers.authorization !== "Bearer dummy-test-key" ||
      data?.model !== "test-model" ||
      !Array.isArray(data.messages) ||
      !data.messages.some(
        (message) =>
          message?.role === "user" &&
          typeof message.content === "string" &&
          message.content.includes("random_id.id") &&
          message.content.includes("<summary>") &&
          message.content.includes("<plan>"),
      )
    ) {
      console.error("AI stub received an unexpected model, key or plan");
      response.writeHead(400).end("Unexpected request");
      return;
    }

    response.writeHead(200, { "Content-Type": "application/json" }).end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                risk_level: "LOW",
                summary: "Creates a random ID for testing.",
              }),
            },
          },
        ],
      }),
    );
  })
  .listen(8080, "127.0.0.1");
