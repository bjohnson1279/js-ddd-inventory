import express from "express";
import inventoryRoutes from "./infrastructure/http/routes/inventory.routes";
import shopifyRoutes from "./infrastructure/http/routes/shopify.routes";

const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

app.use("/api/inventory", inventoryRoutes);
app.use("/api/shopify", shopifyRoutes);

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
