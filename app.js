var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  request = require('request'),
  gcloud = require('gcloud'),
  fs = require('fs'),
  sax = require("sax"),
  process = require('child_process'),
  //Conquest Mysql database
  mysqlPool = mysql.createPool({
    host: '127.0.0.1',
    user: 'root',
    password: 'user',
    database: 'conquest'
  }),
  //Google Cloud Storage Param
  gcs = gcloud.storage({
    keyFilename: './CloudDicom-1f0d0f461c12.json',
    projectId: 'axiomatic-math-616'
  });

app.use(bodyParser.json());
//
//
//Function to convert Xml dicom stream to json
var dcmxml2json = function(xmlStreamIn, callback) {
  var currentNode = "",
    outDicomJson = {},
    saxStream = sax.createStream(false, {
      trim: true
    });
  xmlStreamIn.pipe(saxStream);
  saxStream.on("error", function(err) {
    console.error("error!", err);
    // clear the error
    this._parser.error = null;
    this._parser.resume();
  });
  // Extract only usefull info from xml
  saxStream.on("opentag", function(node) {
    currentNode = node.attributes.NAME;
  });
  saxStream.on("text", function(text) {
    outDicomJson[currentNode] = text;
  });
  saxStream.on("end", function() {
    callback(outDicomJson);
  });
};
// Function to send FileStream to Google Cloud Storage
var dicom2Gcs = function(inFileStream, fileName, bucket, callback) {
  var gcsbucket = gcs.bucket(bucket),
    remoteWriteStream = gcsbucket.file(fileName).createWriteStream();
  inFileStream.pipe(remoteWriteStream);
  remoteWriteStream.on('error', function(err) {
    console.log(err);
  });
  remoteWriteStream.on('finish', function() {
    callback();
  });
};
//
//
//Home Route
app.get('/', function(req, res) {
  res.status("200").send('ConquestRestAPI is running...');
});
//
//
//Routes to handles worklist
app.get('/v1/patients', function(req, res) {
  //Return patient list
  res.status("200").send('Return patient list');
});

app.post('/v1/patients', function(req, res) {
  //Create patient
  mysqlPool.getConnection(function(err, connection) {
    if (err) {
      console.log(err);
      res.status("500").end();
    } else {
      connection.query('INSERT INTO DICOMWorkList SET ?', req.body, function(err, result) {
        if (err) {
          console.log(err);
          res.status("500").end();
        } else {
          res.status("201").end();
        }
      });
      connection.release();
    }
  });
});
app.get('/v1/patients/:Id', function(req, res) {
  //Return patient data
});
app.put('/v1/patients/:Id', function(req, res) {
  //Update patient data
});
app.delete('/v1/patients/:Id', function(req, res) {
  //Delete patient
});
//
//
// Routes to handle Forward DICOM
app.post('/v1/dicoms/', function(req, res) {
  // Read xml data from dicom
  var dicomFile = req.body.file,
    dicomDataUrl = 'https://dicomwebpacs-tetraib-1.c9.io/v1/images/',
    dcm2xml = process.spawn('./dcm2xml', [dicomFile]);
  dcm2xml.on('error', function(err) {
    console.log(err);
    res.status("500").end();
  });
  dcmxml2json(dcm2xml.stdout, function(dcmjson) {
    //Post dicom data to remote server
    request.post(dicomDataUrl, {
      json: dcmjson
    }, function(error, response, body) {
      if (error) {
        console.log(error);
        res.status("500").end();
      } else if (response.statusCode == 201) {
        // Read image from dicom file
        var dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '50', dicomFile]);
        dcmj2pnm.on('error', function(err) {
          console.log(err);
          res.status("500").end();
        });
        // Send image to cloud storage
        dicom2Gcs(dcmj2pnm.stdout, dcmjson.SOPInstanceUID + ".jpg", 'dicom', function() {
          res.status("201").end();
        });
      }
    });
  });
});

app.listen(8080);
