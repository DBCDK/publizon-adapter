const { fetcher } = require("../utils");

/**
 * Checks that attributes contains a municipalityAgencyId
 */
function validateMunicipalityAgencyId({ attributes, log, token }) {
  if (!(attributes && attributes.municipalityAgencyId)) {
    log.info(
      `MunicipalityAgencyId request to userinfo failed for token=${token}. Client is missing configuration`
    );
    throw {
      code: 403,
      body: { message: "token client does not include a municipalityAgencyId" },
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
    const res = await fetcher(
      `${process.env.USERINFO_URL}`,
      { headers: { authorization: `Bearer ${token}` } },
      log
    );

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
          body: { message: "internal server error" },
        };
    }
  }

  return { fetch };
}

module.exports = init;
