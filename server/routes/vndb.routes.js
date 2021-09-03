import express from "express";
import vndbCtrl from "../controllers/vndb.controller";

const root = "/api/vn";
const router = express.Router();

router.route(`${root}/details/:vnId`).get(vndbCtrl.vnDetails);
router.route(`${root}/search`).get(vndbCtrl.vnSearch);
router.route(`${root}/tag/:tagId`).get(vndbCtrl.tagDetails);

export default router;
