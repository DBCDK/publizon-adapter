"use strict";

const { log } = require("dbc-node-logger");
const { v4: uuidv4 } = require("uuid");

const fastifyCORS = require("@fastify/cors");

const initSmaug = require("./clients/smaug");
const initUserinfo = require("./clients/userinfo");
const initProxy = require("./clients/proxy");

const initLogger = require("./logger");
const { getCredentials, ensureString } = require("./utils");

const { startResourceMonitor } = require("./utils");

// Will start resource monitoring
startResourceMonitor();

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
const authRequiredRequestList = [
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

// list of requests where cardNumber is optional
const authOptionalRequestList = [
  { method: "GET", url: "/v1/loanstatus/" },
  { method: "POST", url: "/v1/loanstatus" },
  // for test only
  { method: "GET", url: "/v1/some/optional/path/" },
  { method: "POST", url: "/v1/some/optional/path" },
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

    // summary
    request.requestLogger.summary = {
      datasources: {},
      total_ms: Date.now(),
    };

    request.requestLogger.debug("onRequest", {
      requestObj: {
        method: request.method,
        url: request.url,
        headers: JSON.stringify(request.headers),
        hostname: request.hostname,
        remoteAddress: request.ip,
        remotePort: request.connection.remotePort,
      },
    });

    request.timings = { start: process.hrtime() };

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
        const isAuthenticatedPath = !!authRequiredRequestList.find(
          (obj) =>
            obj.method === request.method && request.url.startsWith(obj.url)
        );

        // Check if authenticated token is optional for the request by matching request url and method
        const isOptionalPath = !!authOptionalRequestList.find(
          (obj) =>
            obj.method === request.method && request.url.startsWith(obj.url)
        );

        // add to summary log
        requestLogger.summary.isAuthenticatedPath = isAuthenticatedPath;
        requestLogger.summary.isOptionalPath = isOptionalPath;

        // The smaug configuration, fetched and validated
        const configuration = await smaug.fetch({
          token,
          isAuthenticatedPath,
        });

        // add to summary log
        requestLogger.summary.agencyId = configuration.agencyId;
        requestLogger.summary.clientId = configuration.app.clientId;

        const isAuthenticatedToken = !!configuration.user?.uniqueId;

        // add to summary log
        requestLogger.summary.isAuthenticatedToken = isAuthenticatedToken;

        let municipalityAgencyId = null;
        if (isAuthenticatedToken) {
          // get municipalityAgencyId from /userinfo
          municipalityAgencyId = await userinfo.fetch({ token });
        }

        // add to summary log
        requestLogger.summary.municipalityAgencyId = municipalityAgencyId;

        // Select agencyId
        const agencyId = municipalityAgencyId || configuration.agencyId;

        // fetch credentials for agencyId/MunicipalityAgencyId
        const credentials = getCredentials({ agencyId, log });

        // Holds the proxy response
        let proxyResponse;

        try {
          let cardNumber = null;
          const uniqueId = configuration.user?.uniqueId;
          // Authenticated path
          if (uniqueId && (isAuthenticatedPath || isOptionalPath)) {
            cardNumber = uniqueId;
          }

          proxyResponse = await proxy.fetch({
            licenseKey: credentials.licenseKey,
            cardNumber,
          });
        } catch (e) {
          // Give up, and pass the error to the caller
          throw e;
        }
        reply.code(proxyResponse.code);
        reply.send(proxyResponse.body);

        // Finally send the proxied response to the caller
        // reply.code(proxyResponse.code).send(await proxyResponse.body);
      } catch (error) {
        if (!error.code) {
          // This is an unexpected error, could be a bug
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

  // fastify.addHook("onSend", function (_request, reply, payload, next) {
  //   // save response body for logging in "onResponse"
  //   // reply.raw.payload = payload;
  //   next();
  // });

  fastify.addHook("onResponse", (request, reply, done) => {
    // payload debug track
    // request.requestLogger.debug("DEBUG", {
    //   requestObj: {
    //     method: request.method,
    //     url: request.url,
    //     body: ensureString(request.body),
    //     headers: request.headers,
    //     hostname: request.hostname,
    //   },
    //   response: {
    //     status: reply.statusCode,
    //     body: ensureString(reply.raw?.payload),
    //   },
    // });

    const summary = request.requestLogger.summary;
    request.requestLogger.info("TRACK", {
      status: reply.statusCode,
      method: request.method,
      url: request.url,
      ...summary,
      total_ms: Date.now() - summary.total_ms,
    });

    // Cleanup request logger
    request.requestLogger = null;
    request.timings = null;

    done();
  });
};
