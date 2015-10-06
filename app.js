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
  var dicomFile = req.body.file,
  // Options for request http POST xml
    postJsonOpt = {
      url: 'https://dicomwebpacs-tetraib-1.c9.io/v1/images/',
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      }
    },
    // Read xml data from dicom
    dcm2xml = process.spawn('./dcm2xml', ['--quiet', '+Ca', 'latin-1', dicomFile]);

  dcm2xml.on('error', function(err) {
    console.log(err);
  });
// New XML parser
  var parser = new expat.Parser('UTF-8'),
    currentAttrs = '',
    first = true,
    // Read Stream to push JSON from XML
    rs = new stream.Readable();
  rs._read = function() {};
  rs.on('error', function(err) {
    console.error(err);
  });

  parser.on('startElement', function(name, attrs) {
    // Get current XML NODE
    if (attrs.name) {
      currentAttrs = attrs.name.trim();
    }
  });
  parser.on('text', function(text) {
    // Push JSON to read stream
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

  dcm2xml.stdout.pipe(parser);
  rs.pipe(request(postJsonOpt).on('error', function(err) {
    console.log(err);
  }).on('response', function(response) {
    /**
     *
     * Treat image
     */
    if(response.statusCode=='201'){
      // Options for request http PUT image
      var putImageOpt = {
          url: 'https://dicomwebpacs-tetraib-1.c9.io/v1/images/123/',
          method: 'PUT'
        },
        // Create jpeg from dicom image
        dcmj2pnm = process.spawn('./dcmj2pnm', ['--quiet', '--write-jpeg', '--compr-quality', '90', dicomFile]),
        // Optimize jpeg with jpegtran
        myJpegTranslator = new JpegTran(['-progressive', '-optimize', '-copy', 'none']);

      dcmj2pnm.on('error', function(err) {
        console.log(err);
      });
      myJpegTranslator.on('error', function(err) {
        console.log(err);
      });

      dcmj2pnm.stdout.pipe(myJpegTranslator).pipe(request(putImageOpt).on('error', function(err) {
        console.log(err);
      }));
    }
  }));
  res.status('202').end();

});
app.listen(8080);
