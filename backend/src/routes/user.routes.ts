import { Router } from "express";

import { getUserSearch } from "../controllers/user.controller.js";
import { requireAuthentication } from "../middleware/auth.js";

const router = Router();

router.use(requireAuthentication);
router.get("/search", getUserSearch);

export default router;
