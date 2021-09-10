import express from "express";
import https from "https";
import cookieParser from "cookie-parser";
import compress from "compression";
import cors from "cors";
import helmet from "helmet";
import fs from "fs";

import vndbRoutes from "./routes/vndb.routes";
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

var options = {
  key: fs.readFileSync("server.key"),
  cert: fs.readFileSync("server.crt"),
};

const server = https.createServer(options, app);

export default app;
