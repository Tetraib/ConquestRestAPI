var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  request = require('request'),

  gcloud = require('gcloud'),
  fs = require('fs'),
  sax = require('sax'),
  expat = require('node-expat'),
  libxml = require("libxmljs"),
  process = require('child_process'),
  util = require('util'),
  stream = require('stream'),
  // Conquest Mysql database
  mysqlPool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'user',
    database: 'conquest'
  }),
  // Google Cloud Storage Param
  gcs = gcloud.storage({
    keyFilename: './CloudDicom-1f0d0f461c12.json',
    projectId: 'axiomatic-math-616'
  });

app.use(bodyParser.json());

//
// Stream transform dicom xml to json
var Transform = stream.Transform;

function Dcm2json(options) {
  // allow use without new
  if (!(this instanceof Dcm2json)) {
    return new Dcm2json(options);
  }
  // init Transform
  Transform.call(this, options);
}
util.inherits(Dcm2json, Transform);

Dcm2json.prototype._transform = function(chunk, enc, cb) {
this.test='hello';
var  string ='',
  first=true;
  this.parser = new libxml.SaxPushParser();

  this.parser.on('startElementNS',function(elem, attrs, prefix, uri, namespace){
    console.log('elem',elem);
    console.log('attrs',attrs);
  });
  this.parser.on('characters',function(char){
    console.log('char',char);
  });

this.parser.on('error',function(err){
  console.log('err',err);
});
  this.parser.push(chunk.toString());

this.push(string);

  cb();




  // saxStream.on('opentag', function(node) {
  //   currentNode = node.attributes.NAME;
  // });
  // saxStream.on('text', function(text) {
  //   outDicomJson[currentNode] = text;
  // });
  //
  //
  // if(first){
  //       string='{'+JSON.stringify(currentNode)+':'+JSON.stringify(text);
  //       first=false;
  //       }else{
  //
  //           string+=','+JSON.stringify(currentNode)+':'+JSON.stringify(text);
  //
  //
  //         }

//   var currentNode = '',
//   string ='',
//   first=true,
//   parser = new expat.Parser('UTF-8');
//
//   parser.on('error', function (error) {
//     console.error("ERROR:",error);
//   });
//
//   parser.on('startElement',function(name, attrs) {
//     currentNode = attrs.name;
//     console.log(attrs.name);
//   });
// parser.on('text', function(text) {
//
//     if(first){
//       string='{'+JSON.stringify(currentNode)+':'+JSON.stringify(text);
//       first=false;
//       }else{
//         if(text!='\n'){
//           string+=','+JSON.stringify(currentNode)+':'+JSON.stringify(text);
//         }
//
//         }
//   });
//   parser.write('<root>'+chunk.toString());

//
//

};
Dcm2json.prototype._flush = function (cb) {
    this.push('}');
    console.log(this.test);
  cb();
};





// Function to send FileStream to Google Cloud Storage
var dicom2Gcs = function(inFileStream, fileName, bucket, callback) {
  var gcsbucket = gcs.bucket(bucket),
    remoteWriteStream = gcsbucket.file(fileName).createWriteStream();
  inFileStream.pipe(remoteWriteStream);
  remoteWriteStream.on('error', function(err) {
    callback(err);
  });
  remoteWriteStream.on('finish', function() {
    callback(null);
  });
};
//
//
// Home Route
app.get('/', function(req, res) {
  res.status('200').send('ConquestRestAPI is running...');
});
//
//
// Routes for worklist management
app.get('/v1/patients', function(req, res) {
  // Return patient list
  res.status('200').send('Return patient list');
});
app.post('/v1/patients', function(req, res) {
  // Create patient
  mysqlPool.getConnection(function(err, connection) {
    if (err) {
      console.log(err);
      res.status('500').end();
    } else {
      connection.query('INSERT INTO DICOMWorkList SET ?', req.body, function(err, result) {
        if (err) {
          console.log(err);
          res.status('500').end();
        } else {
          res.status('201').end();
        }
      });
      connection.release();
    }
  });
});
app.get('/v1/patients/:Id', function(req, res) {
  // Return patient data
});
app.put('/v1/patients/:Id', function(req, res) {
  // Update patient data
});
app.delete('/v1/patients/:Id', function(req, res) {
  // Delete patient
});
//
//
// Route to Forward DICOM
app.post('/v1/dicoms/', function(req, res) {
//
  console.log("NEW REQ !!");
  // Read xml data from dicom
  var dicomFile = req.body.file,
    dicomDataUrl = 'https://dicomwebpacs-tetraib-1.c9.io/v1/images/',
    dcm2xml = process.spawn('./dcm2xml', ['--quiet','--read-file-only',dicomFile]);
  dcm2xml.on('error', function(err) {
    console.log(err);
    res.status('500').end();
  });

  // Call to Stream transform dicom xml to json
  var dcm2json = new Dcm2json(),
    postjson = request(dicomDataUrl, {
    method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    });
test3='{';
test4='"hello":"test"';
test5='}';

var rs = new stream.Readable();
rs.push(test3);
rs.push(test4);
rs.push(test5);
rs.push(null);

rs.pipe(postjson);
  // dcm2xml.stdout.pipe(dcm2json).pipe(postjson);
  // .pipe(test2);
  // .pipe(postjson);

  dcm2json.on('error', function(err) {
    console.log(err);
  });
  postjson.on('error', function(err) {
    console.log(err);
  });
  postjson.on('response', function(response) {
    console.log(response.statusCode); // 200

    var dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '90', dicomFile]);
    dcmj2pnm.on('error', function(err) {
      console.log(err);
      res.status('500').end();
    });
  });
});
app.listen(8080);
