var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  request = require('request'),

  gcloud = require('gcloud'),
  fs = require('fs'),
  sax = require('sax'),
  expat = require('node-expat'),
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
    dcm2xml = process.spawn('./dcm2xml', ['--quiet',dicomFile]);
  dcm2xml.on('error', function(err) {
    console.log(err);
    res.status('500').end();
  });

var parser = new expat.Parser('UTF-8');
var currentAttrs='';
var first = true;
var rs = new stream.Readable();
rs._read = function () {};

parser.on('startElement', function (name, attrs) {
  if(attrs.name){
    currentAttrs=attrs.name.trim();
  }
  });
  parser.on('text', function (text) {
    if(currentAttrs && text && text.trim()){
      if(first){
        rs.push('{'+JSON.stringify(currentAttrs)+' : '+JSON.stringify(text));
        first=false;

      }else{
        rs.push(','+JSON.stringify(currentAttrs)+' : '+JSON.stringify(text));
      }
    }
  });

  parser.on('error', function (error) {
    console.error(error);
  });

  parser.on('end', function () {
    console.error('end');



    rs.push('}');
    rs.push(null);
    first=true;


});

  // Call to Stream transform dicom xml to json
  var postjson = request(dicomDataUrl, {
    method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    });




dcm2xml.stdout.pipe(parser);
rs.pipe(postjson);
rs.on('error', function (error) {
  console.error(error);
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
