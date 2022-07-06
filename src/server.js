"use strict";

const { log } = require("dbc-node-logger");
const { v4: uuidv4 } = require("uuid");

const fastifyCORS = require("@fastify/cors");

const initSmaug = require("./clients/smaug");
const initUserinfo = require("./clients/userinfo");
const initProxy = require("./clients/proxy");

const initLogger = require("./logger");
const { nanoToMs } = require("./utils");

// JSON Schema for validating the request headers
const schema = {
  headers: {
    type: "object",
    properties: {
      Authorization: { type: "string" },
    },
    required: ["Authorization"],
  },
};

// cors settings
const corsOptions = {
  origin: parseCorsOrigin(),
  methods: "GET,PUT,POST,DELETE,OPTIONS,HEAD",
};

function parseCorsOrigin() {
  const originValue = `${process.env.CORS_ORIGIN}`;
  if (originValue === "all") {
    return "*";
  } else {
    return originValue;
  }
}

// list of requests which requires cardNumber to be attached
const authRequestList = [
  { method: "GET", url: "/v1/user/loans" },
  { method: "GET", url: "/v1/user/loans/" },
  { method: "POST", url: "/v1/user/loans/" },
  { method: "GET", url: "/v1/user/reservations" },
  { method: "POST", url: "/v1/user/reservations/" },
  { method: "PATCH", url: "/v1/user/reservations/" },
  { method: "DELETE", url: "/v1/user/reservations/" },
  { method: "GET", url: "/v1/user/checklist" },
  { method: "POST", url: "/v1/user/checklist/" },
  { method: "DELETE", url: "/v1/user/checklist/" },
  { method: "GET", url: "/v1/user/cardnumber/friendly" },
  // for test only
  { method: "GET", url: "/v1/some/authenticated/path" },
  { method: "POST", url: "/v1/some/authenticated/path" },
];

/**
 * All requests to the adapter is handled in this route handler
 */
module.exports = async function (fastify, opts) {
  // Initialize and create global logger for app
  const appLogger = initLogger({ app: "publizon-adapter" });
  appLogger.info("App started");

  // Prepare for 'decorateRequest' and 'timings' properties to be set on request object
  fastify.decorateRequest("requestLogger", null);
  fastify.decorateRequest("timings", null);

  // Cors options (Enable cors)
  fastify.register(fastifyCORS, corsOptions);

  fastify.addHook("onRequest", (request, reply, done) => {
    // Create request logger and generate uuid (reqId) to be attached
    // to every log line during this request
    request.requestLogger = appLogger.child({ reqId: uuidv4() });

    request.requestLogger.info("onRequest", {
      requestObj: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        hostname: request.hostname,
        remoteAddress: request.ip,
        remotePort: request.connection.remotePort,
      },
    });

    request.timings = { start: process.hrtime() };

    done();
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    request.requestLogger.info("onResponse", {
      response: { status: reply.statusCode },
      timings: { ms: nanoToMs(process.hrtime(request.timings.start)[1]) },
    });
    done();
  });

  // route to check if server is running
  fastify.get("/", { logLevel: "silent" }, async (request) => {
    return "ok";
  });

  fastify.route({
    method: ["GET", "POST", "PATCH", "DELETE"],
    url: "*",
    schema,
    logLevel: "silent",
    handler: async (request, reply) => {
      try {
        const requestLogger = request.requestLogger;

        const smaug = initSmaug({ log: requestLogger });

        const userinfo = initUserinfo({ log: requestLogger });

        const proxy = initProxy({
          url: request.url,
          method: request.method,
          headers: request.headers,
          body: request.body,
          log: requestLogger,
        });

        // The smaug token extracted from authorization header
        const token = request.headers.authorization.replace(/bearer /i, "");

        // Check if request requires a authenticated token by matching request url and method
        const authTokenRequired = !!authRequestList.find(
          (obj) => obj.method === request.method && obj.url === request.url
        );

        // The smaug configuration, fetched and validated
        const configuration = await smaug.fetchConfiguration({
          token,
          authTokenRequired,
        });

        const isAuthToken = !!configuration.user?.uniqueId;

        let municipalityAgencyId = null;
        if (isAuthToken && authTokenRequired) {
          // get municipalityAgencyId from /userinfo
          municipalityAgencyId = await userinfo.fetch({ token });
        }

        const agencyId = municipalityAgencyId || configuration.agencyId;

        // The smaug configuration, fetched and validated
        const credentials = await smaug.fetchCredentials({ agencyId });

        // Holds the proxy response
        let proxyResponse;

        try {
          const cardNumber = authTokenRequired
            ? configuration.user?.uniqueId || null
            : null;

          proxyResponse = await proxy.fetch({
            licenseKey: credentials.licenseKey,
            cardNumber,
          });
        } catch (e) {
          // Give up, and pass the error to the caller
          throw e;
        }

        // Finally send the proxied response to the caller
        reply.code(proxyResponse.code).send(await proxyResponse.body);
      } catch (error) {
        if (!error.code) {
          // This is an unexpected error, could be a bug
          // request.log.error(error);
          log.error(String(error), {
            error: String(error),
            stacktrace: error.stack,
          });
        }

        reply
          .code(error.code || 500)
          .send(
            typeof error.body === "undefined"
              ? "internal server error"
              : error.body
          );
      }
    },
  });

  fastify.addHook("onResponse", (request, reply, done) => {
    // Some code
    done();
  });
};
