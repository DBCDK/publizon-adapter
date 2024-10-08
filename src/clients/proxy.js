const HttpsProxyAgent = require("https-proxy-agent");
const { fetcher } = require("../utils");

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

    if (process.env.HTTPS_PROXY) {
      options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
    }

    if (cardNumber) {
      options.headers.cardNumber = cardNumber;
    }

    delete options.headers.host;
    delete options.headers.authorization;

    if (body) {
      options.body = typeof body === "object" ? JSON.stringify(body) : body;
    }

    let res = await fetcher(
      process.env.PUBLIZON_URL + url,
      options,
      log,
      true // Set streaming to true as these responses may be several hundreds of MBs
    );

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
