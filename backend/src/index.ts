import Express from "express";
import "dotenv/config";

const app = Express();

const port = Number(process.env.PORT ?? 3000);

app.use(Express.json());

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
