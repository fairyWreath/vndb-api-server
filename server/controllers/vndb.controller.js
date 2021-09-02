import vndb from "../../database/queries/vndb.queries";
import {
  parseImageData,
  parseProducerData,
  getDevelopersFromReleases,
  getPublishersFromReleases,
} from "../helpers/vndb.helpers";

export const vnDetails = async (req, res) => {
  try {
    const vid = req.params.vnId;
    const vns = await vndb.getVnDetails(vid);
    const tags = await vndb.getVnTags(vid);
    const play_time = await vndb.getVnLength(vid);
    const staff = await vndb.getVnStaff(vid);
    const chars = await vndb.getVnCharacters(vid);
    const relations = await vndb.getVnRelations(vid);
    const releases = await vndb.getVnReleases(vid);

    const vn = vns.rows[0];

    // node pg returns numeric as strings
    vn.tags = tags.rows.map((tag) => {
      tag.score = parseFloat(tag.score);
      return tag;
    });

    vn.tags = vn.tags.filter((tag) => {
      return tag.score >= 0;
    });

    vn.play_time = play_time.rows[0];
    vn.staff = staff.rows;
    vn.characters = chars.rows; // need to deal with doubles
    vn.relations = relations.rows;
    vn.releases = releases.rows;

    // parse image array aggs
    vn.image = parseImageData(vn.image_data[0]);
    delete vn.image_data;
    vn.screenshots = vn.screenshots_data.map((data) => parseImageData(data));
    delete vn.screenshots_data;

    // parse producer data
    vn.releases.forEach((release) => {
      release.producers = release.producers.map((data) =>
        parseProducerData(data)
      );
    });

    vn.developers = getDevelopersFromReleases(vn.releases);
    vn.publishers = getPublishersFromReleases(vn.releases);

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
