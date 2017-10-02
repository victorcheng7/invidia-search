var fs = require('fs');
var Fuse = require('fuse.js');
var h2p = require('html2plaintext');

function fileToJson(file){ //file -> javascript object
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) reject(console.log(err));
      writeToOutput(JSON.parse(data));
      resolve(JSON.parse(data));
    });
  });
}

function writeToOutput(data){
  fs.writeFile("./output.txt", JSON.stringify(data), function(err) {
      if(err) console.log(err);
  });
}

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
      var transcriptCues = Object.assign({}, data[video]);
      var transcript = "";
      var index = 0;
      var milliseconds = 0;
      var aliasVideo = transcriptCues;
      for(cue in aliasVideo["cues"]){ //  for every cue
        var aliasCue = aliasVideo["cues"][cue];
        aliasCue["timestamp"] = secondsToTimeStamp(aliasCue["timestamp"]); // NOTE Set timestamp
        //milliseconds += parseInt(aliasCue["duration"]);
        var cleanText = h2p(aliasCue["text"]); // NOTE take out HTML tags, add extra space, take out \
        cleanText = cleanText.replace(/\\"/g, '"');
        //cleanText = cleanText.replace(/\\\\/g, '');
        cleanText += " ";
        aliasCue["text"] = cleanText;
        //console.log(transcriptCues[transcript]["cues"][cue]["text"]);
        //let temp = transcriptCues[transcript]["cues"][cue]["text"];
        //transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "").replace('&#39;'/g, "'");
        //transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "");
        //console.log(transcriptCues[transcript]["cues"][cue]["text"]);
        transcript += cleanText;
        if(cue == 0) aliasCue["startIndex"] = transcript.length - cleanText.length;
        else if(cue != 0) aliasCue["startIndex"] = transcript.length - cleanText.length + 1;// NOTE set start index
        aliasCue["endIndex"] = transcript.length - 1; // NOTE set end index
      }
      aliasVideo["transcript"] = transcript // NOTE define entire transcript string
      var aliasStats = aliasVideo["info"]["statistics"];
      aliasVideo["relevantScore"] = (aliasStats["likeCount"] - aliasStats["dislikeCount"])/aliasStats["viewCount"];
      result.push(transcriptCues);
    }
}

async function run(){
    const b = await fileToJson('./dannyinput.txt');
    try{
      console.log("Sanitizing text...");
      const cleanedUpData = await sanitizeText(b);
      //console.log(JSON.parse(cleanedUpData));
      console.log("Doing search on sanitized text...");
      const searchResults = await search(b, "we're going");
      console.log("Sorting results...");
      await sortResults(searchResults);
      console.log(searchResults);
    }
    catch(error){
      console.log(error);
    }
}

run();

function median(values) {
    values.sort( function(a,b) {return a - b;} );
    var half = Math.floor(values.length/2);
    if(values.length % 2) return values[half];
    return (values[half-1] + values[half]) / 2.0;
}

function returnMedianViewCount(result){
  let viewCountArray = []; //NOTE make array of viewCounts and pass into median() to return median
  for(video in result){
    console.log(result);
    viewCountArray.push(result[video]["info"]["statistics"]["viewCount"]); //TODO error cannot read viewCount of undefined
  }
  return median(viewCountArray);
}

function sortResults(result){
    result.sort( function(a,b){ return b["relevantScore"]-a["relevantScore"]}); //NOTE sort based on relevant scores
    var median = returnMedianViewCount(result);
    var top50 = [];
    var bottom50 = [];
    for(video in result){
      var viewCount = result[video]["info"]["statistics"]["viewCount"];
      if(viewCount >= median) top50.push(result[video]);
      else bottom50.push(result[video]);
    }
}

function search(searchArray, toSearch){
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
    return results;
}
