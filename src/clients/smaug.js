const { fetcher } = require("../utils");

let = ANONYMOUS_TOKEN = null;

/**
 * Checks that configuration contains a valid user
 */
function validateSmaugUser({ configuration, log }) {
  // token must be authenticated
  if (!configuration?.user?.uniqueId) {
    const clientId = configuration?.app?.clientId || "";
    log.info(
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
    log.info(`Token client '${clientId}' has missing configuration 'agencyId'`);
    throw {
      code: 403,
      body: {
        message: "Token client has missing configuration 'agencyId'",
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
  async function fetch({ token, authTokenRequired }) {
    const res = await fetcher(
      `${process.env.SMAUG_URL}?token=${token}`,
      {},
      log
    );

    const configuration = res.body;

    switch (res.code) {
      case 200:
        // ensure configuration has an agencyId configured
        validateSmaugConfiguration({ configuration, log });

        if (authTokenRequired) {
          // ensure configuration has a user and a uniqueId
          // this check will not trow, only create a log
          validateSmaugUser({ configuration, log });
        }

        return configuration;

      case 404:
        throw {
          code: 403,
          body: { message: "invalid token" },
        };
      default:
        throw {
          code: 500,
          body: { message: "internal server error" },
        };
    }
  }

  return { fetch };
}

module.exports = init;
