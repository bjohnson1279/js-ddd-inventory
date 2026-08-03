try {
    throw { code: "ECONNREFUSED" };
} catch(e) {
    if (!e.code || e.code === "P1001" || e.message?.includes("Can't reach database") || e.name === "PrismaClientKnownRequestError") {
        console.log("fallback");
    } else {
        throw e;
    }
}
