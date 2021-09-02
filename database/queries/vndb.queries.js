import * as db from "../pg.pool";

// get Vn details from vn id
const getVnDetails = async (id) => {
  try {
    const query = `SELECT id, olang, image, l_wikidata, c_votecount, c_popularity, c_rating, length, title, original, alias, l_renai, "desc", c_average
    FROM vndb.vn WHERE id=$1;`;

    const results = await db.query(query, [id]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// get tag details from tag id
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
    const query = `SELECT vn_staff.aid, role, staff_alias.id, name, original
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
const getVnCharacters = async (vid) => {
  try {
    const query = `SELECT vn_seiyuu.id , chars_vns.id, role, spoil,
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

export default {
  getVnDetails,
  getTagDetails,
  getVnTags,
  getVnLength,
  getVnRelations,
  getVnStaff,
  getVnCharacters,
};
