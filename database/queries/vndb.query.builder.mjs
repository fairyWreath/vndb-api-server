import { concat } from "lodash";

/*
  SEARCH VN 
  
  RETURNS:
    - VNID
    - IMAGE
    - NAME
    - SOME TAGS
    - SCORE, POPULARITY, playtime...
    - SOME DEVS AND PUBLISHERS
    - NSFW?VIOL flagging

  FILTERS:
      - NAME
      - tag id (with minumum avg score possibly later on) 
      - released year
      - platform
      - NUM RESULTS / PAGE
      - NSFW / VIOLENC FLAGGING

      not really needed
      - vnid = > we are looking for this, so why?
      - (publishers and devs and staff) => for improvement
  
  SORT:
    -POPULARITy
    -SCORE/rating

    prolly not needed for search
    - id? name? released?
*/
export const advancedVnSearchQuery = (params) => {
  let currIndex = 1;
  const queryParams = [];

  let query = `
  WITH cte (vid, min_released, max_released) AS
  (
  SELECT v.id, MIN(r.released), MAX(r.released)
  FROM vndb.releases_vn rv
  JOIN vndb.releases r ON r.id = rv.id
  JOIN vndb.releases_lang rl ON rl.id = r.id
  JOIN vndb.releases_platforms rpl ON rpl.id = rv.id
  JOIN vndb.vn v ON v.id = rv.vid
  --JOIN releases_producers rp ON rp.id = r.id
  WHERE
      r.released <= To_char(CURRENT_TIMESTAMP AT TIME zone 'UTC',
      'YYYYMMDD') ::integer `;

  if (params.search !== undefined) {
    query = query.concat(`
    AND (v.title ~* $${currIndex} OR r.title ~* $${currIndex} OR 
      v.alias ~* $${currIndex} OR v.original ~* $${currIndex})
    `);
    queryParams.push(params.search);
    currIndex++;
  }
  //	  AND rpl.platform = 'psp'
  if (params.languages !== undefined) {
    query = query.concat(`
    AND rl.lang IN (
    `);

    params.languages.forEach((lang, idx) => {
      if (idx > 0) query = query.concat(` , `);
      query = query.concat(` $${currIndex} `);
      currIndex++;
      queryParams.push(lang);
    });

    query = query.concat(` ) `);
  }

  if (params.platforms !== undefined) {
    query = query.concat(`
    AND rpl.platform IN (
    `);

    params.platforms.forEach((plat, idx) => {
      if (idx > 0) query = query.concat(` , `);
      query = query.concat(` $${currIndex} `);
      currIndex++;
      queryParams.push(plat);
    });

    query = query.concat(` ) `);
  }

  if (params.tags !== undefined) {
    query = query.concat(`
      AND v.id IN (
        (
          SELECT v.id
          FROM vndb.vn v
    `);

    params.tags.forEach((tagid) => {
      query = query.concat(`
      INTERSECT
      SELECT tvi.vid
      FROM vndb.tags_vn_inherit tvi
      WHERE (tvi.tag = $${currIndex} OR tvi.tag IN (SELECT vndb.get_child_tags($${currIndex})))
          AND tvi.rating >= 2
      `);
      currIndex++;
      queryParams.push(tagid);
    });

    query = query.concat(`
      )
    )
    `);
  }

  query = query.concat(`
  GROUP BY v.id)
  `);

  query = query.concat(`
  SELECT 
      v.title,
      v.id,
      v.image,
      v.c_popularity AS "popularity",
      Min(r.released)       AS "released",
      Min(cte.min_released) AS "min_released",
      Max(cte.max_released) AS "max_released",
      c_rating              AS "rating",
    CASE
        WHEN v.length = 0 THEN 'Unknown'
        WHEN v.length = 1 THEN '< 2 hours'
        WHEN v.length = 2 THEN '2 - 10 hours'
        WHEN v.length = 3 THEN '10 - 30 hours'
        WHEN v.length = 4 THEN '30 - 50 hours'
        ELSE '> 50 hours'
    END  AS "length"
  FROM   vndb.releases_vn rv
    JOIN vndb.releases r
      ON r.id = rv.id
    JOIN vndb.releases_lang rl
      ON rl.id = r.id
    JOIN vndb.vn v
      ON v.id = rv.vid
    JOIN cte
      ON cte.vid = v.id
    JOIN vndb.images img
      ON v.image = img.id -- nsfw/viol FLAGGING
  WHERE 1 = 1
  `);

  if (params.nsfw !== undefined) {
    if (!params.nsfw) {
      query = query.concat(`
        AND img.c_sexual_avg = 0
      `);
    }
  }

  if (params.released !== undefined) {
    query = query.concat(`
    AND min_released >= $${currIndex} AND min_released < $${currIndex + 1}
    `);
    queryParams.push(params.released * 10000); // 4 0s for date format
    queryParams.push((params.released + 1) * 10000);
    currIndex += 2;
  }

  // cursor pagination
  if (params.last_sort_value !== undefined) {
    const sort_by = params.sort_by;
    query = query.concat(` AND (`);

    let cursor = "";

    if (sort_by === "popularity") {
      cursor = cursor.concat(" c_popularity ");
    } else if (sort_by === "rating") {
      cursor = cursor.concat(" c_rating ");
    } else if (params.sort_by === "min_released") {
      cursor = cursor.concat(" cte.min_released ");
    } else if (sort_by === "max_released") {
      cursor = cursor.concat(" cte.max_released ");
    } else {
      cursor = cursor.concat(" popularity ");
    }

    let operator = "";
    if (params.sort_order === "ascending") {
      operator = operator.concat(` > `);
    } else {
      operator = operator.concat(` < `);
    }

    query = query.concat(` ${cursor} ${operator} $${currIndex}`);
    currIndex++;
    queryParams.push(params.last_sort_value);

    // use params.last_sort_value as unique key, for similar sort values
    if (params.last_sort_vid !== undefined) {
      query = query.concat(`
      OR ( (${cursor} = $${currIndex}) AND ( v.id < $${currIndex + 1}) )
    `);
      currIndex += 2;
      queryParams.push(params.last_sort_value);
      queryParams.push(params.last_sort_vid);
    }

    query = query.concat(" ) ");
  }

  query = query.concat(`
    GROUP BY v.id
    ORDER BY
  `);

  if (params.sort_by !== undefined) {
    if (params.sort_by === "popularity") {
      query = query.concat(" c_popularity ");
    } else if (params.sort_by === "rating") {
      query = query.concat(" c_rating ");
    } else if (params.sort_by === "released") {
      query = query.concat(" released ");
    } else if (params.sort_by === "max_released") {
      query = query.concat(" max_released ");
    } else if (params.sort_by === "min_released") {
      query = query.concat(" min_released ");
    } else {
      query = query.concat(" c_popularity ");
    }

    if (params.sort_order !== undefined) {
      if (params.sort_order === "ascending") {
        query = query.concat(" ASC ");
      } else {
        query = query.concat(" DESC ");
      }
    } else {
      query = query.concat(" DESC ");
    }
  } else {
    // sort by latest released default
    query = query.concat(` c_popularity DESC `);
  }

  // v.id is unique :)
  query = query.concat(`NULLS LAST, v.id DESC`);

  // max 50 results
  if (
    params.results !== undefined &&
    params.results <= 50 &&
    params.results > 0
  ) {
    query = query.concat(` LIMIT $${currIndex} `);
    queryParams.push(params.results);
    currIndex++;
  } else {
    query = query.concat(` LIMIT 15 `);
  }

  return {
    query: query,
    queryParams: queryParams,
  };
};
