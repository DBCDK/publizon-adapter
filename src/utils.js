const fetch = require("isomorphic-unfetch");
const APP_NAME = process.env.APP_NAME || "DBC adapter";

/**
 * Wraps fetch API
 * Adds some error handling as well as logging
 */
async function fetcher(url, options, log) {
  const start = process.hrtime();
  let res;
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
  const contentType = res.headers.get("content-Type");
  const body =
    contentType && contentType.includes("json")
      ? await res.json()
      : await res.text();

  log.debug(
    `External HTTP request: ${(options && options.method) || "GET"} ${url} ${
      res.status
    }`,
    { timings: { ms: nanoToMs(process.hrtime(start)[1]) } }
  );

  return {
    code: res.status,
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

module.exports = {
  fetcher,
  nanoToMs,
  getCredentials,
  ensureString,
};
