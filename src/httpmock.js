/**
 * @file This is a HTTP mock service, useful for writing cypress tests
 *
 * - Mock http requests
 */
"use strict";

const isMatch = require("lodash/isMatch");

let mocked = [];

module.exports = async function (fastify, opts) {
  // Publizon require to receive content type application/json
  // even though the body is a string.
  // We have to override the default fastify body parser
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    function (req, body, done) {
      try {
        var json = JSON.parse(body);
        done(null, json);
      } catch (err) {
        done(null, body);
      }
    }
  );

  // Mock HTTP request
  fastify.post("/", async (request) => {
    const { body } = request;
    mocked.push(body);
    return { status: "ok" };
  });

  // Reset Mocked requests
  fastify.post("/reset", async () => {
    mocked = [];
    return "ok";
  });

  // Returns a mocked if it matches any
  fastify.route({
    method: ["GET", "POST", "PUT"],
    url: "*",
    handler: async (request, reply) => {
      const { body, headers, method, query } = request;
      const path = request.params["*"];
      // Look for any mocked requests that matches current request
      // method, path, headers, body, query should match
      const match = mocked.find((mock) =>
        isMatch({ method, path, headers, body, query }, mock.request)
      );

      if (match) {
        return reply.code(match.response.status).send(match.response.body);
      }

      request.log.error({
        msg: "no mock matching request",
        request: { body, headers, method, query, path },
      });

      reply.code(500).send({ message: "no mock matching request" });
    },
  });
};
