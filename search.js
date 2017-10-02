var url;
var fuzzysearch = require('fuzzysearch');
var Fuse = require('fuse.js');
chrome.runtime.onMessage.addListener( function(request, sender, sendResponse) {
    if(request["toSearch"] != null){
      //console.log(sender.tab ? "from a content script:" + sender.tab.url : "from the extension");
      var lowerCaseToSearch = request["toSearch"].toLowerCase();
      if(request["transcript"] != null) var lowerCaseTranscript = request["transcript"].toLowerCase(); //make transcript lowercase
      search(lowerCaseToSearch, lowerCaseTranscript, request["title"], request["url"], request["transcriptCues"], request["toggle"], sendResponse);
      //request["toggle"] -> 0 = exact, 1 = loose, 2 = invideo
    }
    if(request["url"] != url){
      url = request["url"];
      server(request["toSearch"],  request["userid"], request["url"], 0, request["title"], request["transcriptCues"]);
    }
    else{
      server(request["toSearch"], request["userid"], request["url"], 1);
    }
});

function server(toSearch, userid, url, check, title, transcriptCues){
  chrome.identity.getProfileUserInfo(function(userInfo){
    var email = "-1";
    if(userInfo.email != "" && userInfo.email != null) email = userInfo.email;
    if (toSearch == null) toSearch = "-1";
    if(userid == null) userid = "-1";
    if(url == null) url = "-1";
    if(title == null) title = "-1";
    if(transcriptCues == null) transcriptCues = "-1";
    //console.log(JSON.stringify(transcriptCues));
    var xhttp = new XMLHttpRequest();
    console.log(check);
    if(check === 0){ //First time website send transcript
      xhttp.open("POST", "https://invideo.herokuapp.com/transcript");
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({"email": email, "userid": userid, "url": url, "title": title, "transcriptCues": transcriptCues}));
      xhttp.onreadystatechange = function() {
        if(xhttp.status == 200 && xhttp.readyState == 4) {
           console.log(xhttp.responseText);
        }
      }
    }
    else { //When you're searching for result
      xhttp.open("POST", "https://invideo.herokuapp.com/notranscript");
      xhttp.setRequestHeader("Content-type", "application/json");
      xhttp.send(JSON.stringify({"email": email, "toSearch": toSearch, "userid": userid, "url": url}));
      xhttp.onreadystatechange = function() {
        if(xhttp.status == 200 && xhttp.readyState == 4) {
           console.log(xhttp.responseText);
        }
      }
    }
  });
}

function search(toSearch, transcript, title, url, transcriptCues, toggle, sendResponse){
    //console.log(transcript, title, url, transcriptCues);
    //console.log(transcriptCues);
    if(toggle == 0) sendResponse(exactSearch(toSearch, transcript, title, url, transcriptCues));
    else if(toggle == 1) sendResponse(looseSearch(toSearch, transcript, title, url, transcriptCues));
    else if(toggle == 2) sendResponse(invideoSearch(exactSearch(toSearch, transcript, title, url, transcriptCues), looseSearch(toSearch, transcript, title, url, transcriptCues)));
}

function generateNewSearchDictionary(toSearch, transcript){
    var searchDictionary = [];
    var split = toSearch.trim().split(" ");
    var splitCount = (split[split.length-1] == "") ? split.length-1 : split.length;
    var indexCounter = 0;
    var count;
    while(transcript.split(" ").length > ((splitCount == 1) ? splitCount : splitCount - 1)){
      //Set dictionary with text
      var parts = transcript.split(" ");
      var text = "";
      for(var i = 0; i < splitCount - 1; i++){
        text += (parts[i] + " ");
      }
      text += parts[splitCount - 1];
      searchDictionary.push({"text": text, "textStart": indexCounter, "textEnd": indexCounter + text.length - 1});
      indexCounter += parts[0].length + 1;
      //Rejoin transcript
      parts.shift();
      if(parts instanceof Array){
        transcript = parts.join(" ");
      }
    }
    return searchDictionary;
}

function generateResult(toSearch, indices, transcriptCues, toggle){ // Goal: only return relevant cues based on indices match on transcript
    var resultDictionary = {}; //
    for(var index in indices){
        for(var timestamp in transcriptCues){
          if(transcriptCues[timestamp]["textStart"] <= indices[index] && transcriptCues[timestamp]["textEnd"] >= indices[index]){
              //console.log("EXACT- Inserting timestamp into resultDictionary", timestamp);
              resultDictionary[timestamp] = transcriptCues[timestamp]["text"];
          }
        }
    }
    //console.log(resultDictionary);
    var result = [];
    //Take out double counting because text is on edge of cue
    if(toggle === 0){
      for(cue in resultDictionary){
        var firstWord = toSearch.split(" ");
        if(resultDictionary[cue].toLowerCase().includes(firstWord[0])){
          result.push({"text": resultDictionary[cue], "timestamp": cue});
        }
      }
    }

    if (toggle === 1){ //loose'
      for(cue in resultDictionary){
        result.push({"text": resultDictionary[cue], "timestamp": cue});
      }
    }
    return result;
}

function exactSearch(toSearch, transcript, title, url, transcriptCues){
    var indices = []; // indexes in transcript where there is an exact match
    for(var pos = transcript.indexOf(toSearch); pos !== -1; pos = transcript.indexOf(toSearch, pos + 1)) {
        indices.push(pos);
    }
    return generateResult(toSearch, indices, transcriptCues, 0);
}

function looseSearch(toSearch, transcript, title, url, transcriptCues){ //return all the cues/indexes where there is a loose match
    var searchArray = generateNewSearchDictionary(toSearch, transcript);
    var indices = [];
    //console.log("LOOSE- searchArray", searchArray);
    //Fuse.js Search
    var options = {
      shouldSort: true,
      threshold: 0.3,
      location: 0,
      distance: 0,
      maxPatternLength: 65,
      minMatchCharLength: 1,
      keys: [
        "text"
      ]
    };
    var fuse = new Fuse(searchArray, options);
    var results = fuse.search(toSearch);
    //console.log("LOOSE- results", results);
    for(var result in results){
      indices.push(results[result]["textStart"]);
    }

/*
  //Fuzzysearch
    for (var search in searchArray){
      if(fuzzysearch(toSearch, searchArray[search]["text"])){
        indices.push(searchArray[search]["textStart"]);
      }
    }
    */
    return generateResult(toSearch, indices, transcriptCues, 1);
}

function invideoSearch(exactSearchResult, looseSearchResult){
  var exactSearchResultLength = exactSearchResult.length;
  var looseSearchResultLength = looseSearchResult.length;
  var invideoResult = []; //Invideo search is top 10 results from exactSearchResult and looseSearchResult where exactSearchResult has greater precedence
  //var allResult = exactSearchResult.splice(0) + looseSearchResult.splice(0); // All the search results

  if(exactSearchResultLength > 10){
    var alreadyInSet = {};
    while(invideoResult.length < 10){  //return a random 10 from exactSearchResult
      var randomIndex = Math.floor(Math.random() * exactSearchResultLength);
      if(alreadyInSet[randomIndex] != "undefined"){
        alreadyInSet[randomIndex] = true;
        invideoResult.push(exactSearchResult[randomIndex]);
      }
    }
  }
  else if(exactSearchResultLength === 10){
    invideoResult = exactSearchResult.slice(0);
  }
  else{
    invideoResult = exactSearchResult.slice(0);
    //TODO Random pick (10 - exactSearchResultLength) out of looseSearchResultLength that is not already in exactSearch
  }
  console.log("InvideoResult ", invideoResult);
  return invideoResult;
}
