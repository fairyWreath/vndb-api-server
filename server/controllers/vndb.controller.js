import vndb from "../../database/queries/vndb.queries";
import {
  parseImageData,
  parseProducerData,
  getDevelopersFromReleases,
  getPublishersFromReleases,
} from "../helpers/vndb.helpers";

import queryString from "query-string";

const vnDetails = async (req, res) => {
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

const vnSearch = async (req, res) => {
  try {
    // parse non-string queries to their respsective types
    if (req.query.tags !== undefined && !Array.isArray(req.query.tags)) {
      req.query.tags = [req.query.tags];
    }

    if (req.query.nsfw !== undefined) {
      if (req.query.nsfw === "false") {
        req.query.nsfw = false;
      } else {
        req.query.nsfw = true;
      }
    }

    if (req.query.results !== undefined) {
      req.query.results = parseInt(req.query.results);
    }

    if (req.query.last_sort_value !== undefined) {
      req.query.last_sort_value = parseInt(req.query.last_sort_value);
    }

    console.log(req.query);
    // example param
    // req.params = {
    //   search: "haru-hen",
    //   tags: ["g1986"],
    //   nsfw: false,
    //   sort_by: "max_released",
    //   sort_order: "descending",
    //   results: 15,
    //   last_sort_value: 20210805,
    //   // last_sort_vid: "v25920",
    // };

    const results = await vndb.searchVn(req.query);
    const vns = results.rows.map((vn) => {
      vn.image = parseImageData(vn.image);
      return vn;
    });

    const response = {
      items: vns,
    };
    return res.status(200).json(response);
  } catch (err) {
    return res.status(400).json(err);
  }
};

export default {
  vnDetails,
  tagDetails,
  vnSearch,
};
