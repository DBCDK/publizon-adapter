const { fetcher } = require("../utils");

let = ANONYMOUS_TOKEN = null;

/**
 * Checks that configuration contains a valid user
 */
function validateSmaugUser({ configuration, log }) {
  // token must be user authenticated
  if (!configuration || !configuration.user || !configuration.user.uniqueId) {
    const clientId = configuration?.app?.clientId || "";
    log.info(
      `Token client '${clientId}' has missing configuration 'user' or 'uniqueId'`
    );
    // throw {
    //   code: 403,
    //   body: { message: "user authenticated token is required" },
    // };
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
 * Checks that configuration contains publizon credentials
 */
function validateSmaugCredentials({ credentials, log }) {
  const isValid = credentials?.licenseKey;

  if (!isValid) {
    log.info("Smaug configuration has invalid Publizon credentials");
    throw {
      code: 403,
      body: {
        message: "token must have publizon credentials with 'licenseKey'",
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
  async function fetch({ token }) {
    const res = await fetcher(
      `${process.env.SMAUG_URL}?token=${token}`,
      {},
      log
    );

    switch (res.code) {
      case 404:
        throw {
          code: 403,
          body: { message: "invalid token" },
        };
      default:
        return res;
    }
  }

  async function fetchToken() {
    const clientId = encodeURIComponent(process.env.CLIENT_ID);
    const clientSecret = encodeURIComponent(process.env.CLIENT_SECRET);

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=password&username=@&password=@&client_id=${clientId}&client_secret=${clientSecret}`,
    };

    const res = await fetcher(
      `${process.env.AUTH_URL}/oauth/token`,
      options,
      log
    );

    switch (res.code) {
      case 200:
        return res.body.access_token;

      case 400:
        log.info(`Failed to fetch token for client '${clientId}'`);
        throw {
          code: 400,
          body: { message: `Failed to fetch token for client '${clientId}'` },
        };
      default:
        log.error(
          `Smaug request failed for token=${token}. This is unexpected.`
        );
        throw {
          code: 500,
          body: { message: "internal server error" },
        };
    }
  }

  async function fetchCredentials({ agencyId, retry = false }) {
    if (!ANONYMOUS_TOKEN || retry) {
      // fetch a token to access credentials
      ANONYMOUS_TOKEN = await fetchToken();
    }

    const res = await fetch({ token: ANONYMOUS_TOKEN });

    switch (res.code) {
      case 200:
        const credentials = res.body.publizon?.credentials?.[agencyId];

        // ensure configuration has an agencyId configured
        validateSmaugCredentials({ credentials, log });

        return credentials;

      default:
        if (!retry) {
          // retry if global/stored token is expired/invalid
          // this will trigger a new fresh token fetch
          return await fetchCredentials({ agencyId, retry: true });
        }
        log.error(
          `Smaug request failed for token=${token}. This is unexpected.`
        );
        throw {
          code: 500,
          body: { message: "internal server error" },
        };
    }
  }

  async function fetchConfiguration({ token, authTokenRequired }) {
    const res = await fetch({ token });

    const configuration = res.body;

    // ensure configuration has an agencyId configured
    validateSmaugConfiguration({ configuration, log });

    if (authTokenRequired) {
      // ensure configuration has a user and a uniqueId
      // this check will not trow, only create a log
      validateSmaugUser({ configuration, log });
    }
    return configuration;
  }

  return { fetchCredentials, fetchConfiguration };
}

module.exports = init;
