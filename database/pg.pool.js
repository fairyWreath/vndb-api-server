import Pool from "pg-pool";
import config from "../config/config";

const pool = new Pool(config.database);

export const query = async (text, params) => {
  return pool.query(text, params);
};
