var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  request = require('request'),
  gcloud = require('gcloud'),
  fs = require('fs'),
  sax = require('sax'),
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
  var currentNode = '',
    outDicomJson = {},
    parser = sax.parser(false, {
      trim: true
    });
    parser.onerror = function (err) {
  console.log(err);
};
  parser.ontext = function(text) {
    outDicomJson[currentNode] = text;
  };
  parser.onopentag = function(node) {
    currentNode = node.attributes.NAME;
  };
  parser.write(chunk.toString()).close();
  this.push(JSON.stringify(outDicomJson));
  cb();
};


// Call to Stream transform dicom xml to json
var dcm2json = Dcm2json(),
postjson = request.post('https://dicomwebpacs-tetraib-1.c9.io/v1/images/', {
  headers: {
    'content-type': 'application/json'
  }
});
fs.createReadStream('test.xml').pipe(dcm2json).pipe(postjson);
postjson.on('error', function(err) {
  console.log(err);
});
dcm2json.on('error', function(err) {
  console.log(err);
});



//
//
// Function to convert Xml dicom stream to json
var dcmxml2json = function(xmlStreamIn, callback) {
  var currentNode = '',
    outDicomJson = {},
    saxStream = sax.createStream(false, {
      trim: true
    });
  xmlStreamIn.pipe(saxStream);
  saxStream.on('error', function(err) {
    console.error('error!', err);
    // clear the error
    this._parser.error = null;
    this._parser.resume();
  });
  // Extract only usefull info from xml
  saxStream.on('opentag', function(node) {
    currentNode = node.attributes.NAME;
  });
  saxStream.on('text', function(text) {
    outDicomJson[currentNode] = text;
  });
  saxStream.on('end', function() {
    callback(outDicomJson);
  });
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
  // Read xml data from dicom
  var dicomFile = req.body.file,
    dicomDataUrl = 'https://dicomwebpacs-tetraib-1.c9.io/v1/images/',
    dcm2xml = process.spawn('./dcm2xml', [dicomFile]);
  dcm2xml.on('error', function(err) {
    console.log(err);
    res.status('500').end();
  });
  dcmxml2json(dcm2xml.stdout, function(dcmjson) {
    // Post dicom data to remote server
    request.post(dicomDataUrl, {
      json: dcmjson
    }, function(error, response, body) {
      if (error) {
        console.log(error);
        res.status('500').end();
      } else if (response.statusCode == 201) {
        // Read image from dicom file
        var dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '90', dicomFile]);
        dcmj2pnm.on('error', function(err) {
          console.log(err);
          res.status('500').end();
        });
        // Send image to cloud storage
        dicom2Gcs(dcmj2pnm.stdout, dcmjson.SOPInstanceUID + '.jpg', 'dicom', function(err) {
          if (err) {
            console.log(err);
            res.status('500').end();
          } else {
            res.status('201').end();
            // TODO--> post ok to remote image route
          }
        });
      } else {
        console.log('Remote responded with : ' + response.statusCode);
        res.status('500').end();
      }
    });
  });
});
app.listen(8080);
