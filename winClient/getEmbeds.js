
exports.checkResponse = function(url, callback) {
  var http = require("http");
  var request = require('request');

  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      callback(1);
    } else {
      callback(4);
    }
  });
};

exports.getEmbeds = function(url, screwu) {
  var http = require("http");
  var request = require('request');

  request(url, function (error, response, body) {
    if (!error && response.statusCode == 200) {

      var headers = response.headers;

      if(headers['x-frame-options'] === undefined) {
        console.log("no headers");
        screwu(0, null);

      } else {
        console.log("xframeheaders", headers);

        body = body.replace("<head>", "<head><base href='"+url+"'>");      
        screwu(1, body);

      }
    } else {
      screwu(2, "404.html");
      console.log("error, fallback, go to search");
    }

  });
};