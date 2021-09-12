import * as db from "../pg.pool";
import { advancedVnSearchQuery } from "./vndb.query.builder.mjs";

// get Vn details from vn id
const getVnDetails = async (id) => {
  try {
    const query = `
    WITH CTE(MIN_RELEASED,

      VID) AS
    (SELECT MIN(R.RELEASED) AS MIN_RELEASED,
    RV.VID
    FROM VNDB.RELEASES_VN RV
    INNER JOIN VNDB.RELEASES R ON RV.ID = R.ID
    WHERE RV.VID = $1
    GROUP BY RV.VID)
    SELECT VN.ID,
    OLANG,
    IMAGE,
    L_WIKIDATA,
    VN.C_VOTECOUNT,
    C_POPULARITY,
    C_RATING,
    LENGTH,
    VN.TITLE,
    VN.ORIGINAL,
    ALIAS,
    L_RENAI,
    "desc",
    C_AVERAGE,
    CTE.MIN_RELEASED,
    ARRAY_AGG(IMAGE || ' ' || IMAGES.C_SEXUAL_AVG || ' ' || IMAGES.C_VIOLENCE_AVG) AS IMAGE_DATA
    FROM VNDB.VN
    JOIN CTE ON VN.ID = CTE.VID
    LEFT JOIN VNDB.IMAGES ON IMAGES.ID = IMAGE
    LEFT JOIN VNDB.VN_SCREENSHOTS ON VN.ID = VN_SCREENSHOTS.ID
    GROUP BY VN.ID, CTE.MIN_RELEASED
`;

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

const getVnScreenshotData = async (vid) => {
  try {
    const query = `
    SELECT 
    ARRAY_AGG(SCR || ' ' || IMAGES.C_SEXUAL_AVG || ' ' || IMAGES.C_VIOLENCE_AVG) AS SCREENSHOTS_DATA
    FROM VNDB.VN
    INNER JOIN VNDB.VN_SCREENSHOTS ON VN.ID = VN_SCREENSHOTS.ID
    INNER JOIN VNDB.IMAGES ON VN_SCREENSHOTS.SCR = IMAGES.ID
  	WHERE vn.id = $1
    GROUP BY VN.ID`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const getVnTags = async (vid) => {
  try {
    const query = `SELECT tag, AVG(vote) AS score, COUNT(tags_vn) as num_votes, AVG(spoiler) AS spoiler, name, parent
    FROM vndb.tags_vn 
    INNER JOIN vndb.tags  ON tags_vn.tag = tags.id
    INNER JOIN vndb.tags_parents ON tags.id = tags_parents.id
    WHERE tags_vn.vid=$1
    AND tags_parents.main = true
    GROUP BY tag, name, parent
  	ORDER BY num_votes DESC`;

    // GROUP BY tag, name, parent ORDER BY AVG(vote) DESC;`;

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
    const query = `
    SELECT DISTINCT  vn_seiyuu.aid, chars_vns.id, role, spoil,
    staff_alias.name as seiyuu_name, staff_alias.original as orig_seiyuu_name,
    chars.name, chars.gender, chars.image, chars.main_spoil
    FROM vndb.chars_vns
	  INNER JOIN vndb.chars ON chars_vns.id = chars.id
    LEFT JOIN vndb.vn_seiyuu ON chars_vns.id = vn_seiyuu.cid AND chars_vns.vid = vn_seiyuu.id 
    LEFT JOIN vndb.staff_alias ON vn_seiyuu.aid = staff_alias.aid
    WHERE chars_vns.vid=$1`;

    const results = await db.query(query, [vid]);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

const getCharacterTraitsDetails = async (cids) => {
  try {
    let idx = 1;
    const cidPlaceHolders = cids.map((cid) => {
      return `$${idx++}`;
    });

    const query = `
    SELECT 

    c.image, c.gender, c.spoil_gender, c.bloodt, c.cup_size, c.main, 
    c.s_bust, c.s_waist, c.s_hip, c.b_month, 
    c.b_day, c.height, c.weight, c.main_spoil, c.age, c.name, c.original, c.alias, c."desc",

    ARRAY_AGG(t.name || ' ' ||ct.spoil || ' ' ||  t.sexual || ' ' || t."group")

    FROM vndb.chars_traits ct
      INNER JOIN vndb.chars c ON c.id = ct.id
      INNER JOIN vndb.traits t ON t.id = ct.tid
      WHERE c.id IN (${cidPlaceHolders.join(",")})
      
    GROUP BY c.id
    `;

    const results = await db.query(query, cids);
    return results;
  } catch (err) {
    throw {
      error: err,
    };
  }
};

// get vn releases from vid
const getVnReleases = async (vid) => {
  // mrt = catridge
  try {
    const query = `
    SELECT releases_vn.id,
    minage, voiced, freeware, doujin, uncensored, official, title, ani_story,
    releases.original, releases.website, releases.type, released,
    ARRAY_AGG(releases_lang.lang) as languages,
    ARRAY_AGG(platform) as platforms,
	ARRAY_AGG(medium) as mediums,
    ARRAY_AGG(pid || '~' || developer || '~' || publisher || '~' || producers.name || '~' || producers.lang) as producers
    FROM vndb.releases_vn
    INNER JOIN vndb.releases ON releases_vn.id = releases.id
    INNER JOIN vndb.releases_lang ON releases_vn.id = releases_lang.id
	LEFT JOIN vndb.releases_media ON releases.id = releases_media.id
    INNER JOIN vndb.releases_platforms ON releases_vn.id = releases_platforms.id
    INNER JOIN vndb.releases_producers ON releases_vn.id = releases_producers.id
    INNER JOIN vndb.producers ON releases_producers.pid = producers.id
    WHERE releases_vn.vid = $1
    GROUP BY releases_vn.id, releases.id
    ORDER BY released ASC
    `;

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

  // console.log(query);
  // console.log(queryParams);

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
  getVnScreenshotData,
  getVnTags,
  getVnLength,
  getVnRelations,
  getVnStaff,
  getVnCharacters,
  getVnReleases,
  searchVn,
  getCharacterTraitsDetails,
};
