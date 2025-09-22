import express from "express";
import { createVapiClientToken, searchHotels, getAvailability } from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.post("/vapi/token", createVapiClientToken);
aiRouter.get("/hotels", searchHotels);
aiRouter.get("/availability", getAvailability);

export default aiRouter;


