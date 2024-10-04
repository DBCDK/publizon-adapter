const { ProxyAgent } = require("undici");
const { fetcher } = require("../utils");

const TIMEOUT = 60000;

let dispatcher = null;
if (process.env.HTTPS_PROXY) {
  dispatcher = new ProxyAgent({
    uri: process.env.HTTPS_PROXY,
    bodyTimeout: TIMEOUT,
    headersTimeout: TIMEOUT,
  });
}

/**
 * Initializes the proxy
 */
function init({ url, method, headers, body, log }) {
  /**
   * The actual fetch function
   */
  async function fetch({ licenseKey, cardNumber }) {
    const time = Date.now();
    const clientId = process.env.PUBLIZON_CLIENT_ID;

    const options = {
      method: method,
      headers: {
        ...headers,
        clientId,
        licenseKey,
      },
    };

    if (cardNumber) {
      options.headers.cardNumber = cardNumber;
    }

    if (dispatcher) {
      options.dispatcher = dispatcher;
    }

    delete options.headers.host;
    delete options.headers.authorization;

    if (body) {
      options.body = typeof body === "object" ? JSON.stringify(body) : body;
    }

    let res = await fetcher(process.env.PUBLIZON_URL + url, options, log);

    // log response to summary
    log.summary.datasources.pubhub = {
      code: res.code,
      time: Date.now() - time,
    };

    switch (res.code) {
      case 401:
        throw res;
      default:
        // All other responses we pass through to the client
        return res;
    }
  }
  return { fetch };
}

module.exports = init;
