import * as db from "../pg.pool";
import { advancedVnSearchQuery } from "./vndb.query.builder.mjs";

// get Vn details from vn id
const getVnDetails = async (id) => {
  try {
    const query = `
    with cte(min_released, vid) AS (
      SELECT MIN(r.released) as min_released, rv.vid
      FROM vndb.releases_vn rv
      INNER JOIN vndb.releases r ON rv.id = r.id
      WHERE rv.vid =$1
      GROUP BY rv.vid
    )
    
    SELECT vn.id, olang, image, l_wikidata, vn.c_votecount, c_popularity, c_rating, length, vn.title, 
        vn.original, alias, l_renai, "desc", c_average, cte.min_released,
        ARRAY_AGG(scr || ' ' || c_sexual_avg || ' ' || c_violence_avg) as screenshots_data,
        ARRAY_AGG(image || ' ' || c_sexual_avg || ' ' || c_violence_avg) as image_data
        FROM vndb.vn 
          JOIN cte ON vn.id = cte.vid
          INNER JOIN vndb.images ON vn.image = images.id
          INNER JOIN vndb.vn_screenshots ON vn.id = vn_screenshots.id
          GROUP BY vn.id, cte.min_released
    
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
  getCharacterTraitsDetails,
};

const queryfull = `
WITH cte (vid, min_released, max_released) AS
(
SELECT v.id, MIN(r.released), MAX(r.released)
FROM vndb.releases_vn rv
JOIN vndb.releases r ON r.id = rv.id
JOIN vndb.releases_lang rl ON rl.id = r.id
JOIN vndb.vn v ON v.id = rv.vid
// JOIN releases_producers rp ON rp.id = r.id
WHERE
    r.released > 0 --"Released after"
    AND r.released <= to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYYMMDD')::INTEGER --"Released before". As is, checks if it's "Already released".
    --AND (v.title ~* 'Kyonyuu' OR r.title ~* 'Kyonyuu') --String to search in VN/Release title. No normalization is done. Use = instead of ~* if you want to make an exact matching. For case sensitive match, use ~
    --AND v.length = '3' --0 -> Unknown, 1 -> Less than 2 hours, 2 -> 2-10 hours, 3 -> 10-30 hours, 4 -> 30-50 hours, 5 ->More than 50 hours
    AND rl.lang = 'en' --Language filter.
    AND r.type = 'complete' --Release type. Can be also 'partial' or 'trial'.
    AND (r.minage = '18' OR r.minage = '-1') --Age rating. -1 stands for unknown.
    --AND r.uncensored = TRUE
    --AND r.patch = FALSE --TRUE for patch, FALSE for standalone.
    --AND r.freeware = FALSE --TRUE for freeware, FALSE for non-freeware.
    --AND r.doujin = FALSE --TRUE for doujin, FALSE for commercial.
    --AND r.voiced != '1' --Voice filter. 0 -> Unknown, 1 -> Not voiced, 2 -> Only ero scenes are voiced, 3 -> Partially voiced, 4->Fully voiced
    --AND r.resolution = '1920x1080' 
    --AND pid != '3392' AND pid != '6286' --Producer filter. As is, excludes companies known for MTLing VNs. To use this, you will have to uncomment "JOIN releases_producers rp ON rp.id = r.id" above.
    --AND r.engine = 'KiriKiri' --Engine filter.
  AND v.id IN (
  --"Include" section for trags and traits.
    (
      SELECT v.id
      FROM vndb.vn v
      
      
      INTERSECT
      
      --Includes VNs that have Fantasy and/or its child tags with the tag score of 2 or more.
      --Change tv.tag to tag id you want.
      --You can simply add additional tag/trait filters with the same INTERSECT SELECT FROM... structure.
      
      SELECT tvi.vid
      FROM vndb.tags_vn_inherit tvi
      WHERE (tvi.tag = 'g1986' OR tvi.tag IN (SELECT vndb.get_child_tags('g1986')))
          AND tvi.rating >= 2
      
      
      
      INTERSECT
      
      --Parent only search example with additional tag score criterion.
      SELECT v.id
      FROM vndb.tags_vn tv
      JOIN vndb.vn v ON v.id = tv.vid
      WHERE tv.tag = '105'
      GROUP BY v.id
      HAVING avg(tv.vote) >= 2
      

      
            INTERSECT
            
            --Includes VNs where a tsundere (or one of its child trait) girl is a main character. Does not have the problem mentioned in t12507.23
            --If you don't want to include its child tags, simply remove the "OR ct.tid IN (SELECT get_child_traits(217))" part.
      SELECT v.id
      FROM vndb.chars_vns cv
            JOIN vndb.chars c ON c.id = cv.id
            JOIN vndb.vn v ON v.id = cv.vid
            JOIN vndb.chars_traits ct ON ct.id = c.id
      WHERE
          cv.role = 'primary'
          AND c.gender = 'f'
          AND (ct.tid = 'g217' OR ct.tid IN (SELECT vndb.get_child_traits('g217')))
      GROUP BY v.id
      
    )
    
    EXCEPT
    --"Exclude" section.
    (	
      --Excludes VNs where protagonist is a homosexual male. As is, this kind of filtering cannot be done through VNDB.
      SELECT v.id
      FROM vndb.chars_vns cv
            JOIN vndb.chars c ON c.id = cv.id
            JOIN vndb.vn v ON v.id = cv.vid
            JOIN vndb.chars_traits ct ON ct.id = c.id
      WHERE
          cv.role = 'main'
          AND c.gender = 'm'
          AND (ct.tid = '748' OR ct.tid = '2842')
      GROUP BY v.id
    )
  )
GROUP BY v.id
)
SELECT v.title as "Title", 'https://vndb.org/' || v.id AS "URL", MIN(r.released) AS "Released", MIN(cte.min_released) AS "Released (Oldest)", MAX(cte.max_released) AS "Released (Latest)", c_rating || ' (' || c_votecount || ')' as "Rating",
    CASE
        WHEN v.length = 0 THEN 'Unknown'
        WHEN v.length = 1 THEN '< 2 hours'
        WHEN v.length = 2 THEN '2 - 10 hours'
        WHEN v.length = 3 THEN '10 - 30 hours'
        WHEN v.length = 4 THEN '30 - 50 hours'
        ELSE '> 50 hours'
    END AS "Length"
FROM vndb.releases_vn rv
JOIN vndb.releases r ON r.id = rv.id
JOIN vndb.releases_lang rl ON rl.id = r.id
JOIN vndb.vn v ON v.id = rv.vid
JOIN cte ON cte.vid = v.id

WHERE
    --Original language.
    --If you don't want to filter with original language, then simply comment this section.
    ---- By yorhel <https://vndb.org/t12800.4>
    v.id IN(
        SELECT rv.vid
        FROM vndb.releases_lang rl
        JOIN vndb.releases_vn rv ON rv.id = rl.id
        JOIN vndb.releases r ON r.id = rl.id
        WHERE lang = 'ja' -- The original language you want
            AND NOT EXISTS(
                SELECT 1 FROM vndb.releases_vn irv JOIN vndb.releases ir ON ir.id = irv.id
                WHERE irv.vid = rv.vid AND ir.released < r.released)
                )
    ----

    --AND cte.max_released > '20190000'
    --AND cte.min_released > '20190000'
    --AND r.voiced != '1' --Checks if any release is not 'not voiced'.
    --AND r.resolution = '1920x1080' --Checks if any realease has the given resolution
    --AND r.freeware = FALSE --Checks if any release is non-freeware.
    --AND r.doujin = FALSE --Checks if any release is commercial.

GROUP BY v.id
ORDER BY MAX(cte.max_released) DESC, c_rating DESC NULLS LAST --Sort by Released (Latest)
--ORDER BY MIN(cte.min_released) DESC, c_rating DESC NULLS LAST --Sort by Released (Oldest)
--ORDER BY MIN(r.released) DESC, c_rating DESC NULLS LAST --Sort by Released
--ORDER BY c_rating DESC NULLS LAST, c_votecount --Sort by Rating`;
