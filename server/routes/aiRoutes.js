import express from "express";
import { createVapiClientToken, searchHotels, getAvailability, ragSearch } from "../controllers/aiController.js";

const aiRouter = express.Router();

aiRouter.post("/vapi/token", createVapiClientToken);
aiRouter.get("/hotels", searchHotels);
aiRouter.get("/availability", getAvailability);
aiRouter.post("/rag-search", ragSearch);

export default aiRouter;



