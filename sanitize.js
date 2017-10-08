var fs = require('fs');
var path = require('path');
var Fuse = require('fuse.js');
var h2p = require('html2plaintext');
var dotenv = require('dotenv');
dotenv.config();
var elasticsearch = require('elasticsearch');

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
});*/
var client = new elasticsearch.Client({
	//host: 'arn:aws:es:us-east-2:379689518484:domain/invidia',
	host: 'https://search-video-data-domain-lo5oj6jfkwcejhg6y4mirb75ie.us-west-2.es.amazonaws.com',
  log: []
});

function loopThroughFiles(){
	var moveFrom = "./dump/reactjs";
	var toPath = "./elasticsearch";
	fs.readdir( moveFrom, function( err, files ) {
        if( err ) {
            console.error( "Could not list the directory.", err );
            process.exit( 1 );
        }

				var counter = 0;
        files.forEach( function( file, index ) {
                // Make one pass and make the file complete
                var fromPath = path.join( moveFrom, file );
								var topath = path.join (toPath, file);
                fs.stat( fromPath, function( error, stat ) {
                    if( error ) {
                        console.error( "Error stating file.", error );
                        return;
                    }

										console.log("Sanitizing video", counter++);
										sanitize(fromPath, toPath);

                    if( stat.isFile() )
                        console.log( "'%s' is a file.", fromPath );

                } );
        } );
	} );
}

function fileToJson(file){ //file -> javascript object
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) reject(console.log(err));
			var formattedData = JSON.parse(data);
      resolve(formattedData);
    });
  });
}

function writeToOutput(data, file){
  fs.writeFile(file || "./text/random.txt", JSON.stringify(data), function(err) {
      if(err) console.log(err);
  });
}

async function sanitize(file, outputFile){
  const b = await fileToJson(file);
  console.log("Sanitizing text...");
  try{
    const cleanedUpData = await sanitizeText(b);
    writeToOutput(cleanedUpData, outputFile);
  }
  catch(err){
    console.log("Error in sanitize()");
    console.log(err);
  }
}

async function searchFuse(toSearch){
    try{
      const b = await fileToJson('./text/sanitizedresult.txt');
      console.log("Doing search on sanitized text...");
      const searchResults = await fuseSearch(b, toSearch);
      console.log("Sorting results...");
      await sortResults(searchResults);
      console.log(searchResults);
    }
    catch(error){
      console.log(error);
    }
}

async function searchElastic(toSearch){
  console.log("Attempting to search on elasticSearch...");
  await connectToClient();
  const searchResults = await elasticSearch(toSearch);
  console.log("Returning", searchResults.length, "results");
  console.log("Sorting results...");
  await sortResults(searchResults);
  writeToOutput(searchResults, "./text/elasticresult.txt");
  //console.log("Printing first 2 results...");
  //console.log(searchResults[0], searchResults[1]);
}

loopThroughFiles();
//sanitize("./text/nishanthelastic.txt");
//searchElastic("react");
//searchFuse("we're going");


function secondsToTimeStamp(seconds){
    var hours = Math.floor(seconds / 3600);
    var minutes = Math.floor((seconds % 3600) / 60);
    var seconds = Math.floor(seconds % 3600 % 60);
    if(seconds < 10) return hours+":"+minutes+":0"+seconds;
    return hours+":"+minutes+":"+seconds;
}

function sanitizeText(data){ // Output Sanitized Text
    var result = [];
    for(video in data){//  For every video
      var transcriptCues = data[video]; //Object.assign({}, data[video]);
      //var transcript = "";
      var index = 0;
      var milliseconds = 0;
      var aliasVideo = transcriptCues;
      for(cue in aliasVideo["cues"]){ //  for every cue
        var aliasCue = aliasVideo["cues"][cue];
        aliasCue["timestamp"] = secondsToTimeStamp(aliasCue["timestamp"]); // NOTE Set timestamp
        var cleanText = h2p(aliasCue["text"]); // NOTE take out HTML tags, add extra space, take out \
        cleanText = cleanText.replace(/\\"/g, '"');
        //cleanText += " ";
        aliasCue["text"] = cleanText;
        //transcript += cleanText;
				/*
        if(cue == 0) aliasCue["startIndex"] = transcript.length - cleanText.length;
        else if(cue != 0) aliasCue["startIndex"] = transcript.length - cleanText.length + 1;// NOTE set start index
        aliasCue["endIndex"] = transcript.length - 1; // NOTE set end index*/
      }
      //aliasVideo["transcript"] = transcript // NOTE define entire transcript string
      var aliasStats = aliasVideo["info"]["statistics"];
      aliasVideo["relevantScore"] = (aliasStats["likeCount"] - aliasStats["dislikeCount"])/aliasStats["viewCount"];
      result.push(transcriptCues);
    }
    return new Promise((resolve, rejects)=> {
      resolve(result);
    });
}

function median(values) {
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if(values.length % 2) return values[half];
    return (values[half-1] + values[half]) / 2.0;
}

function returnMedianViewCount(result){
  let viewCountArray = []; //NOTE make array of viewCounts and pass into median() to return median
  for(video in result){
    viewCountArray.push(result[video]["_source"]["info"]["statistics"]["viewCount"]); //TODO error cannot read viewCount of undefined
  }
  return median(viewCountArray);
}

function sortResults(result){
  return new Promise((resolve, reject) => {
    const checkResult = Object.assign({}, result);
    result.sort( function(a,b){ return b["_source"]["relevantScore"]-a["_source"]["relevantScore"]}); //NOTE sort based on relevant scores
    result === checkResult ? console.log(true) : console.log(false);
    var median = returnMedianViewCount(result);
    var top50 = [];
    var bottom50 = [];
    for(video in result){
      var viewCount = result[video]["_source"]["info"]["statistics"]["viewCount"];
      if(viewCount >= median) top50.push(result[video]);
      else bottom50.push(result[video]);
    }
    resolve();
  })
}

function fuseSearch(searchArray, toSearch){
    toSearch = toSearch.toLowerCase();
    var options = {
      shouldSort: true,
      threshold: 0.3,
      location: 0,
      distance: 0,
      maxPatternLength: 65,
      minMatchCharLength: 1,
      keys: [
        "cues.text" //TODO try search with entire transcript and check speed + accuracy
      ]
    };
    var fuse = new Fuse(searchArray, options);
    var results = fuse.search(toSearch);
    console.log(results.length, "results");
    return new Promise((resolve, reject) => {
      resolve(results);
    })
}

function elasticSearch(toSearch){
  return new Promise((resolve, reject) => {
      toSearch = toSearch.toLowerCase();
      client.search({
        index: 'youtube-video-data-index',
          body: {
            query: {
              match: {
                "transcript": toSearch
              }
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

function connectToClient() {
  return new Promise((resolve, reject) => {
    client.ping({
      requestTimeout: 30000,
    }, function (error) {
      if (error) {
        console.error('Elasticsearch is down!');
        reject(error);
      } else {
        console.log('Elasticsearch cluster conneted.');
        resolve();
      }
    });
  });
}

/*
TODO - Test query for highlighting on transcript

/* extra
//console.log(transcriptCues[transcript]["cues"][cue]["text"]);
//let temp = transcriptCues[transcript]["cues"][cue]["text"];
//transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "").replace('&#39;'/g, "'");
//transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "");
//console.log(transcriptCues[transcript]["cues"][cue]["text"]);*/
