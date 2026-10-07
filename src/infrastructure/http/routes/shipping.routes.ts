import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";
import { ShippingController } from "../controllers/ShippingController";

const router: FastifyPluginAsync = async (fastify) => {

fastify.get("/rates", ShippingController.getRates);
fastify.post("/labels", ShippingController.purchaseLabel);
fastify.get("/shipments", ShippingController.getShipments);
fastify.post("/shipments/:id/track", ShippingController.trackShipment);
fastify.post("/route", ShippingController.routeOrder);
fastify.post("/quote", ShippingController.calculateCarrierRates);
fastify.post("/label", ShippingController.generateShippingLabel);

};
export default router;
