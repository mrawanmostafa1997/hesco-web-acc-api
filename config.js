const { Scopes } = require("@aps_sdk/authentication");
require("dotenv").config();

let {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
  SERVER_SESSION_SECRET,
  PORT,
} = process.env;
if (
  !APS_CLIENT_ID ||
  !APS_CLIENT_SECRET ||
  !APS_CALLBACK_URL ||
  !SERVER_SESSION_SECRET
) {
  console.warn("Missing some of the environment variables.");
  process.exit(1);
}
const INTERNAL_TOKEN_SCOPES = [
  Scopes.DataRead,
  Scopes.DataWrite,
  Scopes.DataCreate,
];
const PUBLIC_TOKEN_SCOPES = [
  Scopes.DataRead,
  Scopes.DataWrite,
  Scopes.DataCreate,
];
PORT = PORT || 8080;

module.exports = {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
  SERVER_SESSION_SECRET,
  INTERNAL_TOKEN_SCOPES,
  PUBLIC_TOKEN_SCOPES,
  PORT,
};
