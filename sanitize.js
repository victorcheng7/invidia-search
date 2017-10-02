var fs = require('fs');
var Fuse = require('fuse.js');
var h2p = require('html2plaintext');

function fileToJson(file){ //file -> javascript object
  return new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err,data) {
      if (err) reject(console.log(err));
      console.log(JSON.parse(data)[0]);
      resolve(JSON.parse(data));
    });
  });
}

function milliSecondsToTimeStamp(milliseconds){
    let seconds = Math.floor((milliseconds/1000) % 60);
    let minutes = Math.floor((milliseconds/(1000*60)) % 60);
    let hours = Math.floor((milliseconds/(1000*60*60)) % 24);
    if(seconds < 10) return hours+":"+minutes+":0"+seconds;
    return result[hours+":"+minutes+":"+seconds];
}

function sanitizeText(data){ // Output Sanitized Text
    var transcriptCues = Object.assign({}, data);
    for(video in transcriptCues){//  For every video
      var transcript = "";
      var transcriptLength = 0;
      var index = 0;
      var milliseconds = 0;
      var aliasVideo = transcriptCues[video];
      for(cue in aliasVideo["cues"]){ //  for every cue
        var aliasCue = aliasVideo["cues"][cue];
        milliseconds += aliasCue["duration"];
        aliasCue["timestamp"] = milliSecondsToTimeStamp(milliseconds) // NOTE Set timestamp
        var cleanText = h2p(aliasCue["text"]); // NOTE take out HTML tags
        aliasCue["text"] = cleanText;
        //console.log(transcriptCues[transcript]["cues"][cue]["text"]);
        //let temp = transcriptCues[transcript]["cues"][cue]["text"];
        //transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "").replace('&#39;'/g, "'");
        //transcriptCues[transcript]["cues"][cue]["text"] = temp.replace(/<[^>]*>/g, "");
        //console.log(transcriptCues[transcript]["cues"][cue]["text"]);
        transcript += (cleanText + " ");
        aliasCue["startIndex"] = transcript.length - cleanText.length; // NOTE set start index
        aliasCue["endIndex"] = transcript.length - 1; // NOTE set end index
      }
      aliasVideo["transcript"] = transcript // NOTE define entire transcript string
      var aliasStats = aliasVideo["info"]["statistics"];
      aliasVideo["relevantScore"] = (aliasStats["likeCount"] - aliasStats["dislikeCount"])/aliasStats["viewCount"];
    }
    return transcriptCues;
}

async function run(){
    const b = await fileToJson('./dannyinput.txt');
    await console.log(sanitizeText(b)[0]);
    //search(cleanedUpData);
    return b; //TODO the actual json sorted for the front end to render
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
  for(video in newResult){
    viewCountArray.push(newResult[video]["statistics"]["viewCount"]);
  }
  return median(viewCountArray);
}

function sortResults(result){
    newResult.sort( function(a,b){ return b["relevantScore"]-a["relevantScore"]}); //NOTE sort based on relevant scores
    var median = returnMedianViewCount(result);
    var top50 = [];
    var bottom50 = [];
    for(video in result){
      var viewCount = result[index]["info"]["statistics"]["viewCount"];
      if(viewCount >= median) top50.push(result[index]);
      else bottom50.push(result[index]);
    }
}

function search(searchArray, toSearch){
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
    var results = fuse.search("ingrdients");
    console.log(results.length);
}
