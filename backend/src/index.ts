import Express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import authRouter from "./modules/routes/auth.route";
import ressourceRouter from "./modules/routes/ressource.route";
import severityRouter from "./modules/routes/severity.route";
import transactionRouter from "./modules/routes/transaction.route";
import cors from "cors";
import { createServer } from "node:http";
import { initializeSocketServer } from "./wc/socket";
import { CORS_ORIGINS } from "./util/corsOrigins";
import { startTransferArrivalJob } from "./modules/services/transaction.service";

const app = Express();

const port = Number(process.env.PORT);
if (isNaN(port)) {
  throw new Error("Invalid port");
}

app.use(
  cors({
    origin: CORS_ORIGINS,
    credentials: true,
  }),
);

app.use(Express.json());

app.use(cookieParser());

app.use("/api/auth", authRouter);
app.use("/api/ressources", ressourceRouter);
app.use("/api/severities", severityRouter);
app.use("/api/transactions", transactionRouter);

const server = createServer(app);
initializeSocketServer(server);
startTransferArrivalJob();

server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});