import express from 'express';


const app: express.Application = express();

const PORT: number = process.env.PORT ? parseInt(process.env.PORT) : 9292;


app.use(express.json());


app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

export default app;