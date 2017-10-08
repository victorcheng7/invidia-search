var request = require('request');
var fs = require('fs');
var elasticsearch = require('elasticsearch');
//33473


/* DEFINE ELASTIC_SEARCH */
/*
var client = new elasticsearch.Client({
	host: [
		{
			host: process.env.ELASTIC_HOST,
			auth: process.env.ELASTIC_AUTH,
			protocol: process.env.ELASTIC_PROTOCOL,
			port: process.env.ELASTIC_PORT
		}
	]
});
res = es.search(index='indexname', doc_type='typename', body=doc,scroll='1m')
Then you get a reponse with your matching documents and also an attribute named '_scroll_id'

scrollId = res['_scroll_id']
es.scroll(scroll_id = scrollId, scroll = '1m')

search()

function search(){
  return new Promise((resolve, reject) => {
      toSearch = toSearch.toLowerCase();
      client.search({
        index: 'youtube-video-data-index',
          body: {
            'size' : 10000,
            'query': {
                'match_all' : {}
           }
          }
        },
        function(error, response) {
          if(error){
            console.log("Error in elasticSearch()");
            reject(error);
          }
          //console.log(response);
          resolve(response.hits.hits);
        }
      );
  });
}
*/

request("https://search-video-data-domain-lo5oj6jfkwcejhg6y4mirb75ie.us-west-2.es.amazonaws.com/youtube-video-data-index/_search?size=10000&q=*:*", function (error, response, body) {
  console.log('error:', error);
  console.log('statusCode:', response && response.statusCode);
  var videos = JSON.parse(body).hits.hits;
  var array = [];
  for(var index in videos){
    array.push(JSON.stringify(videos[index]._source));
  }
  writeToOutput(array, './text/nishanthelastic.txt');
});


function fileToJson(file){ //file -> javascript object
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) reject(console.log(err));
			var formattedData = JSON.parse(data);
      resolve(formattedData);
    });
  });
}

fileToJson("./text/nishanthelastic.txt").then((data) => {console.log(data);});

function writeToOutput(data, file){
  fs.writeFile(file || "./text/random.txt",data, function(err) {
      if(err) console.log(err);
  });
}
