const {
  AuthenticationClient,
  ResponseType,
} = require("@aps_sdk/authentication");
const { DataManagementClient } = require("@aps_sdk/data-management");
const {
  APS_CLIENT_ID,
  APS_CLIENT_SECRET,
  APS_CALLBACK_URL,
  INTERNAL_TOKEN_SCOPES,
  PUBLIC_TOKEN_SCOPES,
} = require("../config.js");

const authenticationClient = new AuthenticationClient();
const dataManagementClient = new DataManagementClient();
const service = (module.exports = {});

service.getAuthorizationUrl = () =>
  authenticationClient.authorize(
    APS_CLIENT_ID,
    ResponseType.Code,
    APS_CALLBACK_URL,
    INTERNAL_TOKEN_SCOPES
  );

service.authCallbackMiddleware = async (req, res, next) => {
  const internalCredentials = await authenticationClient.getThreeLeggedToken(
    APS_CLIENT_ID,
    req.query.code,
    APS_CALLBACK_URL,
    {
      clientSecret: APS_CLIENT_SECRET,
    }
  );
  const publicCredentials = await authenticationClient.refreshToken(
    internalCredentials.refresh_token,
    APS_CLIENT_ID,
    {
      clientSecret: APS_CLIENT_SECRET,
      scopes: PUBLIC_TOKEN_SCOPES,
    }
  );
  req.session.public_token = publicCredentials.access_token;
  req.session.internal_token = internalCredentials.access_token;
  req.session.refresh_token = publicCredentials.refresh_token;
  req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
  next();
};

service.authRefreshMiddleware = async (req, res, next) => {
  const { refresh_token, expires_at } = req.session;
  if (!refresh_token) {
    res.status(401).end();
    return;
  }

  if (expires_at < Date.now()) {
    const internalCredentials = await authenticationClient.refreshToken(
      refresh_token,
      APS_CLIENT_ID,
      {
        clientSecret: APS_CLIENT_SECRET,
        scopes: INTERNAL_TOKEN_SCOPES,
      }
    );
    const publicCredentials = await authenticationClient.refreshToken(
      internalCredentials.refresh_token,
      APS_CLIENT_ID,
      {
        clientSecret: APS_CLIENT_SECRET,
        scopes: PUBLIC_TOKEN_SCOPES,
      }
    );
    req.session.public_token = publicCredentials.access_token;
    req.session.internal_token = internalCredentials.access_token;
    req.session.refresh_token = publicCredentials.refresh_token;
    req.session.expires_at = Date.now() + internalCredentials.expires_in * 1000;
  }
  req.internalOAuthToken = {
    access_token: req.session.internal_token,
    expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
  };
  req.publicOAuthToken = {
    access_token: req.session.public_token,
    expires_in: Math.round((req.session.expires_at - Date.now()) / 1000),
  };
  next();
};

service.getUserProfile = async (accessToken) => {
  const resp = await authenticationClient.getUserInfo(accessToken);
  return resp;
};

service.getHubs = async (accessToken) => {
  const resp = await dataManagementClient.getHubs({ accessToken });
  return resp.data;
};

service.getProjects = async (hubId, accessToken) => {
  const resp = await dataManagementClient.getHubProjects(hubId, {
    accessToken,
  });
  return resp.data;
};

service.getProjectContents = async (
  hubId,
  projectId,
  folderId,
  accessToken
) => {
  if (!folderId) {
    const resp = await dataManagementClient.getProjectTopFolders(
      hubId,
      projectId,
      { accessToken }
    );
    return resp.data;
  } else {
    const resp = await dataManagementClient.getFolderContents(
      projectId,
      folderId,
      { accessToken }
    );
    return resp.data;
  }
};

service.getItemVersions = async (projectId, itemId, accessToken) => {
  const resp = await dataManagementClient.getItemVersions(projectId, itemId, {
    accessToken,
  });
  return resp.data;
};
service.exportPDFs = async (projectId, outputFileName, fileVersions, token) => {
  if (!projectId || !outputFileName || !fileVersions?.length || !token) {
    throw new Error(
      "Invalid input: Ensure projectId, outputFileName, fileVersions, and token are provided."
    );
  }

  try {
    const baseUrl = "https://developer.api.autodesk.com/construction/files/v1";
    const exportUrl = `${baseUrl}/projects/${projectId}/exports`;

    const requestBody = {
      options: {
        outputFileName: outputFileName,
        standardMarkups: {
          includePublishedMarkups: true,
          includeUnpublishedMarkups: true,
          includeMarkupLinks: true,
        },
        issueMarkups: {
          includePublishedMarkups: true,
          includeUnpublishedMarkups: true,
        },
        photoMarkups: {
          includePublishedMarkups: true,
          includeUnpublishedMarkups: true,
        },
      },
      fileVersions: fileVersions.split(","),
    };

    const headers = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(exportUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
    });

    if (response.ok) {
      const responseData = await response.json();
      console.log("Export job created successfully:", responseData);
      return responseData;
    } else {
      console.error(`Failed to create export job. Status: ${response.status}`);
      const errorData = await response.json().catch(() => null);
      console.error(
        "Error details:",
        errorData || "Unable to parse error details"
      );
      throw new Error(`Export job failed with status ${response.status}`);
    }
  } catch (error) {
    console.error("An error occurred:", error.message);
    throw error;
  }
};

service.getExportJob = async (projectId, exportId, token) => {
  if (!projectId || !exportId || !token) {
    throw new Error(
      "Invalid input: Ensure projectId, exportId, and token are provided."
    );
  }

  const baseUrl = "https://developer.api.autodesk.com/construction/files/v1";
  const exportUrl = `${baseUrl}/projects/${projectId}/exports/${exportId}`;

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  try {
    const response = await fetch(exportUrl, {
      method: "GET",
      headers: headers,
    });
    const responseData = await response.json();
    return responseData;
  } catch (error) {
    console.error("An error occurred:", error.message);
    throw error;
  }
};
