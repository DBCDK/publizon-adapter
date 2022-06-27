/// <reference types="cypress" />

const mockHTTPUrl = Cypress.env("mockHTTPUrl");

const validSmaugUser = {
  uniqueId: "some-uniqueId",
};
const validSmaugPublizonCredentials = {
  clientId: "some-clientId",
  licenseKey: "some-licenseKey",
};

describe("Testing the publizon adapter", () => {
  beforeEach(() => {
    resetMockHTTP();
  });

  context("Token validation", () => {
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

    it("returns error when configuration has invalid publizon credentials", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration
       * 2. smaug configuration fails to validate
       */

      // Setup mocks
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        status: 200,
        body: {},
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_CLIENTID",
        status: 200,
        body: {
          pub: omit("clientId", validSmaugPublizonCredentials),
        },
      });
      mockSmaug({
        token: "TOKEN_WITHOUT_PUBLIZON_LICENSEKEY",
        status: 200,
        body: {
          pub: omit("licenseKey", validSmaugPublizonCredentials),
        },
      });

      // For each token we send request to adapter
      // expecting to fail smaug configuration validation
      [
        "TOKEN_WITHOUT_PUBLIZON_CREDENTIALS",
        "TOKEN_WITHOUT_PUBLIZON_CLIENTID",
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
            message:
              "token must have publizon credentials with 'clientId' and 'licenseKey'",
          });
        });
      });
    });
  });

  context("Access anonymous path", () => {
    it("returns publizon response, when token has valid credentials - GET request", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. smaug configuration is succesfully validated
       * 3. The request is then forwarded to Publizon with succes
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: {
          pub: validSmaugPublizonCredentials,
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

    it("Returns publizon response, when token has valid credentials - POST request", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. smaug configuration is succesfully validated
       * 3. The request is then forwarded to Publizon with succes
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_TOKEN",
        status: 200,
        body: {
          pub: validSmaugPublizonCredentials,
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

  context("Access authenticated path", () => {
    it("Returns 403 when requesting a authenticated path with a anonymous token", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. smaug configuration validation fails with 403
       */

      // Setup mocks
      mockSmaug({
        token: "ANONYMOUS_TOKEN",
        status: 200,
        body: {
          pub: validSmaugPublizonCredentials,
        },
      });

      mockFetchPublizonAuthenticatedPathGetSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/cardnumber/required/path",
        headers: {
          Authorization: "Bearer ANONYMOUS_TOKEN",
        },
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(403);
        expect(res.body).to.deep.include({
          message: "user authenticated token is required",
        });
      });
    });

    it("Returns publizon response including cardNumber, with authenticated token and path", () => {
      /**
       * Expected flow:
       * 1. Adapter uses token to fetch smaug configuration containing publizon credentials
       * 2. smaug configuration is succesfully validated
       * 3. The request is then forwarded to Publizon with succes
       */

      // Setup mocks
      mockSmaug({
        token: "VALID_AUTHENTICATED_TOKEN",
        status: 200,
        body: {
          pub: validSmaugPublizonCredentials,
          user: validSmaugUser,
        },
      });

      mockFetchPublizonAuthenticatedPathGetSucces();

      // Send request to adapter
      cy.request({
        url: "/v1/some/cardnumber/required/path",
        headers: {
          Authorization: "Bearer VALID_AUTHENTICATED_TOKEN",
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

function mockFetchUserinfoAuthenticatedTokenNoCPR() {
  mockHTTP({
    request: {
      method: "GET",
      path: `/userinfo`,
      headers: {
        authorization: "Bearer TOKEN_WITH_NO_CPR",
      },
    },
    response: {
      status: 200,
      body: {
        attributes: {
          userId: "some-userId",
          pincode: "some-pincode",
        },
      },
    },
  });
}

function omit(key, obj) {
  const { [key]: omitted, ...rest } = obj;
  return rest;
}
