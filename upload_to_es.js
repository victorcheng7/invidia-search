var path = require('path');
var fs = require('fs');
var Promise = require("bluebird");
var dotenv = require('dotenv');
var elasticsearch = require('elasticsearch');

let files = 0;
/* DEFINE ELASTIC_SEARCH

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
	host: process.env.ELASTIC_HOST,
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
										readFile('output.txt');
                    if( stat.isFile() )
                        console.log( "'%s' is a file.", fromPath );

                } );
        } );
	} );
}

function deleteClusterIndices() {
	client.indices.delete({
	    index: '_all'
	}, function(err, response) {
		console.log(`Response from delete: ${response}`);
	});
}

function testConnectionToClient() {
	client.ping({
		requestTimeout: 100000,
	}, function (error) {
		if (error) {
			console.error('Elasticsearch cluster is down!');
			console.log(error);
		} else {
			console.log('Elasticsearch cluster is connected.');
		}
	});
}

function readFile(filename) {
	return new Promise((resolve, reject) => {
		fs.readFile(filename, 'utf8', function(err, data) {
		  if (err) throw err;
			var videoCaptionData = JSON.parse(data);
			let caption_parts = videoCaptionData.map((captionData) => {
				return new Promise((resolve, reject) => {
					sendVideoDataToClient(captionData, resolve);
				});
			});

			Promise.all(caption_parts)
			.then(() => {
				console.log("About to resolve upper promise");
				resolve();
			});
		});
	});
}

let writeStream = fs.createWriteStream("upload_log.txt");

function sendVideoDataToClient(data, resolve) {
	if (!data) return resolve();
	client.index({
	  index: 'youtube-video-data-index',
	  type: 'caption-data',
	  id: data.video_id,
	  body: JSON.stringify(data)
	}, function (error, response) {
		error ? writeStream.write(JSON.stringify(error)) : console.log(`Finished uploading ${++files}`);
		resolve();
	});
}

testConnectionToClient();

//deleteClusterIndices();
//readFile('output.txt');



fs.readdir( "./dump/other", (err, files) => {
	(function loopRead(fileIndex = 0) {
		if(fileIndex >= files.length) return console.log(files.length);
		readFile("./dump/reactjs/" + files[fileIndex])
		.then(() => {
			setTimeout(function() {
				loopRead(++fileIndex);
			}, 200);
		});
	})();
});
