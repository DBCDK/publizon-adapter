const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const APP_NAME = process.env.APP_NAME || "DBC adapter";

const { log: _log } = require("dbc-node-logger");
const { cpuUsage, memoryUsage } = require("process");

const timeout = 5 * 60 * 1000; // 5min
/**
 * Wraps fetch API
 * Adds some error handling as well as logging
 */
async function fetcher(url, options = {}, log, stream = false) {
  const start = process.hrtime();
  let res;
  const controller = new AbortController();
  options.signal = controller.signal;

  const timer = setTimeout(() => {
    log.error(`HTTP request timeout: ${url}`);
    controller.abort();
  }, timeout);

  try {
    log.debug(
      `Creating external HTTP request: ${
        (options && options.method) || "GET"
      } ${url}`,
      {
        requestObj: options,
        timings: { ms: nanoToMs(process.hrtime(start)[1]) },
      }
    );

    res = await fetch(url, options);

    res?.body.on?.("close", () => {
      log.debug(`HTTP request close: ${url}`);
      // Clear timeout timer when socket is closed
      clearTimeout(timer);
    });
    res?.body.on?.("end", () => {
      log.debug(`HTTP request end: ${url}`);
      // Clear timeout timer when stream is ended
      clearTimeout(timer);
    });
    res?.body.on?.("error", () => {
      controller.abort(); // Abort if there is an error in streaming
      clearTimeout(timer);
    });
  } catch (e) {
    log.error(
      `External HTTP request: ${
        (options && options.method) || "GET"
      } ${url} FETCH ERROR`,
      {
        error: String(e),
        stacktrace: e.stack,
        timings: { ms: nanoToMs(process.hrtime(start)[1]) },
      }
    );

    throw {
      code: 500,
      body: { message: "internal server error", appName: APP_NAME },
    };
  }

  let body = res.body;

  if (!stream) {
    const contentType = res.headers.get("content-Type");

    body =
      contentType && contentType.includes("json")
        ? await res.json()
        : await res.text();
  }

  log.debug(
    `External HTTP request: ${(options && options.method) || "GET"} ${url} ${
      res.status
    }`,
    { timings: { ms: nanoToMs(process.hrtime(start)[1]), stream } }
  );

  return {
    code: res.status,
    headers: res.headers,
    body,
  };
}

/**
 * Convert ns to ms
 *
 * @param {number} nano
 * @returns {number}
 */
function nanoToMs(nano) {
  return Math.round(nano / 1000000);
}

function parseCredentials(str = "") {
  const lines = str.split(/\r?\n/).filter((l) => l);
  const map = {};
  lines.forEach((line) => {
    const arr = line.split(",");
    map[arr[0]] = { licenseKey: arr[1], retailerId: arr[2] };
  });
  return map;
}

const credentialsList = parseCredentials(process.env.PUBLIZON_CREDENTIALS);

function getCredentials({ agencyId, log }) {
  const credentials = credentialsList?.[agencyId];

  if (!credentials?.licenseKey || !credentials?.retailerId) {
    log.debug(`Agency '${agencyId}' is missing Publizon credentials`);
    throw {
      code: 403,
      body: {
        message: "Agency is missing Publizon credentials",
        appName: APP_NAME,
      },
    };
  }

  return credentials;
}

/**
 * Convert to string
 *
 * @param {object|string} el
 * @returns {string}
 */
function ensureString(el) {
  const isString = typeof el === "string";
  return isString ? el : JSON.stringify(el);
}

/**
 * Logs CPU and memory usage in an interval
 */
const INTERVAL_MS = 10000;

let previousCpuUsage = cpuUsage();
let previousTime = performance.now();

function startResourceMonitor() {
  setInterval(() => {
    const currentTime = performance.now();
    let duration = currentTime - previousTime;

    const currentCpuUsage = cpuUsage();

    // Calculating CPU load for the duration
    const user =
      (currentCpuUsage.user - previousCpuUsage.user) / 1000 / duration;
    const system =
      (currentCpuUsage.system - previousCpuUsage.system) / 1000 / duration;

    // Set current to previous
    previousCpuUsage = currentCpuUsage;
    previousTime = currentTime;

    _log.info("RESOURCE_MONITOR", {
      diagnostics: {
        cpuUsage: { user, system },
        memoryUsage: memoryUsage(),
      },
    });
  }, INTERVAL_MS);
}

module.exports = {
  fetcher,
  nanoToMs,
  getCredentials,
  ensureString,
  startResourceMonitor,
};
