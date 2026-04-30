const upstream = require('@expo/metro-config/build/babel-transformer');

module.exports.transform = function (params) {
  if (params.src && params.src.charCodeAt(0) === 0xFEFF) {
    params = { ...params, src: params.src.slice(1) };
  }
  return upstream.transform(params);
};
