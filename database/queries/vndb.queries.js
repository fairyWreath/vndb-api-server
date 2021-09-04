import * as db from "../pg.pool";
import { advancedVnSearchQuery } from "./vndb.query.builder.mjs";

// get Vn details from vn id
const getVnDetails = async (id) => {
  try {
    const query = `SELECT vn.id, olang, image, l_wikidata, vn.c_votecount, c_popularity, c_rating, length, title, original, alias, l_renai, 
    "desc", c_average,
    ARRAY_AGG(image || ' ' || c_sexual_avg || ' ' || c_violence_avg) as image_data,
    ARRAY_AGG(scr || ' ' || c_sexual_avg || ' ' || c_violence_avg) as screenshots_data
    FROM vndb.vn 
    INNER JOIN vndb.images ON vn.image = images.id
    INNER JOIN vndb.vn_screenshots ON vn.id = vn_screenshots.id
    WHERE vn.id=$1
    GROUP BY vn.id`;

    const results = await db.query(query, [id]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// get tag details from tag id, need parent and VNS here
const getTagDetails = async (id) => {
  try {
    const query = `SELECT id, cat, defaultspoil, searchable, applicable, name, description, alias
    FROM vndb.tags WHERE id=$1;`;

    const results = await db.query(query, [id]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const getVnTags = async (vid) => {
  try {
    const query = `SELECT tag, AVG(vote) AS score, AVG(spoiler) AS spoiler, name, parent
    FROM vndb.tags_vn 
    INNER JOIN vndb.tags  ON tags_vn.tag = tags.id
    INNER JOIN vndb.tags_parents ON tags.id = tags_parents.id
    WHERE tags_vn.vid=$1 AND tags_parents.main = true
    GROUP BY tag, name, parent ORDER BY AVG(vote) DESC;`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// get average vn length
const getVnLength = async (vid) => {
  try {
    const query = `SELECT AVG(length) as length, AVG(speed) as SPEED
    FROM vndb.vn_length_votes
    WHERE vid=$1;`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const getVnRelations = async (vid) => {
  try {
    const query = `SELECT vid, relation, official, image, title, original
    FROM vndb.vn_relations
    INNER JOIN vndb.vn ON vn_relations.vid = vn.id
    WHERE vn_relations.id=$1`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const getVnStaff = async (vid) => {
  try {
    const query = `SELECT vn_staff.aid, vn_staff.note, role, staff_alias.id, name, original
    FROM vndb.vn_staff
    INNER JOIN vndb.staff_alias ON vn_staff.aid = staff_alias.aid
    WHERE vn_staff.id=$1;`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// can improve this for more complete character details
// there are 4x duplicates in chars_vns, neeed to use DISTINC for now, will clean db later
const getVnCharacters = async (vid) => {
  try {
    const query = `SELECT DISTINCT vn_seiyuu.id , chars_vns.id, role, spoil,
    staff_alias.name as seiyuu_name, staff_alias.original as orig_seiyuu_name,
    chars.name, chars.gender, chars.image, chars.main_spoil
    FROM vndb.chars_vns
    INNER JOIN vndb.vn_seiyuu ON chars_vns.id = vn_seiyuu.cid AND chars_vns.vid = vn_seiyuu.id
    INNER JOIN vndb.staff_alias ON vn_seiyuu.aid = staff_alias.aid
    INNER JOIN vndb.chars ON chars_vns.id = chars.id
    WHERE chars_vns.vid=$1`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// get vn releases from vid
const getVnReleases = async (vid) => {
  try {
    const query = `SELECT releases_vn.id,
    minage, voiced, freeware, doujin, uncensored, official, title, releases.original, releases.website, releases.type, released,
    ARRAY_AGG(releases_lang.lang) as languages,
    ARRAY_AGG(platform) as platforms,
    ARRAY_AGG(pid || '~' || developer || '~' || publisher || '~' || producers.name || '~' || producers.lang) as producers
    FROM vndb.releases_vn
    INNER JOIN vndb.releases ON releases_vn.id = releases.id
    INNER JOIN vndb.releases_lang ON releases_vn.id = releases_lang.id
    INNER JOIN vndb.releases_platforms ON releases_vn.id = releases_platforms.id
    INNER JOIN vndb.releases_producers ON releases_vn.id = releases_producers.id
    INNER JOIN vndb.producers ON releases_producers.pid = producers.id
    WHERE releases_vn.vid = $1
    GROUP BY releases_vn.id, minage, voiced, freeware, doujin, uncensored,
    official, title, releases.original, releases.website, releases.type, released
    ORDER BY released ASC`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const searchVn = async (params) => {
  const { query, queryParams } = advancedVnSearchQuery(params);

  console.log(query);

  try {
    const results = await db.query(query, queryParams);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

export default {
  getVnDetails,
  getTagDetails,
  getVnTags,
  getVnLength,
  getVnRelations,
  getVnStaff,
  getVnCharacters,
  getVnReleases,
  searchVn,
};
