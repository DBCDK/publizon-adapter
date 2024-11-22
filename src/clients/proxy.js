const HttpsProxyAgent = require("https-proxy-agent");
const { fetcher } = require("../utils");

const agent = new HttpsProxyAgent({
  keepAlive: false, // true may cause sockets no to close
  keepAliveMsecs: 1000, // Holder forbindelser åbne i 1 sekund før de lukkes
  maxSockets: 50, // Maksimalt antal samtidige sockets
  maxFreeSockets: 10, // Maksimalt antal inaktive sockets, der holdes åbne
  timeout: 5000, // Lukker inaktive sockets efter 5 sekunder

  host: "dmzproxy.dbc.dk", // Proxyens værtsnavn
  port: 3128, // Proxyens port
  protocol: "http:",
});

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
      options.agent = agent;
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
