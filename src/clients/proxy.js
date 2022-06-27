const HttpsProxyAgent = require("https-proxy-agent");

const { fetcher } = require("../utils");

/**
 * Initializes the proxy
 */
function init({ url, method, headers, body, log }) {
  /**
   * The actual fetch function
   */
  async function fetch({ clientId, licenseKey, cardNumber }) {
    const options = {
      method: method,
      headers: {
        ...headers,
        clientId,
        licenseKey,
      },
    };

    console.log("########## Cardnumber", cardNumber);

    if (cardNumber) {
      console.log("########## here????????");

      options.headers.cardNumber = cardNumber;
    }

    console.log("########## options.headers", options.headers);

    if (process.env.HTTPS_PROXY) {
      options.agent = new HttpsProxyAgent(process.env.HTTPS_PROXY);
    }

    delete options.headers.host;
    delete options.headers.authorization;

    if (body) {
      options.body = typeof body === "object" ? JSON.stringify(body) : body;
    }

    let res = await fetcher(process.env.PUBLIZON_URL, options, log);

    console.log("############# res", res);

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
