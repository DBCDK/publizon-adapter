/// <reference types="cypress" />

const mockHTTPUrl = Cypress.env("mockHTTPUrl");

const validSmaugUser = {
  uniqueId: "some-uniqueId",
};

const validSmaugConfiguration = {
  agencyId: "000001",
  app: { clientId: "some-clientId" },
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

      // Credentials smaug configuration mocks
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        status: 200,
        body: {
          ...validSmaugConfiguration,
          agencyId: "000003",
        },
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_RETAILERID",
        status: 200,
        body: {
          ...validSmaugConfiguration,
          agencyId: "000004",
        },
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_LICENSEKEY",
        status: 200,
        body: {
          ...validSmaugConfiguration,
          agencyId: "000005",
        },
      });

      // For each token we send request to adapter
      // expecting to fail smaug configuration validation
      [
        "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        "TOKEN_WITHOUT_PUBLIZON_RETAILERID",
        "TOKEN_WITHOUT_PUBLIZON_LICENSEKEY",
      ].forEach((token) => {
        cy.request({
          url: `/v1/some/path`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          failOnStatusCode: false,
        }).then((res) => {
          expect(res.status).to.eq(403);
          expect(res.body).to.deep.include({
            message: "Agency is missing Publizon credentials",
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
      mockFetchPublizonAuthenticatedPathPOSTSucces();

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

    it("Access Publizon API with authenticated token on a dynamic route", () => {
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
      mockFetchPublizonDynamicPathGETSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/authenticated/path/ISBN",
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
      path: "/publizon/v1/some/path",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
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
      path: "/publizon/v1/some/path",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
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
      path: "/publizon/v1/some/authenticated/path",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
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
      path: "/publizon/v1/some/authenticated/path",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
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
      path: "/publizon/v1/some/authenticated/path",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
      },
    },
    response: {
      status: 403,
      body: { message: "Some error from Pubub for missing cardNumber" },
    },
  });
}

function mockFetchPublizonDynamicPathGETSucces() {
  mockHTTP({
    request: {
      path: "/publizon/v1/some/authenticated/path/ISBN",
      headers: {
        clientid: "some-clientId",
        // licensekey: "some-licenseKey",
        licensekey: "d4383a9fa7214a6d78a019c1328695a3",
        cardnumber: "some-uniqueId",
      },
    },
    response: {
      status: 200,
      body: { message: "Hello from Publizon" },
    },
  });
}

function omit(key, obj) {
  const { [key]: omitted, ...rest } = obj;
  return rest;
}
