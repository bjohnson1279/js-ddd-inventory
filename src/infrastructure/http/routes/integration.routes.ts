import { FastifyRequest, FastifyReply, FastifyPluginAsync } from "fastify";

const router: FastifyPluginAsync = async (fastify) => {

fastify.post("/amazon/connect", (request: any, reply: any) => {
    // Scaffold connection logic
    reply.status(200).send({ status: "success", message: "Amazon connected" });
});

fastify.post("/woocommerce/connect", (request: any, reply: any) => {
    // Scaffold connection logic
    reply.status(200).send({ status: "success", message: "WooCommerce connected" });
});

fastify.get("/connections", (request: any, reply: any) => {
    // Scaffold fetching connections
    reply.status(200).send({ amazon: [], woocommerce: [] });
});

};
export default router;
