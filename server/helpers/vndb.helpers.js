// get from vndb cloud hosting
const BASE_IMAGE_URL = `https://s2.vndb.org`;
const IMAGE_FORMAT = `.jpg`;

export const getImageUrlFromId = (imgId) => {
  const group = imgId.substring(0, 2);
  const fullNum = imgId.substring(2, imgId.length);
  const num = imgId.substring(imgId.length - 2, imgId.length);

  return `${BASE_IMAGE_URL}/${group}/${num}/${fullNum}${IMAGE_FORMAT}`;
};

// format of string imgid s_avg v_avg, for vn details
export const parseImageData = (data) => {
  const imgData = data.split(" ");
  const image_src = getImageUrlFromId(imgData[0]);
  return {
    src: image_src,
    nsfw: imgData[1],
    violence: imgData[2],
  };
};

// parse producer data for vn details
export const parseProducerData = (data) => {
  // format - producer id, developer, publisher, producer name, prod lang
  const prodData = data.split("~");
  return {
    id: prodData[0],
    developer: prodData[1],
    publisher: prodData[2],
    name: prodData[3],
    language: prodData[4],
  };
};

// get all developers from (parsed) releases
export const getDevelopersFromReleases = (releases) => {
  const prodNameSet = new Set();
  releases.forEach((release) => {
    release.producers.forEach((producer) => {
      if (!prodNameSet.has(producer.name)) {
        prodNameSet.add(producer.name);
      }
    });
  });

  return Array.from(prodNameSet);
};

export const getPublishersFromReleases = (releases) => {
  const prodNameSet = new Set();

  // need map for better implementation
  let result = [];
  releases.forEach((release) => {
    release.producers.forEach((producer) => {
      if (!prodNameSet.has(producer.id)) {
        prodNameSet.add(producer.id);
        result.push({
          id: producer.id,
          name: producer.name,
          languages: release.languages,
        });
      }
    });
  });

  return result;
};

export const getLanguagesFromReleases = (releases) => {
  const langSet = new Set();

  releases.forEach((release) => {
    release.languages.forEach((lang) => langSet.add(lang));
  });

  return Array.from(langSet);
};

export const getPlatformsFromReleases = (releases) => {
  const platSet = new Set();

  releases.forEach((release) => {
    release.platforms.forEach((plat) => platSet.add(plat));
  });

  return Array.from(platSet);
};
