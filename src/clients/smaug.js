const { fetcher } = require("../utils");
const APP_NAME = process.env.APP_NAME || "DBC adapter";

let = ANONYMOUS_TOKEN = null;

/**
 * Checks that configuration contains a valid user
 */
function validateSmaugUser({ configuration, log }) {
  // token must be authenticated
  if (!configuration?.user?.uniqueId) {
    const clientId = configuration?.app?.clientId || "";
    log.debug(
      `Authentificated token is required, but got anonymous for client '${clientId}'`
    );
  }
}

/**
 * Checks that configuration has agencyId configured
 * - agencyId is used for accessing credentials for anonymous tokens.
 */
function validateSmaugConfiguration({ configuration, log }) {
  const isValid = configuration?.agencyId;
  const clientId = configuration?.app?.clientId || "";

  if (!isValid) {
    log.debug(
      `Token client '${clientId}' has missing configuration 'agencyId'`
    );
    throw {
      code: 403,
      body: {
        message: "Token client has missing configuration 'agencyId'",
        appName: APP_NAME,
      },
    };
  }
}

/**
 * Initializes the smaug fetcher
 */
function init({ log }) {
  /**
   * The actual fetch function
   */
  async function fetch({ token, isAuthenticatedPath }) {
    const time = Date.now();

    const res = await fetcher(
      `${process.env.SMAUG_URL}?token=${token}`,
      {},
      log
    );

    const configuration = res.body;

    // log response to summary
    log.summary.datasources.smaug = {
      code: res.code,
      time: Date.now() - time,
    };

    switch (res.code) {
      case 200:
        // ensure configuration has an agencyId configured
        validateSmaugConfiguration({ configuration, log });

        if (isAuthenticatedPath) {
          // ensure configuration has a user and a uniqueId
          // this check will not trow, only create a log
          validateSmaugUser({ configuration, log });
        }

        return configuration;

      case 404:
        throw {
          code: 403,
          body: { message: "invalid token", appName: APP_NAME },
        };
      default:
        throw {
          code: 500,
          body: { message: "internal server error", appName: APP_NAME },
        };
    }
  }

  return { fetch };
}

module.exports = init;
