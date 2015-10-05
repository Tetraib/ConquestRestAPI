var express = require('express'),
  app = express(),
  mysql = require('mysql'),
  bodyParser = require('body-parser'),
  request = require('request'),
  JpegTran = require('jpegtran'),
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
  });
app.use(bodyParser.json());
/**
 *
 * Home Route
 */
app.get('/', function(req, res) {
  res.status('200').send('ConquestRestAPI is running...');
});
/**
 *
 * Routes for worklist management
 */
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
/**
 *
 * Route to Forward DICOM
 */
app.post('/v1/dicoms/', function(req, res) {
  //
  // Read xml data from dicom
  var dicomFile = req.body.file,
    dcm2xml = process.spawn('./dcm2xml', ['--quiet', dicomFile]);

  dcm2xml.on('error', function(err) {
    console.log(err);
  });

  var parser = new expat.Parser('UTF-8'),
    currentAttrs = '',
    first = true,
    rs = new stream.Readable();
  rs._read = function() {};
  rs.on('error', function(err) {
    console.error(err);
  });

  parser.on('startElement', function(name, attrs) {
    if (attrs.name) {
      currentAttrs = attrs.name.trim();
    }
  });
  parser.on('text', function(text) {
    if (currentAttrs && text && text.trim()) {
      if (first) {
        rs.push('{' + JSON.stringify(currentAttrs) + ' : ' + JSON.stringify(text));
        first = false;
      } else {
        rs.push(',' + JSON.stringify(currentAttrs) + ' : ' + JSON.stringify(text));
      }
    }
  });

  parser.on('end', function() {
    rs.push('}');
    rs.push(null);
  });

  parser.on('error', function(err) {
    console.error(err);
  });

  var postjson = request('https://dicomwebpacs-tetraib-1.c9.io/v1/images/', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    }
  });

  dcm2xml.stdout.pipe(parser);
  rs.pipe(postjson);


  postjson.on('error', function(err) {
    console.error(err);
  });

  /**
   *
   * Treat image
   */
  var putimage = request('https://dicomwebpacs-tetraib-1.c9.io/v1/images/1010/', {
      method: 'PUT'
    }),
    dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '90', dicomFile]),
    myJpegTranslator = new JpegTran(['-progressive', '-optimize', '-copy', 'none']);

  dcmj2pnm.stdout.pipe(myJpegTranslator).pipe(putimage);

  dcmj2pnm.on('error', function(err) {
    console.log(err);
  });
  putimage.on('error', function(err) {
    console.log(err);
  });
  myJpegTranslator.on('error', function(err) {
    console.log(err);
  });

  res.status('202').end();

});
app.listen(8080);
