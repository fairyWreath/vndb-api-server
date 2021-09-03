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
  JOIN vndb.vn v ON v.id = rv.vid
  --JOIN releases_producers rp ON rp.id = r.id
  WHERE
      r.released <= To_char(CURRENT_TIMESTAMP AT TIME zone 'UTC',
      'YYYYMMDD') ::integer `;

  if (params.released !== undefined) {
    query = query.concat(`
    AND r.released >= $${currIndex} AND r.released < $${currIndex + 1}
    `);
    queryParams.push(params.releaed * 10000); // 4 0s for date format
    queryParams.push((params.released + 1) * 10000);
    currIndex += 2;
  }

  if (params.search !== undefined) {
    query = query.concat(`
    AND (v.title ~* $${currIndex} OR r.title ~* $${currIndex + 1} OR 
      v.alias ~* $${currIndex + 2} OR v.original ~* $${currIndex + 3})
    `);
    queryParams.push(params.search);
    queryParams.push(params.search);
    queryParams.push(params.search);
    queryParams.push(params.search);
    currIndex += 4;
  }

  if (params.tags !== undefined) {
    query = query.concat(`
      AND v.id IN (
        (
          SELECT v.id
          FROM vndb.vn v
    `);

    // parent only for now
    params.tags.forEach((tagid) => {
      query = query.concat(`
        INTERSECT
        SELECT v.id
        FROM vndb.tags_vn tv
        JOIN vndb.vn v ON v.id = tv.vid
        WHERE tv.tag = $${currIndex}
        GROUP BY v.id
        HAVING avg(tv.vote) >= 2
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
      v.c_popularity,
      Min(r.released)       AS "released",
      Min(cte.min_released) AS "min_released",
      Max(cte.max_released) AS "max_released",
      c_rating
      || ' ('
      || v.c_votecount
      || ')'                AS "rating",
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

  // cursor pagination
  if (params.last_sort_value !== undefined) {
    const sort_by = params.sort_by;
    query = query.concat(` AND (`);

    let cursor = "";

    if (sort_by === "popularity") {
      cursor = cursor.concat(" c_popularity ");
    } else if (sort_by === "rating") {
      cursor = cursor.concat(" c_rating ");
    } else if (sort_by === "max_released") {
      cursor = cursor.concat(" cte.max_released ");
    } else {
      cursor = cursor.concat(" cte.max_released "); // default max_released
    }

    let operator = "";
    if (params.sort_order === "acsending") {
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
    } else if (params.sort_by === "max_released") {
      query = query.concat(" MAX(cte.max_released) ");
    } else {
      query = query.concat(" MAX(cte.max_released) ");
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

const queryfull = `
  WITH cte (vid, min_released, max_released) AS
  (
  SELECT v.id, MIN(r.released), MAX(r.released)
  FROM vndb.releases_vn rv
  JOIN vndb.releases r ON r.id = rv.id
  JOIN vndb.releases_lang rl ON rl.id = r.id
  JOIN vndb.vn v ON v.id = rv.vid
  --JOIN releases_producers rp ON rp.id = r.id
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
