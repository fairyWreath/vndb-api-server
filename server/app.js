import express from "express";
import cookieParser from "cookie-parser";
import compress from "compression";
import cors from "cors";
import helmet from "helmet";

import vndbRoutes from "./routes/vndb.routes";

// import PgPool from "../database/pg.pool";

const app = express();

app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));
app.use(cookieParser());
app.use(compress());
app.use(helmet());
app.use(cors());

app.use("/", vndbRoutes);

app.get("/", (req, res) => {
  return "<div>I loge Hitagi</div>";
});

export default app;
