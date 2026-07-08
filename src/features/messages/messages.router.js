import { Router } from "express";
import { messagesHandler } from "./messages.controller.js";

const router = Router();

router.post("/v1/messages", messagesHandler);

export default router;
