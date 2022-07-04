/// <reference types="cypress" />

const mockHTTPUrl = Cypress.env("mockHTTPUrl");

const validSmaugUser = {
  uniqueId: "some-uniqueId",
};

const validSmaugPublizonCredentials = {
  clientId: "some-clientId",
  licenseKey: "some-licenseKey",
};

const validSmaugConfiguration = {
  agencyId: "000001",
  app: { clientId: "some-client-id" },
};

const validSmaugCredentialsList = {
  publizon: {
    "000001": validSmaugPublizonCredentials,
    "000002": validSmaugPublizonCredentials,
    "000003": validSmaugPublizonCredentials,
    "000004": validSmaugPublizonCredentials,
  },
};

describe("Testing the publizon adapter", () => {
  beforeEach(() => {
    resetMockHTTP();
  });

  context("Validating incomming tokens", () => {
    it("returns error when no token is given", () => {
      /**
       * Expected flow:
       * 1. Request is invalid due to missing token
       */

      // Send request to adapter
      cy.request({
        url: "/v1/some/path",
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(400);
        expect(res.body).to.deep.include({
          message: "headers should have required property 'authorization'",
        });
      });
    });

    it("returns error when token is not found", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({ token: "INVALID_TOKEN", status: 404, body: "" });

      // Send request to adapter
      cy.request({
        url: "/v1/some/path",
        headers: {
          Authorization: "Bearer INVALID_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({ message: "invalid token" });
      });
    });

    it("returns error on missing configuration 'agencyId' for anonymous token", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: omit("agencyId", validSmaugConfiguration),
      });

      // Send request to adapter
      cy.request({
        url: "/v1/some/path",
        headers: {
          Authorization: "Bearer VALID_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({
          message: "Token client has missing configuration 'agencyId'",
        });
      });
    });

    it("returns error on missing configuration 'agencyId' for authenticated token", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "AUTHENTICATED_TOKEN",
        status: 200,
        body: omit("agencyId", {
          ...validSmaugConfiguration,
          ...validSmaugUser,
        }),
      });

      // Send request to adapter
      cy.request({
        url: "/v1/some/path",
        headers: {
          Authorization: "Bearer AUTHENTICATED_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({
          message: "Token client has missing configuration 'agencyId'",
        });
      });
    });
  });

  context("Accessing publizon credentials", () => {
    it("returns error when configuration has invalid publizon credentials", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration
       * 2. smaug configuration fails to validate
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
        },
      });

      // Credentials smaug configuration mocks
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        status: 200,
        body: {},
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_CLIENTID",
        status: 200,
        body: omit("clientId", validSmaugPublizonCredentials),
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_LICENSEKEY",
        status: 200,
        body: omit("licenseKey", validSmaugPublizonCredentials),
      });

      // For each token we send request to adapter
      // expecting to fail smaug configuration validation
      [
        "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        "TOKEN_WITHOUT_PUBLIZON_CLIENTID",
        "TOKEN_WITHOUT_PUBLIZON_LICENSEKEY",
      ].forEach((token) => {
        // get anonymous token
        mockFetchAuthSucces({ token });

        cy.request({
          url: `/v1/some/path`,
          headers: {
            Authorization: `Bearer VALID_TOKEN`,
          },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(403);
          expect(res.body).to.deep.include({
            message:
              "token must have publizon credentials with 'clientId' and 'licenseKey'",
          });
        });
      });
    });
  });

  context("Accessing publizon credentials on anonymous path", () => {
    it("GET: Fetch credentials for anonymous token (credentials by agencyId)", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
        },
      });

      mockFetchCredentials();
      mockFetchPublizonAnonymousPathGetSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/path",
        headers: {
          Authorization: "Bearer VALID_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.include({
          message: "Hello from Publizon",
        });
      });
    });

    it("POST: Fetch credentials for anonymous token (credentials by agencyId)", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
        },
      });

      mockFetchCredentials();
      mockFetchPublizonAnonymousPathPostSucces();

      // Send request to adapter
      cy.request({
        method: "POST",
        url: "/v1/some/path",
        headers: {
          Authorization: "Bearer VALID_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.include({
          message: "Hello from Publizon",
        });
      });
    });
  });

  context("Accessing publizon credentials on authenticated path", () => {
    it("Fail when token has no 'municipalityAgencyId' configured on token client", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. /userinfo attributes will NOT contain a municipalityAgencyId
       */

      // Setup mocks
      mockSmaug({
        token: "AUTHENTICATED_TOKEN",
        status: 200,
        body: {
          user: validSmaugUser,
          ...validSmaugConfiguration,
        },
      });

      mockFetchUserinfoNoMunicipalityAgencyId();

      // Send request to adapter
      cy.request({
        method: "POST",
        url: "/v1/some/authenticated/path",
        headers: {
          Authorization: "Bearer AUTHENTICATED_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({
          message: "token client does not include a municipalityAgencyId",
        });
      });
    });

    it("Allow requesting PubHub authenticated path with a anonymous token", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. smaug configuration is succesfully validated
       * 3. PubHub adapter will return an error message for missing cardNumber in header
       */

      // Setup mocks
      mockSmaug({
        token: "ANONYMOUS_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
        },
      });

      mockFetchCredentials();

      mockFetchPublizonAuthenticatedPathAnonymousTokenGetSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/authenticated/path",
        headers: {
          Authorization: "Bearer ANONYMOUS_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({
          message: "Some error from Pubub for missing cardNumber",
        });
      });
    });

    it("GET: Fetch credentials for authenticated token (credentials by municipalityAgencyId)", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "AUTHENTICATED_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
          user: validSmaugUser,
        },
      });

      mockFetchUserinfoSucces();
      mockFetchCredentials();
      mockFetchPublizonAuthenticatedPathGetSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/authenticated/path",
        headers: {
          Authorization: "Bearer AUTHENTICATED_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.include({
          message: "Hello from Publizon",
        });
      });
    });

    it("POST: Fetch credentials for authenticated token (credentials by municipalityAgencyId)", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration, but token is invalid
       */

      // Setup mocks
      mockSmaug({
        token: "AUTHENTICATED_TOKEN",
        status: 200,
        body: {
          ...validSmaugConfiguration,
          user: validSmaugUser,
        },
      });

      mockFetchUserinfoSucces();
      mockFetchCredentials();
      mockFetchPublizonAuthenticatedPathPOSTSucces();

      mockSmaug({
        token: "SOME_ANONYMOUS_TOKEN",
        status: 200,
        body: validSmaugCredentialsList,
      });

      // Send request to adapter
      cy.request({
        method: "POST",
        url: "/v1/some/authenticated/path",
        headers: {
          Authorization: "Bearer AUTHENTICATED_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.deep.include({
          message: "Hello from Publizon",
        });
      });
    });
  });
});

// ----- HELPER FUNCTIONS FOR MOCKING STUFF -----
function mockHTTP({ request, response }) {
  cy.request({
    method: "POST",
    url: mockHTTPUrl,
    body: {
      request,
      response,
    },
  });
}

function resetMockHTTP() {
  cy.request({
    method: "POST",
    url: `${mockHTTPUrl}/reset`,
  });
}

function mockSmaug({ token, status, body }) {
  mockHTTP({
    request: {
      method: "GET",
      path: "/smaug/configuration",
      query: {
        token,
      },
    },
    response: {
      status,
      body,
    },
  });
}

function mockFetchCredentials({ token } = {}) {
  if (!token) {
    token = "SOME_ANONYMOUS_TOKEN";
  }
  // get Anonymous token from smaug auth
  mockFetchAuthSucces({ token });

  // add credentialsList to smaug
  mockSmaug({
    token,
    status: 200,
    body: validSmaugCredentialsList,
  });
}

function mockFetchAuthSucces({ token = "SOME_ANONYMOUS_TOKEN" }) {
  mockHTTP({
    request: {
      method: "POST",
      path: `/auth/oauth/token`,
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      // body: `grant_type=password&username=@&password=@&client_id=some-client-id&client_secret=some-client-secret`,
      body: {
        grant_type: "password",
        username: "@",
        password: "@",
        client_id: "some-client-id",
        client_secret: "some-client-secret",
      },
    },
    response: {
      status: 200,
      body: {
        access_token: token,
        token_type: "Bearer",
        expires_in: 2591999,
      },
    },
  });
}

function mockFetchUserinfoSucces() {
  mockHTTP({
    request: {
      method: "GET",
      path: `/userinfo`,
      headers: {
        authorization: "Bearer AUTHENTICATED_TOKEN",
      },
    },
    response: {
      status: 200,
      body: {
        attributes: {
          municipalityAgencyId: "000002",
        },
      },
    },
  });
}

function mockFetchUserinfoNoMunicipalityAgencyId() {
  mockHTTP({
    request: {
      method: "GET",
      path: `/userinfo`,
      headers: {
        authorization: "Bearer AUTHENTICATED_TOKEN",
      },
    },
    response: {
      status: 200,
      body: {
        attributes: {},
      },
    },
  });
}

function mockFetchPublizonAnonymousPathGetSucces() {
  mockHTTP({
    request: {
      method: "GET",
      path: "/publizon",
      headers: {
        clientid: "some-clientId",
        licensekey: "some-licenseKey",
      },
    },
    response: {
      status: 200,
      body: { message: "Hello from Publizon" },
    },
  });
}
function mockFetchPublizonAnonymousPathPostSucces() {
  mockHTTP({
    request: {
      method: "POST",
      path: "/publizon",
      headers: {
        clientid: "some-clientId",
        licensekey: "some-licenseKey",
      },
    },
    response: {
      status: 200,
      body: { message: "Hello from Publizon" },
    },
  });
}

function mockFetchPublizonAuthenticatedPathGetSucces() {
  mockHTTP({
    request: {
      method: "GET",
      path: "/publizon",
      headers: {
        clientid: "some-clientId",
        licensekey: "some-licenseKey",
        cardnumber: "some-uniqueId",
      },
    },
    response: {
      status: 200,
      body: { message: "Hello from Publizon" },
    },
  });
}

function mockFetchPublizonAuthenticatedPathPOSTSucces() {
  mockHTTP({
    request: {
      method: "POST",
      path: "/publizon",
      headers: {
        clientid: "some-clientId",
        licensekey: "some-licenseKey",
        cardnumber: "some-uniqueId",
      },
    },
    response: {
      status: 200,
      body: { message: "Hello from Publizon" },
    },
  });
}

function mockFetchPublizonAuthenticatedPathAnonymousTokenGetSucces() {
  mockHTTP({
    request: {
      method: "GET",
      path: "/publizon",
      headers: {
        clientid: "some-clientId",
        licensekey: "some-licenseKey",
      },
    },
    response: {
      status: 403,
      body: { message: "Some error from Pubub for missing cardNumber" },
    },
  });
}

function omit(key, obj) {
  const { [key]: omitted, ...rest } = obj;
  return rest;
}
