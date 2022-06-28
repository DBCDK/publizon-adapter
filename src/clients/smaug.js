const { fetcher } = require("../utils");

/**
 * Checks that configuration contains a valid user
 */
function validateSmaugUser({ configuration, log }) {
  // token must be user authenticated
  if (!configuration || !configuration.user || !configuration.user.uniqueId) {
    log.info("Smaug configuration is missing a user or uniqueId");
    // throw {
    //   code: 403,
    //   body: { message: "user authenticated token is required" },
    // };
  }
}

/**
 * Checks that configuration contains publizon credentials
 */
function validateSmaugCredentials({ configuration, log }) {
  const isValid =
    configuration &&
    configuration.pub &&
    configuration.pub.clientId &&
    configuration.pub.licenseKey;

  if (!isValid) {
    log.info("Smaug configuration has invalid Publizon credentials");
    throw {
      code: 403,
      body: {
        message:
          "token must have publizon credentials with 'clientId' and 'licenseKey'",
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

    console.log("######### url", `${process.env.SMAUG_URL}?token=${token}`);

    switch (res.code) {
      case 200:
        const configuration = res.body;
        validateSmaugCredentials({ configuration, log });
        if (authTokenRequired) {
          validateSmaugUser({ configuration, log });
        }
        return configuration;
      case 404:
        throw {
          code: 403,
          body: { message: "invalid token" },
        };
      default:
        log.error(
          `Smaug request failed for token=${token}. This is unexpected.`
        );
        throw {
          code: 500,
          body: { message: "internal server error 1" },
        };
    }
  }

  return { fetch };
}

module.exports = init;
