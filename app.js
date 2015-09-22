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

  //Cloud storage connection param
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
  // Make an json from xml to send only usefull info
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
//
//
//Routes to handles worklist
app.get('/', function(req, res) {
  res.status("200").send('ConquestRestAPI is running...');
});

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
    request.post(dicomDataUrl, {
      json: dcmjson
    }, function(error, response, body) {
      if(error){
        console.log(error);
        res.status("500").end();
      }else if (response.statusCode == 201) {
        // Read image from dicom
        var dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '50', dicomFile]),
          // Send image to cloud storage
          bucket = gcs.bucket('dicom'),
          remoteWriteStream = bucket.file(dicomFile + ".jpg").createWriteStream();
        dcmj2pnm.stdout.pipe(remoteWriteStream);
        //
        dcmj2pnm.on('error', function(err) {
          console.log(err);
          res.status("500").end();
        });
        remoteWriteStream.on('error', function(err) {
          console.log(err);
          res.status("500").end();
        });
        // Send 201 when all done
        remoteWriteStream.on('finish', function() {
          res.status("201").end();
        });
      }
    });
  });

});

app.listen(8080);
