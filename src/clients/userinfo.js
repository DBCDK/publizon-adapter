const { fetcher } = require("../utils");
const APP_NAME = process.env.APP_NAME || "DBC adapter";

/**
 * Checks that attributes contains a municipalityAgencyId
 */
function validateMunicipalityAgencyId({ attributes, log, token }) {
  if (!(attributes && attributes.municipalityAgencyId)) {
    log.debug(
      `MunicipalityAgencyId request to userinfo failed for token=${token}. Client is missing configuration`
    );
    throw {
      code: 403,
      body: {
        message: "token client does not include a municipalityAgencyId",
        appName: APP_NAME,
      },
    };
  }
}

/**
 * Initializes the userinfo fetcher
 */
function init({ log }) {
  /**
   * The actual fetch function
   */
  async function fetch({ token }) {
    const time = Date.now();

    const res = await fetcher(
      `${process.env.USERINFO_URL}`,
      { headers: { authorization: `Bearer ${token}` } },
      log
    );

    // log response to summary
    log.summary.datasources.userinfo = {
      code: res.code,
      time: Date.now() - time,
    };

    switch (res.code) {
      case 200:
        const attributes = res.body && res.body.attributes;
        // ensure user has loggedIn by using nem-id
        validateMunicipalityAgencyId({ attributes, log, token });
        return attributes.municipalityAgencyId;
      case 401:
        validateMunicipalityAgencyId({ log }); // fails
      default:
        log.error(
          `Userinfo request failed for token=${token}. This is unexpected.`
        );
        throw {
          code: 500,
          body: { message: "internal server error", appName: APP_NAME },
        };
    }
  }

  return { fetch };
}

module.exports = init;
