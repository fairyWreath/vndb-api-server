import vndb from "../../database/queries/vndb.queries";

export const vnDetails = async (req, res) => {
  try {
    const vid = req.params.vnId;
    const vns = await vndb.getVnDetails(vid);
    const tags = await vndb.getVnTags(vid);
    const play_time = await vndb.getVnLength(vid);
    const staff = await vndb.getVnStaff(vid);
    const chars = await vndb.getVnCharacters(vid);
    const relations = await vndb.getVnRelations(vid);

    const vn = vns.rows[0];
    vn.tags = tags.rows;
    vn.play_time = play_time.rows[0];
    vn.staff = staff.rows;
    vn.characters = chars.rows;
    vn.relations = relations.rows;

    const response = {
      item: vn,
    };
    return res.status(200).json(response);
  } catch (err) {
    return res.status(400).json(err);
  }
};

const tagDetails = async (req, res) => {
  try {
    const results = await vndb.getTagDetails(req.params.tagId);
    const response = {
      item: results.rows[0],
    };
    return res.status(200).json(response);
  } catch (err) {
    return res.status(400).json(err);
  }
};

export default {
  vnDetails,
  tagDetails,
};
