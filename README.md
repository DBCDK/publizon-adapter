# Publizon Adapter

The adapter is a thin layer on top of the publizon api _PubHub_ which allow software running in a browser (or similar) to call the API using a _DÅP token_.

## Setting up the dev environment

Use docker-compose to start the dev server on port 3000.
`docker-compose -f docker-compose-dev.yml up`
This will start a service for mocking HTTP and the adapter. The adapter and mock service are restarted automatically when files change in the src folder.

NOTICE:
This project is using npx, if any changes are made in eg. package.json you need to make sure that local images are rebuild - one way is to remove them by running
`docker-compose -f docker-compose-dev.yml down --rmi all` and then run the `docker-compose -f docker-compose-dev.yml up` command again.

When the dev environment is started, run tests with `npm run cy:open`.

## Environment Variables

- **LOG_LEVEL**
  Sets the log level. Supported values are _TRACE, DEBUG, INFO, WARN, ERROR or OFF_
- **SMAUG_URL**
  Url pointing at smaug configuration endpoint
- **PUBLIZON_URL**
  Url pointing at the root of the PubHub API. This is where HTTP requests are proxied to.
- **PUBLIZON_CLIENT_ID**
  ClientId for the adapter app. This id is the `clientId` sent as header to the PubHup API
- **USERINFO_URL**
  Url pointing at the userinfo endpoint. This is used to fetch a users municipalityAgencyId from a authenticated token
- **PUBLIZON_CREDENTIALS**
  A list of credentials for libraries with access to the PubHub API. 
- **VALID_PUBLIZON_CREDENTIALS**
  This variable can be set to add a valid library/agencyId to the credentials list (for test purpose)
  credentials must be set in the following syntax: _000001,some-licenseKey,some-retailerId_


## Using the adapter

The adapter must be called with a DÅP token associated with a client that is configured with a agencyId. In this way the adapter is able to fetch the proper credentials used to access the PubHub API.

- The adapter requires the DÅP token to be given as authorization bearer header.

### Accessing anonymous data

Some data in the API can be accessed using an anonymous token `Authorization: Bearer {ANONYMOUS_TOKEN}`.

The PubHub API will be called with `clientId` and `licenseKey` credentials set in the header. 

Credentials is fetched by the configured agencyId in the smaug configuration.

### Accessing authenticated data

Most of the endpoints in the PubHub API requires a authenticated token `Authorization: Bearer {AUTHENTICATED_TOKEN}`.

Requests with a authenticated token from the adapter to the PubHub api will in addition to the `clientId` and `licenseKey` credentials, also include a `cardNumber` in the header. 

CardNumber will contain a users `uniqueId`.

## Request parameters

When using the adapter, the header should be replaced with a DÅP token and 

_HOST_ should be replaced with the adapter host:

`curl -H "Authorization: Bearer {TOKEN}" "{PUBLIZON_HOST}/{PATH}"`

## Examples

Here are a couple of examples on how to call the adapter:

Anonymous token on a anonymous path:

`curl -H "Authorization: bearer {TOKEN}" -H "Content-Type: application/json" -X GET {PUBLIZON_HOST}/v1/library/profile`

Authenticated token on a authenticated path:

`curl -H "Authorization: bearer {AUTHENTICATED_TOKEN}" -H "Content-Type: application/json" -X GET {PUBLIZON_HOST}/v1/user/loans`

Anonymous token on a authenticated path (This will return error message from PubHup):

`curl -H "Authorization: bearer {TOKEN}" -H "Content-Type: application/json" -X GET {PUBLIZON_HOST}/v1/user/loans`

List of requests requiring _cardNumber_ to be set in header:

| Method | Path                         |
| ------ | -----------------------------|
| GET    | /v1/user/loans               | 
| GET    | /v1/user/loans/              |
| POST   | /v1/user/loans/              |
| GET    | /v1/user/reservations        |
| POST   | /v1/user/reservations/       |
| PATCH  | /v1/user/reservations/       |
| DELETE | /v1/user/reservations/       |
| GET    | /v1/user/checklist           |
| POST   | /v1/user/checklist/          |
| DELETE | /v1/user/checklist/          |
| GET    | /v1/user/cardnumber/friendly |

And for cypress test purpose:

| Method | Path                         |
| ------ | -----------------------------|
| GET    | /v1/some/authenticated/path  | 
| POST   | /v1/some/authenticated/path  |

## Custom responses from the Adapter

For the most of the time the adapter will pass raw responses from the PubHub API back to the caller. In some circumstances however, the adapter itself return error messages:
| Description | Request | Response Body | Response Status Code |
|-------------|---------|---------------|----------------------|
| Missing authorization header |`curl "{PUBLIZON_HOST}/v1/some/path"`| `{"message":"headers should have required property 'authorization'"}`| 400 |
| Token does not exist | `curl -H "Authorization: Bearer TOKEN_NOT_EXISTING" "{PUBLIZON_HOST}/v1/some/path"` | `{"message":"invalid token"}` | 403 |
| Token is associated with client not configured with agencyId | `curl -H "Authorization: Bearer TOKEN_MISSING_CREDENTIALS" "{PUBLIZON_HOST}/v1/some/path"` | `{"message":"Token client has missing configuration 'agencyId'"}` | 403 |
| Token is associated with client missing credentials | `curl -H "Authorization: Bearer SOME_TOKEN" "{PUBLIZON_HOST}/v1/some/path"` | `{"message":"Agency is missing Publizon credentials"}` | 403 |
| Authenticated token is associated with client not configured with municipalityAgencyId | `curl -H "Authorization: Bearer SOME_TOKEN" "{PUBLIZON_HOST}/v1/some/authenticated/path"` | `{"message":"token client does not include a municipalityAgencyId"}` | 403 |
