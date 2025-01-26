const express = require("express");
const {
  authRefreshMiddleware,
  exportPDFs,
  getExportJob,
} = require("../services/aps.js");

let router = express.Router();

router.use("/api/projects", authRefreshMiddleware);

router.get(
  "/api/projects/:project_id/exports",
  async function (req, res, next) {
    try {
      const response = await exportPDFs(
        req.params.project_id,
        req.query.outputFileName,
        req.query.fileVersions,
        req.internalOAuthToken.access_token
      );
      res.json(response);
    } catch (err) {
      next(err);
    }
  }
);
router.get(
  "/api/projects/:project_id/exports/:export_id",
  async function (req, res, next) {
    try {
      const response = await getExportJob(
        req.params.project_id,
        req.params.export_id,
        req.internalOAuthToken.access_token
      );
      return res.json(response);
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
