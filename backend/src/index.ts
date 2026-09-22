import Express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import authRouter from "./modules/routes/auth.route";
import ressourceRouter from "./modules/routes/ressource.route";
import severityRouter from "./modules/routes/severity.route";
import transactionRouter from "./modules/routes/transaction.route";
import cors from "cors";
import { Server } from 'socket.io';
import { createServer } from 'node:http';

const app = Express();
const server = createServer(app);
const io = new Server(server);

const port = Number(process.env.PORT);
if (isNaN(port)) {
  throw new Error("Invalid port");
}

app.use(cors({
  origin: "http://localhost:9001",
  credentials: true,
}));

app.use(Express.json());

app.use(cookieParser())

app.use("/api/auth", authRouter);
app.use("/api/ressources", ressourceRouter);
app.use("/api/severities", severityRouter);
app.use("/api/transactions", transactionRouter);

io.on('connection', (socket) => {
  console.log('a user connected');
});

server.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
