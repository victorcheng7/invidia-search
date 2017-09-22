var fs = require('fs');
//fs.readFileSync(path.join(__dirname), 'utf8');
//function fileToJson(the file) -> JSON object
// function()

var readFilePromise = new Promise((resolve, reject) => {
  fs.readFile('./1505974203282.txt', 'utf8', function (err,data) {
    if (err) reject(console.log(err));
    resolve(JSON.parse(data));
  });
});
readFilePromise.then((data) => {
  console.log(data.length);
  resolve("yo")
}).catch((err)=> {
  console.log(err);
}).then((data)=> console.log(data))
/*
var yo = new Promise((resolve, reject) => {
  resolve("yo");
})
yo.then((data) => console.log(data))


Promise.all([readFilePromise, yo]);
*/
